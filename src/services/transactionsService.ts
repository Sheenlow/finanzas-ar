import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { accountsService } from './accountsService';
import { getBillingMonthFromRules, getBillingMonthFromCycle } from '@/lib/utils';

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  if (result.getMonth() !== (targetMonth % 12 + 12) % 12) {
    result.setDate(0);
  }
  return result;
}

async function resolveBillingMonth(
  supabase: SupabaseClient,
  paymentMethod: string | undefined,
  accountId: string | undefined,
  transactionDate: string | Date
): Promise<string | null> {
  if (paymentMethod !== 'card' || !accountId) return null;
  try {
    const card = await accountsService.getCreditCard(supabase, accountId);
    if (!card) return null;

    const cycle = await accountsService.findClosestBillingCycle(
      supabase,
      card.id,
      typeof transactionDate === 'string' ? transactionDate : transactionDate.toISOString()
    );
    if (cycle) {
      return getBillingMonthFromCycle(transactionDate, cycle.close_date);
    }

    return getBillingMonthFromRules(transactionDate, card.closing_rule, card.closing_day);
  } catch {}
  return null;
}

type Transaction = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

export const transactionsService = {
  async getAll(supabase: any, userId: string, sortField: string = 'transaction_date') {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, accounts!transactions_account_id_fkey(name), categories(name)')
      .eq('user_id', userId)
      .order(sortField, { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getHouseholdTransactions(supabase: any, householdId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, accounts!transactions_account_id_fkey(name), categories(name), household_share_records(count)')
      .eq('household_id', householdId)
      .order('transaction_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  async create(supabase: any, transaction: TransactionInsert) {
    const billingMonth = await resolveBillingMonth(
      supabase,
      transaction.payment_method,
      transaction.account_id,
      transaction.transaction_date || new Date()
    );

    const { data: newTransaction, error: insertError } = await supabase
      .from('transactions')
      .insert([{ ...transaction, billing_month: billingMonth }])
      .select()
      .single();
    
    if (insertError) throw insertError;

    // Actualizar saldo de cuenta
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', transaction.account_id)
      .single();
    
    if (!accountError) {
      const amount = parseFloat(transaction.amount.toString());
      const newBalance = transaction.type === 'income' 
        ? parseFloat(account.balance) + amount 
        : parseFloat(account.balance) - amount;
        
      await accountsService.update(supabase, transaction.account_id, { balance: newBalance });
    }
    
    return newTransaction as Transaction;
  },

  async createInstallments(supabase: any, transaction: TransactionInsert, totalInstallments: number) {
    const { id: _, ...transactionBase } = transaction;
    const baseDate = new Date(transaction.transaction_date || new Date());

    const billingMonth = await resolveBillingMonth(
      supabase,
      transaction.payment_method,
      transaction.account_id,
      baseDate
    );

    // 1. Insert parent (1st installment)
    const { data: parent, error: parentError } = await supabase
      .from('transactions')
      .insert([{
        ...transactionBase,
        amount: transaction.amount / totalInstallments,
        transaction_date: baseDate.toISOString(),
        billing_month: billingMonth,
        is_installment: true,
        installments_total: totalInstallments,
        installment_number: 1,
      }])
      .select('id')
      .single();
    
    if (parentError) throw parentError;
    const parentId = parent.id;

    // 2. Insert children con billing_month calculado para cada fecha futura
    const childTransactions = [];
    for (let i = 1; i < totalInstallments; i++) {
      const installmentDate = addMonths(baseDate, i);
      const childBillingMonth = await resolveBillingMonth(
        supabase,
        transaction.payment_method,
        transaction.account_id,
        installmentDate
      );

      childTransactions.push({
        ...transactionBase,
        amount: transaction.amount / totalInstallments,
        transaction_date: installmentDate.toISOString(),
        billing_month: childBillingMonth,
        is_installment: true,
        installments_total: totalInstallments,
        installment_number: i + 1,
        parent_transaction_id: parentId,
      });
    }

    const { error: childError } = await supabase
      .from('transactions')
      .insert(childTransactions);

    if (childError) throw childError;

    // Actualizar saldo de cuenta (solo la primera cuota)
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', transaction.account_id)
      .single();
    
    if (!accountError) {
      const firstInstallmentAmount = parseFloat((transaction.amount / totalInstallments).toString());
      const newBalance = transaction.type === 'income' 
        ? parseFloat(account.balance) + firstInstallmentAmount 
        : parseFloat(account.balance) - firstInstallmentAmount;
        
      await accountsService.update(supabase, transaction.account_id, { balance: newBalance });
    }
    
    return [parent, ...childTransactions];
  },

  async delete(supabase: any, id: string) {
    // Obtener transacción antes de borrar
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('account_id, amount, type, is_installment, installment_number')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;

    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;

    // Revertir saldo solo si fue la primera cuota (o una transacción normal)
    if (!transaction.is_installment || transaction.installment_number === 1) {
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', transaction.account_id)
        .single();
      
      if (!accountError) {
        const amount = parseFloat(transaction.amount.toString());
        const newBalance = transaction.type === 'income' 
          ? parseFloat(account.balance) - amount 
          : parseFloat(account.balance) + amount;
           
        await accountsService.update(supabase, transaction.account_id, { balance: newBalance });
      }
    }
  },


  async update(supabase: any, id: string, updates: TransactionUpdate) {
    // Recalcular billing_month si cambió payment_method, account_id o transaction_date
    if (
      updates.payment_method !== undefined ||
      updates.account_id !== undefined ||
      updates.transaction_date !== undefined
    ) {
      const { data: current } = await supabase
        .from('transactions')
        .select('payment_method, account_id, transaction_date')
        .eq('id', id)
        .single();

      const effectivePaymentMethod = updates.payment_method ?? current?.payment_method;
      const effectiveAccountId = updates.account_id ?? current?.account_id;
      const effectiveDate = updates.transaction_date ?? current?.transaction_date;

      const billingMonth = await resolveBillingMonth(
        supabase,
        effectivePaymentMethod,
        effectiveAccountId,
        effectiveDate || new Date()
      );

      (updates as any).billing_month = billingMonth;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Transaction;
  },
};

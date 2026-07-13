import { createClient } from '@/lib/supabase/server';
import { transactionsService } from '@/services/transactionsService';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
const TransactionForm = dynamic(() => import('@/components/forms/TransactionForm').then(m => ({ default: m.TransactionForm })));
const TransactionItem = dynamic(() => import('@/components/TransactionItem'));
const RecurringExpenses = dynamic(() => import('@/components/RecurringExpenses').then(m => ({ default: m.RecurringExpenses })));

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const transactions = await transactionsService.getAll(supabase, user.id, 'created_at');
  
  // Group installments and subscriptions for display
  const groupedTransactions = transactions.reduce((acc: any[], t: any) => {
    if (t.parent_transaction_id && t.id !== t.parent_transaction_id) {
        // It's a child (installment or subscription), ignore for display as a separate transaction
        return acc;
    }
    acc.push(t);
    return acc;
  }, []);

  // Fetch recurring expenses (subscriptions, services, Servicios category)
  const { data: recurring } = await supabase
    .from('transactions')
    .select('*, accounts!transactions_account_id_fkey(name), categories!inner(name)')
    .eq('user_id', user.id)
    .eq('is_installment', false)
    .is('parent_transaction_id', null)
    .or('type.eq.subscription,type.eq.service,categories.name.eq.Servicios')
    .order('transaction_date', { ascending: false });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Consumos</h1>
      
      <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
        <section>
          <TransactionForm userId={user.id} />
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-4">Últimos consumos</h2>
          <div className="space-y-4">
            {groupedTransactions.map((transaction: any) => (
              <TransactionItem key={transaction.id} transaction={transaction} userId={user.id} />
            ))}
          </div>
        </section>
      </div>

      <RecurringExpenses recurring={recurring || []} userId={user.id} />
    </div>
  );
}

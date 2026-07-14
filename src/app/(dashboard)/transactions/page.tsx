import { createClient } from '@/lib/supabase/server';
import { transactionsService } from '@/services/transactionsService';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
const QuickTransactionInput = dynamic(() => import('@/components/forms/QuickTransactionInput').then(m => ({ default: m.QuickTransactionInput })));
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

  const groupedTransactions = transactions.reduce((acc: any[], t: any) => {
    if (t.parent_transaction_id && t.id !== t.parent_transaction_id) {
      return acc;
    }
    acc.push(t);
    return acc;
  }, []);

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

      <section className="mb-6">
        <QuickTransactionInput userId={user.id} />
      </section>

      <details className="mb-6 group">
        <summary className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform text-[10px]">&#9654;</span>
          Modo avanzado
        </summary>
        <div className="mt-4">
          <TransactionForm userId={user.id} />
        </div>
      </details>

      <section>
        <h2 className="text-xl font-semibold mb-4">Últimos consumos</h2>
        <div className="space-y-4">
          {groupedTransactions.map((transaction: any) => (
            <TransactionItem key={transaction.id} transaction={transaction} userId={user.id} />
          ))}
        </div>
      </section>

      <RecurringExpenses recurring={recurring || []} userId={user.id} />
    </div>
  );
}

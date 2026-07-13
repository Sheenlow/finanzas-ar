import { createClient } from '@/lib/supabase/server';
import { accountsService } from '@/services/accountsService';
import { redirect } from 'next/navigation';
import { AccountForm } from '@/components/forms/AccountForm';
import { AccountItem } from '@/components/AccountItem';

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const accounts = await accountsService.getAll(supabase, user.id);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Mis Cuentas</h1>
      
      <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
        <section>
          <AccountForm userId={user.id} />
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-4">Cuentas Existentes</h2>
          <div className="space-y-4">
            {accounts.map((account) => (
              <AccountItem key={account.id} account={account} userId={user.id} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

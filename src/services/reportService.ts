import { Database } from '@/types/database.types';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type TransactionWithCategory = Transaction & { categories?: { name: string } | null };

export const reportService = {
  getFixedExpenses(transactions: Transaction[]) {
    // 1. Filtrar transacciones de gastos fijos (Padres o únicos)
    const fixedExpenses = (transactions as TransactionWithCategory[]).filter(t => 
      (t.type === 'subscription' || t.type === 'service' || t.is_installment === true ||
       t.categories?.name === 'Servicios') &&
      (!t.parent_transaction_id || t.id === t.parent_transaction_id)
    );

    // 2. Agrupar por mes
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const monthLabel = new Date(0, i).toLocaleString('es-ES', { month: 'long' });
        return {
            month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
            amount: 0
        };
    });

    fixedExpenses.forEach(t => {
      const transDate = t.payment_method === 'card' && t.billing_month
        ? (() => {
            const [year, month] = t.billing_month.split('-').map(Number);
            return new Date(year, month - 1, 1);
          })()
        : new Date(t.transaction_date);

      const endMonth = t.is_installment 
        ? Math.min(transDate.getMonth() + t.installments_total, 12)
        : 12;

      const frequencyMultiplier = t.subscription_frequency === 'annual' ? 1 
                                : t.subscription_frequency === 'biannual' ? 2 
                                : t.subscription_frequency === 'quarterly' ? 4 
                                : 12; // monthly default

      for (let i = transDate.getMonth(); i < endMonth; i++) {
        if (t.is_installment) {
            monthlyData[i].amount += t.amount; // t.amount ya es el monto de la cuota
        } else {
            const interval = 12 / frequencyMultiplier;
            if ((i - transDate.getMonth()) % interval === 0) {
              monthlyData[i].amount += t.amount;
            }
        }
      }
    });

    return {
      items: fixedExpenses,
      monthlyData
    };
  }
};

import { BudgetsList } from '@/components/budgets/BudgetsList';

export default function BudgetsPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Budgets & Goals</h1>
      <p className="text-sm text-text-muted">Month-to-date spend per category. Goals land in a later phase.</p>
      <BudgetsList />
    </div>
  );
}

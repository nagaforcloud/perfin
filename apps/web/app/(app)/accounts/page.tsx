import { AccountsGrid } from '@/components/accounts/AccountsGrid';

export default function AccountsPage() {
  return (
    <div className="p-8 max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <AccountsGrid />
    </div>
  );
}

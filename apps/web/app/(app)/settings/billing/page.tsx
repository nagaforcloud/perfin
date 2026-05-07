import { BillingPanel } from '@/components/settings/BillingPanel';

export default function SettingsBillingPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <BillingPanel />
    </div>
  );
}

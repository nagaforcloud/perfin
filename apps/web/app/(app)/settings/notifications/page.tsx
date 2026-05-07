import { NotificationsPanel } from '@/components/settings/NotificationsPanel';

export default function SettingsNotificationsPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <NotificationsPanel />
    </div>
  );
}

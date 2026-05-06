import { InboxList } from '@/components/inbox/InboxList';

export default function InboxPage() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <p className="text-sm text-text-muted">Things that need a quick decision.</p>
      <InboxList />
    </div>
  );
}

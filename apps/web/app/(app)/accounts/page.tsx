'use client';

import { useState } from 'react';
import { AccountsTabs, type AccountsTabKey } from '@/components/accounts/AccountsTabs';
import { BankConnectionsTab } from '@/components/accounts/BankConnectionsTab';
import { ManualAccountsTab } from '@/components/accounts/ManualAccountsTab';
import { UploadsTab } from '@/components/accounts/UploadsTab';
import { EmailForwardingTab } from '@/components/accounts/EmailForwardingTab';

export default function AccountsPage() {
  const [tab, setTab] = useState<AccountsTabKey>('bank');
  return (
    <div className="p-8 max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <AccountsTabs value={tab} onChange={setTab} />
      {tab === 'bank' && <BankConnectionsTab />}
      {tab === 'manual' && <ManualAccountsTab />}
      {tab === 'uploads' && <UploadsTab />}
      {tab === 'email' && <EmailForwardingTab />}
    </div>
  );
}

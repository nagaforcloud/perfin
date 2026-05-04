/** Accounts page — list and manage financial accounts */
class AccountsPage {
  constructor(container) { this.el = container; }

  async render() {
    this.el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Accounts</div>
          <div class="page-subtitle">Manage your financial accounts</div>
        </div>
        <button class="btn btn-primary" id="new-acct-btn">+ New Account</button>
      </div>
      <div class="page-body" id="accounts-body">
        <div class="loading-screen" style="height:40vh"><div class="spinner"></div></div>
      </div>`;

    document.getElementById('new-acct-btn').addEventListener('click', () => this._createAccount());
    await this._load();
  }

  async _load() {
    const body = document.getElementById('accounts-body');
    try {
      const accounts = await API.Accounts.list();

      if (!accounts.length) {
        body.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
            <h3>No accounts yet</h3>
            <p>Upload a statement or click "+ New Account" to get started</p>
          </div>`;
        return;
      }

      body.innerHTML = `<div class="accounts-grid">${accounts.map(a => this._accountCard(a)).join('')}</div>`;

      // Click card → go to transactions filtered by account
      body.querySelectorAll('.account-card[data-name]').forEach(card => {
        card.querySelector('.acct-view-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          const name = card.dataset.name;
          App.state.account = name;
          const sel = document.getElementById('account-select');
          if (sel) sel.value = name;
          window.location.hash = 'transactions';
        });
        card.querySelector('.acct-edit-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          const name = card.dataset.name;
          const acct = accounts.find(a => a.name === name);
          if (acct) this._editAccount(acct);
        });
        card.querySelector('.acct-del-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          this._deleteAccount(card.dataset.name);
        });
      });

    } catch (e) {
      body.innerHTML =
        `<div class="empty-state"><p style="color:var(--danger)">${_esc(e.message)}</p></div>`;
    }
  }

  _accountCard(a) {
    const TYPE_ICONS = { checking: '🏦', savings: '💰', credit: '💳', investment: '📈', other: '🏧' };
    const typeIcon   = TYPE_ICONS[a.account_type] || '🏦';
    const net        = (a.total_income || 0) - (a.total_expenses || 0);
    const netColor   = net >= 0 ? 'var(--success)' : 'var(--danger)';

    const accentColor = _esc(a.color || '#6366f1');
    return `<div class="account-card" data-name="${_esc(a.name)}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:11px;background:${accentColor}18;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;border:1px solid ${accentColor}28">${typeIcon}</div>
          <div>
            <div class="account-name">${_esc(a.name)}</div>
            <div class="account-bank" style="margin-bottom:0">${_esc(a.bank || a.account_type)} · ${_esc(a.currency || 'INR')}</div>
          </div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-icon btn-ghost acct-edit-btn" title="Edit account" style="color:var(--text-muted);width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>
          </button>
          <button class="btn btn-icon btn-ghost acct-del-btn" title="Delete account" style="color:var(--danger);width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        <div style="background:var(--border-light);border-radius:var(--radius-sm);padding:8px 10px">
          <div class="account-stat-label">Txns</div>
          <div class="account-stat-value">${(a.transaction_count || 0).toLocaleString()}</div>
        </div>
        <div style="background:rgba(16,185,129,0.08);border-radius:var(--radius-sm);padding:8px 10px">
          <div class="account-stat-label" style="color:#10b981">Income</div>
          <div class="account-stat-value" style="color:#10b981">${Charts.fmtFull(a.total_income || 0)}</div>
        </div>
        <div style="background:rgba(244,63,94,0.08);border-radius:var(--radius-sm);padding:8px 10px">
          <div class="account-stat-label" style="color:#f43f5e">Expenses</div>
          <div class="account-stat-value" style="color:#f43f5e">${Charts.fmtFull(a.total_expenses || 0)}</div>
        </div>
      </div>

      <div style="padding-top:12px;border-top:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px;color:var(--text-muted)">
          Net: <span style="font-family:var(--mono);font-weight:600;color:${netColor}">${net >= 0 ? '' : '−'}${Charts.fmtFull(net)}</span>
        </div>
        <button class="btn btn-ghost btn-sm acct-view-btn" style="font-size:12px;gap:4px">
          View
          <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path fill-rule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>`;
  }

  async _createAccount() {
    const result = await App.prompt([
      { key: 'name',         label: 'Account Name',  required: true, placeholder: 'e.g. HDFC Savings' },
      { key: 'bank',         label: 'Bank',           required: false, placeholder: 'e.g. HDFC' },
      { key: 'account_type', label: 'Type',           type: 'select', value: 'checking',
        options: [
          { value: 'checking',   label: 'Checking / Savings' },
          { value: 'credit',     label: 'Credit Card' },
          { value: 'investment', label: 'Investment' },
          { value: 'other',      label: 'Other' },
        ]},
      { key: 'currency', label: 'Currency', required: false, value: 'INR', placeholder: 'INR' },
      { key: 'color',    label: 'Colour',   type: 'color',   value: '#6366f1' },
    ], { title: 'New Account', okLabel: 'Create' });

    if (!result) return;
    try {
      await API.Accounts.create(result);
      App.toast('Account created', 'success');
      App.refreshAccountList();
      await this._load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }

  async _editAccount(acct) {
    const result = await App.prompt([
      { key: 'name',         label: 'Account Name',  required: true, value: acct.name },
      { key: 'bank',         label: 'Bank',           value: acct.bank || '' },
      { key: 'account_type', label: 'Type',           type: 'select', value: acct.account_type || 'checking',
        options: [
          { value: 'checking',   label: 'Checking / Savings' },
          { value: 'credit',     label: 'Credit Card' },
          { value: 'investment', label: 'Investment' },
          { value: 'other',      label: 'Other' },
        ]},
      { key: 'currency', label: 'Currency', value: acct.currency || 'INR' },
      { key: 'color',    label: 'Colour',   type: 'color', value: acct.color || '#6366f1' },
    ], { title: `Edit: ${acct.name}`, okLabel: 'Save changes' });

    if (!result) return;
    try {
      await API.Accounts.update(acct.name, result);
      App.toast('Account updated', 'success');
      App.refreshAccountList();
      await this._load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }

  async _deleteAccount(name) {
    const ok = await App.confirm(
      `Delete account "${name}"? Transactions will be kept but unlinked from this account.`,
      { title: 'Delete Account', okLabel: 'Delete', danger: true }
    );
    if (!ok) return;
    try {
      await API.Accounts.delete(name);
      App.toast('Account deleted', 'success');
      // Clear sidebar selection if it was this account
      if (App.state.account === name) {
        App.state.account = '';
        const sel = document.getElementById('account-select');
        if (sel) sel.value = '';
      }
      App.refreshAccountList();
      await this._load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }
}

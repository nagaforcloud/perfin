/** Transactions page — searchable, filterable, editable table */

// Consistent color per category name (deterministic hash)
function _catColor(cat) {
  const MAP = {
    'Income':                '#22c55e',
    'Food':                  '#f97316',
    'Groceries':             '#84cc16',
    'Transport':             '#3b82f6',
    'Utilities':             '#06b6d4',
    'Shopping':              '#ec4899',
    'Rent':                  '#8b5cf6',
    'Insurance':             '#64748b',
    'Subscription':          '#a855f7',
    'Investment':            '#6366f1',
    'Transfer':              '#14b8a6',
    'Medical':               '#ef4444',
    'Entertainment':         '#f59e0b',
    'Travel':                '#0ea5e9',
    'Education':             '#e11d48',
    'Professional Services': '#475569',
    'Home Maintenance':      '#92400e',
    'Personal Care':         '#db2777',
    'Gifts & Donations':     '#d97706',
    'Other':                 '#94a3b8',
    'Needs Review':          '#f59e0b',
  };
  if (MAP[cat]) return MAP[cat];
  // Deterministic fallback from string hash
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffffffff;
  const PALETTE = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6',
                   '#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b'];
  return PALETTE[Math.abs(h) % PALETTE.length];
}

class TransactionsPage {
  constructor(container) {
    this.el = container;
    this._txns = [];
    this._categories = [];
    this._page = 1;
    this._perPage = 50;
    this._sort = { col: 'date', dir: 'desc' };
    this._filters = { search: '', category: '', account: App.state.account || '' };
  }

  async render() {
    this.el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Transactions</div>
          <div class="page-subtitle" id="txn-count">Loading…</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="txn-export" title="Download as CSV">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            Export CSV
          </button>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" id="txn-categorize" title="Apply rule-based categorization">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
                <path d="M9.5 2a.5.5 0 000 1h4a.5.5 0 000-1h-4zM2 3.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm1.5-2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM9.5 7a.5.5 0 000 1h4a.5.5 0 000-1h-4zM2 8.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm1.5-2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM9.5 12a.5.5 0 000 1h4a.5.5 0 000-1h-4zM2 13.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm1.5-2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
              </svg>
              Auto-categorize
            </button>
            <button class="btn btn-ghost btn-sm" id="txn-categorize-llm" title="Use AI to categorize (slower)">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
                <path d="M6 12.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 004.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 01-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 013 9.219V8.062zm4.542-.827a.25.25 0 00-.217.068l-.92.9a24.767 24.767 0 01-1.339-.092.25.25 0 00-.256.274l.032.504a.25.25 0 00.41.148l.533-.531 1.063 1.063a.25.25 0 00.354 0l1.063-1.063.533.531a.25.25 0 00.41-.148l.032-.504a.25.25 0 00-.256-.274 24.75 24.75 0 01-1.339.092l-.92-.9a.25.25 0 00-.183-.068z"/>
                <path d="M5 3.5A2.5 2.5 0 017.5 1h1A2.5 2.5 0 0111 3.5v1h-1v-1A1.5 1.5 0 008.5 2h-1A1.5 1.5 0 006 3.5v1H5v-1z"/>
              </svg>
              AI Categorize
            </button>
          </div>
          <button class="btn btn-primary btn-sm" id="txn-refresh">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
              <path fill-rule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>
      <div class="page-body">
        <div class="card">
          <div class="toolbar">
            <input class="search-input" id="txn-search" placeholder="Search description, category, amount…" value="${_esc(this._filters.search)}"/>
            <select class="filter-select" id="txn-cat-filter">
              <option value="">All categories</option>
            </select>
            <select class="filter-select" id="txn-acct-filter">
              <option value="">All accounts</option>
            </select>
            <div style="display:flex;align-items:center;gap:4px">
              <label style="font-size:12px;color:var(--text-muted);white-space:nowrap">From</label>
              <input type="date" class="form-control" id="txn-start" style="width:140px"/>
            </div>
            <div style="display:flex;align-items:center;gap:4px">
              <label style="font-size:12px;color:var(--text-muted);white-space:nowrap">To</label>
              <input type="date" class="form-control" id="txn-end" style="width:140px"/>
            </div>
            <select class="filter-select" id="txn-perpage" title="Rows per page">
              <option value="50"  selected>50 / page</option>
              <option value="100">100 / page</option>
              <option value="200">200 / page</option>
            </select>
          </div>
          <div class="table-wrap" id="txn-table-wrap">
            <div class="loading-screen" style="height:300px"><div class="spinner"></div></div>
          </div>
          <div class="pagination" id="txn-pagination"></div>
        </div>
      </div>`;

    this._categories = await API.Categories.list().catch(() => []);
    this._populateCatFilter();

    const accts = await API.Accounts.list().catch(() => []);
    const acctSel = document.getElementById('txn-acct-filter');
    accts.forEach(a => {
      const o = document.createElement('option');
      o.value = a.name; o.textContent = a.name;
      if (a.name === this._filters.account) o.selected = true;
      acctSel.appendChild(o);
    });

    // Events
    document.getElementById('txn-search').addEventListener('input', e => {
      this._filters.search = e.target.value; this._page = 1; this._renderTable();
    });
    document.getElementById('txn-cat-filter').addEventListener('change', e => {
      this._filters.category = e.target.value; this._page = 1; this._renderTable();
    });
    document.getElementById('txn-acct-filter').addEventListener('change', e => {
      // Sync with sidebar account switcher
      this._filters.account = e.target.value;
      App.state.account = e.target.value;
      const sidebarSel = document.getElementById('account-select');
      if (sidebarSel) sidebarSel.value = e.target.value;
      this._page = 1; this._load();
    });
    document.getElementById('txn-start').addEventListener('change', () => { this._page = 1; this._load(); });
    document.getElementById('txn-end').addEventListener('change',   () => { this._page = 1; this._load(); });
    document.getElementById('txn-perpage').addEventListener('change', e => {
      this._perPage = parseInt(e.target.value); this._page = 1; this._renderTable();
    });
    document.getElementById('txn-refresh').addEventListener('click', () => this._load());
    document.getElementById('txn-categorize').addEventListener('click', () => this._autoCateg(false));
    document.getElementById('txn-categorize-llm').addEventListener('click', () => this._autoCateg(true));
    document.getElementById('txn-export').addEventListener('click', () => this._exportCsv());

    await this._load();
  }

  _populateCatFilter() {
    const sel = document.getElementById('txn-cat-filter');
    this._categories.forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  }

  async _load() {
    const params = {
      account:    this._filters.account  || undefined,
      start_date: document.getElementById('txn-start')?.value || undefined,
      end_date:   document.getElementById('txn-end')?.value   || undefined,
    };
    const wrap = document.getElementById('txn-table-wrap');
    if (wrap) wrap.innerHTML =
      `<div class="loading-screen" style="height:300px"><div class="spinner"></div></div>`;
    try {
      this._txns = await API.Transactions.list(params);
      this._renderTable();
    } catch (e) {
      if (wrap) wrap.innerHTML =
        `<div class="empty-state"><p style="color:var(--danger)">${_esc(e.message)}</p></div>`;
    }
  }

  _filtered() {
    let data = this._txns;
    const { search, category } = this._filters;
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(t =>
        t.description.toLowerCase().includes(s) ||
        t.category.toLowerCase().includes(s) ||
        String(Math.abs(t.amount)).includes(s)
      );
    }
    if (category) data = data.filter(t => t.category === category);
    return data;
  }

  _sorted(data) {
    const { col, dir } = this._sort;
    return [...data].sort((a, b) => {
      let va = a[col], vb = b[col];
      if (col === 'amount') { va = parseFloat(va); vb = parseFloat(vb); }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  _renderTable() {
    const filtered = this._sorted(this._filtered());
    const total    = filtered.length;
    const pages    = Math.max(1, Math.ceil(total / this._perPage));
    this._page     = Math.min(this._page, pages);
    const slice    = filtered.slice((this._page - 1) * this._perPage, this._page * this._perPage);

    const countEl = document.getElementById('txn-count');
    if (countEl) countEl.textContent = `${total.toLocaleString()} transactions`;

    const sortArrow = col => {
      if (this._sort.col !== col) return '<span style="opacity:.3;font-size:10px"> ⇅</span>';
      return this._sort.dir === 'asc'
        ? '<span style="font-size:10px"> ▲</span>'
        : '<span style="font-size:10px"> ▼</span>';
    };

    const wrap = document.getElementById('txn-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = total === 0
      ? `<div class="empty-state">
           <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
           <h3>No transactions found</h3>
           <p>Upload a statement or adjust your filters</p>
         </div>`
      : `<table>
          <thead><tr>
            <th data-col="date" style="cursor:pointer">Date${sortArrow('date')}</th>
            <th data-col="description" style="cursor:pointer">Description${sortArrow('description')}</th>
            <th data-col="amount" style="cursor:pointer">Amount${sortArrow('amount')}</th>
            <th>Category</th>
            <th data-col="account" style="cursor:pointer">Account${sortArrow('account')}</th>
            <th></th>
          </tr></thead>
          <tbody>${slice.map(t => this._row(t)).join('')}</tbody>
        </table>`;

    // Sort click
    document.querySelectorAll('thead th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (this._sort.col === col) {
          this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          this._sort = { col, dir: col === 'amount' ? 'desc' : 'asc' };
        }
        this._renderTable();
      });
    });

    // Category click → inline edit
    document.querySelectorAll('.cat-badge[data-id]').forEach(el => {
      el.addEventListener('click', () => this._editCategory(el.dataset.id, el.dataset.cat));
    });

    // Delete click
    document.querySelectorAll('.del-btn[data-id]').forEach(el => {
      el.addEventListener('click', () => this._deleteRow(el.dataset.id));
    });

    // Pagination
    this._renderPagination(pages);
  }

  _row(t) {
    const amtClass = t.amount >= 0 ? 'amount-positive' : 'amount-negative';
    const amtSign  = t.amount >= 0 ? '+' : '';
    const isNeedsReview = t.category === 'Needs Review';
    const bgColor  = isNeedsReview ? '#fef3c7' : _catColor(t.category) + '22'; // 22 = 13% alpha
    const txtColor = isNeedsReview ? '#92400e'  : _catColor(t.category);

    return `<tr>
      <td class="date-cell">${t.date}</td>
      <td class="desc-cell" title="${_esc(t.description)}">${_esc(t.description)}</td>
      <td class="${amtClass}">${amtSign}${Charts.fmtFull(t.amount)}</td>
      <td>
        <span class="cat-badge" data-id="${t.id}" data-cat="${_esc(t.category)}"
          style="background:${bgColor};color:${txtColor}" title="Click to change category">
          ${_esc(t.category)}
          <svg viewBox="0 0 12 12" fill="currentColor" width="10" height="10" style="margin-left:3px;opacity:.6">
            <path d="M7.586 2l2.414 2.414L4.586 10H2V7.586L7.586 2z"/>
          </svg>
        </span>
      </td>
      <td class="acct-cell">${_esc(t.account || '')}</td>
      <td>
        <button class="btn btn-icon btn-ghost del-btn" data-id="${t.id}" title="Delete transaction"
          style="color:var(--text-light);font-size:14px">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66H14.5a.5.5 0 0 0 0-1h-.996a.59.59 0 0 0-.01 0H11Z"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }

  _renderPagination(pages) {
    const p     = this._page;
    const total = this._filtered().length;
    const from  = ((p - 1) * this._perPage) + 1;
    const to    = Math.min(p * this._perPage, total);

    const btn = (label, page, disabled = false, active = false) =>
      `<button class="page-btn${active ? ' active' : ''}" data-pg="${page}" ${disabled ? 'disabled' : ''}>${label}</button>`;

    let btns = btn('‹', p - 1, p === 1);
    const start = Math.max(1, p - 2), end = Math.min(pages, p + 2);
    if (start > 1) btns += btn('1', 1);
    if (start > 2) btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    for (let i = start; i <= end; i++) btns += btn(i, i, false, i === p);
    if (end < pages - 1) btns += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    if (end < pages) btns += btn(pages, pages);
    btns += btn('›', p + 1, p === pages);

    const pag = document.getElementById('txn-pagination');
    if (!pag) return;
    pag.innerHTML = `<span>${from}–${to} of ${total.toLocaleString()}</span>
      <div class="pagination-btns">${btns}</div>`;

    pag.querySelectorAll('.page-btn[data-pg]').forEach(b => {
      b.addEventListener('click', () => { this._page = parseInt(b.dataset.pg); this._renderTable(); });
    });
  }

  async _editCategory(id, current) {
    const newCat = await App.showCategoryPicker(current);
    if (!newCat || newCat === current) return;
    try {
      await API.Transactions.update(id, { category: newCat });
      const t = this._txns.find(x => String(x.id) === String(id));
      if (t) t.category = newCat;
      this._renderTable();
      App.toast('Category updated', 'success');
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }

  async _deleteRow(id) {
    const t   = this._txns.find(x => String(x.id) === String(id));
    const desc = t ? t.description : `transaction #${id}`;
    const ok  = await App.confirm(
      `Delete "${desc}"? This cannot be undone.`,
      { title: 'Delete Transaction', okLabel: 'Delete', danger: true }
    );
    if (!ok) return;
    try {
      await API.Transactions.remove(id);
      this._txns = this._txns.filter(t => String(t.id) !== String(id));
      this._renderTable();
      App.toast('Transaction deleted');
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }

  async _autoCateg(useLlm = false) {
    const btn = document.getElementById(useLlm ? 'txn-categorize-llm' : 'txn-categorize');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Running…';
    try {
      const r = await API.Categorize.run(useLlm);
      const msg = useLlm
        ? `Rules: ${r.categorised_by_rules}, AI: ${r.categorised_by_llm ?? 0}`
        : `Categorized ${r.categorised_by_rules} by rules`;
      App.toast(msg, 'success');
      await this._load();
    } catch (e) {
      App.toast(e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  _exportCsv() {
    const data = this._sorted(this._filtered());
    if (!data.length) { App.toast('No transactions to export', 'error'); return; }

    const headers = ['Date', 'Description', 'Amount', 'Category', 'Account'];
    const rows = data.map(t => [
      t.date,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.amount,
      t.category,
      t.account || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast(`Exported ${data.length} transactions`, 'success');
  }
}

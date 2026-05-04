/**
 * App — main entry point.
 * Handles routing, global state, toast notifications, shared utilities.
 */
const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    account:    '',    // currently selected account filter ('' = all)
    categories: [],    // cached valid categories
    _healthTs:  0,     // timestamp of last health fetch (ms)
    _healthData: null, // cached health response
  };

  // ── Route map ─────────────────────────────────────────────────────────────
  const PAGES = {
    dashboard:    () => new DashboardPage(document.getElementById('main-content')),
    transactions: () => new TransactionsPage(document.getElementById('main-content')),
    upload:       () => new UploadPage(document.getElementById('main-content')),
    analytics:    () => new AnalyticsPage(document.getElementById('main-content')),
    accounts:     () => new AccountsPage(document.getElementById('main-content')),
  };

  let currentPage = null;

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    // Load categories into cache
    API.Categories.list()
      .then(cats => { state.categories = cats; })
      .catch(() => {});

    // Populate account switcher
    await refreshAccountList();

    // Account switcher change
    document.getElementById('account-select').addEventListener('change', e => {
      state.account = e.target.value;
      _navigate(_currentRoute());
    });

    // Hash-based routing
    window.addEventListener('hashchange', () => _navigate(_currentRoute()));
    _navigate(_currentRoute());

    // Sidebar collapse toggle
    document.getElementById('sidebar-toggle').addEventListener('click', _toggleSidebar);

    // Global ESC → close any open modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay.classList.contains('hidden')) {
          overlay.classList.add('hidden');
          // Resolve any pending showCategoryPicker / confirm promises
          if (_modalReject) { _modalReject(null); _modalReject = null; }
        }
      }
    });
  }

  function _currentRoute() {
    return window.location.hash.replace('#', '') || 'dashboard';
  }

  async function _navigate(route) {
    const key = Object.keys(PAGES).includes(route) ? route : 'dashboard';
    window.location.hash = key;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === key);
    });

    // Destroy previous page if it has a cleanup method
    if (currentPage && typeof currentPage.destroy === 'function') currentPage.destroy();

    // Mount new page
    currentPage = PAGES[key]();
    await currentPage.render();

    // Refresh health badge (throttled — max once per 60 s)
    _refreshHealthBadge();
  }

  // ── Sidebar collapse ───────────────────────────────────────────────────────
  function _toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('main-content').classList.toggle('sidebar-collapsed');
    // Also toggle layout wrapper class for main margin
    document.querySelector('.main').classList.toggle('sidebar-collapsed');
  }

  // ── Account list ──────────────────────────────────────────────────────────
  async function refreshAccountList() {
    try {
      const accounts = await API.Accounts.list();
      const sel = document.getElementById('account-select');
      const cur = sel.value;

      sel.innerHTML = `<option value="">All Accounts</option>` +
        accounts.map(a =>
          `<option value="${_esc(a.name)}" ${a.name === cur ? 'selected' : ''}>${_esc(a.name)}</option>`
        ).join('');

      if (cur && accounts.find(a => a.name === cur)) sel.value = cur;
    } catch (_) {}
  }

  // ── Health badge (cached, max 1 fetch / 60 s) ─────────────────────────────
  async function _refreshHealthBadge() {
    const now = Date.now();
    if (now - state._healthTs < 60_000 && state._healthData) {
      _renderHealthBadge(state._healthData);
      return;
    }
    try {
      const h = await API.Analytics.health();
      state._healthData = h;
      state._healthTs   = Date.now();
      _renderHealthBadge(h);
    } catch (_) {}
  }

  function _renderHealthBadge(h) {
    const pct    = Math.round(h.total_score / h.max_score * 100);
    const colour = pct >= 80 ? '#16A34A' : pct >= 60 ? '#4F6EF7' : pct >= 40 ? '#D97706' : '#DC2626';
    const el = document.getElementById('sidebar-health');
    if (!el) return;
    el.innerHTML =
      `<div style="display:flex;align-items:center;gap:6px">
        <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16" style="color:${colour};flex-shrink:0">
          <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
        </svg>
        <div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Health</div>
          <div style="font-size:15px;font-weight:700;color:${colour}">${h.rating}</div>
        </div>
      </div>`;
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let _toastTimer;
  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className   = `toast ${type} show`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // ── Generic confirm modal ─────────────────────────────────────────────────
  let _modalReject = null;

  function confirm(message, opts = {}) {
    return new Promise(resolve => {
      const overlay  = document.getElementById('modal-overlay');
      const box      = document.getElementById('modal-box');
      const danger   = opts.danger || false;
      const okLabel  = opts.okLabel  || 'Confirm';
      const canLabel = opts.cancelLabel || 'Cancel';

      box.innerHTML = `
        <div class="modal-title">${_esc(opts.title || 'Confirm')}</div>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px">${_esc(message)}</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="modal-cancel">${_esc(canLabel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-ok">${_esc(okLabel)}</button>
        </div>`;

      overlay.classList.remove('hidden');

      _modalReject = () => { overlay.classList.add('hidden'); resolve(false); };

      document.getElementById('modal-ok').addEventListener('click', () => {
        overlay.classList.add('hidden'); _modalReject = null; resolve(true);
      });
      document.getElementById('modal-cancel').addEventListener('click', () => {
        overlay.classList.add('hidden'); _modalReject = null; resolve(false);
      });
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { overlay.classList.add('hidden'); _modalReject = null; resolve(false); }
      }, { once: true });
    });
  }

  // ── Generic input modal ───────────────────────────────────────────────────
  function prompt(fields, opts = {}) {
    return new Promise(resolve => {
      const overlay = document.getElementById('modal-overlay');
      const box     = document.getElementById('modal-box');
      const title   = opts.title  || 'Enter details';
      const okLabel = opts.okLabel || 'Save';

      const fieldsHtml = fields.map(f => `
        <div class="form-group">
          <label class="form-label">${_esc(f.label)}${f.required ? ' *' : ''}</label>
          ${f.type === 'select'
            ? `<select class="form-control" id="mpf-${_esc(f.key)}">
                ${(f.options || []).map(o =>
                  `<option value="${_esc(o.value)}" ${o.value === f.value ? 'selected' : ''}>${_esc(o.label)}</option>`
                ).join('')}</select>`
            : f.type === 'color'
            ? `<input type="color" id="mpf-${_esc(f.key)}" value="${_esc(f.value || '#6366f1')}"
                style="width:48px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px"/>`
            : `<input class="form-control" id="mpf-${_esc(f.key)}"
                type="${f.type || 'text'}" value="${_esc(f.value || '')}"
                placeholder="${_esc(f.placeholder || '')}"/>`
          }
        </div>`
      ).join('');

      box.innerHTML = `
        <div class="modal-title">${_esc(title)}</div>
        ${fieldsHtml}
        <div id="mpf-err" style="color:var(--danger);font-size:12px;margin-bottom:8px;display:none"></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="modal-cancel">${_esc(opts.cancelLabel || 'Cancel')}</button>
          <button class="btn btn-primary" id="modal-ok">${_esc(okLabel)}</button>
        </div>`;

      overlay.classList.remove('hidden');

      // Focus first input
      setTimeout(() => document.querySelector(`#mpf-${fields[0]?.key}`)?.focus(), 50);

      _modalReject = () => { overlay.classList.add('hidden'); resolve(null); };

      const doSubmit = () => {
        const result = {};
        for (const f of fields) {
          const el = document.getElementById(`mpf-${f.key}`);
          result[f.key] = el ? el.value.trim() : '';
          if (f.required && !result[f.key]) {
            const err = document.getElementById('mpf-err');
            err.textContent = `${f.label} is required.`;
            err.style.display = '';
            el && el.focus();
            return;
          }
        }
        overlay.classList.add('hidden'); _modalReject = null; resolve(result);
      };

      document.getElementById('modal-ok').addEventListener('click', doSubmit);
      box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'SELECT') doSubmit(); });
      document.getElementById('modal-cancel').addEventListener('click', () => {
        overlay.classList.add('hidden'); _modalReject = null; resolve(null);
      });
      overlay.addEventListener('click', e => {
        if (e.target === overlay) { overlay.classList.add('hidden'); _modalReject = null; resolve(null); }
      }, { once: true });
    });
  }

  // ── Category picker modal ─────────────────────────────────────────────────
  function showCategoryPicker(current) {
    return new Promise(resolve => {
      const cats = state.categories.length
        ? state.categories
        : ['Income','Food','Groceries','Transport','Utilities','Shopping','Rent',
           'Insurance','Subscription','Investment','Transfer','Medical','Entertainment',
           'Travel','Education','Professional Services','Home Maintenance',
           'Personal Care','Gifts & Donations','Other','Needs Review'];

      const overlay = document.getElementById('modal-overlay');
      const box     = document.getElementById('modal-box');

      box.innerHTML = `
        <div class="modal-title">Change Category</div>
        <input class="form-control mb-3" id="cat-search" placeholder="Search…" autocomplete="off"/>
        <div id="cat-list" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
          ${cats.map(c => `
            <button class="btn btn-ghost" style="justify-content:flex-start;padding:8px 12px;${c === current ? 'background:var(--primary-light);color:var(--primary-dark)' : ''}"
              data-cat="${_esc(c)}">${_esc(c)}</button>`
          ).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
        </div>`;

      overlay.classList.remove('hidden');

      _modalReject = () => { overlay.classList.add('hidden'); resolve(null); };

      // Filter
      document.getElementById('cat-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#cat-list button').forEach(b => {
          b.style.display = b.dataset.cat.toLowerCase().includes(q) ? '' : 'none';
        });
      });
      document.getElementById('cat-search').focus();

      // Select
      document.querySelectorAll('#cat-list button').forEach(b => {
        b.addEventListener('click', () => {
          overlay.classList.add('hidden'); _modalReject = null; resolve(b.dataset.cat);
        });
      });

      // Cancel
      document.getElementById('modal-cancel').addEventListener('click', () => {
        overlay.classList.add('hidden'); _modalReject = null; resolve(null);
      });

      overlay.addEventListener('click', e => {
        if (e.target === overlay) { overlay.classList.add('hidden'); _modalReject = null; resolve(null); }
      }, { once: true });
    });
  }

  return { init, state, toast, confirm, prompt, refreshAccountList, showCategoryPicker };
})();

// ── Global helper (used in templates) ─────────────────────────────────────
function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Boot ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => App.init());

/** Upload page — drag-and-drop statement upload (PDF / CSV / XLSX) */

const ALLOWED_EXTS  = ['.pdf', '.csv', '.xlsx', '.xls'];
const ALLOWED_TYPES = ['application/pdf', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'];

class UploadPage {
  constructor(container) {
    this.el = container;
    this._uploads = []; // { filename, account, inserted, date }
  }

  async render() {
    const accounts = await API.Accounts.list().catch(() => []);

    this.el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Upload Statement</div>
          <div class="page-subtitle">Import transactions from PDF, CSV, or Excel</div>
        </div>
      </div>
      <div class="page-body">
        <div style="max-width:620px;margin:0 auto">

          <!-- Account selector / creator -->
          <div class="card" style="margin-bottom:16px">
            <div class="card-header"><span class="card-title">Select Account</span></div>
            <div class="card-body">
              <div class="form-group" style="margin-bottom:8px">
                <label class="form-label">Account <span style="color:var(--danger)">*</span></label>
                <select class="form-control" id="upload-account">
                  <option value="">— Choose an account —</option>
                  ${accounts.map(a => `<option value="${_esc(a.name)}">${_esc(a.name)} (${_esc(a.bank || a.account_type)})</option>`).join('')}
                </select>
                <div id="acct-warning" style="display:none;margin-top:6px;padding:8px 10px;background:var(--warning-bg);color:#fbbf24;border-radius:6px;font-size:12px;display:flex;align-items:flex-start;gap:6px">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="flex-shrink:0;margin-top:1px;color:#f59e0b"><path d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"/></svg>
                  No account selected — transactions will be imported into a temporary "Default" account. Select or create an account above for better organisation.
                </div>
              </div>
              <div id="new-account-fields" style="display:none;padding:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;margin-top:8px">
                <div class="form-group">
                  <label class="form-label">Account Name <span style="color:var(--danger)">*</span></label>
                  <input class="form-control" id="new-acct-name" placeholder="e.g. HDFC Savings"/>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                  <div class="form-group">
                    <label class="form-label">Bank</label>
                    <input class="form-control" id="new-acct-bank" placeholder="HDFC"/>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Type</label>
                    <select class="form-control" id="new-acct-type">
                      <option value="checking">Checking / Savings</option>
                      <option value="credit">Credit Card</option>
                      <option value="investment">Investment</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" id="toggle-new-acct" style="margin-top:8px">+ Create new account</button>
            </div>
          </div>

          <!-- Drop zone -->
          <div class="card">
            <div class="card-body">
              <div class="upload-zone" id="drop-zone">
                <div class="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                </div>
                <h3>Drop your statement here</h3>
                <p>or click to browse — supports multiple files</p>
                <div class="file-types">
                  <span class="file-type-tag">PDF</span>
                  <span class="file-type-tag">CSV</span>
                  <span class="file-type-tag">XLSX</span>
                  <span class="file-type-tag">XLS</span>
                </div>
              </div>
              <input type="file" id="file-input" accept=".pdf,.csv,.xlsx,.xls" style="display:none" multiple/>

              <!-- Upload log -->
              <div id="upload-log" style="margin-top:16px"></div>
            </div>
          </div>

          <!-- Recent uploads -->
          <div class="card" style="margin-top:16px" id="recent-card">
            <div class="card-header"><span class="card-title">Recent Uploads</span></div>
            <div class="card-body" id="recent-uploads">Loading…</div>
          </div>
        </div>
      </div>`;

    this._bindEvents();
    this._loadRecent();
  }

  _bindEvents() {
    const zone  = document.getElementById('drop-zone');
    const input = document.getElementById('file-input');
    const acctSel = document.getElementById('upload-account');

    // Show warning when no account selected
    acctSel.addEventListener('change', () => {
      document.getElementById('acct-warning').style.display =
        acctSel.value ? 'none' : '';
    });

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      const files = [...e.dataTransfer.files];
      const invalid = files.filter(f => !this._isAllowed(f));
      if (invalid.length) {
        const names = invalid.map(f => f.name).join(', ');
        App.toast(`Unsupported file type: ${names}. Use PDF, CSV, or XLSX.`, 'error');
      }
      files.filter(f => this._isAllowed(f)).forEach(f => this._uploadFile(f));
    });

    input.addEventListener('change', () => [...input.files].forEach(f => this._uploadFile(f)));

    document.getElementById('toggle-new-acct').addEventListener('click', () => {
      const fields  = document.getElementById('new-account-fields');
      const visible = fields.style.display !== 'none';
      fields.style.display = visible ? 'none' : 'block';
      document.getElementById('toggle-new-acct').textContent =
        visible ? '+ Create new account' : '− Cancel';
      if (!visible) {
        // Hide the existing selector when creating new
        document.getElementById('upload-account').value = '';
      }
    });
  }

  _isAllowed(file) {
    const ext  = '.' + file.name.split('.').pop().toLowerCase();
    return ALLOWED_EXTS.includes(ext) || ALLOWED_TYPES.includes(file.type);
  }

  _getAccountName() {
    const sel = document.getElementById('upload-account').value;
    if (sel) return sel;
    const newName = document.getElementById('new-acct-name')?.value?.trim();
    if (newName) return newName;
    return null; // no account selected
  }

  async _ensureAccount() {
    const name    = this._getAccountName();
    const newName = document.getElementById('new-acct-name')?.value?.trim();
    const isNew   = document.getElementById('new-account-fields').style.display !== 'none' && newName;

    if (isNew) {
      await API.Accounts.create({
        name:         newName,
        bank:         document.getElementById('new-acct-bank').value.trim(),
        account_type: document.getElementById('new-acct-type').value,
      }).catch(() => {});  // Ignore if already exists
      await App.refreshAccountList();
    }
    return name || 'Default';
  }

  async _uploadFile(file, password = null) {
    // Show warning if no account selected (and not creating new)
    const acctSel = document.getElementById('upload-account');
    const hasNew  = document.getElementById('new-account-fields').style.display !== 'none' &&
                    document.getElementById('new-acct-name')?.value?.trim();
    if (!acctSel.value && !hasNew) {
      document.getElementById('acct-warning').style.display = '';
    }

    const log = document.getElementById('upload-log');
    const id  = 'up-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

    log.insertAdjacentHTML('afterbegin', `
      <div id="${id}" style="margin-bottom:10px;padding:14px 16px;border:1.5px solid var(--border);border-radius:var(--radius);background:var(--card-bg);animation:slide-up 0.25s ease both">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;background:var(--primary-light);border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--primary);flex-shrink:0">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.414A2 2 0 0 0 13.414 3L11 .586A2 2 0 0 0 9.586 0H4zm4 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
            </div>
            <span style="font-weight:600;font-size:13px;color:var(--text)">${_esc(file.name)}</span>
          </div>
          <span style="font-family:var(--mono);font-size:11.5px;color:var(--text-muted);background:var(--border-light);padding:2px 8px;border-radius:20px">${_humanSize(file.size)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:10%" id="${id}-bar"></div></div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:5px" id="${id}-msg">Preparing…</div>
      </div>`);

    try {
      const accountName = await this._ensureAccount();
      document.getElementById(`${id}-bar`).style.width = '40%';
      document.getElementById(`${id}-msg`).textContent = 'Uploading…';

      const result = await API.Upload.upload(file, accountName, password);

      document.getElementById(`${id}-bar`).style.width     = '100%';
      document.getElementById(`${id}-bar`).style.background = 'var(--success)';
      document.getElementById(`${id}-msg`).innerHTML =
        `<span style="color:var(--success);display:inline-flex;align-items:center;gap:5px">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
          Inserted <strong>${result.inserted}</strong> transactions
          (${result.extracted} extracted &middot; ${result.normalised} normalised &middot; account: <em>${_esc(accountName)}</em>)
        </span>`;

      // Track for recent uploads log
      this._uploads.unshift({ filename: file.name, account: accountName,
        inserted: result.inserted, date: new Date().toLocaleString() });

      App.toast(`${result.inserted} transactions imported`, 'success');
      App.refreshAccountList();
      this._loadRecent();

    } catch (e) {
      const bar = document.getElementById(`${id}-bar`);
      const msg = document.getElementById(`${id}-msg`);
      if (bar) { bar.style.background = 'var(--danger)'; bar.style.width = '100%'; }

      // Password-protected PDF: show inline password prompt
      if (e.responseData && e.responseData.password_required) {
        const pwId = `${id}-pw`;
        if (msg) msg.innerHTML = `
          <span style="color:var(--danger);display:inline-flex;align-items:center;gap:5px">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M8 1a2 2 0 012 2v4H6V3a2 2 0 012-2zm3 6V3a3 3 0 00-6 0v4a2 2 0 00-2 2v5a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2z"/></svg>
            ${_esc(e.message)}
          </span>
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
            <input type="password" id="${pwId}" class="form-control"
              placeholder="Enter PDF password" style="flex:1;font-size:13px;padding:6px 10px"/>
            <button class="btn btn-primary btn-sm" id="${pwId}-btn">Unlock &amp; Upload</button>
          </div>`;

        const retryBtn = document.getElementById(`${pwId}-btn`);
        const pwInput  = document.getElementById(pwId);

        pwInput.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') retryBtn.click();
        });

        retryBtn.addEventListener('click', async () => {
          const pw = pwInput.value;
          if (!pw) { App.toast('Please enter the PDF password', 'error'); return; }
          document.getElementById(id).remove();
          await this._uploadFile(file, pw);
        });

        pwInput.focus();
        App.toast('PDF is password-protected — enter the password below', 'error');
      } else {
        if (msg) msg.innerHTML = `<span style="color:var(--danger);display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>${_esc(e.message)}</span>`;
        App.toast(e.message, 'error');
      }
    }
  }

  async _loadRecent() {
    const box = document.getElementById('recent-uploads');
    if (!box) return;

    // Show session-local upload log first (most useful)
    if (this._uploads.length) {
      box.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0">
          ${this._uploads.map(u => `
            <div style="display:flex;align-items:center;justify-content:space-between;
              padding:10px 0;border-bottom:1px solid var(--border-light)">
              <div>
                <div style="font-weight:500;font-size:13px">${_esc(u.filename)}</div>
                <div style="font-size:11.5px;color:var(--text-muted)">${_esc(u.account)} · ${_esc(u.date)}</div>
              </div>
              <span style="font-size:12px;font-weight:600;color:var(--success)">+${u.inserted} txns</span>
            </div>`).join('')}
        </div>`;
      return;
    }

    // Fallback: show accounts with their transaction counts
    try {
      const accts = await API.Accounts.list();
      box.innerHTML = accts.length
        ? `<div style="display:flex;flex-direction:column;gap:0">
            ${accts.map(a => `
              <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 0;border-bottom:1px solid var(--border-light)">
                <span style="font-weight:500">${_esc(a.name)}</span>
                <span style="font-size:12px;color:var(--text-muted)">${(a.transaction_count || 0).toLocaleString()} transactions</span>
              </div>`).join('')}
          </div>`
        : `<p class="text-muted text-sm">No accounts yet — upload your first statement above.</p>`;
    } catch (_) {
      box.textContent = 'Unable to load';
    }
  }
}

function _humanSize(bytes) {
  if (bytes < 1024)    return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

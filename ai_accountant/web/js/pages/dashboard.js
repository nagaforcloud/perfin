/** Dashboard page — summary cards + monthly chart + donut + anomalies/recurring */
class DashboardPage {
  constructor(container) {
    this.el = container;
    this._account = App.state.account;
  }

  async render() {
    this.el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dashboard</div>
          <div class="page-subtitle" id="dash-period">Your financial overview</div>
        </div>
        <div class="flex gap-2">
          <div class="daterange-bar" id="dash-daterange"></div>
          <button class="btn btn-ghost btn-sm" id="dash-refresh" title="Refresh data">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>
      <div class="page-body" id="dash-body">
        <div class="loading-screen" style="height:60vh"><div class="spinner"></div></div>
      </div>`;

    this._buildDatePicker();
    document.getElementById('dash-refresh').addEventListener('click', () => this._load());
    await this._load();
  }

  _buildDatePicker() {
    const bar = document.getElementById('dash-daterange');
    const opts = [
      { label: '1M',  months: 1  },
      { label: '3M',  months: 3  },
      { label: '6M',  months: 6  },
      { label: 'YTD', ytd: true  },
      { label: '1Y',  months: 12 },
      { label: 'All', all: true  },
    ];
    this._range = { label: '6M', months: 6 };

    bar.innerHTML = opts.map(o =>
      `<button class="date-quick-btn${o.label === '6M' ? ' active' : ''}"
        data-label="${o.label}">${o.label}</button>`
    ).join('');

    bar.addEventListener('click', e => {
      const btn = e.target.closest('.date-quick-btn');
      if (!btn) return;
      bar.querySelectorAll('.date-quick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this._range = opts.find(x => x.label === btn.dataset.label);
      this._load();
    });
  }

  _getDates() {
    const now = new Date();
    if (this._range.all) return {};
    if (this._range.ytd) {
      return {
        start_date: `${now.getFullYear()}-01-01`,
        end_date:   now.toISOString().slice(0, 10),
      };
    }
    const start = new Date(now);
    start.setMonth(start.getMonth() - this._range.months);
    return {
      start_date: start.toISOString().slice(0, 10),
      end_date:   now.toISOString().slice(0, 10),
    };
  }

  _getPeriodLabel() {
    if (this._range.all)  return 'All time';
    if (this._range.ytd)  return `Year to date (${new Date().getFullYear()})`;
    const d = this._getDates();
    const fmt = s => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(d.start_date)} – ${fmt(d.end_date)}`;
  }

  async _load() {
    const dates   = this._getDates();
    const params  = { ...dates, ...(this._account ? { account: this._account } : {}) };

    // Update period subtitle
    const subtitle = document.getElementById('dash-period');
    if (subtitle) subtitle.textContent = this._getPeriodLabel();

    try {
      const [summary, monthly, cats, anomalies, recurring] = await Promise.all([
        API.Analytics.summary(params),
        API.Analytics.monthly(params),
        API.Analytics.categories(params),
        API.Detection.anomalies(params),
        API.Detection.recurring(),
      ]);

      // Onboarding empty state
      if (!summary.transaction_count) {
        document.getElementById('dash-body').innerHTML = `
          <div class="empty-state" style="height:60vh">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" style="opacity:.3">
              <rect x="6" y="10" width="36" height="28" rx="4"/><line x1="6" y1="18" x2="42" y2="18"/>
              <line x1="14" y1="26" x2="22" y2="26"/><line x1="14" y1="32" x2="28" y2="32"/>
            </svg>
            <h3>No transactions yet</h3>
            <p>Upload your first bank statement to see your financial overview.</p>
            <a href="#upload" class="btn btn-primary" style="margin-top:16px">Upload Statement</a>
          </div>`;
        return;
      }

      document.getElementById('dash-body').innerHTML = `
        ${this._renderSummaryCards(summary)}
        <div class="charts-grid">
          <div class="card chart-wrap">
            <div class="chart-title">Monthly Income vs Expenses</div>
            <div class="card-body" id="monthly-chart"></div>
          </div>
          <div class="card chart-wrap">
            <div class="chart-title">Spending by Category</div>
            <div class="card-body" id="donut-area"></div>
          </div>
        </div>
        <div class="panels-grid">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Alerts &amp; Anomalies</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="badge badge-${anomalies.length ? 'high' : 'low'}">${anomalies.length}</span>
                ${anomalies.length > 5 ? `<a href="#analytics" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px">View all</a>` : ''}
              </div>
            </div>
            <div class="card-body" id="anomaly-panel"></div>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">Recurring Payments</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="badge badge-low">${recurring.length}</span>
                ${recurring.length > 6 ? `<a href="#analytics" class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px">View all</a>` : ''}
              </div>
            </div>
            <div class="card-body" id="recurring-panel"></div>
          </div>
        </div>`;

      // Monthly grouped bar chart
      document.getElementById('monthly-chart').innerHTML =
        Charts.groupedBarChart(monthly.slice(-12));

      // Donut chart
      const expCats = cats
        .filter(c => c.total_expenses > 0 && c.category !== 'Needs Review')
        .sort((a, b) => b.total_expenses - a.total_expenses)
        .slice(0, 8)
        .map((c, i) => ({ label: c.category, value: c.total_expenses, color: Charts.color(i) }));

      const { svg, legend } = Charts.donutChart(expCats, { size: 200 });
      document.getElementById('donut-area').innerHTML =
        `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="flex-shrink:0;width:160px">${svg}</div>
          <div class="donut-legend" style="flex:1">${legend}</div>
        </div>`;

      // Anomalies (filter to date range client-side)
      const filteredAnomalies = dates.start_date
        ? anomalies.filter(a => {
            const d = a.transaction?.date;
            return !d || (d >= dates.start_date && (!dates.end_date || d <= dates.end_date));
          })
        : anomalies;

      document.getElementById('anomaly-panel').innerHTML =
        filteredAnomalies.length
          ? `<div class="anomaly-list">${filteredAnomalies.slice(0, 5).map(a => `
              <div class="anomaly-item ${a.severity}">
                <div class="anomaly-icon">${_severityIcon(a.severity)}</div>
                <div class="anomaly-info">
                  <div class="anomaly-title">${_esc(a.transaction?.description || 'Unknown')} — ${Charts.fmtFull(a.transaction?.amount || 0)}</div>
                  <div class="anomaly-reason">${_esc(a.reason)}</div>
                </div>
                <span class="badge badge-${a.severity}">${a.severity}</span>
              </div>`).join('')}</div>`
          : `<div class="empty-state" style="padding:24px"><p>No anomalies detected</p></div>`;

      // Recurring
      document.getElementById('recurring-panel').innerHTML =
        recurring.length
          ? `<div class="recurring-list">${recurring.slice(0, 6).map(r => `
              <div class="recurring-item">
                <div>
                  <div class="recurring-merchant">${_esc(r.merchant)}</div>
                  <div class="recurring-freq">${r.frequency} · confidence ${(r.confidence * 100).toFixed(0)}%</div>
                </div>
                <span class="recurring-amount">${Charts.fmtFull(r.amount)}</span>
              </div>`).join('')}</div>`
          : `<div class="empty-state" style="padding:24px"><p>No recurring payments detected</p></div>`;

    } catch (e) {
      document.getElementById('dash-body').innerHTML =
        `<div class="empty-state"><p style="color:var(--danger)">Failed to load: ${_esc(e.message)}</p></div>`;
    }
  }

  _renderSummaryCards(s) {
    const isNegSavings = s.net_savings < 0;
    const rateColor = s.savings_rate < 0
      ? '#f43f5e'
      : s.savings_rate >= 20 ? '#10b981' : '#f59e0b';

    return `<div class="kpi-grid">

      <div class="kpi-card kpi-income" style="--kpi-delay:0ms">
        <div class="kpi-icon-ring" style="background:rgba(14,165,233,0.1);color:#0ea5e9">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
            <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="kpi-label">Total Income</div>
        <div class="kpi-value income">${Charts.fmtFull(s.total_income)}</div>
        <div class="kpi-sub">${s.transaction_count} transactions · ${this._getPeriodLabel()}</div>
      </div>

      <div class="kpi-card kpi-expense" style="--kpi-delay:80ms">
        <div class="kpi-icon-ring" style="background:rgba(244,63,94,0.1);color:#f43f5e">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1 1 0 100 2h5a1 1 0 100-2h-5zm0 4a1 1 0 100 2h5a1 1 0 100-2h-5zm0 4a1 1 0 100 2h2a1 1 0 100-2h-2z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="kpi-label">Total Expenses</div>
        <div class="kpi-value expense">${Charts.fmtFull(s.total_expenses)}</div>
        <div class="kpi-sub">${s.total_income > 0 ? ((s.total_expenses / s.total_income) * 100).toFixed(1) + '% of income' : '—'}</div>
      </div>

      <div class="kpi-card ${isNegSavings ? 'kpi-neg' : 'kpi-savings'}" style="--kpi-delay:160ms">
        <div class="kpi-icon-ring" style="background:${isNegSavings ? 'rgba(244,63,94,0.1);color:#f43f5e' : 'rgba(79,126,247,0.1);color:#4f7ef7'}">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>
          </svg>
        </div>
        <div class="kpi-label">Net Savings</div>
        <div class="kpi-value ${isNegSavings ? 'expense' : 'savings'}">${isNegSavings ? '−' : ''}${Charts.fmtFull(s.net_savings)}</div>
        <div class="kpi-sub">${isNegSavings ? 'Spending exceeds income' : 'Positive cash flow'}</div>
      </div>

      <div class="kpi-card kpi-rate" style="--kpi-delay:240ms">
        <div class="kpi-icon-ring" style="background:rgba(245,158,11,0.1);color:#f59e0b">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="kpi-label">Savings Rate</div>
        <div class="kpi-value" style="color:${rateColor}">${s.savings_rate.toFixed(1)}%</div>
        <div class="kpi-sub">${s.savings_rate >= 20 ? 'Excellent — keep it up' : s.savings_rate >= 10 ? 'Moderate rate' : s.savings_rate < 0 ? 'Net deficit this period' : 'Low — room to improve'}</div>
      </div>

    </div>`;
  }
}

function _severityIcon(s) {
  /* SVG icons per CLAUDE.md: no emoji for financial data indicators */
  const icons = {
    critical: `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="color:#f43f5e"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4.5zm0 7.5a1 1 0 110-2 1 1 0 010 2z"/></svg>`,
    high:     `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="color:#f43f5e"><path d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"/></svg>`,
    medium:   `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="color:#f59e0b"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4.5zm0 7.5a1 1 0 110-2 1 1 0 010 2z"/></svg>`,
    low:      `<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="color:#9CA3AF"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 110-2 1 1 0 010 2z"/></svg>`,
  };
  return icons[s] || `<span style="color:var(--text-muted)">&#8226;</span>`;
}

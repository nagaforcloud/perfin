/** Analytics page — deep charts: monthly trend, category breakdown, merchants, health */

const HEALTH_DESCRIPTIONS = {
  savings_score:        { label: 'Savings Rate',        tip: 'Measures what % of income you save. Above 20% is great.' },
  consistency_score:    { label: 'Expense Consistency',  tip: 'Low score means your spending varies a lot month-to-month.' },
  budget_score:         { label: 'Budget Control',       tip: 'Penalised when expenses exceed income in any given month.' },
  categorization_score: { label: 'Categorisation',       tip: 'Higher score when more transactions are categorised (not "Needs Review").' },
};

class AnalyticsPage {
  constructor(container) {
    this.el = container;
    this._account = App.state.account;
    this._range   = { label: '1Y', months: 12 };
  }

  async render() {
    this.el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Analytics</div>
          <div class="page-subtitle">Deep dive into your spending patterns</div>
        </div>
        <div class="flex gap-2">
          <div class="daterange-bar" id="ana-daterange"></div>
        </div>
      </div>
      <div class="page-body" id="ana-body">
        <div class="loading-screen" style="height:60vh"><div class="spinner"></div></div>
      </div>`;

    this._buildDatePicker();
    await this._load();
  }

  _buildDatePicker() {
    const bar  = document.getElementById('ana-daterange');
    const opts = [
      { label: '3M',  months: 3  },
      { label: '6M',  months: 6  },
      { label: 'YTD', ytd: true  },
      { label: '1Y',  months: 12 },
      { label: 'All', all: true  },
    ];
    this._range = { label: '1Y', months: 12 };

    bar.innerHTML = opts.map(o =>
      `<button class="date-quick-btn${o.label === '1Y' ? ' active' : ''}" data-label="${o.label}">${o.label}</button>`
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
      return { start_date: `${now.getFullYear()}-01-01`, end_date: now.toISOString().slice(0, 10) };
    }
    const s = new Date(now);
    s.setMonth(s.getMonth() - this._range.months);
    return { start_date: s.toISOString().slice(0, 10), end_date: now.toISOString().slice(0, 10) };
  }

  async _load() {
    const params = { ...this._getDates(), ...(this._account ? { account: this._account } : {}) };

    try {
      const [monthly, cats, merchants, health] = await Promise.all([
        API.Analytics.monthly(params),
        API.Analytics.categories(params),
        API.Analytics.merchants({ ...params, top: 10 }),
        API.Analytics.health(),
      ]);

      document.getElementById('ana-body').innerHTML = `
        <!-- Net savings line chart -->
        <div class="card" style="margin-bottom:16px">
          <div class="chart-title">Net Savings Trend</div>
          <div class="card-body" id="savings-chart"></div>
        </div>

        <!-- Monthly grouped bar -->
        <div class="card" style="margin-bottom:16px">
          <div class="chart-title">Monthly Income vs Expenses</div>
          <div class="card-body" id="monthly-chart"></div>
        </div>

        <div class="analytics-grid">
          <!-- Expense category horizontal bars -->
          <div class="card">
            <div class="chart-title">Top Expense Categories</div>
            <div class="card-body" id="cat-chart"></div>
          </div>

          <!-- Income source breakdown (donut) — replaces the redundant expense donut -->
          <div class="card">
            <div class="chart-title">Income by Source</div>
            <div class="card-body" id="income-donut"></div>
          </div>
        </div>

        <div class="analytics-grid" style="margin-top:16px">
          <!-- Top merchants -->
          <div class="card">
            <div class="chart-title">Top Merchants by Spending</div>
            <div class="card-body" id="merchant-chart"></div>
          </div>

          <!-- Health score -->
          <div class="card">
            <div class="chart-title">Financial Health Score</div>
            <div class="card-body" id="health-panel"></div>
          </div>
        </div>`;

      // Savings line chart (mixed positive/negative fill handled in charts.js)
      const savingsData = monthly.map(m => ({ label: m.month, value: m.net || 0 }));
      document.getElementById('savings-chart').innerHTML = Charts.lineChart(savingsData);

      // Monthly bar chart
      document.getElementById('monthly-chart').innerHTML = Charts.groupedBarChart(monthly);

      // Expense category bars
      const expCats = cats
        .filter(c => c.total_expenses > 0)
        .sort((a, b) => b.total_expenses - a.total_expenses)
        .slice(0, 10)
        .map((c, i) => ({ label: c.category, value: c.total_expenses, color: Charts.color(i) }));
      document.getElementById('cat-chart').innerHTML = Charts.horizontalBars(expCats);

      // Income source donut — unique data vs the expense chart
      const incCats = cats
        .filter(c => c.total_income > 0)
        .sort((a, b) => b.total_income - a.total_income)
        .slice(0, 8)
        .map((c, i) => ({ label: c.category, value: c.total_income, color: Charts.color(i + 4) }));

      if (incCats.length) {
        const { svg: iSvg, legend: iLeg } = Charts.donutChart(incCats, { size: 200 });
        document.getElementById('income-donut').innerHTML =
          `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="flex-shrink:0;width:160px">${iSvg}</div>
            <div class="donut-legend" style="flex:1">${iLeg}</div>
          </div>`;
      } else {
        document.getElementById('income-donut').innerHTML =
          `<div class="empty-state" style="padding:32px"><p>No income transactions in this period</p></div>`;
      }

      // Merchants
      const mData = merchants.map((m, i) => ({
        label: m.merchant, value: m.total, color: Charts.color(i + 5)
      }));
      document.getElementById('merchant-chart').innerHTML =
        mData.length ? Charts.horizontalBars(mData) :
        `<div class="empty-state" style="padding:32px"><p>No merchant data</p></div>`;

      // Health score
      document.getElementById('health-panel').innerHTML = this._renderHealth(health);

    } catch (e) {
      document.getElementById('ana-body').innerHTML =
        `<div class="empty-state"><p style="color:var(--danger)">${_esc(e.message)}</p></div>`;
    }
  }

  _renderHealth(h) {
    const pct    = (h.total_score / h.max_score) * 100;
    const colour = pct >= 80 ? '#10b981' : pct >= 60 ? '#4f7ef7' : pct >= 40 ? '#f59e0b' : '#f43f5e';

    const metricRows = Object.entries(HEALTH_DESCRIPTIONS).map(([key, meta]) => {
      const score = h.metrics?.[key] || 0;
      const maxM  = 25;
      const p     = (score / maxM) * 100;
      const mc    = p >= 80 ? '#10b981' : p >= 60 ? '#4f7ef7' : p >= 40 ? '#f59e0b' : '#f43f5e';
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:12px;display:flex;align-items:center;gap:4px">
            ${_esc(meta.label)}
            <span class="health-tip" data-tip="${_esc(meta.tip)}" title="${_esc(meta.tip)}"
              style="width:14px;height:14px;border-radius:50%;background:var(--border);
                color:var(--text-muted);font-size:10px;display:inline-flex;align-items:center;
                justify-content:center;cursor:help;flex-shrink:0">?</span>
          </span>
          <span style="font-size:12px;font-weight:700;color:${mc}">${score}/${maxM}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${p}%;background:${mc}"></div>
        </div>
      </div>`;
    }).join('');

    return `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:52px;font-weight:800;color:${colour};line-height:1">${h.total_score}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">out of ${h.max_score} — <strong style="color:${colour}">${h.rating}</strong></div>
        <div style="margin:14px 0 4px">
          <div class="progress-bar" style="height:10px">
            <div class="progress-fill" style="width:${pct}%;background:${colour}"></div>
          </div>
        </div>
      </div>
      ${metricRows}
      <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        <div style="padding:10px;background:var(--success-bg);border-radius:8px;text-align:center">
          <div style="color:var(--text-muted);margin-bottom:2px">Income</div>
          <div style="font-weight:700;color:var(--success)">${Charts.fmtFull(h.summary?.total_income || 0)}</div>
        </div>
        <div style="padding:10px;background:var(--danger-bg);border-radius:8px;text-align:center">
          <div style="color:var(--text-muted);margin-bottom:2px">Expenses</div>
          <div style="font-weight:700;color:var(--danger)">${Charts.fmtFull(h.summary?.total_expenses || 0)}</div>
        </div>
      </div>`;
  }
}

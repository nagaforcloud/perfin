/**
 * SVG chart library — pure functions that return SVG markup strings.
 * No external dependencies.  All charts use a fixed viewBox and scale
 * responsively via CSS ( svg { width: 100%; height: auto } ).
 */
const Charts = (() => {

  // Colour palette for categories / slices
  const PALETTE = [
    '#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6',
    '#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b',
    '#a855f7','#06b6d4','#84cc16','#e11d48','#0ea5e9',
  ];

  function color(i) { return PALETTE[i % PALETTE.length]; }

  // Unique ID counter so multiple charts on the same page don't share SVG ids
  let _uid = 0;
  function _id() { return 'c' + (++_uid); }

  // ── helpers ──────────────────────────────────────────────────────────────

  function fmt(n) {
    if (Math.abs(n) >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    if (Math.abs(n) >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'K';
    return '₹' + Math.abs(n).toFixed(0);
  }

  function fmtFull(n) {
    return '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  /** Convert YYYY-MM (or YYYY-MM-DD) → "Jan '25" for axis labels */
  function fmtMonth(s) {
    if (!s) return String(s);
    const parts = String(s).slice(0, 7).split('-');
    if (parts.length === 2) {
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec'];
      const m = parseInt(parts[1], 10) - 1;
      return (MONTHS[m] || parts[1]) + " '" + parts[0].slice(2);
    }
    return s;
  }

  function svgText(x, y, txt, attrs = '') {
    return `<text x="${x}" y="${y}" ${attrs}>${esc(txt)}</text>`;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function niceMax(v) {
    if (v === 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / mag) * mag;
  }

  // ── Bar chart (grouped income / expense) ─────────────────────────────────

  /**
   * @param {Array<{month:string, income:number, expenses:number}>} data
   * @param {{width?:number, height?:number}} opts
   */
  function groupedBarChart(data, opts = {}) {
    const W = opts.width  || 700;
    const H = opts.height || 300;
    const m = { top: 24, right: 24, bottom: 52, left: 64 };
    const iW = W - m.left - m.right;
    const iH = H - m.top  - m.bottom;

    if (!data || !data.length) return emptySvg(W, H, 'No data');

    const maxVal = niceMax(Math.max(...data.map(d => Math.max(d.income || 0, d.expenses || 0)), 1));
    const yScale = v => iH - (v / maxVal) * iH;

    const groupW = iW / data.length;
    const barW   = Math.min(groupW * 0.35, 28);
    const gap    = barW * 0.25;

    const yTicks = 5;
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      style="overflow:visible">
      <defs>
        <style>
          .chart-axis { font: 11px 'JetBrains Mono', monospace; fill: #94a3b8; }
          .bar-income  { fill: #0ea5e9; cursor: default; }
          .bar-expense { fill: #f43f5e; cursor: default; }
          .bar-income:hover  { fill: #0284c7; }
          .bar-expense:hover { fill: #e11d48; }
        </style>
      </defs>
      <g transform="translate(${m.left},${m.top})">`;

    // Y grid + axis
    for (let i = 0; i <= yTicks; i++) {
      const val = (maxVal / yTicks) * i;
      const y   = yScale(val);
      svg += `<line x1="0" y1="${y}" x2="${iW}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"/>`;
      svg += svgText(-8, y + 4, fmt(val), `class="chart-axis" text-anchor="end"`);
    }

    // Bars + x labels + tooltips
    data.forEach((d, i) => {
      const cx      = groupW * i + groupW / 2;
      const xIncome = cx - barW - gap / 2;
      const xExpense = cx + gap / 2;

      const income   = d.income   || 0;
      const expenses = d.expenses || 0;
      const hIncome  = iH - yScale(income);
      const hExpense = iH - yScale(expenses);

      svg += `<rect class="bar-income"  x="${xIncome}"  y="${yScale(income)}"
        width="${barW}" height="${Math.max(hIncome, 0)}" rx="3">
        <title>Income ${fmtMonth(d.month)}: ${fmtFull(income)}</title></rect>`;
      svg += `<rect class="bar-expense" x="${xExpense}" y="${yScale(expenses)}"
        width="${barW}" height="${Math.max(hExpense, 0)}" rx="3">
        <title>Expenses ${fmtMonth(d.month)}: ${fmtFull(expenses)}</title></rect>`;

      // X label — formatted month
      svg += svgText(cx, iH + 18, fmtMonth(d.month), `class="chart-axis" text-anchor="middle"`);
    });

    // Legend
    svg += `<g transform="translate(${iW - 120},${-16})">
      <rect x="0" y="0" width="10" height="10" rx="2" fill="#0ea5e9"/>
      <text x="14" y="9" class="chart-axis" fill="#64748b">Income</text>
      <rect x="68" y="0" width="10" height="10" rx="2" fill="#f43f5e"/>
      <text x="82" y="9" class="chart-axis" fill="#64748b">Expense</text>
    </g>`;

    svg += `</g></svg>`;
    return svg;
  }

  // ── Donut / pie chart ─────────────────────────────────────────────────────

  /**
   * @param {Array<{label:string, value:number, color?:string}>} data
   * @param {{size?:number, inner?:number}} opts
   * Returns { svg, legend } where legend is an HTML string for a legend list.
   */
  function donutChart(data, opts = {}) {
    const SIZE  = opts.size  || 200;
    const INNER = opts.inner || 68;
    const CX = SIZE / 2, CY = SIZE / 2;
    const R  = SIZE / 2 - 6;

    const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0);
    if (!total) return { svg: emptySvg(SIZE, SIZE, 'No data'), legend: '' };

    let angle = -Math.PI / 2;
    let paths = '';

    const slices = data.map((d, i) => {
      const pct   = Math.max(d.value, 0) / total;
      const sweep = pct * 2 * Math.PI;
      const c     = d.color || color(i);

      const x1 = CX + R * Math.cos(angle);
      const y1 = CY + R * Math.sin(angle);
      angle += sweep;
      const x2 = CX + R * Math.cos(angle);
      const y2 = CY + R * Math.sin(angle);

      const ix1 = CX + INNER * Math.cos(angle - sweep);
      const iy1 = CY + INNER * Math.sin(angle - sweep);
      const ix2 = CX + INNER * Math.cos(angle);
      const iy2 = CY + INNER * Math.sin(angle);

      const large = sweep > Math.PI ? 1 : 0;

      paths += `<path d="M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2}
        L${ix2} ${iy2} A${INNER} ${INNER} 0 ${large} 0 ${ix1} ${iy1} Z"
        fill="${c}" stroke="#151f33" stroke-width="1.5">
        <title>${esc(d.label)}: ${fmtFull(d.value)} (${(pct*100).toFixed(1)}%)</title>
      </path>`;

      return { ...d, pct, color: c };
    });

    const svg = `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
      ${paths}
      <text x="${CX}" y="${CY - 4}" text-anchor="middle"
        style="font:11px 'JetBrains Mono',monospace;fill:#94a3b8">Total</text>
      <text x="${CX}" y="${CY + 14}" text-anchor="middle"
        style="font:500 13px 'JetBrains Mono',monospace;fill:#e2e8f0">${fmt(total)}</text>
    </svg>`;

    // Legend shows both amount and percentage
    const legend = slices.slice(0, 8).map(s =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${s.color}"></div>
        <span class="legend-label">${esc(s.label)}</span>
        <span class="legend-pct">${fmtFull(s.value)}</span>
        <span style="color:var(--text-light);font-size:11px;margin-left:2px">${(s.pct * 100).toFixed(1)}%</span>
      </div>`
    ).join('');

    return { svg, legend };
  }

  // ── Sparkline (single line) ───────────────────────────────────────────────

  function sparkline(data, opts = {}) {
    const W = opts.width  || 200;
    const H = opts.height || 60;
    const c = opts.color  || '#6366f1';
    const gid = _id();

    if (!data || data.length < 2) return `<svg viewBox="0 0 ${W} ${H}"></svg>`;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 8) - 4;
      return `${x},${y}`;
    });

    const fill = pts.map((p, i) => {
      const [x, y] = p.split(',');
      return i === 0 ? `M${x},${H} L${x},${y}` : `L${x},${y}`;
    }).join(' ') + ` L${W},${H} Z`;

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${c}" stop-opacity=".25"/>
          <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${fill}" fill="url(#${gid})"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  }

  // ── Horizontal bar chart (category amounts) ───────────────────────────────

  function horizontalBars(data, opts = {}) {
    const W     = opts.width || 480;
    const barH  = opts.barHeight || 22;
    const gap   = 8;
    const leftW = opts.labelWidth || 140;
    const topPad = 8;

    const items = data.slice(0, opts.maxItems || 10);
    const H     = topPad + items.length * (barH + gap);
    const maxVal = Math.max(...items.map(d => Math.abs(d.value)), 1);
    const innerW = W - leftW - 72; // 72px for value label on right

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <style>.hbar-label { font: 12px 'JetBrains Mono', monospace; fill: #64748b; }
             .hbar-value { font: 500 12px 'JetBrains Mono', monospace; fill: #e2e8f0; }</style>`;

    items.forEach((d, i) => {
      const y   = topPad + i * (barH + gap);
      const bW  = (Math.abs(d.value) / maxVal) * innerW;
      const c   = d.color || color(i);

      svg += svgText(leftW - 6, y + barH / 2 + 4, d.label,
        `class="hbar-label" text-anchor="end"`);
      svg += `<rect x="${leftW}" y="${y}" width="${Math.max(bW, 2)}" height="${barH}"
        rx="4" fill="${c}" opacity=".85">
        <title>${esc(d.label)}: ${fmtFull(d.value)}</title></rect>`;
      svg += svgText(leftW + bW + 6, y + barH / 2 + 4, fmt(d.value),
        `class="hbar-value"`);
    });

    svg += '</svg>';
    return svg;
  }

  // ── Line chart (net savings trend) ───────────────────────────────────────

  function lineChart(data, opts = {}) {
    const W = opts.width  || 700;
    const H = opts.height || 220;
    const m = { top: 24, right: 24, bottom: 40, left: 64 };
    const iW = W - m.left - m.right;
    const iH = H - m.top  - m.bottom;
    const gid = _id();

    if (!data || data.length < 2) return emptySvg(W, H, 'Insufficient data');

    const values = data.map(d => d.value);
    const minV   = Math.min(...values);
    const maxV   = Math.max(...values);
    const range  = maxV - minV || 1;
    const posColor = '#6366f1';
    const negColor = '#f43f5e';

    const xScale = i => (i / (data.length - 1)) * iW;
    const yScale = v => iH - ((v - minV) / range) * (iH - 8) - 4;

    const pts = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`);

    // Area fill path (shared by both positive and negative clip regions)
    const area = pts.map((p, i) => {
      const [x, y] = p.split(',');
      return i === 0 ? `M${x},${iH} L${x},${y}` : `L${x},${y}`;
    }).join(' ') + ` L${iW},${iH} Z`;

    // Determine if we have mixed positive/negative values
    const hasMixed = minV < 0 && maxV > 0;
    const allNeg   = maxV <= 0;
    const zy       = hasMixed ? yScale(0) : null; // y-pixel of zero line

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>`;

    if (hasMixed) {
      // Gradient for positive area (above zero line)
      svg += `<linearGradient id="${gid}p" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${posColor}" stop-opacity=".2"/>
          <stop offset="100%" stop-color="${posColor}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${gid}n" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${negColor}" stop-opacity="0"/>
          <stop offset="100%" stop-color="${negColor}" stop-opacity=".2"/>
        </linearGradient>
        <clipPath id="${gid}cp"><rect x="0" y="0" width="${iW}" height="${zy}"/></clipPath>
        <clipPath id="${gid}cn"><rect x="0" y="${zy}" width="${iW}" height="${iH - zy}"/></clipPath>`;
    } else {
      const fc = allNeg ? negColor : posColor;
      svg += `<linearGradient id="${gid}f" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${fc}" stop-opacity=".2"/>
          <stop offset="100%" stop-color="${fc}" stop-opacity="0"/>
        </linearGradient>`;
    }

    svg += `<style>.lc-axis { font: 11px 'JetBrains Mono', monospace; fill: #94a3b8; }</style>
      </defs>
      <g transform="translate(${m.left},${m.top})">`;

    // Zero line (if mixed)
    if (hasMixed) {
      svg += `<line x1="0" y1="${zy}" x2="${iW}" y2="${zy}" stroke="#94a3b8" stroke-dasharray="4 2" stroke-width="1"/>`;
      // Fill: positive part (above zero) in blue, negative (below zero) in red
      svg += `<path d="${area}" fill="url(#${gid}p)" clip-path="url(#${gid}cp)"/>`;
      svg += `<path d="${area}" fill="url(#${gid}n)" clip-path="url(#${gid}cn)"/>`;
    } else {
      svg += `<path d="${area}" fill="url(#${gid}f)"/>`;
    }

    // Line: color by majority
    const lineColor = allNeg ? negColor : posColor;
    svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${lineColor}"
      stroke-width="2.5" stroke-linejoin="round"/>`;

    // Data points
    data.forEach((d, i) => {
      const x = xScale(i), y = yScale(d.value);
      const pc = d.value >= 0 ? posColor : negColor;
      svg += `<circle cx="${x}" cy="${y}" r="3" fill="${pc}" stroke="#151f33" stroke-width="1.5">
        <title>${fmtMonth(d.label || d.month || '')}: ${fmtFull(d.value)}</title></circle>`;
    });

    // X labels
    const step = Math.max(1, Math.floor(data.length / 8));
    data.forEach((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        svg += svgText(xScale(i), iH + 18, fmtMonth(d.label || d.month || ''),
          `class="lc-axis" text-anchor="middle"`);
      }
    });

    // Y axis ticks
    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const v = minV + (range / ticks) * t;
      const y = yScale(v);
      svg += `<line x1="0" y1="${y}" x2="${iW}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3"/>`;
      svg += svgText(-8, y + 4, fmt(v), `class="lc-axis" text-anchor="end"`);
    }

    svg += `</g></svg>`;
    return svg;
  }

  // ── Fallback empty SVG ─────────────────────────────────────────────────────

  function emptySvg(w, h, msg = 'No data') {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <text x="${w/2}" y="${h/2}" text-anchor="middle"
        style="font:13px system-ui;fill:#94a3b8">${esc(msg)}</text>
    </svg>`;
  }

  return { groupedBarChart, donutChart, sparkline, horizontalBars, lineChart,
           color, fmt, fmtFull, fmtMonth };
})();

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:   [99,  102, 241],
  primaryDk: [79,  70,  229],
  success:   [34,  197, 94],
  warning:   [234, 179, 8],
  danger:    [239, 68,  68],
  info:      [6,   182, 212],
  text:      [15,  23,  42],
  subtext:   [71,  85,  105],
  muted:     [148, 163, 184],
  border:    [226, 232, 240],
  surface:   [248, 250, 252],
  surface2:  [241, 245, 249],
  white:     [255, 255, 255],
};

const A4_W  = 210;
const A4_H  = 297;
const A4_LW = 297; // landscape width
const A4_LH = 210; // landscape height
const M     = 14;  // margin
const CW    = A4_W - 2 * M;  // content width (portrait)

const money = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// ─── Shared drawing helpers ───────────────────────────────────────────────────

function hexToRgb(hex) {
  if (!hex) return C.primary;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : C.primary;
}

/** Draw a header band with gradient feel */
function drawHeader(doc, title, subtitle, pageW = A4_W) {
  doc.setFillColor(...C.primaryDk);
  doc.rect(0, 0, pageW * 0.55, 30, 'F');
  doc.setFillColor(...C.primary);
  doc.rect(pageW * 0.45, 0, pageW * 0.55, 30, 'F');

  // Left: app name + title
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ExpenseTracker', M, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(title, M, 21);

  // Right: subtitle + generated date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(subtitle, pageW - M, 12, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.text(`Generated ${dateStr}`, pageW - M, 21, { align: 'right' });
}

/** Draw a section label with a rule line underneath */
function section(doc, label, y, pageW = A4_W) {
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.muted);
  doc.text(label.toUpperCase(), M, y);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.line(M, y + 1.8, pageW - M, y + 1.8);
  return y + 7.5;
}

/** Draw a row of stat boxes; returns y after the row */
function statBoxRow(doc, boxes, y, h = 28, pageW = A4_W) {
  const gap = 4;
  const contentW = pageW - 2 * M;
  const w = (contentW - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach((box, i) => {
    const x = M + i * (w + gap);
    doc.setFillColor(...C.surface);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
    if (box.accent) {
      doc.setFillColor(...box.accent);
      doc.roundedRect(x, y, 3.5, h, 1.5, 1.5, 'F');
    }
    doc.setTextColor(...C.muted);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text((box.label || '').toUpperCase(), x + w / 2, y + 7.5, { align: 'center' });
    doc.setTextColor(...(box.color || C.text));
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(String(box.value || '—'), x + w / 2, y + 18, { align: 'center' });
    if (box.sub) {
      doc.setTextColor(...C.muted);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(box.sub, x + w / 2, y + 24.5, { align: 'center' });
    }
  });
  return y + h + 5;
}

/** Draw a horizontal progress bar */
function progressBar(doc, x, y, w, h, pct, fillColor = C.primary) {
  doc.setFillColor(...C.border);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  const fw = Math.min(Math.max(pct / 100, 0), 1) * w;
  if (fw > 0.5) {
    doc.setFillColor(...fillColor);
    doc.roundedRect(x, y, fw, h, h / 2, h / 2, 'F');
  }
}

/** Draw a page footer with page number */
function footer(doc, pageNum, total, pageW = A4_W, pageH = A4_H) {
  doc.setFillColor(...C.surface2);
  doc.rect(0, pageH - 9, pageW, 9, 'F');
  doc.setTextColor(...C.muted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('ExpenseTracker — Personal Expense Report', M, pageH - 3.5);
  doc.text(`Page ${pageNum} of ${total}`, pageW - M, pageH - 3.5, { align: 'right' });
}

// ─── Category horizontal bars (for spending breakdown) ────────────────────────

function categoryBars(doc, cats, y, pageW = A4_W) {
  const ROW_H = 10;
  const BAR_X  = M + 68;
  const BAR_W  = pageW - M - BAR_X - 36;
  const maxVal = Math.max(...cats.map(c => c.total), 1);

  cats.forEach((cat, i) => {
    const ry = y + i * ROW_H;
    const color = hexToRgb(cat.color);

    // Colored dot
    doc.setFillColor(...color);
    doc.circle(M + 3, ry + 3.5, 2.5, 'F');

    // Name
    doc.setTextColor(...C.text);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${cat.icon || ''} ${cat.name}`.trim().slice(0, 24), M + 8, ry + 5);

    // Bar background + fill
    doc.setFillColor(...C.border);
    doc.roundedRect(BAR_X, ry + 1, BAR_W, 5, 1, 1, 'F');
    const fw = (cat.total / maxVal) * BAR_W;
    if (fw > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(BAR_X, ry + 1, fw, 5, 1, 1, 'F');
    }

    // Amount
    doc.setTextColor(...C.text);
    doc.setFont('helvetica', 'bold');
    doc.text(money(cat.total), BAR_X + BAR_W + 3, ry + 5);

    // Pct
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${cat.pct}%`, pageW - M, ry + 5, { align: 'right' });
  });

  return y + cats.length * ROW_H + 4;
}

// ─── Mini vertical bar chart (monthly trend) ─────────────────────────────────

function miniBarChart(doc, data, y, chartH = 36, pageW = A4_W) {
  if (!data.length) return y;
  const contentW = pageW - 2 * M;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW   = Math.min((contentW / data.length) - 3, 28);
  const totalBarSpace = barW * data.length;
  const spacing = (contentW - totalBarSpace) / Math.max(data.length - 1, 1);

  data.forEach((d, i) => {
    const bh  = (d.value / maxVal) * chartH;
    const bx  = M + i * (barW + spacing);
    const by  = y + chartH - bh;

    // Bar
    doc.setFillColor(...C.primary);
    doc.roundedRect(bx, by, barW, bh, 1.5, 1.5, 'F');

    // Value label above bar
    if (d.value > 0) {
      doc.setTextColor(...C.subtext);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`$${(d.value / 1000).toFixed(1)}k`, bx + barW / 2, by - 1.5, { align: 'center' });
    }

    // Month label below axis
    doc.setTextColor(...C.muted);
    doc.setFontSize(7);
    doc.text(d.label, bx + barW / 2, y + chartH + 5, { align: 'center' });
  });

  return y + chartH + 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY REPORT PDF  (2 pages, portrait A4)
// ─────────────────────────────────────────────────────────────────────────────

export function exportSummaryPDF({
  affordability, categoryTotals, ytdSummary,
  topExpenses, recurringVendors, splitSavings, rollingTrend,
  settings, dateFilter, categories,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const period = dateFilter?.mode === 'month'  ? dateFilter.month
    : dateFilter?.mode === 'range' ? `${dateFilter.start} – ${dateFilter.end}`
    : 'All Time';

  const budget   = settings?.monthlyBudget || 0;
  const spent    = affordability?.totalSpent ?? categoryTotals.reduce((s, c) => s + c.total, 0);
  const pct      = affordability?.percentUsed ?? (budget > 0 ? Math.round((spent / budget) * 100) : 0);
  const statusClr = pct >= 100 ? C.danger : pct >= 75 ? C.warning : C.success;

  // ── PAGE 1 ─────────────────────────────────────────────────────────────────

  drawHeader(doc, 'Monthly Expense Report', period);
  let y = 36;

  // ── Snapshot stat boxes
  y = section(doc, 'Snapshot', y);
  const snap = [
    { label: 'Monthly Budget',    value: budget > 0 ? money(budget) : 'Not Set', accent: C.primary },
    { label: 'Total Spent (My Share)', value: money(spent), accent: statusClr, color: statusClr,
      sub: budget > 0 ? `${pct}% of budget` : undefined },
    { label: 'Remaining Budget',  value: budget > 0 ? money(Math.max(0, budget - spent)) : '—',
      accent: pct >= 100 ? C.danger : C.success, color: pct >= 100 ? C.danger : C.success },
    ...(affordability ? [{
      label: 'Safe to Spend / Day', value: money(affordability.safeToSpend), accent: C.info,
      sub: `${affordability.daysRemaining} days remaining`,
    }] : []),
  ];
  y = statBoxRow(doc, snap, y);

  // Budget progress bar
  if (budget > 0) {
    doc.setTextColor(...C.subtext);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Budget usage: ${pct}%`, M, y + 4);
    progressBar(doc, M + 32, y + 1, CW - 42, 5, pct, statusClr);
    doc.setTextColor(...C.muted);
    doc.setFontSize(7);
    doc.text(`${money(spent)} / ${money(budget)}`, A4_W - M, y + 5, { align: 'right' });
    y += 12;
  }

  // ── Affordability insight
  if (affordability) {
    y = section(doc, 'Affordability Insight', y);
    const isOver = affordability.projectedDeficit < 0;
    const aBoxes = [
      { label: 'Daily Spend Rate',     value: money(affordability.dailyRate) },
      { label: 'Projected Month-End',  value: money(affordability.projected) },
      { label: 'Projected Surplus/Deficit', value: money(affordability.projectedDeficit),
        color: isOver ? C.danger : C.success, accent: isOver ? C.danger : C.success },
      { label: 'Days Elapsed',         value: `${affordability.daysElapsed} / ${affordability.daysInMonth}` },
    ];
    y = statBoxRow(doc, aBoxes, y, 22);

    const narrative = isOver
      ? `⚠  At your current pace, you will exceed your budget by ${money(Math.abs(affordability.projectedDeficit))} by month end.`
      : `✓  You're on track! Projected to end the month with ${money(affordability.projectedDeficit)} remaining.`;
    doc.setFillColor(...(isOver ? [254, 242, 242] : [240, 253, 244]));
    doc.roundedRect(M, y, CW, 9, 2, 2, 'F');
    doc.setTextColor(...(isOver ? C.danger : C.success));
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(narrative, M + 3, y + 6);
    y += 14;
  }

  // ── Category breakdown
  if (categoryTotals.length > 0) {
    y = section(doc, 'Spending by Category', y);
    const total = categoryTotals.reduce((s, c) => s + c.total, 0);
    const cats  = categoryTotals.slice(0, 10).map(c => ({
      ...c, pct: total > 0 ? Math.round((c.total / total) * 100) : 0,
    }));
    y = categoryBars(doc, cats, y);
  }

  footer(doc, 1, 2);

  // ── PAGE 2 ─────────────────────────────────────────────────────────────────

  doc.addPage();
  drawHeader(doc, 'Trends & Details', period);
  y = 36;

  // ── 6-month trend
  const trendData = (rollingTrend || []).slice(-6).filter(d => d.myShare > 0);
  if (trendData.length > 0) {
    y = section(doc, '6-Month Spending Trend (My Share)', y);
    y = miniBarChart(doc, trendData.map(d => ({ label: d.label, value: d.myShare })), y, 36);
    y += 2;
  }

  // ── Top 10 largest expenses
  if (topExpenses.length > 0) {
    y = section(doc, 'Top 10 Largest Expenses', y);
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Description', 'Category', 'Amount (My Share)']],
      body: topExpenses.slice(0, 10).map(t => {
        const cat = categories?.find(c => c.id === t.categoryId);
        return [t.date || '', (t.description || t.rawDescription || '').slice(0, 38), cat?.name || '—', money(t.myShare)];
      }),
      styles:          { fontSize: 8, cellPadding: 2.5 },
      headStyles:      { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: C.surface },
      columnStyles:    { 3: { halign: 'right', fontStyle: 'bold' } },
      margin:          { left: M, right: M },
      theme:           'grid',
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── YTD summary boxes
  y = section(doc, 'Year-to-Date Summary', y);
  const ytdBoxes = [
    { label: 'Total Gross',       value: money(ytdSummary.totalGross) },
    { label: 'Total My Share',    value: money(ytdSummary.totalMyShare), accent: C.primary, color: C.primary },
    { label: 'Split Savings YTD', value: money(splitSavings.ytd), accent: C.success, color: C.success },
    { label: 'Credits / Refunds', value: money(ytdSummary.totalCredits), accent: C.info },
    { label: 'Transactions',      value: `${ytdSummary.transactionCount}` },
  ];
  y = statBoxRow(doc, ytdBoxes, y, 22);

  // ── Recurring vendors (if space)
  if (recurringVendors?.length > 0 && y < A4_H - 60) {
    y = section(doc, 'Recurring Expenses Detected', y);
    autoTable(doc, {
      startY: y,
      head: [['Vendor', 'Months', 'Avg / Month', 'Total']],
      body: recurringVendors.slice(0, 8).map(v => [
        (v.vendor || '').slice(0, 32),
        `${v.monthCount}×`,
        money(v.avgAmount),
        money(v.totalAmount),
      ]),
      styles:          { fontSize: 7.5, cellPadding: 2.5 },
      headStyles:      { fillColor: [71, 85, 105], textColor: C.white, fontSize: 7.5 },
      alternateRowStyles: { fillColor: C.surface },
      columnStyles:    { 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      margin:          { left: M, right: M },
      theme:           'grid',
    });
  }

  footer(doc, 2, 2);

  doc.save(`expense-report-${period.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER PDF  (landscape A4, multi-page table)
// ─────────────────────────────────────────────────────────────────────────────

export function exportLedgerPDF(transactions, categories, periodLabel = 'All Transactions') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Header band
  doc.setFillColor(...C.primaryDk);
  doc.rect(0, 0, A4_LW * 0.5, 24, 'F');
  doc.setFillColor(...C.primary);
  doc.rect(A4_LW * 0.45, 0, A4_LW * 0.55, 24, 'F');

  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('ExpenseTracker — Unified Ledger', M, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Period: ${periodLabel}   ·   ${transactions.length} transactions   ·   Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    M, 19
  );

  // ── Summary strip
  const debits  = transactions.filter(t => t.transactionType === 'Debit');
  const credits = transactions.filter(t => t.transactionType === 'Credit');
  const gross   = debits.reduce((s, t) => s + (t.amount  || 0), 0);
  const share   = debits.reduce((s, t) => s + (t.myShare || 0), 0);
  const savings = debits.reduce((s, t) => s + (t.splitSavings || 0), 0);
  const cred    = credits.reduce((s, t) => s + (t.amount || 0), 0);

  doc.setFillColor(...C.surface2);
  doc.rect(0, 24, A4_LW, 12, 'F');

  [
    `Transactions: ${transactions.length}`,
    `Gross: ${money(gross)}`,
    `My Share: ${money(share)}`,
    `Split Savings: ${money(savings)}`,
    `Credits / Refunds: ${money(cred)}`,
  ].forEach((txt, i) => {
    doc.setTextColor(i === 0 ? C.subtext : C.primary)[i === 0 ? 0 : 0]; // placeholder
    doc.setTextColor(...(i === 0 ? C.subtext : C.text));
    doc.setFontSize(7.5);
    doc.setFont('helvetica', i === 0 ? 'normal' : 'bold');
    doc.text(txt, M + i * 54, 32);
  });

  // ── Build lookup maps
  const catById = {};
  const subById = {};
  categories.forEach(c => {
    catById[c.id] = c;
    (c.subcategories || []).forEach(s => { subById[s.id] = s; });
  });

  // ── Table rows
  const rows = [...transactions]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(t => {
      const cat = catById[t.categoryId];
      const sub = subById[t.subcategoryId];
      const splitLabel =
        t.split?.type === 'DIVIDE_N'     ? `÷${t.split.divisor}` :
        t.split?.type === 'CUSTOM_AMOUNT' ? 'Custom' : 'Full';
      return {
        data: [
          t.date || '',
          (t.description || t.rawDescription || '').slice(0, 42),
          t.bank || '—',
          cat?.name || 'Uncategorized',
          sub?.name || '—',
          t.transactionType || '',
          money(t.amount),
          splitLabel,
          money(t.myShare),
          t.splitSavings > 0 ? money(t.splitSavings) : '—',
          (t.notes || '').slice(0, 28),
        ],
        isCredit: t.transactionType === 'Credit',
      };
    });

  autoTable(doc, {
    startY: 38,
    head: [['Date', 'Description', 'Bank', 'Category', 'Subcategory', 'Type', 'Amount', 'Split', 'My Share', 'Saved', 'Notes']],
    body: rows.map(r => r.data),
    styles:          { fontSize: 7, cellPadding: 2, overflow: 'ellipsize' },
    headStyles:      { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3 },
    alternateRowStyles: { fillColor: C.surface },
    columnStyles: {
      0:  { cellWidth: 20 },
      1:  { cellWidth: 58 },
      2:  { cellWidth: 22 },
      3:  { cellWidth: 28 },
      4:  { cellWidth: 24 },
      5:  { cellWidth: 14, halign: 'center' },
      6:  { cellWidth: 22, halign: 'right' },
      7:  { cellWidth: 13, halign: 'center' },
      8:  { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      9:  { cellWidth: 18, halign: 'right' },
      10: { cellWidth: 'auto' },
    },
    willDrawCell(data) {
      if (data.section === 'body' && rows[data.row.index]?.isCredit) {
        doc.setFillColor(240, 253, 244); // light green for credit rows
      }
    },
    didDrawPage() {
      const cur   = doc.getCurrentPageInfo().pageNumber;
      const total = doc.getNumberOfPages();
      doc.setFillColor(...C.surface2);
      doc.rect(0, A4_LH - 9, A4_LW, 9, 'F');
      doc.setTextColor(...C.muted);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('ExpenseTracker — Unified Ledger Export', M, A4_LH - 3.5);
      doc.text(`Page ${cur} of ${total}`, A4_LW - M, A4_LH - 3.5, { align: 'right' });
    },
    margin: { left: M, right: M },
    theme:  'grid',
  });

  doc.save(`ledger-${periodLabel.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}
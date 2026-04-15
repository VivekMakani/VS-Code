/**
 * Build monthly spending buckets from transactions.
 * Returns array of { month: 'YYYY-MM', gross, myShare, count, byCategory }
 */
export function buildMonthlyBuckets(transactions) {
  const buckets = {};
  transactions.forEach(txn => {
    if (txn.excluded) return;
    const month = txn.date ? txn.date.slice(0, 7) : 'unknown';
    if (!buckets[month]) {
      buckets[month] = { month, gross: 0, myShare: 0, count: 0, byCategory: {} };
    }
    const b = buckets[month];
    if (txn.transactionType === 'Debit') {
      b.gross += txn.amount || 0;
      b.myShare += txn.myShare || 0;
      b.count += 1;
      const catId = txn.categoryId || 'cat_uncategorized';
      b.byCategory[catId] = (b.byCategory[catId] || 0) + (txn.myShare || 0);
    }
  });
  return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Build category totals for a given month (or all if month is null).
 * Returns array of { categoryId, total, count } sorted by total desc.
 */
export function buildCategoryTotals(transactions, month = null) {
  const totals = {};
  transactions.forEach(txn => {
    if (txn.excluded) return;
    if (txn.transactionType !== 'Debit') return;
    if (month && !txn.date?.startsWith(month)) return;
    const catId = txn.categoryId || 'cat_uncategorized';
    if (!totals[catId]) totals[catId] = { categoryId: catId, total: 0, count: 0 };
    totals[catId].total += txn.myShare || 0;
    totals[catId].count += 1;
  });
  return Object.values(totals)
    .sort((a, b) => b.total - a.total)
    .map(t => ({ ...t, total: Math.round(t.total * 100) / 100 }));
}

/**
 * Build subcategory totals for a given category and month.
 */
export function buildSubcategoryTotals(transactions, categoryId, month = null) {
  const totals = {};
  transactions.forEach(txn => {
    if (txn.excluded) return;
    if (txn.transactionType !== 'Debit') return;
    if (txn.categoryId !== categoryId) return;
    if (month && !txn.date?.startsWith(month)) return;
    const subId = txn.subcategoryId || 'none';
    if (!totals[subId]) totals[subId] = { subcategoryId: subId, total: 0, count: 0 };
    totals[subId].total += txn.myShare || 0;
    totals[subId].count += 1;
  });
  return Object.values(totals)
    .sort((a, b) => b.total - a.total)
    .map(t => ({ ...t, total: Math.round(t.total * 100) / 100 }));
}

/**
 * Build rolling N-month trend.
 * Returns array of last N months with their totals.
 */
export function buildRollingTrend(transactions, months = 12) {
  const buckets = buildMonthlyBuckets(transactions);
  // Get the last N months from today
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.find(b => b.month === monthKey);
    result.push({
      month: monthKey,
      label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      myShare: bucket ? bucket.myShare : 0,
      gross: bucket ? bucket.gross : 0,
      count: bucket ? bucket.count : 0,
    });
  }
  return result;
}

/**
 * Calculate YTD totals for the current fiscal year.
 */
export function buildYTDSummary(transactions, fiscalYearStartMonth = 1) {
  const now = new Date();
  const year = now.getFullYear();
  const startMonth = fiscalYearStartMonth - 1;
  const startDate = new Date(year, startMonth, 1);
  const ytdTxns = transactions.filter(t => {
    if (!t.date) return false;
    return new Date(t.date) >= startDate && !t.excluded;
  });
  const debits = ytdTxns.filter(t => t.transactionType === 'Debit');
  const credits = ytdTxns.filter(t => t.transactionType === 'Credit');
  const totalGross = debits.reduce((s, t) => s + (t.amount || 0), 0);
  const totalMyShare = debits.reduce((s, t) => s + (t.myShare || 0), 0);
  const totalSplitSavings = debits.reduce((s, t) => s + (t.splitSavings || 0), 0);
  const totalCredits = credits.reduce((s, t) => s + (t.amount || 0), 0);
  return {
    totalGross: Math.round(totalGross * 100) / 100,
    totalMyShare: Math.round(totalMyShare * 100) / 100,
    totalSplitSavings: Math.round(totalSplitSavings * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    transactionCount: debits.length,
  };
}

/**
 * Build daily spending totals between startDate and endDate (inclusive, 'YYYY-MM-DD').
 * Returns array of { date, label, amount }.
 */
export function buildDailySpending(transactions, startDate, endDate) {
  if (!startDate || !endDate) return [];
  const daily = {};
  const cur = new Date(startDate + 'T12:00:00');
  const last = new Date(endDate + 'T12:00:00');
  while (cur <= last) {
    daily[cur.toISOString().slice(0, 10)] = 0;
    cur.setDate(cur.getDate() + 1);
  }
  transactions.forEach(t => {
    if (t.excluded || t.transactionType !== 'Debit') return;
    if (t.date && Object.prototype.hasOwnProperty.call(daily, t.date))
      daily[t.date] += t.myShare || 0;
  });
  return Object.entries(daily).map(([date, amount]) => {
    const d = new Date(date + 'T12:00:00');
    return { date, label: d.toLocaleDateString('default', { month: 'short', day: 'numeric' }), amount: Math.round(amount * 100) / 100 };
  });
}

/**
 * Build spending aggregated by day of week (Sun–Sat).
 * Returns array of 7 items: { day, total, avg, count }.
 */
export function buildDayOfWeekSpending(transactions, startDate, endDate) {
  const totals = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  transactions.forEach(t => {
    if (t.excluded || t.transactionType !== 'Debit' || !t.date) return;
    if (startDate && t.date < startDate) return;
    if (endDate && t.date > endDate) return;
    const dow = new Date(t.date + 'T12:00:00').getDay();
    totals[dow] += t.myShare || 0;
    counts[dow]++;
  });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => ({
    day,
    total: Math.round(totals[i] * 100) / 100,
    avg: counts[i] > 0 ? Math.round((totals[i] / counts[i]) * 100) / 100 : 0,
    count: counts[i],
  }));
}

/**
 * Build top-N category trend over the last numMonths months (always from today, ignores date filter).
 * Returns { data: [{ month, label, [catName]: amount }], categories: [{ id, name, color, icon }] }
 */
export function buildCategoryTrend(transactions, categories, numMonths = 6, topN = 5) {
  const now = new Date();
  const months = [];
  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'short', year: '2-digit' }) });
  }
  const monthKeys = new Set(months.map(m => m.key));

  // Find top N categories by total across the period
  const catTotals = {};
  transactions.forEach(t => {
    if (t.excluded || t.transactionType !== 'Debit') return;
    const month = t.date?.slice(0, 7);
    if (!month || !monthKeys.has(month)) return;
    const catId = t.categoryId || 'cat_uncategorized';
    catTotals[catId] = (catTotals[catId] || 0) + (t.myShare || 0);
  });
  const topCatIds = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([id]) => id);
  const catMeta = topCatIds.map(catId => {
    const cat = categories.find(c => c.id === catId);
    return { id: catId, name: cat?.name || 'Other', color: cat?.color || '#6b7280', icon: cat?.icon || '' };
  });

  const data = months.map(({ key, label }) => {
    const row = { month: key, label };
    catMeta.forEach(c => { row[c.name] = 0; });
    transactions
      .filter(t => !t.excluded && t.transactionType === 'Debit' && t.date?.slice(0, 7) === key)
      .forEach(t => {
        const meta = catMeta.find(c => c.id === (t.categoryId || 'cat_uncategorized'));
        if (meta) row[meta.name] = Math.round(((row[meta.name] || 0) + (t.myShare || 0)) * 100) / 100;
      });
    return row;
  });
  return { data, categories: catMeta };
}

/**
 * Build cumulative daily spending for a month vs pro-rated budget line.
 * Returns array of { day, label, cumulative, daily, budget? } up to today (or end of month).
 */
export function buildCumulativeSpend(transactions, month, budget = 0) {
  if (!month) return [];
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === mon;
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

  const daily = {};
  for (let d = 1; d <= daysInMonth; d++) daily[String(d).padStart(2, '0')] = 0;
  transactions.forEach(t => {
    if (t.excluded || t.transactionType !== 'Debit' || !t.date?.startsWith(month)) return;
    const day = t.date.slice(-2);
    if (Object.prototype.hasOwnProperty.call(daily, day)) daily[day] += t.myShare || 0;
  });

  let cum = 0;
  const result = [];
  for (let d = 1; d <= lastDay; d++) {
    const key = String(d).padStart(2, '0');
    cum += daily[key] || 0;
    const row = { day: d, label: `${d}`, daily: Math.round((daily[key] || 0) * 100) / 100, cumulative: Math.round(cum * 100) / 100 };
    if (budget > 0) row.budget = Math.round((budget / daysInMonth * d) * 100) / 100;
    result.push(row);
  }
  return result;
}

/**
 * Detect recurring vendors: vendors that appear in 2+ different months.
 */
export function detectRecurringVendors(transactions) {
  const vendorMonths = {};
  transactions.forEach(txn => {
    if (txn.excluded || txn.transactionType !== 'Debit') return;
    const vendor = txn.description || txn.rawDescription;
    const month = txn.date?.slice(0, 7);
    if (!vendor || !month) return;
    if (!vendorMonths[vendor]) vendorMonths[vendor] = new Set();
    vendorMonths[vendor].add(month);
  });
  return Object.entries(vendorMonths)
    .filter(([, months]) => months.size >= 2)
    .map(([vendor, months]) => {
      const vendorTxns = transactions.filter(t =>
        (t.description === vendor || t.rawDescription === vendor) && t.transactionType === 'Debit' && !t.excluded
      );
      const avgAmount = vendorTxns.reduce((s, t) => s + (t.myShare || 0), 0) / vendorTxns.length;
      return {
        vendor,
        monthCount: months.size,
        avgAmount: Math.round(avgAmount * 100) / 100,
        totalAmount: Math.round(vendorTxns.reduce((s, t) => s + (t.myShare || 0), 0) * 100) / 100,
      };
    })
    .sort((a, b) => b.monthCount - a.monthCount || b.totalAmount - a.totalAmount);
}

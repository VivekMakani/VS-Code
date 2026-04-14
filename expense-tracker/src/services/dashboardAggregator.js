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

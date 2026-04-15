import { useMemo } from 'react';
import { useStorage } from '../store/StorageContext';
import {
  buildMonthlyBuckets,
  buildCategoryTotals,
  buildRollingTrend,
  buildYTDSummary,
  detectRecurringVendors,
  buildDailySpending,
  buildDayOfWeekSpending,
  buildCategoryTrend,
  buildCumulativeSpend,
} from '../services/dashboardAggregator';

// ─── Date range helpers ───────────────────────────────────────────────────────

function getRange(dateFilter) {
  if (!dateFilter) return { start: null, end: null };
  if (dateFilter.mode === 'month' && dateFilter.month) {
    const [y, m] = dateFilter.month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    return { start: `${dateFilter.month}-01`, end: `${dateFilter.month}-${String(days).padStart(2, '0')}` };
  }
  if (dateFilter.mode === 'range' && dateFilter.start && dateFilter.end) {
    return { start: dateFilter.start, end: dateFilter.end };
  }
  return { start: null, end: null }; // all time
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardData(dateFilter) {
  const { transactions: allTransactions, categories, settings } = useStorage();

  const { start: rangeStart, end: rangeEnd } = useMemo(() => getRange(dateFilter), [dateFilter]);

  // Pre-filter transactions for the selected period
  const transactions = useMemo(() => {
    if (!rangeStart) return allTransactions;
    return allTransactions.filter(t => t.date && t.date >= rangeStart && t.date <= rangeEnd);
  }, [allTransactions, rangeStart, rangeEnd]);

  // Monthly buckets (always all transactions — used for bar/trend charts)
  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(allTransactions), [allTransactions]);

  // Current bucket for the selected month (only valid in month mode)
  const currentMonthBucket = useMemo(() => {
    if (dateFilter?.mode !== 'month' || !dateFilter.month) return null;
    return monthlyBuckets.find(b => b.month === dateFilter.month) || null;
  }, [monthlyBuckets, dateFilter]);

  // Category totals for filtered period
  const categoryTotals = useMemo(() => buildCategoryTotals(transactions, null), [transactions]);

  // 12-month rolling trend (always all transactions)
  const rollingTrend = useMemo(() => buildRollingTrend(allTransactions, 12), [allTransactions]);

  // YTD summary (always all transactions)
  const ytdSummary = useMemo(
    () => buildYTDSummary(allTransactions, settings.fiscalYearStart || 1),
    [allTransactions, settings.fiscalYearStart]
  );

  const recurringVendors = useMemo(() => detectRecurringVendors(allTransactions), [allTransactions]);

  // Affordability — only meaningful in month mode
  const affordability = useMemo(() => {
    if (dateFilter?.mode !== 'month' || !dateFilter.month) return null;
    const now = new Date();
    const [year, month] = dateFilter.month.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
    const daysRemaining = isCurrentMonth ? daysInMonth - now.getDate() : 0;
    const totalSpent = currentMonthBucket?.myShare || 0;
    const budget = settings.monthlyBudget || 0;
    const dailyRate = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const projected = dailyRate * daysInMonth;
    const remaining = Math.max(0, budget - totalSpent);
    const safeToSpend = daysRemaining > 0 ? remaining / daysRemaining : 0;
    const projectedDeficit = budget - projected;
    return {
      daysElapsed, daysRemaining, daysInMonth,
      totalSpent: Math.round(totalSpent * 100) / 100,
      budget,
      dailyRate: Math.round(dailyRate * 100) / 100,
      projected: Math.round(projected * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      safeToSpend: Math.round(safeToSpend * 100) / 100,
      projectedDeficit: Math.round(projectedDeficit * 100) / 100,
      percentUsed: budget > 0 ? Math.round((totalSpent / budget) * 100) : 0,
    };
  }, [dateFilter, currentMonthBucket, settings.monthlyBudget]);

  // Top 10 largest expenses for filtered period
  const topExpenses = useMemo(() => {
    return transactions
      .filter(t => !t.excluded && t.transactionType === 'Debit')
      .sort((a, b) => (b.myShare || 0) - (a.myShare || 0))
      .slice(0, 10);
  }, [transactions]);

  // Most frequent vendor for filtered period
  const mostFrequentVendor = useMemo(() => {
    const counts = {};
    transactions
      .filter(t => !t.excluded && t.transactionType === 'Debit')
      .forEach(t => { const v = t.description || t.rawDescription; counts[v] = (counts[v] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [transactions]);

  // Largest single expense for filtered period
  const largestExpense = useMemo(() => {
    const debits = transactions.filter(t => !t.excluded && t.transactionType === 'Debit');
    if (!debits.length) return null;
    return debits.reduce((max, t) => (t.myShare || 0) > (max.myShare || 0) ? t : max, debits[0]);
  }, [transactions]);

  // Uncategorized count for filtered period
  const uncategorizedCount = useMemo(() => {
    return transactions.filter(t => !t.excluded && t.categoryId === 'cat_uncategorized').length;
  }, [transactions]);

  // Category totals enriched with category meta
  const enrichedCategoryTotals = useMemo(() => {
    return categoryTotals.map(ct => {
      const cat = categories.find(c => c.id === ct.categoryId);
      return { ...ct, name: cat?.name || ct.categoryId, color: cat?.color || '#6b7280', icon: cat?.icon || '' };
    });
  }, [categoryTotals, categories]);

  // Split savings for filtered period
  const splitSavings = useMemo(() => {
    const debits = transactions.filter(t => !t.excluded && t.transactionType === 'Debit');
    const monthSavings = debits.reduce((s, t) => s + (t.splitSavings || 0), 0);
    const ytdDebits = allTransactions.filter(t => !t.excluded && t.transactionType === 'Debit');
    const ytdTotal = ytdDebits.reduce((s, t) => s + (t.splitSavings || 0), 0);
    return {
      thisMonth: Math.round(monthSavings * 100) / 100,
      ytd: Math.round(ytdTotal * 100) / 100,
    };
  }, [transactions, allTransactions]);

  // ── New: 4 additional chart datasets ────────────────────────────────────────

  // Daily spending for selected period (auto-weekly if > 45 days)
  const dailySpending = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    const raw = buildDailySpending(transactions, rangeStart, rangeEnd);
    // If > 45 days, aggregate into weekly buckets
    if (raw.length > 45) {
      const weeks = [];
      for (let i = 0; i < raw.length; i += 7) {
        const chunk = raw.slice(i, i + 7);
        const total = chunk.reduce((s, d) => s + d.amount, 0);
        weeks.push({ date: chunk[0].date, label: chunk[0].label, amount: Math.round(total * 100) / 100 });
      }
      return weeks;
    }
    return raw;
  }, [transactions, rangeStart, rangeEnd]);

  // Day-of-week spending for selected period
  const dayOfWeekSpending = useMemo(
    () => buildDayOfWeekSpending(transactions, rangeStart, rangeEnd),
    [transactions, rangeStart, rangeEnd]
  );

  // Category trend — always last 6 months from today (not affected by date filter)
  const categoryTrend = useMemo(
    () => buildCategoryTrend(allTransactions, categories, 6, 5),
    [allTransactions, categories]
  );

  // Cumulative spend — only in month mode
  const cumulativeSpend = useMemo(() => {
    if (dateFilter?.mode !== 'month' || !dateFilter.month) return [];
    return buildCumulativeSpend(transactions, dateFilter.month, settings.monthlyBudget || 0);
  }, [transactions, dateFilter, settings.monthlyBudget]);

  return {
    monthlyBuckets,
    currentMonthBucket,
    categoryTotals: enrichedCategoryTotals,
    rollingTrend,
    ytdSummary,
    recurringVendors,
    affordability,
    topExpenses,
    mostFrequentVendor,
    largestExpense,
    uncategorizedCount,
    splitSavings,
    // new
    dateRange: { start: rangeStart, end: rangeEnd },
    dailySpending,
    dayOfWeekSpending,
    categoryTrend,
    cumulativeSpend,
  };
}
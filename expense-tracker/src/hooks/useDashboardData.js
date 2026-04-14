import { useMemo } from 'react';
import { useStorage } from '../store/StorageContext';
import {
  buildMonthlyBuckets,
  buildCategoryTotals,
  buildRollingTrend,
  buildYTDSummary,
  detectRecurringVendors,
} from '../services/dashboardAggregator';

export function useDashboardData(selectedMonth = null) {
  const { transactions, categories, settings } = useStorage();

  const monthlyBuckets = useMemo(() => buildMonthlyBuckets(transactions), [transactions]);

  const currentMonthBucket = useMemo(() => {
    if (!selectedMonth) return null;
    return monthlyBuckets.find(b => b.month === selectedMonth) || null;
  }, [monthlyBuckets, selectedMonth]);

  const categoryTotals = useMemo(
    () => buildCategoryTotals(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const rollingTrend = useMemo(() => buildRollingTrend(transactions, 12), [transactions]);

  const ytdSummary = useMemo(
    () => buildYTDSummary(transactions, settings.fiscalYearStart || 1),
    [transactions, settings.fiscalYearStart]
  );

  const recurringVendors = useMemo(() => detectRecurringVendors(transactions), [transactions]);

  // Affordability metrics for selected month
  const affordability = useMemo(() => {
    if (!selectedMonth) return null;
    const now = new Date();
    const [year, month] = selectedMonth.split('-').map(Number);
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
  }, [selectedMonth, currentMonthBucket, settings.monthlyBudget]);

  // Top 10 largest expenses for selected month
  const topExpenses = useMemo(() => {
    return transactions
      .filter(t => !t.excluded && t.transactionType === 'Debit' && (!selectedMonth || t.date?.startsWith(selectedMonth)))
      .sort((a, b) => (b.myShare || 0) - (a.myShare || 0))
      .slice(0, 10);
  }, [transactions, selectedMonth]);

  // Most frequent vendor for selected month
  const mostFrequentVendor = useMemo(() => {
    const counts = {};
    transactions
      .filter(t => !t.excluded && t.transactionType === 'Debit' && (!selectedMonth || t.date?.startsWith(selectedMonth)))
      .forEach(t => {
        const v = t.description || t.rawDescription;
        counts[v] = (counts[v] || 0) + 1;
      });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [transactions, selectedMonth]);

  // Largest single expense for selected month
  const largestExpense = useMemo(() => {
    const debits = transactions.filter(t =>
      !t.excluded && t.transactionType === 'Debit' && (!selectedMonth || t.date?.startsWith(selectedMonth))
    );
    if (!debits.length) return null;
    return debits.reduce((max, t) => (t.myShare || 0) > (max.myShare || 0) ? t : max, debits[0]);
  }, [transactions, selectedMonth]);

  // Uncategorized count for selected month
  const uncategorizedCount = useMemo(() => {
    return transactions.filter(t =>
      !t.excluded && t.categoryId === 'cat_uncategorized' &&
      (!selectedMonth || t.date?.startsWith(selectedMonth))
    ).length;
  }, [transactions, selectedMonth]);

  // Category totals enriched with category meta
  const enrichedCategoryTotals = useMemo(() => {
    return categoryTotals.map(ct => {
      const cat = categories.find(c => c.id === ct.categoryId);
      return { ...ct, name: cat?.name || ct.categoryId, color: cat?.color || '#6b7280', icon: cat?.icon || '' };
    });
  }, [categoryTotals, categories]);

  // Split savings for selected month
  const splitSavings = useMemo(() => {
    const debits = transactions.filter(t =>
      !t.excluded && t.transactionType === 'Debit' && (!selectedMonth || t.date?.startsWith(selectedMonth))
    );
    const monthSavings = debits.reduce((s, t) => s + (t.splitSavings || 0), 0);
    const ytdDebits = transactions.filter(t => !t.excluded && t.transactionType === 'Debit');
    const ytdSavingsTotal = ytdDebits.reduce((s, t) => s + (t.splitSavings || 0), 0);
    return {
      thisMonth: Math.round(monthSavings * 100) / 100,
      ytd: Math.round(ytdSavingsTotal * 100) / 100,
    };
  }, [transactions, selectedMonth]);

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
  };
}

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStorage } from '../store/StorageContext';
import EmptyState from '../components/common/EmptyState';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const fmtFull = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// ─── Month Picker ─────────────────────────────────────────────────────────────
function MonthPicker({ value, onChange, transactions }) {
  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.date?.slice(0, 7)).filter(Boolean));
    return [...s].sort().reverse();
  }, [transactions]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Viewing month:</label>
      <select className="form-control" style={{ maxWidth: 160 }} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">All Time</option>
        {months.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}

// ─── Stat Cards Row ───────────────────────────────────────────────────────────
function StatCardsRow({ affordability, currentMonthBucket, settings }) {
  const budget = settings?.monthlyBudget || 0;
  const spent = affordability?.totalSpent || 0;
  const pct = affordability?.percentUsed || 0;
  const statusColor = pct >= 100 ? 'var(--color-danger)' : pct >= 75 ? 'var(--color-warning)' : 'var(--color-success)';
  const statusLabel = pct >= 100 ? '🔴 Over Budget' : pct >= 75 ? '🟡 Caution' : '🟢 On Track';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
      <div className="stat-card">
        <div className="stat-card-label">Monthly Budget</div>
        <div className="stat-card-value">{fmt(budget)}</div>
        <div className="stat-card-sub">{statusLabel}</div>
      </div>
      <div className="stat-card">
        <div className="stat-card-label">Total Spent (My Share)</div>
        <div className="stat-card-value" style={{ color: statusColor }}>{fmt(spent)}</div>
        {budget > 0 && (
          <>
            <div style={{ margin: '8px 0 4px' }}>
              <div className="progress-bar">
                <div className={`progress-bar-fill ${pct >= 100 ? 'progress-over' : pct >= 75 ? 'progress-caution' : 'progress-on-track'}`}
                  style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
            <div className="stat-card-sub">{pct}% of budget used</div>
          </>
        )}
      </div>
      <div className="stat-card">
        <div className="stat-card-label">Remaining Budget</div>
        <div className="stat-card-value" style={{ color: (affordability?.remaining || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {fmt(affordability?.remaining || 0)}
        </div>
        <div className="stat-card-sub">{currentMonthBucket?.count || 0} transactions</div>
      </div>
      <div className="stat-card">
        <div className="stat-card-label">Safe to Spend / Day</div>
        <div className="stat-card-value">{fmt(affordability?.safeToSpend || 0)}</div>
        <div className="stat-card-sub">{affordability?.daysRemaining || 0} days remaining</div>
      </div>
    </div>
  );
}

// ─── Affordability Panel ──────────────────────────────────────────────────────
function AffordabilityPanel({ affordability }) {
  if (!affordability) return null;
  const isOver = affordability.projectedDeficit < 0;
  return (
    <div className="card">
      <div className="card-header"><h3>🔮 Affordability Insight</h3></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { label: 'Daily Spend Rate', value: fmtFull(affordability.dailyRate) },
            { label: 'Projected Month-End', value: fmt(affordability.projected) },
            { label: 'Projected Surplus / Deficit', value: fmt(affordability.projectedDeficit), color: isOver ? 'var(--color-danger)' : 'var(--color-success)' },
            { label: 'Days Elapsed', value: `${affordability.daysElapsed} / ${affordability.daysInMonth}` },
          ].map(item => (
            <div key={item.label} style={{ padding: 12, background: 'var(--color-surface-2)', borderRadius: 'var(--radius)' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div className={`alert ${isOver ? 'alert-danger' : affordability.percentUsed >= 75 ? 'alert-warning' : 'alert-success'}`}>
          <span>{isOver ? '⚠️' : '💡'}</span>
          <span>
            {isOver
              ? `At your current pace, you will <strong>exceed</strong> your budget by ${fmt(Math.abs(affordability.projectedDeficit))} by month end. You have ${fmtFull(affordability.safeToSpend)}/day left to spend safely.`
              : `You're on track! At your current pace, you'll end the month with ${fmt(affordability.projectedDeficit)} remaining. You can spend up to ${fmtFull(affordability.safeToSpend)}/day for the rest of the month.`
            }
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Category Breakdown ───────────────────────────────────────────────────────
function CategoryBreakdown({ categoryTotals, onCategoryClick }) {
  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  const totalSpent = categoryTotals.reduce((s, c) => s + c.total, 0);

  return (
    <div className="card">
      <div className="card-header"><h3>🏷️ Spending by Category</h3></div>
      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'center' }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={categoryTotals.slice(0, 8)} cx="50%" cy="50%" labelLine={false} label={renderLabel}
              outerRadius={110} dataKey="total" onClick={(d) => onCategoryClick(d.categoryId)}>
              {categoryTotals.slice(0, 8).map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} cursor="pointer" />
              ))}
            </Pie>
            <Tooltip formatter={(v) => fmtFull(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div>
          {categoryTotals.slice(0, 10).map(cat => (
            <div key={cat.categoryId}
              onClick={() => onCategoryClick(cat.categoryId)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', flex: 1 }}>{cat.icon} {cat.name}</span>
              <span className="font-mono text-sm" style={{ fontWeight: 600 }}>{fmtFull(cat.total)}</span>
              <span className="text-xs text-muted" style={{ width: 40, textAlign: 'right' }}>
                {totalSpent > 0 ? `${Math.round((cat.total / totalSpent) * 100)}%` : '0%'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Monthly Trend ────────────────────────────────────────────────────────────
function MonthlyTrend({ rollingTrend, monthlyBuckets }) {
  return (
    <div className="card">
      <div className="card-header"><h3>📈 12-Month Spending Trend</h3></div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rollingTrend} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtFull(v)} />
            <Line type="monotone" dataKey="myShare" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} name="My Share" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Monthly Bar Chart ────────────────────────────────────────────────────────
function MonthlyBarChart({ monthlyBuckets }) {
  const data = monthlyBuckets.slice(-6).map(b => ({
    month: b.month.slice(5), // show MM only
    'My Share': b.myShare,
    'Gross': b.gross,
  }));

  return (
    <div className="card">
      <div className="card-header"><h3>📊 Monthly Spending (Last 6 Months)</h3></div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtFull(v)} />
            <Legend />
            <Bar dataKey="My Share" fill="var(--color-primary)" radius={[4,4,0,0]} />
            <Bar dataKey="Gross" fill="#c7d2fe" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Top Expenses ─────────────────────────────────────────────────────────────
function TopExpenses({ topExpenses, categories }) {
  return (
    <div className="card">
      <div className="card-header"><h3>💸 Top 10 Largest Expenses</h3></div>
      <div className="card-body" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>My Share</th></tr></thead>
          <tbody>
            {topExpenses.length === 0 && <tr><td colSpan={4}><EmptyState icon="🎉" title="No expenses this month" /></td></tr>}
            {topExpenses.map(t => {
              const cat = categories.find(c => c.id === t.categoryId);
              return (
                <tr key={t.id}>
                  <td className="text-sm font-mono">{t.date}</td>
                  <td style={{ maxWidth: 160 }} className="truncate">{t.description}</td>
                  <td>{cat && <span className="badge" style={{ background: cat.color + '22', color: cat.color }}>{cat.icon} {cat.name}</span>}</td>
                  <td className="font-mono text-sm" style={{ fontWeight: 600 }}>{fmtFull(t.myShare)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Recurring Vendors ────────────────────────────────────────────────────────
function RecurringVendors({ recurringVendors }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>🔄 Recurring Expenses</h3>
        <span className="text-muted text-sm">{recurringVendors.length} detected</span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {recurringVendors.length === 0 ? (
          <div style={{ padding: 20 }}><EmptyState icon="🔍" title="No recurring expenses detected" description="Appears in 2+ months to be listed here." /></div>
        ) : (
          <table className="table">
            <thead><tr><th>Vendor</th><th>Months</th><th>Avg / Month</th><th>Total</th></tr></thead>
            <tbody>
              {recurringVendors.slice(0, 15).map((v, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{v.vendor}</td>
                  <td><span className="badge badge-primary">{v.monthCount}×</span></td>
                  <td className="font-mono text-sm">{fmtFull(v.avgAmount)}</td>
                  <td className="font-mono text-sm" style={{ fontWeight: 600 }}>{fmtFull(v.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── YTD Summary ──────────────────────────────────────────────────────────────
function YTDSummaryPanel({ ytdSummary, splitSavings }) {
  return (
    <div className="card">
      <div className="card-header"><h3>📅 Year-to-Date Summary</h3></div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Spent (My Share)', value: fmtFull(ytdSummary.totalMyShare), color: 'var(--color-primary)' },
            { label: 'Total Gross Amount', value: fmtFull(ytdSummary.totalGross), color: 'var(--color-text)' },
            { label: 'Split Savings YTD', value: fmtFull(splitSavings.ytd), color: 'var(--color-success)' },
            { label: 'Total Credits / Refunds', value: fmtFull(ytdSummary.totalCredits), color: 'var(--color-info)' },
            { label: 'Total Transactions', value: ytdSummary.transactionCount, color: 'var(--color-text)' },
          ].map(item => (
            <div key={item.label} style={{ padding: 12, background: 'var(--color-surface-2)', borderRadius: 'var(--radius)' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        {splitSavings.thisMonth > 0 && (
          <div className="alert alert-success" style={{ marginTop: 12 }}>
            <span>💰</span>
            <span>You saved <strong>{fmtFull(splitSavings.thisMonth)}</strong> this month and <strong>{fmtFull(splitSavings.ytd)}</strong> year-to-date through expense splitting!</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { transactions, categories, settings } = useStorage();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [drillCategory, setDrillCategory] = useState(null);

  const {
    monthlyBuckets, currentMonthBucket, categoryTotals, rollingTrend,
    ytdSummary, recurringVendors, affordability, topExpenses,
    mostFrequentVendor, largestExpense, uncategorizedCount, splitSavings,
  } = useDashboardData(selectedMonth);

  if (transactions.length === 0) {
    return (
      <div>
        <h1 style={{ marginBottom: 24 }}>📊 Dashboard</h1>
        <EmptyState
          icon="📊"
          title="No data yet"
          description="Import transactions to see your spending insights."
          action={<button className="btn btn-primary" onClick={() => navigate('/import')}>📥 Import Transactions</button>}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>📊 Dashboard</h1>
          <p className="text-muted text-sm">{transactions.length} transactions tracked</p>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} transactions={transactions} />
      </div>

      {/* Uncategorized alert */}
      {uncategorizedCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <span>⚠️</span>
          <span>
            <strong>{uncategorizedCount} uncategorized transaction{uncategorizedCount > 1 ? 's' : ''}</strong> in the selected period.{' '}
            <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', color: 'var(--color-warning)' }} onClick={() => navigate('/ledger')}>
              Review in Ledger →
            </button>
          </span>
        </div>
      )}

      {/* Stat Cards */}
      {selectedMonth && (
        <div style={{ marginBottom: 24 }}>
          <StatCardsRow affordability={affordability} currentMonthBucket={currentMonthBucket} settings={settings} />
        </div>
      )}

      {/* Affordability */}
      {selectedMonth && affordability && (
        <div style={{ marginBottom: 24 }}>
          <AffordabilityPanel affordability={affordability} />
        </div>
      )}

      {/* Most Frequent + Largest */}
      {(mostFrequentVendor || largestExpense) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {mostFrequentVendor && (
            <div className="stat-card">
              <div className="stat-card-label">Most Frequent Vendor</div>
              <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>{mostFrequentVendor.name}</div>
              <div className="stat-card-sub">{mostFrequentVendor.count} transactions this period</div>
            </div>
          )}
          {largestExpense && (
            <div className="stat-card">
              <div className="stat-card-label">Largest Expense</div>
              <div className="stat-card-value" style={{ fontSize: '1.25rem' }}>{fmtFull(largestExpense.myShare)}</div>
              <div className="stat-card-sub">{largestExpense.description} · {largestExpense.date}</div>
            </div>
          )}
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 24 }}>
        {categoryTotals.length > 0 && <CategoryBreakdown categoryTotals={categoryTotals} onCategoryClick={setDrillCategory} />}
        {monthlyBuckets.length > 0 && <MonthlyBarChart monthlyBuckets={monthlyBuckets} />}
      </div>

      {/* Trend */}
      {rollingTrend.some(b => b.myShare > 0) && (
        <div style={{ marginBottom: 24 }}>
          <MonthlyTrend rollingTrend={rollingTrend} monthlyBuckets={monthlyBuckets} />
        </div>
      )}

      {/* Top expenses + Recurring */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 24 }}>
        <TopExpenses topExpenses={topExpenses} categories={categories} />
        <RecurringVendors recurringVendors={recurringVendors} />
      </div>

      {/* YTD Summary */}
      <YTDSummaryPanel ytdSummary={ytdSummary} splitSavings={splitSavings} />
    </div>
  );
}

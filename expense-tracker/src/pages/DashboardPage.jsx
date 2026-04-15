import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportSummaryPDF, exportLedgerPDF } from '../services/pdfExporter';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStorage } from '../store/StorageContext';
import EmptyState from '../components/common/EmptyState';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const fmtFull = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// ─── Widget config (persisted to localStorage) ────────────────────────────────

const DEFAULT_WIDGETS = {
  affordability: true,
  highlights: true,
  categoryBreakdown: true,
  cumulativeSpend: true,
  categoryTrend: true,
  monthlyBarChart: true,
  trendLine: true,
  dailySpending: true,
  dayOfWeek: true,
  topExpenses: true,
  recurringVendors: true,
  ytdSummary: true,
};

const WIDGET_LABELS = {
  affordability: '🔮 Affordability Insight',
  highlights: '⭐ Highlights (Largest / Most Frequent)',
  categoryBreakdown: '🏷️ Spending by Category (Pie)',
  cumulativeSpend: '📈 Cumulative Spend vs Budget',
  categoryTrend: '📊 Category Trend (6 months)',
  monthlyBarChart: '📊 Monthly Bar Chart',
  trendLine: '📈 12-Month Trend Line',
  dailySpending: '📅 Daily Spending',
  dayOfWeek: '🗓️ Day of Week Analysis',
  topExpenses: '💸 Top 10 Largest Expenses',
  recurringVendors: '🔄 Recurring Expenses',
  ytdSummary: '📅 Year-to-Date Summary',
};

function loadWidgets() {
  try {
    const raw = localStorage.getItem('exp_dashboard_widgets');
    return raw ? { ...DEFAULT_WIDGETS, ...JSON.parse(raw) } : { ...DEFAULT_WIDGETS };
  } catch { return { ...DEFAULT_WIDGETS }; }
}

function saveWidgets(w) {
  try { localStorage.setItem('exp_dashboard_widgets', JSON.stringify(w)); } catch {}
}

// ─── Export PDF Dropdown ──────────────────────────────────────────────────────

function ExportPDFButton({ onSummary, onLedger, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        📄 Export PDF <span style={{ fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
          minWidth: 230, overflow: 'hidden',
        }}>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: 0, gap: 10 }}
            onClick={() => { onSummary(); setOpen(false); }}
          >
            <span style={{ fontSize: '1.2rem' }}>📊</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Summary Report</div>
              <div className="text-xs text-muted">2-page PDF · stats, charts, top expenses</div>
            </div>
          </button>
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: 0, gap: 10 }}
            onClick={() => { onLedger(); setOpen(false); }}
          >
            <span style={{ fontSize: '1.2rem' }}>📋</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Ledger Table</div>
              <div className="text-xs text-muted">Landscape PDF · full transaction table</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Date Filter Control ──────────────────────────────────────────────────────

function DateFilterControl({ value, onChange, transactions }) {
  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.date?.slice(0, 7)).filter(Boolean));
    return [...s].sort().reverse();
  }, [transactions]);

  const setMode = (mode) => onChange({ ...value, mode });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {/* Mode pills */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 8, padding: 3 }}>
        {[['month', 'Month'], ['range', 'Date Range'], ['all', 'All Time']].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setMode(mode)}
            style={{
              padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.85rem',
              background: value.mode === mode ? 'var(--color-primary)' : 'transparent',
              color: value.mode === mode ? '#fff' : 'var(--color-text-muted)',
              fontWeight: value.mode === mode ? 600 : 400,
              transition: 'all 150ms',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Month selector */}
      {value.mode === 'month' && (
        <select className="form-control" style={{ maxWidth: 160 }} value={value.month}
          onChange={e => onChange({ ...value, month: e.target.value })}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}

      {/* Custom range */}
      {value.mode === 'range' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="date" className="form-control" style={{ maxWidth: 160 }} value={value.start}
            onChange={e => onChange({ ...value, start: e.target.value })} />
          <span className="text-muted text-sm">to</span>
          <input type="date" className="form-control" style={{ maxWidth: 160 }} value={value.end}
            min={value.start}
            onChange={e => onChange({ ...value, end: e.target.value })} />
        </div>
      )}

      {value.mode === 'all' && (
        <span className="badge badge-neutral">All {transactions.length} transactions</span>
      )}
    </div>
  );
}

// ─── Customize Panel ──────────────────────────────────────────────────────────

function CustomizePanel({ widgets, onChange }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <h3>🎛️ Customize Dashboard</h3>
        <span className="text-sm text-muted">Toggle widgets on or off</span>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {Object.entries(WIDGET_LABELS).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 'var(--radius)', background: widgets[key] ? 'var(--color-primary-light)' : 'var(--color-surface-2)', border: `1px solid ${widgets[key] ? 'var(--color-primary)' : 'var(--color-border)'}`, transition: 'all 150ms', userSelect: 'none' }}>
              <input type="checkbox" className="checkbox" checked={!!widgets[key]}
                onChange={e => onChange({ ...widgets, [key]: e.target.checked })} />
              <span style={{ fontSize: '0.875rem', fontWeight: widgets[key] ? 500 : 400 }}>{label}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onChange(Object.fromEntries(Object.keys(DEFAULT_WIDGETS).map(k => [k, true])))}>
            Show All
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onChange(Object.fromEntries(Object.keys(DEFAULT_WIDGETS).map(k => [k, false])))}>
            Hide All
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Cards Row ───────────────────────────────────────────────────────────

function StatCardsRow({ affordability, currentMonthBucket, settings, dateFilter, transactions }) {
  const isMonth = dateFilter?.mode === 'month';
  const budget = settings?.monthlyBudget || 0;
  const spent = isMonth ? (affordability?.totalSpent || 0) : transactions.filter(t => !t.excluded && t.transactionType === 'Debit').reduce((s, t) => s + (t.myShare || 0), 0);
  const pct = (isMonth && budget > 0) ? Math.round((spent / budget) * 100) : 0;
  const statusColor = pct >= 100 ? 'var(--color-danger)' : pct >= 75 ? 'var(--color-warning)' : 'var(--color-success)';
  const statusLabel = !isMonth ? '—' : pct >= 100 ? '🔴 Over Budget' : pct >= 75 ? '🟡 Caution' : '🟢 On Track';
  const txCount = transactions.filter(t => !t.excluded && t.transactionType === 'Debit').length;
  const credits = transactions.filter(t => !t.excluded && t.transactionType === 'Credit').reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
      {isMonth && budget > 0 && (
        <div className="stat-card">
          <div className="stat-card-label">Monthly Budget</div>
          <div className="stat-card-value">{fmt(budget)}</div>
          <div className="stat-card-sub">{statusLabel}</div>
        </div>
      )}
      <div className="stat-card">
        <div className="stat-card-label">Total Spent (My Share)</div>
        <div className="stat-card-value" style={{ color: isMonth && budget > 0 ? statusColor : undefined }}>{fmt(spent)}</div>
        {isMonth && budget > 0 && (
          <>
            <div style={{ margin: '8px 0 4px' }}>
              <div className="progress-bar">
                <div className={`progress-bar-fill ${pct >= 100 ? 'progress-over' : pct >= 75 ? 'progress-caution' : 'progress-on-track'}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
            <div className="stat-card-sub">{pct}% of budget used</div>
          </>
        )}
      </div>
      {isMonth && budget > 0 && (
        <div className="stat-card">
          <div className="stat-card-label">Remaining Budget</div>
          <div className="stat-card-value" style={{ color: (affordability?.remaining || 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {fmt(affordability?.remaining || 0)}
          </div>
          <div className="stat-card-sub">{currentMonthBucket?.count || 0} transactions</div>
        </div>
      )}
      {isMonth && affordability && (
        <div className="stat-card">
          <div className="stat-card-label">Safe to Spend / Day</div>
          <div className="stat-card-value">{fmt(affordability.safeToSpend)}</div>
          <div className="stat-card-sub">{affordability.daysRemaining} days remaining</div>
        </div>
      )}
      <div className="stat-card">
        <div className="stat-card-label">Transactions</div>
        <div className="stat-card-value">{txCount}</div>
        <div className="stat-card-sub">{credits > 0 ? `+ ${fmt(credits)} credits` : 'debits only'}</div>
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
              ? `At your current pace, you will exceed your budget by ${fmt(Math.abs(affordability.projectedDeficit))} by month end. You have ${fmtFull(affordability.safeToSpend)}/day left to spend safely.`
              : `You're on track! At your current pace, you'll end the month with ${fmt(affordability.projectedDeficit)} remaining. Spend up to ${fmtFull(affordability.safeToSpend)}/day for the rest of the month.`
            }
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Category Breakdown (Pie) ─────────────────────────────────────────────────

function CategoryBreakdown({ categoryTotals, onCategoryClick }) {
  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
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
              {categoryTotals.slice(0, 8).map((entry, i) => <Cell key={i} fill={entry.color} cursor="pointer" />)}
            </Pie>
            <Tooltip formatter={(v) => fmtFull(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div>
          {categoryTotals.slice(0, 10).map(cat => (
            <div key={cat.categoryId} onClick={() => onCategoryClick(cat.categoryId)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
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

// ─── Cumulative Spend vs Budget ───────────────────────────────────────────────

function CumulativeSpendChart({ data, budget }) {
  if (!data.length) return null;
  const hasBudget = budget > 0 && data.some(d => d.budget !== undefined);
  return (
    <div className="card">
      <div className="card-header">
        <h3>📈 Cumulative Spend vs Budget</h3>
        <span className="text-sm text-muted">Running total this month</span>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.floor(data.length / 6)} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, name) => [fmtFull(v), name === 'cumulative' ? 'Spent' : 'Budget Pace']} />
            <Area type="monotone" dataKey="cumulative" stroke="var(--color-primary)" fill="url(#spendGrad)" strokeWidth={2} name="cumulative" dot={false} />
            {hasBudget && <Line type="monotone" dataKey="budget" stroke="var(--color-danger)" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="budget" />}
            {hasBudget && <ReferenceLine y={budget} stroke="var(--color-danger)" strokeDasharray="4 4" opacity={0.5} label={{ value: 'Budget', fill: 'var(--color-danger)', fontSize: 11 }} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Category Trend (Stacked Bar) ─────────────────────────────────────────────

function CategoryTrendChart({ categoryTrend }) {
  const { data, categories } = categoryTrend;
  if (!data.length || !categories.length) return null;
  return (
    <div className="card">
      <div className="card-header">
        <h3>📊 Category Trend</h3>
        <span className="text-sm text-muted">Top 5 categories · last 6 months</span>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtFull(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {categories.map(cat => (
              <Bar key={cat.id} dataKey={cat.name} stackId="a" fill={cat.color} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Monthly Bar Chart ────────────────────────────────────────────────────────

function MonthlyBarChart({ monthlyBuckets }) {
  const data = monthlyBuckets.slice(-6).map(b => ({ month: b.month.slice(5), 'My Share': b.myShare, 'Gross': b.gross }));
  return (
    <div className="card">
      <div className="card-header"><h3>📊 Monthly Spending (Last 6 Months)</h3></div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtFull(v)} />
            <Legend />
            <Bar dataKey="My Share" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gross" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── 12-Month Trend Line ──────────────────────────────────────────────────────

function MonthlyTrend({ rollingTrend }) {
  return (
    <div className="card">
      <div className="card-header"><h3>📈 12-Month Spending Trend</h3></div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rollingTrend} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtFull(v)} />
            <Line type="monotone" dataKey="myShare" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} name="My Share" />
            <Line type="monotone" dataKey="gross" stroke="#c7d2fe" strokeWidth={1.5} dot={false} name="Gross" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Daily Spending Bar ───────────────────────────────────────────────────────

function DailySpendingChart({ data, dateRange }) {
  if (!data.length) return (
    <div className="card">
      <div className="card-header"><h3>📅 Daily Spending</h3></div>
      <div className="card-body"><EmptyState icon="📅" title="Select a date range to see daily breakdown" /></div>
    </div>
  );
  return (
    <div className="card">
      <div className="card-header">
        <h3>📅 Daily Spending</h3>
        <span className="text-sm text-muted">{data.length > 20 ? 'Weekly buckets' : 'Per day'} · {dateRange.start} – {dateRange.end}</span>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmtFull(v)} labelFormatter={(l) => `Date: ${l}`} />
            <Bar dataKey="amount" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Spent" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Day of Week ──────────────────────────────────────────────────────────────

function DayOfWeekChart({ data }) {
  const hasData = data.some(d => d.total > 0);
  return (
    <div className="card">
      <div className="card-header">
        <h3>🗓️ Day of Week Analysis</h3>
        <span className="text-sm text-muted">When do you spend the most?</span>
      </div>
      <div className="card-body">
        {!hasData ? (
          <EmptyState icon="🗓️" title="No data for selected period" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, name) => [fmtFull(v), name === 'total' ? 'Total' : 'Avg per day']}
                content={({ active, payload, label }) => active && payload?.length ? (
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
                    <div>Total: {fmtFull(payload[0]?.value)}</div>
                    <div>Avg per visit: {fmtFull(payload[1]?.value)}</div>
                    <div className="text-muted text-xs">{payload[0]?.payload?.count} transaction{payload[0]?.payload?.count !== 1 ? 's' : ''}</div>
                  </div>
                ) : null}
              />
              <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="total" />
              <Bar dataKey="avg" fill="#a5b4fc" radius={[4, 4, 0, 0]} name="avg" />
              <Legend formatter={(v) => v === 'total' ? 'Total Spent' : 'Avg per Visit'} wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        )}
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
            {topExpenses.length === 0 && <tr><td colSpan={4}><EmptyState icon="🎉" title="No expenses in this period" /></td></tr>}
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
          <div style={{ padding: 20 }}><EmptyState icon="🔍" title="No recurring expenses detected" description="Vendors appearing in 2+ months show here." /></div>
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
            { label: 'Total Gross Amount', value: fmtFull(ytdSummary.totalGross) },
            { label: 'Split Savings YTD', value: fmtFull(splitSavings.ytd), color: 'var(--color-success)' },
            { label: 'Total Credits / Refunds', value: fmtFull(ytdSummary.totalCredits), color: 'var(--color-info)' },
            { label: 'Total Transactions', value: ytdSummary.transactionCount },
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
            <span>You saved <strong>{fmtFull(splitSavings.thisMonth)}</strong> this period and <strong>{fmtFull(splitSavings.ytd)}</strong> year-to-date through expense splitting!</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { transactions: allTxn, categories, settings } = useStorage();
  const [showCustomize, setShowCustomize] = useState(false);
  const [widgets, setWidgets] = useState(loadWidgets);
  const [dateFilter, setDateFilter] = useState(() => {
    const now = new Date();
    return {
      mode: 'month',
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      start: '',
      end: '',
    };
  });

  const {
    monthlyBuckets, currentMonthBucket, categoryTotals, rollingTrend,
    ytdSummary, recurringVendors, affordability, topExpenses,
    mostFrequentVendor, largestExpense, uncategorizedCount, splitSavings,
    dateRange, dailySpending, dayOfWeekSpending, categoryTrend, cumulativeSpend,
  } = useDashboardData(dateFilter);

  // Transactions in the selected period for stat card
  const filteredTxn = useMemo(() => {
    if (!dateRange.start) return allTxn;
    return allTxn.filter(t => t.date && t.date >= dateRange.start && t.date <= dateRange.end);
  }, [allTxn, dateRange]);

  function handleWidgetChange(newWidgets) {
    setWidgets(newWidgets);
    saveWidgets(newWidgets);
  }

  // Validate range mode has both dates
  const rangeReady = dateFilter.mode !== 'range' || (dateFilter.start && dateFilter.end && dateFilter.start <= dateFilter.end);

  if (allTxn.length === 0) {
    return (
      <div>
        <h1 style={{ marginBottom: 24 }}>📊 Dashboard</h1>
        <EmptyState icon="📊" title="No data yet" description="Import transactions to see your spending insights."
          action={<button className="btn btn-primary" onClick={() => navigate('/import')}>📥 Import Transactions</button>} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>📊 Dashboard</h1>
          <p className="text-muted text-sm">{allTxn.length} transactions tracked</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateFilterControl value={dateFilter} onChange={setDateFilter} transactions={allTxn} />
          <button
            className={`btn btn-sm ${showCustomize ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowCustomize(v => !v)}
          >
            🎛️ Customize
          </button>
          <ExportPDFButton
            disabled={!rangeReady}
            onSummary={() => exportSummaryPDF({
              affordability, categoryTotals, monthlyBuckets, ytdSummary,
              topExpenses, recurringVendors, splitSavings, rollingTrend,
              settings, dateFilter, categories,
            })}
            onLedger={() => exportLedgerPDF(filteredTxn, categories,
              dateFilter.mode === 'month' ? dateFilter.month :
              dateFilter.mode === 'range' ? `${dateFilter.start} to ${dateFilter.end}` : 'All Time'
            )}
          />
        </div>
      </div>

      {/* Range validation warning */}
      {dateFilter.mode === 'range' && !rangeReady && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span>⚠️</span>
          <span>Please select both a start and end date (start must be before end).</span>
        </div>
      )}

      {/* Customize panel */}
      {showCustomize && <CustomizePanel widgets={widgets} onChange={handleWidgetChange} />}

      {/* Uncategorized alert */}
      {uncategorizedCount > 0 && rangeReady && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <span>⚠️</span>
          <span>
            <strong>{uncategorizedCount} uncategorized transaction{uncategorizedCount > 1 ? 's' : ''}</strong> in this period.{' '}
            <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px', color: 'var(--color-warning)' }} onClick={() => navigate('/ledger')}>
              Review in Ledger →
            </button>
          </span>
        </div>
      )}

      {!rangeReady ? null : (
        <>
          {/* Snapshot Cards — always visible */}
          <StatCardsRow affordability={affordability} currentMonthBucket={currentMonthBucket} settings={settings} dateFilter={dateFilter} transactions={filteredTxn} />

          {/* Affordability */}
          {widgets.affordability && dateFilter.mode === 'month' && affordability && (
            <div style={{ marginBottom: 24 }}>
              <AffordabilityPanel affordability={affordability} />
            </div>
          )}

          {/* Highlights */}
          {widgets.highlights && (mostFrequentVendor || largestExpense) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {mostFrequentVendor && (
                <div className="stat-card">
                  <div className="stat-card-label">Most Frequent Vendor</div>
                  <div className="stat-card-value" style={{ fontSize: '1.2rem' }}>{mostFrequentVendor.name}</div>
                  <div className="stat-card-sub">{mostFrequentVendor.count} transactions this period</div>
                </div>
              )}
              {largestExpense && (
                <div className="stat-card">
                  <div className="stat-card-label">Largest Expense</div>
                  <div className="stat-card-value" style={{ fontSize: '1.2rem' }}>{fmtFull(largestExpense.myShare)}</div>
                  <div className="stat-card-sub">{largestExpense.description} · {largestExpense.date}</div>
                </div>
              )}
            </div>
          )}

          {/* Category Pie + Cumulative Spend */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 24 }}>
            {widgets.categoryBreakdown && categoryTotals.length > 0 && (
              <CategoryBreakdown categoryTotals={categoryTotals} onCategoryClick={() => {}} />
            )}
            {widgets.cumulativeSpend && dateFilter.mode === 'month' && cumulativeSpend.length > 0 && (
              <CumulativeSpendChart data={cumulativeSpend} budget={settings.monthlyBudget || 0} />
            )}
          </div>

          {/* Category Trend + Monthly Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 24 }}>
            {widgets.categoryTrend && categoryTrend.data.length > 0 && (
              <CategoryTrendChart categoryTrend={categoryTrend} />
            )}
            {widgets.monthlyBarChart && monthlyBuckets.length > 0 && (
              <MonthlyBarChart monthlyBuckets={monthlyBuckets} />
            )}
          </div>

          {/* 12-Month Trend */}
          {widgets.trendLine && rollingTrend.some(b => b.myShare > 0) && (
            <div style={{ marginBottom: 24 }}>
              <MonthlyTrend rollingTrend={rollingTrend} />
            </div>
          )}

          {/* Daily Spending + Day of Week */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 24 }}>
            {widgets.dailySpending && (
              <DailySpendingChart data={dailySpending} dateRange={dateRange} />
            )}
            {widgets.dayOfWeek && (
              <DayOfWeekChart data={dayOfWeekSpending} />
            )}
          </div>

          {/* Top Expenses + Recurring */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 20, marginBottom: 24 }}>
            {widgets.topExpenses && <TopExpenses topExpenses={topExpenses} categories={categories} />}
            {widgets.recurringVendors && <RecurringVendors recurringVendors={recurringVendors} />}
          </div>

          {/* YTD Summary */}
          {widgets.ytdSummary && <YTDSummaryPanel ytdSummary={ytdSummary} splitSavings={splitSavings} />}
        </>
      )}
    </div>
  );
}
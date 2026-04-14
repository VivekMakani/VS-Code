import { useState, useMemo, useCallback } from 'react';
import { useStorage } from '../store/StorageContext';
import { exportTransactionsToCSV } from '../services/csvExporter';
import { categorizeBatch } from '../services/rulesEngine';
import { calcMyShare, calcSplitSavings } from '../services/splitCalculator';
import { SPLIT_TYPES } from '../constants/splitTypes';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import RuleFormModal from '../components/rulebook/RuleFormModal';
import { MATCH_TYPES } from '../constants/matchTypes';

const PAGE_SIZE = 50;

// ─── Format helpers ──────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// ─── Inline Category Cell ────────────────────────────────────────────────────
function CategoryCell({ txn, categories, onUpdate, onCategorized }) {
  const selectedCat = categories.find(c => c.id === txn.categoryId);

  function handleCategoryChange(newCategoryId) {
    onUpdate(txn.id, { categoryId: newCategoryId, subcategoryId: '', ruleId: 'MANUAL' });
    // Fire the "save as rule?" prompt — but only when user actively picks a real category
    if (newCategoryId && newCategoryId !== 'cat_uncategorized') {
      onCategorized({ txn, newCategoryId, newSubcategoryId: '' });
    }
  }

  function handleSubcategoryChange(newSubcategoryId) {
    onUpdate(txn.id, { subcategoryId: newSubcategoryId });
    // Re-fire with updated subcategory so the prompt reflects the final selection
    if (txn.categoryId && txn.categoryId !== 'cat_uncategorized') {
      onCategorized({ txn, newCategoryId: txn.categoryId, newSubcategoryId });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
      <select
        className="form-control"
        style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
        value={txn.categoryId || ''}
        onChange={e => handleCategoryChange(e.target.value)}
      >
        <option value="">— Uncategorized —</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
      </select>
      {selectedCat && (
        <select
          className="form-control"
          style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
          value={txn.subcategoryId || ''}
          onChange={e => handleSubcategoryChange(e.target.value)}
        >
          <option value="">No subcategory</option>
          {selectedCat.subcategories?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
    </div>
  );
}

// ─── Inline Split Cell ───────────────────────────────────────────────────────
function SplitCell({ txn, onUpdate }) {
  const split = txn.split || { type: SPLIT_TYPES.FULL, divisor: 2, customAmount: 0 };

  function handleTypeChange(type) {
    const newSplit = { ...split, type };
    const myShare = calcMyShare(txn.amount, newSplit);
    const splitSavings = calcSplitSavings(txn.amount, myShare);
    onUpdate(txn.id, { split: newSplit, myShare, splitSavings });
  }

  function handleDivisorChange(divisor) {
    const newSplit = { ...split, divisor: Number(divisor) };
    const myShare = calcMyShare(txn.amount, newSplit);
    const splitSavings = calcSplitSavings(txn.amount, myShare);
    onUpdate(txn.id, { split: newSplit, myShare, splitSavings });
  }

  function handleCustomChange(val) {
    const customAmount = Math.min(parseFloat(val) || 0, txn.amount);
    const newSplit = { ...split, customAmount };
    const myShare = calcMyShare(txn.amount, newSplit);
    const splitSavings = calcSplitSavings(txn.amount, myShare);
    onUpdate(txn.id, { split: newSplit, myShare, splitSavings });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
      <select
        className="form-control"
        style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
        value={split.type}
        onChange={e => handleTypeChange(e.target.value)}
      >
        <option value={SPLIT_TYPES.FULL}>Full</option>
        <option value={SPLIT_TYPES.DIVIDE_N}>Split ÷N</option>
        <option value={SPLIT_TYPES.CUSTOM_AMOUNT}>Custom $</option>
      </select>
      {split.type === SPLIT_TYPES.DIVIDE_N && (
        <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.8125rem' }} value={split.divisor} onChange={e => handleDivisorChange(e.target.value)}>
          {[2,3,4,5,6].map(n => <option key={n} value={n}>÷{n}</option>)}
        </select>
      )}
      {split.type === SPLIT_TYPES.CUSTOM_AMOUNT && (
        <input className="form-control" style={{ padding: '4px 8px', fontSize: '0.8125rem' }} type="number" min={0} max={txn.amount} step={0.01}
          value={split.customAmount || ''} onChange={e => handleCustomChange(e.target.value)} placeholder="$0.00" />
      )}
    </div>
  );
}

// ─── Add Manual Transaction Modal ────────────────────────────────────────────
function AddTransactionModal({ isOpen, onClose, categories, onAdd }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), description: '', amount: '', categoryId: '', subcategoryId: '', transactionType: 'Debit', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const selectedCat = categories.find(c => c.id === form.categoryId);

  function handleSave() {
    if (!form.date || !form.description || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 0) return;
    onAdd({
      date: form.date, rawDescription: form.description, description: form.description,
      amount, transactionType: form.transactionType, categoryId: form.categoryId || 'cat_uncategorized',
      subcategoryId: form.subcategoryId || null, bank: 'manual', autoMatched: false,
      ruleId: null, split: { type: SPLIT_TYPES.FULL, divisor: 2, customAmount: 0 },
      myShare: amount, splitSavings: 0, notes: form.notes,
    });
    onClose();
    setForm({ date: new Date().toISOString().slice(0,10), description: '', amount: '', categoryId: '', subcategoryId: '', transactionType: 'Debit', notes: '' });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Manual Transaction"
      footer={
        <><button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!form.date || !form.description || !form.amount}>Add Transaction</button></>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group"><label className="form-label">Date *</label>
          <input className="form-control" type="date" value={form.date} onChange={e => set('date', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Type</label>
          <select className="form-control" value={form.transactionType} onChange={e => set('transactionType', e.target.value)}>
            <option value="Debit">Debit (Expense)</option>
            <option value="Credit">Credit (Income/Refund)</option>
          </select></div>
      </div>
      <div className="form-group"><label className="form-label">Description *</label>
        <input className="form-control" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Grocery store" /></div>
      <div className="form-group"><label className="form-label">Amount ($) *</label>
        <input className="form-control" type="number" min={0} step={0.01} value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group"><label className="form-label">Category</label>
          <select className="form-control" value={form.categoryId} onChange={e => { set('categoryId', e.target.value); set('subcategoryId', ''); }}>
            <option value="">Uncategorized</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select></div>
        <div className="form-group"><label className="form-label">Subcategory</label>
          <select className="form-control" value={form.subcategoryId} onChange={e => set('subcategoryId', e.target.value)} disabled={!form.categoryId}>
            <option value="">None</option>
            {selectedCat?.subcategories?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
      </div>
      <div className="form-group"><label className="form-label">Notes</label>
        <textarea className="form-control" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" /></div>
    </Modal>
  );
}

// ─── Main Ledger Page ────────────────────────────────────────────────────────
export default function LedgerPage() {
  const { transactions, categories, rules, settings, updateTransaction, deleteTransaction, deleteTransactions, addTransactions, addRule } = useStorage();

  // Filters
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterUncategorized, setFilterUncategorized] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [addModal, setAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // ── "Save as Rule?" prompt state ─────────────────────────────────────────
  // Holds { txn, newCategoryId, newSubcategoryId } when a manual categorization fires
  const [rulePrompt, setRulePrompt] = useState(null);
  // Controls the full rule form modal (opened from the prompt)
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [rulePrefill, setRulePrefill] = useState(null);

  // Called by CategoryCell whenever user manually picks a category
  const handleCategorized = useCallback(({ txn, newCategoryId, newSubcategoryId }) => {
    setRulePrompt({ txn, newCategoryId, newSubcategoryId });
  }, []);

  function dismissRulePrompt() { setRulePrompt(null); }

  function openRuleForm() {
    if (!rulePrompt) return;
    const { txn, newCategoryId, newSubcategoryId } = rulePrompt;
    setRulePrefill({
      // Pre-fill keywords with the raw bank description
      keywords: [{ keyword: txn.rawDescription, matchType: MATCH_TYPES.CONTAINS }],
      normalizedVendor: txn.description || txn.rawDescription,
      categoryId: newCategoryId,
      subcategoryId: newSubcategoryId,
      priority: 50,
      enabled: true,
      notes: `Added from Ledger on ${new Date().toLocaleDateString()}`,
    });
    setRuleModalOpen(true);
    setRulePrompt(null);
  }

  // Unique months for filter dropdown
  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map(t => t.date?.slice(0, 7)).filter(Boolean));
    return [...months].sort().reverse();
  }, [transactions]);

  const availableBanks = useMemo(() => {
    return [...new Set(transactions.map(t => t.bank).filter(Boolean))];
  }, [transactions]);

  // Apply filters
  const filtered = useMemo(() => {
    return transactions
      .filter(t => {
        if (search) {
          const q = search.toLowerCase();
          if (!t.rawDescription?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
        }
        if (filterMonth && !t.date?.startsWith(filterMonth)) return false;
        if (filterCategory && t.categoryId !== filterCategory) return false;
        if (filterBank && t.bank !== filterBank) return false;
        if (filterType && t.transactionType !== filterType) return false;
        if (filterUncategorized && t.categoryId !== 'cat_uncategorized') return false;
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [transactions, search, filterMonth, filterCategory, filterBank, filterType, filterUncategorized]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Totals
  const totals = useMemo(() => ({
    gross: filtered.filter(t => t.transactionType === 'Debit').reduce((s, t) => s + (t.amount || 0), 0),
    myShare: filtered.filter(t => t.transactionType === 'Debit').reduce((s, t) => s + (t.myShare || 0), 0),
    splitSavings: filtered.filter(t => t.transactionType === 'Debit').reduce((s, t) => s + (t.splitSavings || 0), 0),
    count: filtered.length,
  }), [filtered]);

  const clearFilters = () => { setSearch(''); setFilterMonth(''); setFilterCategory(''); setFilterBank(''); setFilterType(''); setFilterUncategorized(false); setPage(1); };

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleSelectAll = useCallback((checked) => {
    setSelectedIds(checked ? new Set(paginated.map(t => t.id)) : new Set());
  }, [paginated]);

  function handleRecategorizeAll() {
    const recategorized = categorizeBatch(transactions, rules);
    recategorized.forEach(t => {
      const orig = transactions.find(o => o.id === t.id);
      if (!orig) return;
      if (t.categoryId !== orig.categoryId || t.ruleId !== orig.ruleId) {
        updateTransaction(t.id, {
          categoryId: t.categoryId, subcategoryId: t.subcategoryId,
          ruleId: t.ruleId, description: t.description, autoMatched: t.autoMatched,
        });
      }
    });
  }

  function getRowClass(t) {
    if (t.transactionType === 'Credit') return 'row-credit';
    if (t.categoryId === 'cat_uncategorized') return 'row-uncategorized';
    if (settings.flagLargeTransactionsThreshold && t.amount >= settings.flagLargeTransactionsThreshold) return 'row-large';
    return '';
  }

  function getCat(catId) { return categories.find(c => c.id === catId); }
  function getSub(catId, subId) { return categories.find(c => c.id === catId)?.subcategories?.find(s => s.id === subId); }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>📋 Unified Ledger</h1>
          <p className="text-muted text-sm">{transactions.length} total transactions · {filtered.length} shown</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleRecategorizeAll} title="Re-apply all rules to existing transactions">🔄 Re-Categorize All</button>
          <button className="btn btn-secondary" onClick={() => exportTransactionsToCSV(filtered, categories)}>⬇️ Export CSV</button>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add Manual</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <input className="form-control" style={{ maxWidth: 220 }} placeholder="🔍 Search description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-control" style={{ maxWidth: 140 }} value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }}>
          <option value="">All Months</option>
          {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="form-control" style={{ maxWidth: 180 }} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select className="form-control" style={{ maxWidth: 140 }} value={filterBank} onChange={e => { setFilterBank(e.target.value); setPage(1); }}>
          <option value="">All Banks</option>
          {availableBanks.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="form-control" style={{ maxWidth: 140 }} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="Debit">Debit</option>
          <option value="Credit">Credit</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" className="checkbox" checked={filterUncategorized} onChange={e => { setFilterUncategorized(e.target.checked); setPage(1); }} />
          Uncategorized only
        </label>
        {(search || filterMonth || filterCategory || filterBank || filterType || filterUncategorized) && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Clear Filters</button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{selectedIds.size} selected</span>
          <button className="btn btn-danger btn-sm" onClick={() => setBulkDeleteConfirm(true)}>🗑️ Delete Selected</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>✕ Deselect</button>
        </div>
      )}

      {/* Table */}
      {transactions.length === 0 ? (
        <EmptyState icon="📊" title="No transactions yet" description="Import a CSV file or add a manual transaction to get started." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No results" description="Try adjusting your filters." action={<button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" className="checkbox"
                      checked={paginated.length > 0 && paginated.every(t => selectedIds.has(t.id))}
                      onChange={e => toggleSelectAll(e.target.checked)} />
                  </th>
                  <th>Date</th>
                  <th>Bank</th>
                  <th>Description</th>
                  <th>Category / Subcategory</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Split</th>
                  <th>My Share</th>
                  <th>Saved</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(t => {
                  const cat = getCat(t.categoryId);
                  return (
                    <tr key={t.id} className={getRowClass(t)}>
                      <td><input type="checkbox" className="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} /></td>
                      <td className="font-mono text-sm" style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                      <td><span className="badge badge-neutral text-xs">{t.bank}</span></td>
                      <td style={{ maxWidth: 200 }}>
                        <div className="truncate" title={t.rawDescription} style={{ fontWeight: 500 }}>{t.description || t.rawDescription}</div>
                        {t.description !== t.rawDescription && <div className="truncate text-xs text-muted" title={t.rawDescription}>{t.rawDescription}</div>}
                        {t.ruleId && <div className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>{t.autoMatched ? `Rule: ${t.ruleId}` : '✏️ Manual'}</div>}
                      </td>
                      <td>
                        <CategoryCell txn={t} categories={categories} onUpdate={updateTransaction} onCategorized={handleCategorized} />
                      </td>
                      <td>
                        <span className={`badge ${t.transactionType === 'Credit' ? 'badge-success' : 'badge-neutral'}`}>
                          {t.transactionType}
                        </span>
                      </td>
                      <td className="font-mono text-sm" style={{ whiteSpace: 'nowrap' }}>{fmt(t.amount)}</td>
                      <td>
                        {t.transactionType === 'Debit' && <SplitCell txn={t} onUpdate={updateTransaction} />}
                      </td>
                      <td className="font-mono text-sm" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {t.transactionType === 'Debit' ? fmt(t.myShare) : '—'}
                      </td>
                      <td className="font-mono text-sm" style={{ color: (t.splitSavings || 0) > 0 ? 'var(--color-success)' : 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}>
                        {(t.splitSavings || 0) > 0 ? fmt(t.splitSavings) : '—'}
                      </td>
                      <td style={{ maxWidth: 140 }}>
                        <input
                          className="form-control"
                          style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: 100 }}
                          value={t.notes || ''}
                          onChange={e => updateTransaction(t.id, { notes: e.target.value })}
                          placeholder="Add note…"
                        />
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteTarget(t)} title="Delete">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--color-surface-2)', fontWeight: 600 }}>
                  <td colSpan={6} style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Totals ({filtered.length} transactions)
                  </td>
                  <td className="font-mono" style={{ padding: '10px 14px' }}>{fmt(totals.gross)}</td>
                  <td></td>
                  <td className="font-mono" style={{ padding: '10px 14px' }}>{fmt(totals.myShare)}</td>
                  <td className="font-mono" style={{ padding: '10px 14px', color: 'var(--color-success)' }}>{totals.splitSavings > 0 ? fmt(totals.splitSavings) : '—'}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
              <span className="text-sm text-muted">Page {page} of {pageCount}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AddTransactionModal
        isOpen={addModal} onClose={() => setAddModal(false)}
        categories={categories} onAdd={(txn) => addTransactions([txn])}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTransaction(deleteTarget.id)}
        title="Delete Transaction"
        message={`Delete transaction "${deleteTarget?.description}"? This cannot be undone.`}
      />
      <ConfirmDialog
        isOpen={bulkDeleteConfirm} onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => { deleteTransactions([...selectedIds]); setSelectedIds(new Set()); }}
        title="Delete Transactions"
        message={`Delete ${selectedIds.size} selected transaction${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`}
      />

      {/* ── "Save as Rule?" floating toast ─────────────────────────────────── */}
      {rulePrompt && (() => {
        const cat = categories.find(c => c.id === rulePrompt.newCategoryId);
        const sub = cat?.subcategories?.find(s => s.id === rulePrompt.newSubcategoryId);
        return (
          <div style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: '#1e293b', color: '#f8fafc', borderRadius: 'var(--radius-lg)',
            padding: '14px 20px', boxShadow: 'var(--shadow-lg)',
            display: 'flex', alignItems: 'center', gap: 16, zIndex: 200,
            maxWidth: 620, width: 'calc(100vw - 48px)', fontSize: '0.9rem',
            animation: 'slideUp 200ms ease',
          }}>
            <span style={{ fontSize: '1.3rem' }}>📌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                Categorized as{' '}
                {cat && <span style={{ color: cat.color }}>{cat.icon} {cat.name}</span>}
                {sub && <span style={{ color: '#94a3b8' }}> › {sub.name}</span>}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Save this as a Rulebook rule so future "{rulePrompt.txn.rawDescription?.slice(0, 40)}{rulePrompt.txn.rawDescription?.length > 40 ? '…' : ''}" transactions are auto-categorized?
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none' }}
                onClick={openRuleForm}
              >
                ✅ Add to Rulebook
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155' }}
                onClick={dismissRulePrompt}
              >
                Not now
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Pre-filled Rule Form Modal ──────────────────────────────────────── */}
      <RuleFormModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        categories={categories}
        initialData={rulePrefill}
        title="📌 Add to Rulebook"
        onSave={(data) => {
          addRule(data);
          setRuleModalOpen(false);
          setRulePrefill(null);
        }}
      />
    </div>
  );
}

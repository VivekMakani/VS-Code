import { useState } from 'react';
import { useStorage } from '../store/StorageContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import RuleFormModal from '../components/rulebook/RuleFormModal';
import { MATCH_TYPE_OPTIONS } from '../constants/matchTypes';
import { DEFAULT_RULES, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../models/seedData';
import { BANK_PROFILES } from '../services/bankProfiles';

// ─── Vendor Rules Tab ────────────────────────────────────────────────────────

function VendorRulesTab() {
  const { rules, categories, addRule, updateRule, deleteRule } = useStorage();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = rules
    .filter(r => !search || r.keyword.toLowerCase().includes(search.toLowerCase()) || r.normalizedVendor?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.priority - b.priority);

  function openAdd() { setEditRule(null); setModalOpen(true); }
  function openEdit(r) { setEditRule(r); setModalOpen(true); }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input className="form-control" style={{ maxWidth: 280 }} placeholder="Search rules…" value={search} onChange={e => setSearch(e.target.value)} />
        <span className="text-muted text-sm">{filtered.length} rules</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Rule</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Keyword / Pattern</th>
              <th>Match Type</th>
              <th>Vendor Name</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8}><EmptyState icon="🔍" title="No rules found" description="Add a rule to start auto-categorizing transactions." /></td></tr>
            )}
            {filtered.map(rule => {
              const cat = categories.find(c => c.id === rule.categoryId);
              const sub = cat?.subcategories?.find(s => s.id === rule.subcategoryId);
              return (
                <tr key={rule.id}>
                  <td><span className="badge badge-neutral">{rule.priority}</span></td>
                  <td>
                    {/* Support both new keywords[] array and legacy single keyword */}
                    {(rule.keywords?.length > 0 ? rule.keywords : [{ keyword: rule.keyword, matchType: rule.matchType }])
                      .map((kw, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {i > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', fontWeight: 700, padding: '0 2px' }}>OR</span>}
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', background: 'var(--color-surface-2)', padding: '2px 6px', borderRadius: 4 }}>{kw.keyword}</code>
                        </span>
                      ))
                    }
                  </td>
                  <td>
                    {(rule.keywords?.length > 0 ? rule.keywords : [{ keyword: rule.keyword, matchType: rule.matchType }])
                      .map((kw, i) => (
                        <span key={i} className="text-sm" style={{ display: 'block', lineHeight: 1.8 }}>
                          {MATCH_TYPE_OPTIONS.find(m => m.value === kw.matchType)?.label || '—'}
                        </span>
                      ))
                    }
                  </td>
                  <td>{rule.normalizedVendor || '—'}</td>
                  <td>
                    {cat && <span className="badge" style={{ background: cat.color + '22', color: cat.color }}>{cat.icon} {cat.name}</span>}
                  </td>
                  <td className="text-sm text-muted">{sub?.name || '—'}</td>
                  <td>
                    <span className={`badge ${rule.enabled ? 'badge-success' : 'badge-neutral'}`}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(rule)} title="Edit">✏️</button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteTarget(rule)} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RuleFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        initialData={editRule}
        onSave={(data) => {
          if (editRule) updateRule(editRule.id, data);
          else addRule(data);
          setModalOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteRule(deleteTarget.id)}
        title="Delete Rule"
        message={`Delete rule for "${deleteTarget?.normalizedVendor || (deleteTarget?.keywords?.[0]?.keyword ?? deleteTarget?.keyword)}"? This cannot be undone.`}
      />
    </div>
  );
}

// ─── Categories Tab ──────────────────────────────────────────────────────────

function CategoriesTab() {
  const { categories, addCategory, updateCategory, deleteCategory, addSubcategory, updateSubcategory, deleteSubcategory } = useStorage();
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [subModal, setSubModal] = useState(false);
  const [editSub, setEditSub] = useState(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState(null);

  const selectedCat = categories.find(c => c.id === selectedCatId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
      {/* Category List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Categories</h3>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditCat(null); setCatModal(true); }}>+ Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {categories.map(cat => (
            <div key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                background: selectedCatId === cat.id ? 'var(--color-primary-light)' : 'var(--color-surface)',
                border: `1px solid ${selectedCatId === cat.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{cat.icon} {cat.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="btn btn-ghost btn-icon" style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                  onClick={e => { e.stopPropagation(); setEditCat(cat); setCatModal(true); }}>✏️</button>
                <button className="btn btn-ghost btn-icon" style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                  onClick={e => { e.stopPropagation(); setDeleteCatTarget(cat); }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subcategory List */}
      <div>
        {!selectedCat ? (
          <EmptyState icon="👆" title="Select a category" description="Click a category on the left to manage its subcategories." />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Subcategories of <span style={{ color: selectedCat.color }}>{selectedCat.icon} {selectedCat.name}</span></h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditSub(null); setSubModal(true); }}>+ Add</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th></th></tr></thead>
                <tbody>
                  {selectedCat.subcategories.length === 0 && (
                    <tr><td colSpan={2}><EmptyState icon="📂" title="No subcategories" description="Add subcategories to organize expenses further." /></td></tr>
                  )}
                  {selectedCat.subcategories.map(sub => (
                    <tr key={sub.id}>
                      <td>{sub.name}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditSub(sub); setSubModal(true); }}>✏️</button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteSubTarget(sub)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Category Modal */}
      <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={editCat ? 'Edit Category' : 'Add Category'}
        footer={
          <><button className="btn btn-secondary" onClick={() => setCatModal(false)}>Cancel</button>
          <button className="btn btn-primary" form="cat-form" type="submit">Save</button></>
        }
      >
        <CategoryForm initialData={editCat} onSave={(data) => {
          if (editCat) updateCategory(editCat.id, data); else addCategory(data);
          setCatModal(false);
        }} />
      </Modal>

      {/* Subcategory Modal */}
      <Modal isOpen={subModal} onClose={() => setSubModal(false)} title={editSub ? 'Edit Subcategory' : 'Add Subcategory'}
        footer={
          <><button className="btn btn-secondary" onClick={() => setSubModal(false)}>Cancel</button>
          <button className="btn btn-primary" form="sub-form" type="submit">Save</button></>
        }
      >
        <form id="sub-form" onSubmit={(e) => {
          e.preventDefault();
          const name = e.target.name_field.value.trim();
          if (!name) return;
          if (editSub) updateSubcategory(selectedCatId, editSub.id, { name });
          else addSubcategory(selectedCatId, { name });
          setSubModal(false);
        }}>
          <div className="form-group">
            <label className="form-label">Subcategory Name *</label>
            <input name="name_field" className="form-control" defaultValue={editSub?.name || ''} placeholder="e.g. Fast Food" required />
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteCatTarget} onClose={() => setDeleteCatTarget(null)}
        onConfirm={() => deleteCategory(deleteCatTarget.id)}
        title="Delete Category" message={`Delete category "${deleteCatTarget?.name}" and all its subcategories?`} />
      <ConfirmDialog isOpen={!!deleteSubTarget} onClose={() => setDeleteSubTarget(null)}
        onConfirm={() => deleteSubcategory(selectedCatId, deleteSubTarget.id)}
        title="Delete Subcategory" message={`Delete subcategory "${deleteSubTarget?.name}"?`} />
    </div>
  );
}

function CategoryForm({ initialData, onSave }) {
  const COLORS = ['#22c55e','#f97316','#a855f7','#3b82f6','#eab308','#ef4444','#ec4899','#06b6d4','#8b5cf6','#f43f5e','#10b981','#84cc16','#64748b','#94a3b8','#22d3ee','#6b7280'];
  return (
    <form id="cat-form" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      onSave({ name: fd.get('name'), color: fd.get('color'), icon: fd.get('icon') });
    }}>
      <div className="form-group"><label className="form-label">Name *</label>
        <input name="name" className="form-control" defaultValue={initialData?.name || ''} required placeholder="e.g. Groceries" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group"><label className="form-label">Icon (emoji)</label>
          <input name="icon" className="form-control" defaultValue={initialData?.icon || ''} placeholder="🛒" /></div>
        <div className="form-group"><label className="form-label">Color</label>
          <select name="color" className="form-control" defaultValue={initialData?.color || COLORS[0]}>
            {COLORS.map(c => <option key={c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>)}
          </select></div>
      </div>
    </form>
  );
}

// ─── Bank Mappings Tab ───────────────────────────────────────────────────────

function BankMappingsTab() {
  const profiles = Object.values(BANK_PROFILES);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="alert alert-info">
        <span>ℹ️</span>
        <span>These are the default column mappings used when importing CSV files from each bank. They are applied automatically based on your bank selection during import.</span>
      </div>
      {profiles.map(profile => (
        <div key={profile.id} className="card">
          <div className="card-header">
            <h3>🏦 {profile.displayName}</h3>
            <span className="badge badge-neutral">Amount sign: {profile.amountSign}</span>
          </div>
          <div className="card-body">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Field</th><th>Column Header(s) to Look For</th></tr></thead>
                <tbody>
                  {Object.entries(profile.columns).filter(([, v]) => v).map(([field, cols]) => (
                    <tr key={field}>
                      <td><strong style={{ textTransform: 'capitalize' }}>{field}</strong></td>
                      <td>{Array.isArray(cols) ? cols.join(', ') : cols}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Global Settings Tab ─────────────────────────────────────────────────────

function GlobalSettingsTab() {
  const { settings, updateSettings, rules, categories, addRule, addCategory, addSubcategory } = useStorage();
  const [form, setForm] = useState(() => ({ ...settings }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSave(e) {
    e.preventDefault();
    updateSettings({ ...form, monthlyBudget: Number(form.monthlyBudget), monthlyIncome: Number(form.monthlyIncome), flagLargeTransactionsThreshold: Number(form.flagLargeTransactionsThreshold), duplicateWindow: Number(form.duplicateWindow) });
    alert('Settings saved!');
  }

  function handleResetRules() {
    if (!confirm('Reset all rules to defaults? Existing rules will be replaced.')) return;
    DEFAULT_RULES.forEach(r => addRule(r));
  }

  function handleResetCategories() {
    if (!confirm('Reset all categories to defaults? Existing categories will remain.')) return;
    DEFAULT_CATEGORIES.forEach(cat => {
      const existing = categories.find(c => c.id === cat.id);
      if (!existing) {
        const { subcategories, ...catData } = cat;
        addCategory(catData);
        subcategories.forEach(sub => addSubcategory(cat.id, sub));
      }
    });
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header"><h3>💰 Budget & Income</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Monthly Budget ($)</label>
            <input className="form-control" type="number" min={0} value={form.monthlyBudget} onChange={e => set('monthlyBudget', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Monthly Income ($) — for affordability panel</label>
            <input className="form-control" type="number" min={0} value={form.monthlyIncome} onChange={e => set('monthlyIncome', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>⚙️ Import & Detection</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Duplicate Detection Window (days)</label>
            <input className="form-control" type="number" min={0} max={30} value={form.duplicateWindow} onChange={e => set('duplicateWindow', e.target.value)} />
            <span className="text-xs text-muted">Transactions within this window with same amount and similar description are flagged as duplicates.</span>
          </div>
          <div className="form-group">
            <label className="form-label">Flag Large Transactions Above ($)</label>
            <input className="form-control" type="number" min={0} value={form.flagLargeTransactionsThreshold} onChange={e => set('flagLargeTransactionsThreshold', e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="flag-uncat" className="checkbox" checked={form.flagUncategorized} onChange={e => set('flagUncategorized', e.target.checked)} />
            <label htmlFor="flag-uncat" className="form-label" style={{ margin: 0 }}>Highlight uncategorized transactions</label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>🔄 Default Split</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Default Split Method</label>
            <select className="form-control" value={form.defaultSplit?.type || 'FULL'} onChange={e => set('defaultSplit', { ...form.defaultSplit, type: e.target.value })}>
              <option value="FULL">Full (100%)</option>
              <option value="DIVIDE_N">Split Evenly (÷N)</option>
              <option value="CUSTOM_AMOUNT">Custom Amount</option>
            </select>
          </div>
          {form.defaultSplit?.type === 'DIVIDE_N' && (
            <div className="form-group">
              <label className="form-label">Divide by</label>
              <select className="form-control" value={form.defaultSplit?.divisor || 2} onChange={e => set('defaultSplit', { ...form.defaultSplit, divisor: Number(e.target.value) })}>
                {[2,3,4,5,6].map(n => <option key={n} value={n}>÷{n} ({Math.round(100/n)}%)</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>🔁 Reset to Defaults</h3></div>
        <div className="card-body" style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={handleResetRules}>Reset Rules ({rules.length} → {DEFAULT_RULES.length})</button>
          <button type="button" className="btn btn-secondary" onClick={handleResetCategories}>Restore Default Categories</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary">Save Settings</button>
      </div>
    </form>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rules', label: '📌 Vendor Rules' },
  { id: 'categories', label: '🏷️ Categories' },
  { id: 'bank-mappings', label: '🏦 Bank Mappings' },
  { id: 'settings', label: '⚙️ Settings' },
];

export default function RulebookPage() {
  const [activeTab, setActiveTab] = useState('rules');
  const { rules } = useStorage();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>⚙️ Rulebook</h1>
        <p className="text-muted text-sm">Configure vendor rules, categories, bank column mappings, and global settings. {rules.length} active rules.</p>
      </div>
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab-item ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {activeTab === 'rules' && <VendorRulesTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'bank-mappings' && <BankMappingsTab />}
      {activeTab === 'settings' && <GlobalSettingsTab />}
    </div>
  );
}

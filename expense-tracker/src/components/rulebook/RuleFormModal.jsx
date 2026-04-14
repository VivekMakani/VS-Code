import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { MATCH_TYPES, MATCH_TYPE_OPTIONS } from '../../constants/matchTypes';

/** Convert old single-keyword rule or pre-fill data to the keywords[] format */
export function normalizeKeywords(rule) {
  if (Array.isArray(rule?.keywords) && rule.keywords.length > 0) return rule.keywords;
  if (rule?.keyword) return [{ keyword: rule.keyword, matchType: rule.matchType || MATCH_TYPES.CONTAINS }];
  return [{ keyword: '', matchType: MATCH_TYPES.CONTAINS }];
}

const EMPTY_FORM = {
  keywords: [{ keyword: '', matchType: MATCH_TYPES.CONTAINS }],
  normalizedVendor: '', categoryId: '', subcategoryId: '',
  priority: 50, enabled: true, notes: '',
};

/**
 * Reusable rule add/edit modal.
 *
 * Props:
 *   isOpen       — boolean
 *   onClose      — () => void
 *   onSave       — (ruleData) => void
 *   categories   — categories array from store
 *   initialData  — rule object to edit, or a prefill object { keywords, categoryId, subcategoryId, normalizedVendor }
 *   title        — optional modal title override
 */
export default function RuleFormModal({ isOpen, onClose, onSave, categories, initialData, title }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialData
      ? { ...EMPTY_FORM, ...initialData, keywords: normalizeKeywords(initialData) }
      : { ...EMPTY_FORM }
    );
  }, [isOpen, initialData]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const selectedCat = categories.find(c => c.id === form.categoryId);

  // ── keyword row helpers ──────────────────────────────────────────────────
  function updateKeyword(index, field, val) {
    setForm(f => ({
      ...f,
      keywords: f.keywords.map((kw, i) => i === index ? { ...kw, [field]: val } : kw),
    }));
  }
  function addKeyword() {
    setForm(f => ({ ...f, keywords: [...f.keywords, { keyword: '', matchType: MATCH_TYPES.CONTAINS }] }));
  }
  function removeKeyword(index) {
    setForm(f => ({ ...f, keywords: f.keywords.filter((_, i) => i !== index) }));
  }

  const hasValidKeyword = form.keywords.some(kw => kw.keyword.trim());

  function handleSave() {
    if (!hasValidKeyword || !form.categoryId) return;
    const cleanedKeywords = form.keywords
      .filter(kw => kw.keyword.trim())
      .map(kw => ({ ...kw, keyword: kw.keyword.trim() }));
    onSave({
      ...form,
      keywords: cleanedKeywords,
      // Keep legacy fields from first keyword for backward compat
      keyword: cleanedKeywords[0].keyword,
      matchType: cleanedKeywords[0].matchType,
      priority: Number(form.priority),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || (initialData?.id ? 'Edit Rule' : 'Add Rule')}
      maxWidth={620}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!hasValidKeyword || !form.categoryId}
          >
            Save Rule
          </button>
        </>
      }
    >
      {/* ── Keywords ──────────────────────────────────────────────────────── */}
      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>Keyword / Pattern(s) *</label>
          <span className="text-xs text-muted">— matches if ANY keyword matches (OR logic)</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.keywords.map((kw, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {i === 0
                ? <div style={{ width: 30, flexShrink: 0 }} />
                : (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-primary)',
                    background: 'var(--color-primary-light)', padding: '2px 5px',
                    borderRadius: 4, flexShrink: 0, letterSpacing: '0.05em', width: 30, textAlign: 'center',
                  }}>OR</span>
                )
              }
              <input
                className="form-control"
                style={{ flex: 1 }}
                placeholder={i === 0 ? 'e.g. WALMART.COM' : 'e.g. WM SUPERCENTER'}
                value={kw.keyword}
                onChange={e => updateKeyword(i, 'keyword', e.target.value)}
              />
              <select
                className="form-control"
                style={{ width: 140, flexShrink: 0 }}
                value={kw.matchType}
                onChange={e => updateKeyword(i, 'matchType', e.target.value)}
              >
                {MATCH_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {form.keywords.length > 1 && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => removeKeyword(i)}
                  title="Remove keyword"
                  style={{ flexShrink: 0, color: 'var(--color-danger)' }}
                >✕</button>
              )}
            </div>
          ))}
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={addKeyword}
          style={{ marginTop: 8, color: 'var(--color-primary)', paddingLeft: 0 }}
        >
          + Add another keyword
        </button>
        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
          Tip: add multiple keywords that all point to the same vendor — e.g.{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>WM SUPERCENTER</code>,{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>WAL-MART</code>,{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>WALMART</code>.
        </div>
      </div>

      {/* ── Vendor Name + Priority ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Normalized Vendor Name</label>
          <input
            className="form-control"
            placeholder="e.g. Walmart"
            value={form.normalizedVendor}
            onChange={e => set('normalizedVendor', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Priority <span className="text-muted">(lower = runs first)</span></label>
          <input
            className="form-control"
            type="number" min={1} max={999}
            value={form.priority}
            onChange={e => set('priority', e.target.value)}
          />
        </div>
      </div>

      {/* ── Category + Subcategory ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Category *</label>
          <select
            className="form-control"
            value={form.categoryId}
            onChange={e => { set('categoryId', e.target.value); set('subcategoryId', ''); }}
          >
            <option value="">Select category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Subcategory</label>
          <select
            className="form-control"
            value={form.subcategoryId}
            onChange={e => set('subcategoryId', e.target.value)}
            disabled={!form.categoryId}
          >
            <option value="">None</option>
            {selectedCat?.subcategories?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Active toggle ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox" id="rule-enabled-modal" className="checkbox"
          checked={form.enabled}
          onChange={e => set('enabled', e.target.checked)}
        />
        <label htmlFor="rule-enabled-modal" className="form-label" style={{ margin: 0 }}>Rule is active</label>
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea
          className="form-control" rows={2}
          placeholder="Optional notes…"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
        />
      </div>
    </Modal>
  );
}

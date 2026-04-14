import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCsvImport, IMPORT_PHASES } from '../hooks/useCsvImport';
import { useStorage } from '../store/StorageContext';
import { BANK_OPTIONS } from '../constants/banks';
import EmptyState from '../components/common/EmptyState';

// ─── Bank Selector ───────────────────────────────────────────────────────────

function BankSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {BANK_OPTIONS.map(opt => (
        <label key={opt.value} style={{
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          padding: '10px 16px', borderRadius: 'var(--radius)',
          border: `2px solid ${value === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background: value === opt.value ? 'var(--color-primary-light)' : 'var(--color-surface)',
          fontWeight: value === opt.value ? 600 : 400, fontSize: '0.9rem',
          transition: 'all 150ms', userSelect: 'none',
        }}>
          <input type="radio" name="bank" value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value)} style={{ display: 'none' }} />
          🏦 {opt.label}
        </label>
      ))}
    </div>
  );
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────

function CsvDropZone({ onCsv }) {
  const fileRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState('');

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onCsv(e.target.result);
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!textMode ? (
        <div
          className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📂</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop your CSV file here or click to browse</div>
          <div className="text-sm text-muted">Supports .csv files from Chase, Bank of America, Capital One, or American Express</div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])} />
        </div>
      ) : (
        <div>
          <textarea
            className="form-control"
            style={{ minHeight: 200, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
            placeholder="Paste CSV content here…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <button className="btn btn-primary" style={{ marginTop: 8 }}
            onClick={() => { if (text.trim()) onCsv(text); }}
            disabled={!text.trim()}>
            Parse CSV
          </button>
        </div>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => setTextMode(m => !m)} style={{ alignSelf: 'flex-start' }}>
        {textMode ? '📂 Switch to file upload' : '📋 Or paste CSV text instead'}
      </button>
    </div>
  );
}

// ─── Import Preview Table ────────────────────────────────────────────────────

function ImportPreviewTable({ rows, duplicateFlags, selectedRows, onToggleRow, onToggleAll }) {
  const allSelected = rows.length > 0 && selectedRows.size === rows.length;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <input type="checkbox" className="checkbox" checked={allSelected}
                onChange={e => onToggleAll(e.target.checked)} />
            </th>
            <th>Date</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={duplicateFlags[i] ? 'row-duplicate' : ''}>
              <td>
                <input type="checkbox" className="checkbox" checked={selectedRows.has(i)}
                  onChange={() => onToggleRow(i)} />
              </td>
              <td className="font-mono text-sm">{row.date}</td>
              <td style={{ maxWidth: 300 }} className="truncate" title={row.rawDescription}>{row.rawDescription}</td>
              <td className="font-mono text-sm">${row.amount?.toFixed(2)}</td>
              <td>
                <span className={`badge ${row.transactionType === 'Credit' ? 'badge-success' : 'badge-neutral'}`}>
                  {row.transactionType}
                </span>
              </td>
              <td>
                {duplicateFlags[i]
                  ? <span className="badge badge-warning">⚠️ Possible Duplicate</span>
                  : <span className="badge badge-success">✓ New</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RawImportPage() {
  const navigate = useNavigate();
  const { categories } = useStorage();
  const {
    phase, bankId, setBankId,
    normalizedRows, duplicateFlags, parseErrors,
    selectedRows, toggleRow, toggleAll,
    summary, startImport, confirmImport, reset,
  } = useCsvImport();

  const dupCount = duplicateFlags.filter(Boolean).length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>📥 Raw Import</h1>
        <p className="text-muted text-sm">Import CSV statements from your bank. Transactions will be auto-categorized and added to the Unified Ledger.</p>
      </div>

      {/* IDLE: bank select + upload */}
      {phase === IMPORT_PHASES.IDLE && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 780 }}>
          <div className="card">
            <div className="card-header"><h3>Step 1 — Select Your Bank</h3></div>
            <div className="card-body">
              <BankSelector value={bankId} onChange={setBankId} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Step 2 — Upload or Paste CSV</h3></div>
            <div className="card-body">
              <CsvDropZone onCsv={(text) => startImport(text, bankId)} />
            </div>
          </div>
          <div className="alert alert-info">
            <span>💡</span>
            <div>
              <strong>How to export CSV from your bank:</strong>
              <ul style={{ marginTop: 6, paddingLeft: 20, lineHeight: 2 }}>
                <li><strong>Chase:</strong> Accounts → Account Activity → Download Account Activity → CSV</li>
                <li><strong>Bank of America:</strong> Accounts → Transactions → Download → CSV Format</li>
                <li><strong>Capital One:</strong> Transactions → Download Transactions → CSV</li>
                <li><strong>American Express:</strong> Statements &amp; Activity → Download → CSV</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* PARSING */}
      {phase === IMPORT_PHASES.PARSING && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Parsing CSV…</div>
          <div className="text-muted text-sm" style={{ marginTop: 8 }}>Normalizing column headers and detecting duplicates</div>
        </div>
      )}

      {/* PREVIEW */}
      {phase === IMPORT_PHASES.PREVIEW && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="card" style={{ padding: '14px 20px', display: 'flex', gap: 32, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Rows</div>
                <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{normalizedRows.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected</div>
                <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-primary)' }}>{selectedRows.size}</div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Possible Duplicates</div>
                <div style={{ fontWeight: 700, fontSize: '1.5rem', color: dupCount > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{dupCount}</div>
              </div>
              {parseErrors.length > 0 && (
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parse Errors</div>
                  <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-danger)' }}>{parseErrors.length}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={reset}>← Back</button>
              <button className="btn btn-primary" onClick={confirmImport} disabled={selectedRows.size === 0}>
                Import {selectedRows.size} Transaction{selectedRows.size !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>

          {dupCount > 0 && (
            <div className="alert alert-warning">
              <span>⚠️</span>
              <span><strong>{dupCount} possible duplicate{dupCount > 1 ? 's' : ''} detected</strong> — unchecked by default. Review and check any you still want to import.</span>
            </div>
          )}
          {parseErrors.length > 0 && (
            <div className="alert alert-danger">
              <span>❌</span>
              <div>
                <strong>Parse errors ({parseErrors.length}):</strong>
                {parseErrors.slice(0, 5).map((e, i) => <div key={i} className="text-sm" style={{ marginTop: 4 }}>{e}</div>)}
                {parseErrors.length > 5 && <div className="text-sm text-muted">…and {parseErrors.length - 5} more</div>}
              </div>
            </div>
          )}

          <ImportPreviewTable
            rows={normalizedRows} duplicateFlags={duplicateFlags}
            selectedRows={selectedRows} onToggleRow={toggleRow} onToggleAll={toggleAll}
          />
        </div>
      )}

      {/* COMMITTING */}
      {phase === IMPORT_PHASES.COMMITTING && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔄</div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Categorizing and saving transactions…</div>
        </div>
      )}

      {/* DONE */}
      {phase === IMPORT_PHASES.DONE && summary && (
        <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 40 }}>
          <div style={{ fontSize: '4rem' }}>✅</div>
          <h2>Import Complete!</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <div className="stat-card">
              <div className="stat-card-label">Imported</div>
              <div className="stat-card-value" style={{ color: 'var(--color-success)' }}>{summary.imported}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Skipped</div>
              <div className="stat-card-value" style={{ color: 'var(--color-text-muted)' }}>{summary.skipped}</div>
            </div>
            {summary.duplicates > 0 && (
              <div className="stat-card">
                <div className="stat-card-label">Duplicates Found</div>
                <div className="stat-card-value" style={{ color: 'var(--color-warning)' }}>{summary.duplicates}</div>
              </div>
            )}
          </div>
          <div className="alert alert-info" style={{ textAlign: 'left' }}>
            <span>💡</span>
            <span>Transactions have been auto-categorized using your rules. Review uncategorized items in the Ledger.</span>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={reset}>Import More</button>
            <button className="btn btn-primary" onClick={() => navigate('/ledger')}>View in Ledger →</button>
          </div>
        </div>
      )}

      {/* ERROR */}
      {phase === IMPORT_PHASES.ERROR && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
          <div className="alert alert-danger">
            <span>❌</span>
            <div>
              <strong>Import failed</strong>
              {parseErrors.map((e, i) => <div key={i} className="text-sm">{e}</div>)}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={reset}>← Try Again</button>
        </div>
      )}
    </div>
  );
}

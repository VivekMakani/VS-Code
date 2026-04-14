import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { normalizeRows } from '../services/csvNormalizer';
import { findDuplicates } from '../services/duplicateDetector';
import { categorizeBatch } from '../services/rulesEngine';
import { calcMyShare, calcSplitSavings } from '../services/splitCalculator';
import { useStorage } from '../store/StorageContext';

export const IMPORT_PHASES = {
  IDLE: 'IDLE',
  PARSING: 'PARSING',
  PREVIEW: 'PREVIEW',
  COMMITTING: 'COMMITTING',
  DONE: 'DONE',
  ERROR: 'ERROR',
};

export function useCsvImport() {
  const { transactions, rules, settings, addTransactions, addImportBatch } = useStorage();
  const [phase, setPhase] = useState(IMPORT_PHASES.IDLE);
  const [bankId, setBankId] = useState('chase');
  const [normalizedRows, setNormalizedRows] = useState([]);
  const [duplicateFlags, setDuplicateFlags] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());

  const reset = useCallback(() => {
    setPhase(IMPORT_PHASES.IDLE);
    setNormalizedRows([]);
    setDuplicateFlags([]);
    setParseErrors([]);
    setSummary(null);
    setSelectedRows(new Set());
  }, []);

  const startImport = useCallback((csvText, selectedBankId) => {
    if (!csvText?.trim()) return;
    setPhase(IMPORT_PHASES.PARSING);
    setBankId(selectedBankId);

    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { normalized, errors } = normalizeRows(results.data, selectedBankId);
        const dups = findDuplicates(normalized, transactions, settings.duplicateWindow || 3);
        setNormalizedRows(normalized);
        setDuplicateFlags(dups);
        setParseErrors([...errors, ...results.errors.map(e => e.message)]);
        setSelectedRows(new Set(normalized.map((_, i) => i).filter(i => !dups[i])));
        setPhase(IMPORT_PHASES.PREVIEW);
      },
      error: (err) => {
        setParseErrors([err.message]);
        setPhase(IMPORT_PHASES.ERROR);
      },
    });
  }, [transactions, settings.duplicateWindow]);

  const confirmImport = useCallback(() => {
    setPhase(IMPORT_PHASES.COMMITTING);
    const batchId = `batch_${Date.now()}`;
    const toImport = normalizedRows.filter((_, i) => selectedRows.has(i));

    // Categorize
    const categorized = categorizeBatch(toImport, rules);

    // Apply default split from settings
    const defaultSplit = settings.defaultSplit || { type: 'FULL', divisor: 2, customAmount: 0 };
    const enriched = categorized.map(t => {
      const myShare = calcMyShare(t.amount, defaultSplit);
      const splitSavings = calcSplitSavings(t.amount, myShare);
      return { ...t, split: defaultSplit, myShare, splitSavings, importBatch: batchId };
    });

    const added = addTransactions(enriched);
    addImportBatch({
      id: batchId,
      bankId,
      rowCount: normalizedRows.length,
      acceptedCount: added.length,
      skippedCount: normalizedRows.length - selectedRows.size,
      dateRangeStart: enriched.reduce((m, t) => (!m || t.date < m ? t.date : m), null),
      dateRangeEnd: enriched.reduce((m, t) => (!m || t.date > m ? t.date : m), null),
    });

    setSummary({
      imported: added.length,
      skipped: normalizedRows.length - selectedRows.size,
      duplicates: duplicateFlags.filter(Boolean).length,
      errors: parseErrors.length,
    });
    setPhase(IMPORT_PHASES.DONE);
  }, [normalizedRows, selectedRows, rules, settings, bankId, addTransactions, addImportBatch, duplicateFlags, parseErrors]);

  const toggleRow = useCallback((idx) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback((val) => {
    if (val) setSelectedRows(new Set(normalizedRows.map((_, i) => i)));
    else setSelectedRows(new Set());
  }, [normalizedRows]);

  return {
    phase, bankId, setBankId,
    normalizedRows, duplicateFlags, parseErrors,
    selectedRows, toggleRow, toggleAll,
    summary,
    startImport, confirmImport, reset,
  };
}

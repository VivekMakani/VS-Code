import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { DEFAULT_CATEGORIES, DEFAULT_RULES, DEFAULT_SETTINGS } from '../models/seedData';
import { calcMyShare, calcSplitSavings } from '../services/splitCalculator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed:', e);
  }
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StorageContext = createContext(null);

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used within StorageProvider');
  return ctx;
}

// ─── Reducers ─────────────────────────────────────────────────────────────────

function transactionsReducer(state, action) {
  switch (action.type) {
    case 'SET': return action.payload;
    case 'ADD_MANY': {
      const existing = new Set(state.map(t => t.id));
      const newOnes = action.payload.filter(t => !existing.has(t.id));
      return [...state, ...newOnes];
    }
    case 'UPDATE': return state.map(t => t.id === action.id ? { ...t, ...action.payload, updatedAt: new Date().toISOString() } : t);
    case 'DELETE': return state.filter(t => t.id !== action.id);
    case 'DELETE_BATCH': return state.filter(t => !action.ids.includes(t.id));
    case 'DELETE_BY_BANK': return state.filter(t => t.bank !== action.bank);
    default: return state;
  }
}

function rulesReducer(state, action) {
  switch (action.type) {
    case 'SET': return action.payload;
    case 'ADD': return [...state, action.payload];
    case 'UPDATE': return state.map(r => r.id === action.id ? { ...r, ...action.payload } : r);
    case 'DELETE': return state.filter(r => r.id !== action.id);
    case 'REORDER': return action.payload;
    default: return state;
  }
}

function categoriesReducer(state, action) {
  switch (action.type) {
    case 'SET': return action.payload;
    case 'ADD_CATEGORY': return [...state, action.payload];
    case 'UPDATE_CATEGORY': return state.map(c => c.id === action.id ? { ...c, ...action.payload } : c);
    case 'DELETE_CATEGORY': return state.filter(c => c.id !== action.id);
    case 'ADD_SUBCATEGORY': return state.map(c => c.id === action.categoryId
      ? { ...c, subcategories: [...c.subcategories, action.payload] }
      : c);
    case 'UPDATE_SUBCATEGORY': return state.map(c => c.id === action.categoryId
      ? { ...c, subcategories: c.subcategories.map(s => s.id === action.id ? { ...s, ...action.payload } : s) }
      : c);
    case 'DELETE_SUBCATEGORY': return state.map(c => c.id === action.categoryId
      ? { ...c, subcategories: c.subcategories.filter(s => s.id !== action.id) }
      : c);
    default: return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StorageProvider({ children }) {
  const [transactions, dispatchTxn] = useReducer(
    transactionsReducer,
    null,
    () => load(STORAGE_KEYS.TRANSACTIONS, [])
  );
  const [rules, dispatchRules] = useReducer(
    rulesReducer,
    null,
    () => load(STORAGE_KEYS.RULES, DEFAULT_RULES)
  );
  const [categories, dispatchCats] = useReducer(
    categoriesReducer,
    null,
    () => load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES)
  );
  const [settings, setSettingsState] = useReducer(
    (s, a) => ({ ...s, ...a }),
    null,
    () => load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
  );
  const [importBatches, setImportBatches] = useReducer(
    (s, a) => a.type === 'ADD' ? [...s, a.payload] : s,
    null,
    () => load(STORAGE_KEYS.IMPORT_BATCHES, [])
  );

  // Persist to localStorage on every change
  useEffect(() => { save(STORAGE_KEYS.TRANSACTIONS, transactions); }, [transactions]);
  useEffect(() => { save(STORAGE_KEYS.RULES, rules); }, [rules]);
  useEffect(() => { save(STORAGE_KEYS.CATEGORIES, categories); }, [categories]);
  useEffect(() => { save(STORAGE_KEYS.SETTINGS, settings); }, [settings]);
  useEffect(() => { save(STORAGE_KEYS.IMPORT_BATCHES, importBatches); }, [importBatches]);

  // ─── Transaction Actions ───────────────────────────────────────────────────

  const addTransactions = useCallback((incoming) => {
    const enriched = incoming.map(t => ({
      id: t.id || generateId('txn'),
      importBatch: t.importBatch || null,
      bank: t.bank || 'unknown',
      date: t.date,
      rawDescription: t.rawDescription,
      description: t.description || t.rawDescription,
      amount: t.amount || 0,
      transactionType: t.transactionType || 'Debit',
      categoryId: t.categoryId || 'cat_uncategorized',
      subcategoryId: t.subcategoryId || null,
      autoMatched: t.autoMatched || false,
      ruleId: t.ruleId || null,
      split: t.split || { type: 'FULL', divisor: 2, customAmount: 0 },
      myShare: t.myShare ?? t.amount ?? 0,
      splitSavings: t.splitSavings ?? 0,
      notes: t.notes || '',
      excluded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    dispatchTxn({ type: 'ADD_MANY', payload: enriched });
    return enriched;
  }, []);

  const updateTransaction = useCallback((id, changes) => {
    // If split changed, recalculate myShare
    let finalChanges = changes;
    if (changes.split || changes.amount !== undefined) {
      const existing = transactions.find(t => t.id === id);
      if (existing) {
        const amount = changes.amount ?? existing.amount;
        const split = changes.split ?? existing.split;
        const myShare = calcMyShare(amount, split);
        const splitSavings = calcSplitSavings(amount, myShare);
        finalChanges = { ...changes, myShare, splitSavings };
      }
    }
    dispatchTxn({ type: 'UPDATE', id, payload: finalChanges });
  }, [transactions]);

  const deleteTransaction = useCallback((id) => {
    dispatchTxn({ type: 'DELETE', id });
  }, []);

  const deleteTransactions = useCallback((ids) => {
    dispatchTxn({ type: 'DELETE_BATCH', ids });
  }, []);

  // ─── Rule Actions ─────────────────────────────────────────────────────────

  const addRule = useCallback((rule) => {
    const newRule = {
      ...rule,
      id: rule.id || `R${String(rules.length + 1).padStart(3, '0')}`,
      enabled: rule.enabled ?? true,
      createdAt: new Date().toISOString(),
    };
    dispatchRules({ type: 'ADD', payload: newRule });
    return newRule;
  }, [rules]);

  const updateRule = useCallback((id, changes) => {
    dispatchRules({ type: 'UPDATE', id, payload: changes });
  }, []);

  const deleteRule = useCallback((id) => {
    dispatchRules({ type: 'DELETE', id });
  }, []);

  const reorderRules = useCallback((reorderedRules) => {
    const renumbered = reorderedRules.map((r, i) => ({ ...r, priority: (i + 1) * 10 }));
    dispatchRules({ type: 'REORDER', payload: renumbered });
  }, []);

  // ─── Category Actions ─────────────────────────────────────────────────────

  const addCategory = useCallback((cat) => {
    const newCat = {
      ...cat,
      id: cat.id || generateId('cat'),
      subcategories: cat.subcategories || [],
      sortOrder: cat.sortOrder ?? categories.length + 1,
    };
    dispatchCats({ type: 'ADD_CATEGORY', payload: newCat });
    return newCat;
  }, [categories]);

  const updateCategory = useCallback((id, changes) => {
    dispatchCats({ type: 'UPDATE_CATEGORY', id, payload: changes });
  }, []);

  const deleteCategory = useCallback((id) => {
    dispatchCats({ type: 'DELETE_CATEGORY', id });
  }, []);

  const addSubcategory = useCallback((categoryId, sub) => {
    const cat = categories.find(c => c.id === categoryId);
    const newSub = {
      ...sub,
      id: sub.id || generateId('sub'),
      parentId: categoryId,
      sortOrder: sub.sortOrder ?? (cat?.subcategories?.length || 0) + 1,
    };
    dispatchCats({ type: 'ADD_SUBCATEGORY', categoryId, payload: newSub });
    return newSub;
  }, [categories]);

  const updateSubcategory = useCallback((categoryId, id, changes) => {
    dispatchCats({ type: 'UPDATE_SUBCATEGORY', categoryId, id, payload: changes });
  }, []);

  const deleteSubcategory = useCallback((categoryId, id) => {
    dispatchCats({ type: 'DELETE_SUBCATEGORY', categoryId, id });
  }, []);

  // ─── Settings Actions ─────────────────────────────────────────────────────

  const updateSettings = useCallback((changes) => {
    setSettingsState(changes);
  }, []);

  // ─── Import Batch Actions ─────────────────────────────────────────────────

  const addImportBatch = useCallback((batch) => {
    const b = { ...batch, id: batch.id || generateId('batch'), importedAt: new Date().toISOString() };
    setImportBatches({ type: 'ADD', payload: b });
    return b;
  }, []);

  const value = {
    transactions, rules, categories, settings, importBatches,
    addTransactions, updateTransaction, deleteTransaction, deleteTransactions,
    addRule, updateRule, deleteRule, reorderRules,
    addCategory, updateCategory, deleteCategory,
    addSubcategory, updateSubcategory, deleteSubcategory,
    updateSettings, addImportBatch,
  };

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

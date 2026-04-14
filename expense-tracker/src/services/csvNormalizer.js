import { BANK_PROFILES } from './bankProfiles';

/**
 * Find a column value in a row object by trying multiple header name candidates.
 */
function findColumn(row, candidates) {
  if (!candidates) return undefined;
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  // Try case-insensitive match
  const lowerCandidates = candidates.map(c => c.toLowerCase());
  for (const [key, val] of Object.entries(row)) {
    if (lowerCandidates.includes(key.toLowerCase())) {
      return val;
    }
  }
  return undefined;
}

/**
 * Parse a date string into ISO YYYY-MM-DD format.
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = String(dateStr).trim();

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // Try MM/DD/YYYY or M/D/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try MM-DD-YYYY
  const mdyDashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdyDashMatch) {
    const [, m, d, y] = mdyDashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: try JS Date parsing
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Parse amount to a positive number. Direction is returned separately.
 */
function parseAmountAndType(row, profile) {
  const { amountSign, columns } = profile;

  if (amountSign === 'split_columns') {
    const debitRaw = findColumn(row, columns.debit);
    const creditRaw = findColumn(row, columns.credit);
    const debit = debitRaw ? Math.abs(parseFloat(String(debitRaw).replace(/[$,]/g, ''))) : 0;
    const credit = creditRaw ? Math.abs(parseFloat(String(creditRaw).replace(/[$,]/g, ''))) : 0;
    if (credit > 0) return { amount: credit, type: 'Credit' };
    if (debit > 0) return { amount: debit, type: 'Debit' };
    return { amount: 0, type: 'Debit' };
  }

  const raw = findColumn(row, columns.amount);
  if (raw === undefined || raw === null || raw === '') return { amount: 0, type: 'Debit' };
  const num = parseFloat(String(raw).replace(/[$,]/g, ''));
  if (isNaN(num)) return { amount: 0, type: 'Debit' };

  if (amountSign === 'negative_is_expense') {
    return { amount: Math.abs(num), type: num < 0 ? 'Debit' : 'Credit' };
  }
  if (amountSign === 'positive_is_expense') {
    return { amount: Math.abs(num), type: num > 0 ? 'Debit' : 'Credit' };
  }
  return { amount: Math.abs(num), type: 'Debit' };
}

/**
 * Normalize an array of raw CSV rows from PapaParse into a canonical format.
 *
 * @param {Object[]} rawRows - rows from PapaParse (header: true)
 * @param {string} bankId - one of the BANK_IDS values
 * @param {Object} [overrides] - optional column override map
 * @returns {{ normalized: Object[], errors: string[] }}
 */
export function normalizeRows(rawRows, bankId, overrides = {}) {
  const profile = BANK_PROFILES[bankId];
  if (!profile) return { normalized: [], errors: [`Unknown bank: ${bankId}`] };

  const mergedColumns = { ...profile.columns, ...overrides };
  const mergedProfile = { ...profile, columns: mergedColumns };

  const normalized = [];
  const errors = [];

  rawRows.forEach((row, idx) => {
    // Skip empty rows
    const rowValues = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
    if (rowValues.length === 0) return;

    const dateRaw = findColumn(row, mergedProfile.columns.date);
    const descRaw = findColumn(row, mergedProfile.columns.description);
    const { amount, type } = parseAmountAndType(row, mergedProfile);
    const date = parseDate(dateRaw);

    if (!date) {
      errors.push(`Row ${idx + 2}: Could not parse date "${dateRaw}"`);
      return;
    }
    if (!descRaw) {
      errors.push(`Row ${idx + 2}: Missing description`);
      return;
    }
    if (amount === 0 && type === 'Debit') {
      // Might be a header row or empty — skip silently
      return;
    }

    normalized.push({
      date,
      rawDescription: String(descRaw).trim(),
      description: String(descRaw).trim(),
      amount,
      transactionType: type,
      bank: bankId,
    });
  });

  return { normalized, errors };
}

import { MATCH_TYPES } from '../constants/matchTypes';

/**
 * Test a single keyword+matchType pair against a raw description string.
 */
function keywordMatches(keyword, matchType, rawDesc) {
  const text = rawDesc.toLowerCase();
  const kw = keyword.toLowerCase().trim();
  if (!kw) return false;
  switch (matchType) {
    case MATCH_TYPES.CONTAINS:    return text.includes(kw);
    case MATCH_TYPES.STARTS_WITH: return text.startsWith(kw);
    case MATCH_TYPES.EXACT:       return text === kw;
    default:                      return false;
  }
}

/**
 * Test a rule against a raw description.
 * Supports both the new `keywords` array (OR logic — any match wins)
 * and the legacy single `keyword` + `matchType` fields (backward compatible).
 */
function ruleMatches(rule, rawDesc) {
  // New format: keywords array — match if ANY keyword matches (OR logic)
  if (Array.isArray(rule.keywords) && rule.keywords.length > 0) {
    return rule.keywords.some(({ keyword, matchType }) =>
      keywordMatches(keyword, matchType, rawDesc)
    );
  }
  // Legacy format: single keyword + matchType
  return keywordMatches(rule.keyword || '', rule.matchType, rawDesc);
}

/**
 * Apply rules to a raw description.
 * Rules must be sorted by priority ascending (lowest number = highest priority).
 * Returns the first matching rule's relevant fields, or null if no match.
 *
 * @param {string} rawDesc
 * @param {Array} rules  — sorted rule objects from the store
 * @returns {{ categoryId, subcategoryId, ruleId, normalizedVendor, defaultSplit } | null}
 */
export function applyRules(rawDesc, rules) {
  if (!rawDesc || !rules || rules.length === 0) return null;

  const sorted = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (ruleMatches(rule, rawDesc)) {
      return {
        categoryId: rule.categoryId,
        subcategoryId: rule.subcategoryId || null,
        ruleId: rule.id,
        normalizedVendor: rule.normalizedVendor || null,
        defaultSplit: rule.defaultSplit || null,
      };
    }
  }
  return null;
}

/**
 * Categorize a batch of transaction objects.
 * Each transaction must have rawDescription.
 * Returns a new array with categoryId, subcategoryId, ruleId, autoMatched set.
 */
export function categorizeBatch(transactions, rules) {
  return transactions.map(txn => {
    const match = applyRules(txn.rawDescription, rules);
    if (match) {
      return {
        ...txn,
        categoryId: match.categoryId,
        subcategoryId: match.subcategoryId,
        ruleId: match.ruleId,
        description: match.normalizedVendor || txn.description,
        autoMatched: true,
      };
    }
    return {
      ...txn,
      categoryId: 'cat_uncategorized',
      subcategoryId: null,
      ruleId: null,
      autoMatched: false,
    };
  });
}

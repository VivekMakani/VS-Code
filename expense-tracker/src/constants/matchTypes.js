export const MATCH_TYPES = {
  CONTAINS: 'contains',
  STARTS_WITH: 'startsWith',
  EXACT: 'exact',
};

export const MATCH_TYPE_LABELS = {
  [MATCH_TYPES.CONTAINS]: 'Contains',
  [MATCH_TYPES.STARTS_WITH]: 'Starts With',
  [MATCH_TYPES.EXACT]: 'Exact Match',
};

export const MATCH_TYPE_OPTIONS = Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => ({ value, label }));

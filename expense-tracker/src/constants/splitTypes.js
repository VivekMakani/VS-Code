export const SPLIT_TYPES = {
  FULL: 'FULL',
  DIVIDE_N: 'DIVIDE_N',
  CUSTOM_AMOUNT: 'CUSTOM_AMOUNT',
};

export const SPLIT_TYPE_LABELS = {
  [SPLIT_TYPES.FULL]: 'Full (100%)',
  [SPLIT_TYPES.DIVIDE_N]: 'Split Evenly',
  [SPLIT_TYPES.CUSTOM_AMOUNT]: 'Custom Amount',
};

export const SPLIT_DIVISOR_OPTIONS = [2, 3, 4, 5, 6].map(n => ({ value: n, label: `÷${n} (${Math.round(100/n)}%)` }));

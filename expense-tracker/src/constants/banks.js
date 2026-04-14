export const BANK_IDS = {
  CHASE: 'chase',
  BOFA: 'bofa',
  CAPITAL_ONE: 'capitalOne',
  AMEX: 'amex',
};

export const BANK_LABELS = {
  [BANK_IDS.CHASE]: 'Chase',
  [BANK_IDS.BOFA]: 'Bank of America',
  [BANK_IDS.CAPITAL_ONE]: 'Capital One',
  [BANK_IDS.AMEX]: 'American Express',
};

export const BANK_OPTIONS = Object.entries(BANK_LABELS).map(([value, label]) => ({ value, label }));

export const amexProfile = {
  id: 'amex',
  displayName: 'American Express',
  columns: {
    date: ['Date'],
    description: ['Description'],
    amount: ['Amount'],
    credit: null,
    debit: null,
  },
  // AmEx: positive = expense (opposite of Chase)
  amountSign: 'positive_is_expense',
  dateFormats: ['MM/DD/YYYY', 'YYYY-MM-DD', 'M/D/YYYY'],
};

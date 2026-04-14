export const chaseProfile = {
  id: 'chase',
  displayName: 'Chase',
  columns: {
    date: ['Transaction Date', 'Date'],
    description: ['Description'],
    amount: ['Amount'],
    credit: null,
    debit: null,
  },
  // Chase: positive = credit/income, negative = debit/expense
  amountSign: 'negative_is_expense',
  dateFormats: ['MM/DD/YYYY', 'YYYY-MM-DD', 'M/D/YYYY'],
};

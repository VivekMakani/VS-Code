export const capitalOneProfile = {
  id: 'capitalOne',
  displayName: 'Capital One',
  columns: {
    date: ['Transaction Date', 'Date'],
    description: ['Description'],
    amount: null,
    credit: ['Credit'],
    debit: ['Debit'],
  },
  // Capital One: separate Debit and Credit columns
  amountSign: 'split_columns',
  dateFormats: ['YYYY-MM-DD', 'MM/DD/YYYY', 'M/D/YYYY'],
};

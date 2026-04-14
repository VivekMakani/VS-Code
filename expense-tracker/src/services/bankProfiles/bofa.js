export const bofaProfile = {
  id: 'bofa',
  displayName: 'Bank of America',
  columns: {
    date: ['Posted Date', 'Date'],
    description: ['Payee', 'Description'],
    amount: ['Amount'],
    credit: null,
    debit: null,
  },
  // BoA: negative = expense
  amountSign: 'negative_is_expense',
  dateFormats: ['MM/DD/YYYY', 'YYYY-MM-DD', 'M/D/YYYY'],
};

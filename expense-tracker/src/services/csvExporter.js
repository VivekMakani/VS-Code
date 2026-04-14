/**
 * Convert an array of transaction objects to a CSV string and trigger a browser download.
 */
export function exportTransactionsToCSV(transactions, categories = [], filename = 'transactions.csv') {
  const getCategoryName = (catId) => categories.find(c => c.id === catId)?.name || catId || '';
  const getSubcategoryName = (catId, subId) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.subcategories?.find(s => s.id === subId)?.name || subId || '';
  };

  const headers = [
    'Date', 'Bank', 'Description', 'Raw Description', 'Category', 'Subcategory',
    'Type', 'Amount', 'My Share', 'Split Savings', 'Split Method', 'Notes',
  ];

  const rows = transactions.map(t => [
    t.date || '',
    t.bank || '',
    t.description || '',
    t.rawDescription || '',
    getCategoryName(t.categoryId),
    getSubcategoryName(t.categoryId, t.subcategoryId),
    t.transactionType || '',
    t.amount?.toFixed(2) || '0.00',
    t.myShare?.toFixed(2) || '0.00',
    t.splitSavings?.toFixed(2) || '0.00',
    t.split?.type || 'FULL',
    (t.notes || '').replace(/,/g, ';'),
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Simple Levenshtein distance for short strings (descriptions).
 * Only used for values under 100 chars for performance.
 */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Check each incoming normalized row against existing transactions.
 * Returns an array of booleans (true = suspected duplicate, indexed same as incomingRows).
 *
 * Duplicate criteria: same amount AND date within windowDays AND description similar (lev ≤ 3).
 */
export function findDuplicates(incomingRows, existingTransactions, windowDays = 3) {
  return incomingRows.map(incoming => {
    const incomingDate = new Date(incoming.date).getTime();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    return existingTransactions.some(existing => {
      const existingDate = new Date(existing.date).getTime();
      if (Math.abs(incomingDate - existingDate) > windowMs) return false;
      if (Math.abs(existing.amount - incoming.amount) > 0.01) return false;
      const dist = levenshtein(
        incoming.rawDescription.toLowerCase().slice(0, 60),
        existing.rawDescription.toLowerCase().slice(0, 60)
      );
      return dist <= 3;
    });
  });
}

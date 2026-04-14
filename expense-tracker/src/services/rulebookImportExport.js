// ─── Rulebook Export ──────────────────────────────────────────────────────────

export function exportRulebook(rules, categories) {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    rules,
    categories,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rulebook-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Rulebook Parse ───────────────────────────────────────────────────────────

export function parseRulebookFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid file — could not parse JSON. Make sure you are uploading a rulebook .json file exported from this app.');
  }

  const rules = Array.isArray(data.rules) ? data.rules : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];

  if (rules.length === 0 && categories.length === 0) {
    throw new Error('The file contains no rules or categories to import.');
  }

  return {
    rules,
    categories,
    exportedAt: data.exportedAt || null,
    version: data.version || '1.0',
  };
}

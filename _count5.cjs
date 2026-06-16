const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
// Count unique substance IDs in SUPPORT_CATALOG_DATA
const start = c.indexOf('SUPPORT_CATALOG_DATA');
const data = c.substring(start);
// Find all id fields (both single and double quoted)
const ids1 = data.match(/id:\s*'([^']+)'/g) || [];
const ids2 = data.match(/id:\s*"([^"]+)"/g) || [];
const allIds = [...ids1, ...ids2].map(s => s.replace(/^id:\s*['"]/, '').replace(/['"]$/, ''));
// Get unique substance-level IDs (these are the keys in the Record)
const keyPattern = /^\s+(\w+):\s*\{/gm;
const keys = [];
let m;
while ((m = keyPattern.exec(data)) !== null) {
  keys.push(m[1]);
}
console.log('Total id fields:', allIds.length);
console.log('Top-level keys (substances):', keys.length);
console.log('Keys:', keys.join(', '));

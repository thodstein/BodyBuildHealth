const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
const start = c.indexOf('SUPPORT_CATALOG_DATA');
const end = c.indexOf('};', start);
const data = c.substring(start, end + 2);
console.log('Data length:', data.length);
// Find all keys like "  keyName: {" 
const keyRegex = /\n\s+(\w+):\s*\{/g;
const keys = [];
let m;
while ((m = keyRegex.exec(data)) !== null) {
  const k = m[1];
  // Filter out nested keys (dosage, forms, etc)
  if (k.length > 2 && !['dosage','forms','synergies','conflicts','monitoring','contraindications','sideEffects','best','notes'].includes(k)) {
    keys.push(k);
  }
}
console.log('Substance keys found:', keys.length);
console.log('Keys:', keys.join(', '));

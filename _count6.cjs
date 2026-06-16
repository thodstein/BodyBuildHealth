const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
const start = c.indexOf('SUPPORT_CATALOG_DATA');
const data = c.substring(start);
// Find all top-level keys: word followed by colon and { at the start of a line
// Pattern: "  keyName: {"
const keyRegex = /^  (\w+): \{$/gm;
const keys = [];
let m;
while ((m = keyRegex.exec(data)) !== null) {
  // Skip reserved words that are not substance IDs
  if (['dosage', 'forms', 'synergies', 'conflicts', 'monitoring', 'contraindications', 'sideEffects'].includes(m[1])) continue;
  keys.push(m[1]);
}
console.log('Top-level substance keys:', keys.length);
console.log('Keys:', keys.join(', '));

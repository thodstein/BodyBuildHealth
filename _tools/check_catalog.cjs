const fs = require('fs');
const content = fs.readFileSync('src/data/support-catalog.ts', 'utf8');

// Find all top-level keys in SUPPORT_CATALOG_DATA
const dataMatch = content.match(/SUPPORT_CATALOG_DATA:\s*Record<string,\s*SupportCatalogEntry>\s*=\s*\{([\s\S]*)\n\};/);
if (!dataMatch) {
  console.log('Could not find SUPPORT_CATALOG_DATA');
  process.exit(1);
}

const dataBlock = dataMatch[1];
const keys = [];
const keyRegex = /^\s{2}(\w+):\s*\{/gm;
let m;
while ((m = keyRegex.exec(dataBlock)) !== null) {
  keys.push(m[1]);
}

console.log('=== support-catalog.ts CURRENT STATE ===');
console.log('Number of substance entries:', keys.length);
console.log('File size:', (content.length / 1024).toFixed(1), 'KB');
console.log('Lines:', content.split('\n').length);
console.log('\nAll entries:');
keys.forEach(k => console.log('  ' + k));

// Check which fields each entry has
const fieldsPerEntry = {};
for (const key of keys) {
  const entryStart = dataBlock.indexOf(key + ':');
  const entryEnd = dataBlock.indexOf('\n  },', entryStart);
  const entry = dataBlock.substring(entryStart, entryEnd);
  const fields = [];
  const fieldRegex = /(\w+):\s/g;
  let fm;
  while ((fm = fieldRegex.exec(entry)) !== null) {
    if (fm[1] !== key && !['mg','timing','best','form','name','nameRu','dose'].includes(fm[1])) {
      fields.push(fm[1]);
    }
  }
  fieldsPerEntry[key] = [...new Set(fields)];
}

console.log('\n=== Fields per entry ===');
for (const [key, fields] of Object.entries(fieldsPerEntry)) {
  console.log(key + ': ' + fields.join(', '));
}

// Check completeness: which entries have ALL fields
const requiredFields = ['id','name','nameRu','tier','category','forms','organs','systems','mechanisms','description','synergies','conflicts','monitoring','contraindications','sideEffects','dosage','bestForCourse'];
let complete = 0;
let incomplete = 0;
for (const key of keys) {
  const entryStart = dataBlock.indexOf(key + ':');
  const entryEnd = dataBlock.indexOf('\n  },', entryStart);
  const entry = dataBlock.substring(entryStart, entryEnd);
  const hasAll = requiredFields.every(f => entry.includes(f + ':') || entry.includes(f + ': '));
  if (hasAll) complete++;
  else incomplete++;
}
console.log('\n=== Completeness ===');
console.log('Complete entries (all fields):', complete);
console.log('Incomplete entries:', incomplete);

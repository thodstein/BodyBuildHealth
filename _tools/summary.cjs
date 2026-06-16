const fs = require('fs');
const content = fs.readFileSync('src/data/canonical-map.ts', 'utf8');
const regex = /"([^"]+)":\s*"([^"]+)"/g;
const entries = [];
let m;
while ((m = regex.exec(content)) !== null) {
  entries.push({ from: m[1], to: m[2] });
}
const canonicalIds = [...new Set(entries.map(e => e.to))];
console.log('=== CANONICAL_ID_MAP SUMMARY ===');
console.log('Total mapping entries:', entries.length);
console.log('Unique canonical IDs:', canonicalIds.length);
const categories = {};
canonicalIds.forEach(id => {
  const cat = id.includes('_') ? id.split('_')[0] : 'other';
  categories[cat] = (categories[cat] || 0) + 1;
});
console.log('\nCanonical IDs by prefix:');
Object.entries(categories).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log('  ' + cat + ': ' + count);
});
console.log('\nAll canonical IDs:');
canonicalIds.sort().forEach(id => console.log('  ' + id));

const fs = require('fs');
const catalogContent = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
const mapContent = fs.readFileSync('src/data/canonical-map.ts', 'utf8');

// Extract canonical IDs from the map
const mapRegex = /"([^"]+)"/g;
const allValues = [];
let m;
while ((m = mapRegex.exec(mapContent)) !== null) {
  allValues.push(m[1]);
}
const canonicalIds = [...new Set(allValues.filter(v => !v.includes('_') || v.length < 30))];

// Catalog keys
const catalogKeys = ['nac','tudca','magnesium','coq10','vitamin_d3','zinc','selenium','milk_thistle','curcumin','ashwagandha','vitamin_c','taurine','alpha_lipoic','berberine','vitamin_k2','probiotics','collagen','glucosamine','telmisartan','nebivolol'];

const missing = canonicalIds.filter(id => !catalogKeys.includes(id));
const present = canonicalIds.filter(id => catalogKeys.includes(id));

console.log('=== ÊÀÒÀËÎÃ: ÒÅÊÓÙÅÅ ÑÎÑÒÎßÍÈÅ ===');
console.log('Çàïèñåé â êàòàëîãå:', catalogKeys.length);
console.log('Êàíîíè÷åñêèõ ID âñåãî:', canonicalIds.length);
console.log('Óæå â êàòàëîãå:', present.length);
console.log('ÎÒÑÓÒÑÒÂÓÞÒ â êàòàëîãå:', missing.length);
console.log('\nÎòñóòñòâóþùèå ID:');
missing.forEach(id => console.log('  ' + id));

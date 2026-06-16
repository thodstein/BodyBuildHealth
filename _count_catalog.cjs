const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
const m = c.match(/id: '([^']+)'/g);
console.log('Entries:', m ? m.length : 0);
if (m) console.log('IDs:', m.slice(0, 30).map(s => s.replace("id: '", "").replace("'", "")).join(', '));

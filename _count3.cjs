const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
const start = c.indexOf('SUPPORT_CATALOG_DATA');
const data = c.substring(start);
const entries = data.match(/"id":\s*"([^"]+)"/g);
if (entries) {
  console.log('JSON entries:', entries.length);
  console.log('IDs:', entries.slice(0,20).map(s => s.replace(/"id":\s*"/, '').replace(/"/, '')).join(', '));
} else {
  console.log('No entries found');
}

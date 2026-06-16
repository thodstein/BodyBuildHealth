const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
// Count SUPPORT_CATALOG_DATA entries
const dataStart = c.indexOf('SUPPORT_CATALOG_DATA');
if (dataStart === -1) { console.log('No SUPPORT_CATALOG_DATA found'); process.exit(0); }
const data = c.substring(dataStart);
const entries = data.match(/\bid:\s*'([^']+)'/g);
console.log('SUPPORT_CATALOG_DATA entries:', entries ? entries.length : 0);
// Also check for standalone entries before SUPPORT_CATALOG_DATA
const header = c.substring(0, dataStart);
const headerEntries = header.match(/\bid:\s*'([^']+)'/g);
console.log('Header entries:', headerEntries ? headerEntries.length : 0);

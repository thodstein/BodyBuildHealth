const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
// Check if SUPPORT_CATALOG_DATA exists and what format it uses
const start = c.indexOf('SUPPORT_CATALOG_DATA');
if (start === -1) { console.log('NO SUPPORT_CATALOG_DATA'); process.exit(0); }
console.log('Starts at:', start);
// Check if it uses single quotes or double quotes
const snippet = c.substring(start, start + 200);
console.log('Snippet:', snippet.substring(0, 200));
// Try single quote pattern
const singleEntries = c.match(/id:\s*'([^']+)'/g);
console.log('Single-quote entries:', singleEntries ? singleEntries.length : 0);
// Try double quote pattern
const doubleEntries = c.match(/id:\s*"([^"]+)"/g);
console.log('Double-quote entries:', doubleEntries ? doubleEntries.length : 0);
// Try no-quote (JS object shorthand) 
const noQuoteEntries = c.match(/\bid:\s*(\w+)/g);
console.log('No-quote entries:', noQuoteEntries ? noQuoteEntries.length : 0);

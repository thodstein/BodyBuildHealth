const fs = require('fs');
const data = fs.readFileSync('src/core/system-mechanisms.ts', 'utf8');
console.log('Current file size:', data.length);

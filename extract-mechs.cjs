const fs = require('fs');
const c = fs.readFileSync('src/data/support-catalog.ts', 'utf8');
const mechs = new Set();
const re = /mechanisms:\s*\[([^\]]+)\]/g;
let m;
while ((m = re.exec(c)) !== null) {
  m[1].split(',').forEach(s => {
    const v = s.trim().replace(/['"]/g, '');
    if (v) mechs.add(v);
  });
}
console.log('Total unique mechanisms:', mechs.size);
const arr = [...mechs].sort();
arr.forEach(m => console.log(m));

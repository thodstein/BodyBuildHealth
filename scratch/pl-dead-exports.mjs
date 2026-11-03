import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
};

const all = walk(path.join(root, 'src'));
const lmsFiles = all.filter(f => f.includes(path.sep + 'lms' + path.sep) && !f.includes('__tests__'));

const contents = new Map(all.map(f => [f, fs.readFileSync(f, 'utf8')]));

const exportRe = /export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/g;
const rows = [];
for (const f of lmsFiles) {
  const src = contents.get(f);
  const names = new Set();
  let m;
  while ((m = exportRe.exec(src))) names.add(m[1]);
  for (const name of names) {
    const re = new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b');
    let users = 0;
    for (const [g, c] of contents) {
      if (g === f) continue;
      if (g.endsWith('.test.ts') || g.endsWith('.test.tsx')) continue;
      if (re.test(c)) users++;
    }
    if (users === 0) rows.push(`${path.relative(root, f)} :: ${name}`);
  }
}
console.log(rows.join('\n'));
console.log(`\nTOTAL ${rows.length}`);

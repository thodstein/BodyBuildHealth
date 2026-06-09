const fs = require('fs');
const path = require('path');

// Check ALL files for remaining ?? patterns that are NOT nullish coalescing
function walk(d) {
  fs.readdirSync(d).forEach(f => {
    const fp = path.join(d, f);
    if (fs.statSync(fp).isDirectory()) { walk(fp); return; }
    if (!f.endsWith('.ts') && !f.endsWith('.tsx')) return;
    const c = fs.readFileSync(fp, 'utf8');
    const lines = c.split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      // Find ?? followed by Russian text in string context (>?? or '?? or "{?? )
      // NOT nullish coalescing (identifier??property or identifier??value)
      if (/>\s*\?\?[А-яёЁ ]/.test(t)) {
        console.log(fp + ':' + (i+1) + ': ' + t.substring(0, 160));
      }
      if (/>\s*\?\?\?[А-яёЁ ]/.test(t)) {
        console.log(fp + ':' + (i+1) + ': ' + t.substring(0, 160));
      }
      // Find '?? Text' patterns in string literals
      if (/'\?\?[А-яёЁ]/.test(t) && !/[\w$]\?\?/.test(t.substring(t.indexOf("'??") - 1, t.indexOf("'??") + 5))) {
        console.log(fp + ':' + (i+1) + ': STR: ' + t.substring(0, 160));
      }
    });
  });
}
walk('src');

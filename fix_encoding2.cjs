const fs = require('fs');
const path = require('path');

// Check for ?? or ??? patterns in strings that should be emojis
function walk(d) {
  fs.readdirSync(d).forEach(f => {
    const fp = path.join(d, f);
    if (fs.statSync(fp).isDirectory()) { walk(fp); return; }
    if (!f.endsWith('.ts') && !f.endsWith('.tsx')) return;
    const c = fs.readFileSync(fp, 'utf8');
    const lines = c.split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      // Find ?? or ??? in JSX text or string literals before Russian text
      // Pattern: >?? Russian or '?? Russian or "? Russian
      const re = />\s*\?{2,3}\s*[А-яёЁ]/g;
      let m;
      while ((m = re.exec(t)) !== null) {
        console.log(fp + ':' + (i+1) + ': JSX: ' + t.substring(0, 160));
      }
      // String literal pattern
      const re2 = /['"]\s*\?{2,3}\s*[А-яёЁ]/g;
      while ((m = re2.exec(t)) !== null) {
        // Check it's not nullish coalescing
        const before = t.substring(Math.max(0, m.index - 5), m.index);
        if (!/[\w$)\]]/.test(before)) {
          console.log(fp + ':' + (i+1) + ': STR: ' + t.substring(0, 160));
        }
      }
    });
  });
}
walk('src');

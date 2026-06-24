const fs = require(" fs\);
const lines = fs.readFileSync(" D:\\\\BodyBuildHealth\\\\src\\\\data\\\\support-catalog-data.ts\, \utf-8\).split(\\\n\);
const results = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(" bestForCourse:\)) {
    let hasTarget = false;
    const end = Math.min(i + 6, lines.length);
    for (let j = i; j < end; j++) {
      if (lines[j].includes(" targetOrgan:\)) { hasTarget = true; break; }
    }
    if (!hasTarget) {
      let entryId = " unknown\;
      for (let k = i - 1; k >= 0; k--) {
        const m = lines[k].match(/id:\\s*\\x27([^\\x27]+)\\x27/);
        if (m) { entryId = m[1]; break; }
        const m2 = lines[k].match(/id:\\s*\\x22([^\\x22]+)\\x22/);
        if (m2) { entryId = m2[1]; break; }
      }
      results.push({ line: i+1, id: entryId, text: lines[i].trim() });
    }
  }
}
console.log(" Found \ + results.length + " entries:\);

const fs = require('fs');
let content = fs.readFileSync('src/engines/support.engine.ts', 'utf8');

// Replace the resolveSupKey function - use regex since exact match failed
const oldFuncRegex = /const resolveSupKey = \(id: string\): string \| undefined => \{[\s\S]*?return undefined;\s*\};/;

const newFunc = `const resolveSupKey = (id: string): string | undefined => {
    // 1. Resolve to canonical ID first (consolidates all 2083+ variants to ~279 canonical IDs)
    const canonicalId = resolveCanonicalId(id);
    if (SUPPORT_BASE_COVERAGE[canonicalId]) return canonicalId;
    // 2. Check alias map
    if (COVERAGE_ID_ALIAS[id] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[id]]) return COVERAGE_ID_ALIAS[id];
    if (COVERAGE_ID_ALIAS[canonicalId] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[canonicalId]]) return COVERAGE_ID_ALIAS[canonicalId];
    // 3. Direct check
    if (SUPPORT_BASE_COVERAGE[id]) return id;
    // 4. Fuzzy matching (case-insensitive)
    const lower = canonicalId.toLowerCase();
    for (const k of Object.keys(SUPPORT_BASE_COVERAGE)) {
      if (lower.includes(k) || k.includes(lower)) return k;
    }
    return undefined;
  };`;

if (oldFuncRegex.test(content)) {
  content = content.replace(oldFuncRegex, newFunc);
  console.log('Updated resolveSupKey function via regex');
} else {
  console.log('ERROR: Could not find resolveSupKey function');
}

fs.writeFileSync('src/engines/support.engine.ts', content);
console.log('Done');

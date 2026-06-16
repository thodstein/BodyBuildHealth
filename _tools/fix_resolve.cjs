const fs = require('fs');
let content = fs.readFileSync('src/engines/support.engine.ts', 'utf8');

// Add import for resolveCanonicalId
if (!content.includes("resolveCanonicalId")) {
  const lastImportIdx = content.lastIndexOf("} from '../data/support-database';");
  const insertPos = content.indexOf('\n', lastImportIdx) + 1;
  content = content.substring(0, insertPos) + "import { resolveCanonicalId } from '../data/canonical-map';\n" + content.substring(insertPos);
}

// Replace the resolveSupKey function
const oldFunc = `  const resolveSupKey = (id: string): string | undefined => {
    if (SUPPORT_BASE_COVERAGE[id]) return id;
    if (COVERAGE_ID_ALIAS[id] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[id]]) return COVERAGE_ID_ALIAS[id];
    for (const k of Object.keys(SUPPORT_BASE_COVERAGE)) {
      if (id.toLowerCase().includes(k) || k.includes(id.toLowerCase())) return k;
    }
    return undefined;
  };`;

const newFunc = `  // Resolve substance ID to SUPPORT_BASE_COVERAGE key
  // Uses canonical ID resolution first, then falls back to alias and fuzzy matching
  const resolveSupKey = (id: string): string | undefined => {
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

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  console.log('Updated resolveSupKey function');
} else {
  console.log('Could not find exact old resolveSupKey function');
}

fs.writeFileSync('src/engines/support.engine.ts', content);
console.log('Done');

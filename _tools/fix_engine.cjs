const fs = require('fs');
let content = fs.readFileSync('src/engines/support.engine.ts', 'utf8');

// 1. Add import for resolveCanonicalId
const importLine = "import { resolveCanonicalId } from '../data/canonical-map';\n";
// Find the last import from support-database line
const lastImportIdx = content.lastIndexOf("} from '../data/support-database';");
const insertPos = content.indexOf('\n', lastImportIdx) + 1;
content = content.substring(0, insertPos) + importLine + content.substring(insertPos);

// 2. Fix calculateSupportCoverage - update the resolveSupKey to use canonical IDs
const oldResolve = `  // Build a lookup map: substance id -> SUPPORT_BASE_COVERAGE key
  const resolveSupKey = (id: string): string | undefined => {
    if (SUPPORT_BASE_COVERAGE[id]) return id;
    if (COVERAGE_ID_ALIAS[id] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[id]]) return COVERAGE_ID_ALIAS[id];
    for (const k of Object.keys(SUPPORT_BASE_COVERAGE)) {
      if (id.toLowerCase().includes(k) || k.includes(id.toLowerCase())) return k;
    }
    return undefined;
  };`;

const newResolve = `  // Build a lookup map: substance id -> SUPPORT_BASE_COVERAGE key
  // Uses canonical ID resolution first, then falls back to alias and fuzzy matching
  const resolveSupKey = (id: string): string | undefined => {
    // 1. Resolve to canonical ID first (consolidates all 2083+ variants)
    const canonicalId = resolveCanonicalId(id);
    if (SUPPORT_BASE_COVERAGE[canonicalId]) return canonicalId;
    // 2. Check alias map
    if (COVERAGE_ID_ALIAS[id] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[id]]) return COVERAGE_ID_ALIAS[id];
    if (COVERAGE_ID_ALIAS[canonicalId] && SUPPORT_BASE_COVERAGE[COVERAGE_ID_ALIAS[canonicalId]]) return COVERAGE_ID_ALIAS[canonicalId];
    // 3. Fuzzy matching (case-insensitive)
    const lower = canonicalId.toLowerCase();
    for (const k of Object.keys(SUPPORT_BASE_COVERAGE)) {
      if (lower.includes(k) || k.includes(lower)) return k;
    }
    return undefined;
  };`;

if (content.includes(oldResolve)) {
  content = content.replace(oldResolve, newResolve);
  console.log('Updated resolveSupKey in calculateSupportCoverage');
} else {
  console.log('Could not find old resolveSupKey, searching...');
  const idx = content.indexOf('resolveSupKey');
  console.log('Found resolveSupKey at index:', idx);
}

fs.writeFileSync('src/engines/support.engine.ts', content);
console.log('Done updating support.engine.ts');

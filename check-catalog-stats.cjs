const f = require("fs").readFileSync("src/data/support-catalog.ts", "utf-8");

const emptyEffect = (f.match(/effect: ""/g) || []).length;
const emptyMech = (f.match(/mechanism: ""/g) || []).length;
const withEntries = (f.match(/with: "/g) || []).length;

console.log("Synergies/conflicts with empty effect:", emptyEffect);
console.log("Synergies/conflicts with empty mechanism:", emptyMech);
console.log("Total synergy/conflict entries:", withEntries);

// Count cards with populated vs empty synergies
const re = /^\s+(\w+):\s*\{/gm;
let m;
const cards = [];
while ((m = re.exec(f)) !== null) {
  const key = m[1];
  if (["dosage","core","standard","advanced","specialty"].includes(key)) continue;
  
  let braceCount = 0;
  let foundFirst = false;
  let endIdx = m.index;
  for (let i = m.index; i < f.length; i++) {
    if (f[i] === "{") { braceCount++; foundFirst = true; }
    if (f[i] === "}") { braceCount--; }
    if (foundFirst && braceCount === 0) { endIdx = i + 1; break; }
  }
  
  const block = f.substring(m.index, endIdx);
  const synCount = (block.match(/with: "/g) || []).length;
  const hasEmptyEffect = (block.match(/effect: ""/g) || []).length;
  cards.push({ key, synCount, hasEmptyEffect, blockLen: block.length });
}

const withSyn = cards.filter(c => c.synCount > 0);
const emptySyn = cards.filter(c => c.synCount === 0);
const partialSyn = cards.filter(c => c.hasEmptyEffect > 0);

console.log("\nCards WITH synergies/conflicts:", withSyn.length);
console.log("Cards WITHOUT any synergies/conflicts:", emptySyn.length);
console.log("Cards with partially filled (empty effect/mechanism):", partialSyn.length);
console.log("\n=== Cards without ANY synergies (first 20) ===");
emptySyn.slice(0, 20).forEach(c => console.log("  " + c.key));
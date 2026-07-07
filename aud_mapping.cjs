const fs = require('fs');

// 1. UCUM_MAP markers
const consts = fs.readFileSync('D:/BodyBuildHealth/src/core/constants.ts','utf8');
const mapBlock = consts.match(/UCUM_MAP[\s\S]*?as const/)[0];
const ucumKeys = [...mapBlock.matchAll(/'([A-Z_0-9]+)'\s*:\s*\{/g)].map(x=>x[1]);
console.log('UCUM_MAP keys: '+ucumKeys.length);

// 2. lab-marker-map markers + correctionIds
const lmm = fs.readFileSync('D:/BodyBuildHealth/src/data/lab-marker-map.ts','utf8');
const lmmEntries = [...lmm.matchAll(/\{\s*marker:\s*'([^']+)'[^}]*correctionIds:\s*\[([^\]]*)\]/g)];
const lmmMap = {};
for (const e of lmmEntries) {
  const marker = e[1];
  const idsRaw = e[2];
  const ids = [...idsRaw.matchAll(/'([^']+)'/g)].map(x=>x[1]);
  lmmMap[marker] = ids;
}
console.log('lab-marker-map entries: '+Object.keys(lmmMap).length);

// 3. lab-priority-map markers
const lpm = fs.readFileSync('D:/BodyBuildHealth/src/data/lab-priority-map.ts','utf8');
const lpmMarkers = [...lpm.matchAll(/marker:\s*'([^']+)'/g)].map(x=>x[1]);
const lpmSet = new Set(lpmMarkers);
console.log('lab-priority-map markers: '+lpmMarkers.length+' (unique: '+lpmSet.size+')');

// 4. pharma-lab-marker-map (reverse: drug → markers)
const plmm = fs.readFileSync('D:/BodyBuildHealth/src/data/pharma-lab-marker-map.ts','utf8');
const plmmEntries = [...plmm.matchAll(/(\w+):\s*\[([^\]]+)\]/g)];
const markerToDrugs = {};
for (const e of plmmEntries) {
  const drug = e[1];
  const markers = [...e[2].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  for (const m of markers) {
    if (!markerToDrugs[m]) markerToDrugs[m] = [];
    markerToDrugs[m].push(drug);
  }
}
console.log('pharma-lab-marker-map: '+Object.keys(markerToDrugs).length+' unique markers affected by drugs');

// 5. Section 1: markers in lab-marker-map WITHOUT priority mapping
console.log('\n=== SECTION 1: markers in lab-marker-map WITHOUT priority ===');
const inLmmNotLpm = Object.keys(lmmMap).filter(m => !lpmSet.has(m));
for (const m of inLmmNotLpm) console.log('  '+m);

// 6. Section 2: markers in UCUM_MAP without BOTH lmm and lpm
console.log('\n=== SECTION 2: UCUM markers without lab-marker-map AND without priority ===');
const orphanUcum = ucumKeys.filter(k => !lmmMap[k] && !lpmSet.has(k));
for (const m of orphanUcum) console.log('  '+m);

// 7. Section 3: count of correction substances per marker (top 30 by potential)
console.log('\n=== SECTION 3: substance count per marker in lab-marker-map ===');
const sorted = Object.entries(lmmMap).sort((a,b)=>b[1].length-a[1].length);
for (const [m, ids] of sorted) console.log('  '+m+': '+ids.length+' subs');

console.log('\n=== SUMMARY ===');
console.log('Markers in lab-marker-map: '+Object.keys(lmmMap).length);
console.log('Markers in lab-priority: '+lpmSet.size);
console.log('Markers in pharma-lab-marker (reverse): '+Object.keys(markerToDrugs).length);
console.log('Markers in UCUM_MAP: '+ucumKeys.length);
console.log('Markers in lab-marker-map WITHOUT priority: '+inLmmNotLpm.length);
console.log('UCUM orphans (no lmm, no lpm): '+orphanUcum.length);
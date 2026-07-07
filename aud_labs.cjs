const fs = require('fs');

// 1. UCUM_MAP keys
const constants = fs.readFileSync('D:/BodyBuildHealth/src/core/constants.ts', 'utf8');
const m = constants.match(/UCUM_MAP[\s\S]*?as const/);
const mapBlock = m[0];
const markerKeys = [...mapBlock.matchAll(/'([A-Z_0-9]+)'\s*:\s*\{/g)].map(x => x[1]);
console.log('UCUM_MAP markers: ' + markerKeys.length);

// 2. problem-panels markers
const panels = fs.readFileSync('D:/BodyBuildHealth/src/data/labs-problem-panels.ts', 'utf8');
const markerCodes = [...panels.matchAll(/code:\s*'([A-Za-z_0-9]+)'/g)].map(x => x[1]);
const uniqueCodes = [...new Set(markerCodes)];
console.log('Unique problem-panel markers: ' + uniqueCodes.length);
const missing = uniqueCodes.filter(c => !markerKeys.includes(c));
console.log('Missing in UCUM_MAP: ' + (missing.length ? missing.join(', ') : 'NONE'));

// 3. Duplicate panel ids
const panelIds = [...panels.matchAll(/id:\s*'([a-z_]+)'/g)].map(x => x[1]);
const counts = {};
for (const id of panelIds) counts[id] = (counts[id] || 0) + 1;
const dups = Object.entries(counts).filter(([k, v]) => v > 1);
console.log('Duplicate panel ids: ' + (dups.length ? dups.map(x => x[0]).join(', ') : 'NONE'));

// 4. Orphan linked panel refs
const symLink = fs.readFileSync('D:/BodyBuildHealth/src/engines/symptom-lab-link.ts', 'utf8');
const symBlock = symLink.match(/SYMPTOM_PANEL_MAP[\s\S]*?\};/);
if (!symBlock) {
  console.log('SYMPTOM_PANEL_MAP NOT FOUND');
} else {
  const linkedIds = [...symBlock[0].matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
  const panelIdsClean = Object.keys(counts);
  const orphanLinked = [...new Set(linkedIds)].filter(id => !panelIdsClean.includes(id));
  console.log('Orphan panel refs in symptom-lab-link: ' + (orphanLinked.length ? orphanLinked.join(', ') : 'NONE'));
}

// 5. Encoding check all my files
const mine = [
  'src/data/labs-problem-panels.ts',
  'src/core/constants.ts',
  'src/data/labs-phase-panels.ts',
  'src/data/lab-marker-map.ts',
  'src/data/lab-priority-map.ts',
  'src/engines/symptom-lab-link.ts',
  'src/data/pharma-lab-marker-map.ts',
  'src/ui/screens/LabsScreen_parts/LabsProblemPanelsTab.tsx',
  'src/ui/screens/LabsScreen.tsx'
];
let garbledFiles = 0;
for (const f of mine) {
  const c = fs.readFileSync('D:/BodyBuildHealth/' + f, 'utf8');
  if (c.includes('Рџ') || c.includes('РЎРµ') || c.includes('Рѕ')) {
    console.log('GARBLED: ' + f);
    garbledFiles++;
  }
}
console.log('Garbled files: ' + garbledFiles);

console.log('--- AUDIT DONE ---');
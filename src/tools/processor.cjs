const { readFileSync, writeFileSync } = require('fs');
const f = 'D:\\BodyBuildHealth\\src\\data\\support-catalog-data.ts';
const analogMap = JSON.parse(readFileSync('D:\\BodyBuildHealth\\src\\tools\\analog_map.json','utf8'));
const siMap = JSON.parse(readFileSync('D:\\BodyBuildHealth\\src\\tools\\si_map.json','utf8'));
let lines = readFileSync(f, 'utf8').split('\n');
const insertions = [];

for (let i = 0; i < lines.length; i++) {
  const tl = lines[i].trim();
  if (!tl.startsWith('bestForCourse:')) continue;
  
  let entryName = null;
  for (let k = i - 1; k >= 0; k--) {
    const m = lines[k].match(/^\s*(\w[\w\d_]*):\s*\{$/);
    if (m && !['SupportCatalogEntry','CatalogSubstanceForm','SynergyInfo','ConflictInfo','MonitoringItem'].includes(m[1])) {
      entryName = m[1];
      break;
    }
  }
  if (!entryName) continue;
  
  let targetIdx = -1;
  let hasSI = false, hasAnalog = false;
  let bc = 0;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    const t = l.trim();
    for (const ch of l) { if (ch === '{') bc++; if (ch === '}') bc--; }
    if (t.startsWith('targetOrgan:')) { targetIdx = j; break; }
    if (t.startsWith('specialInstructions:')) hasSI = true;
    if (t.startsWith('analog:')) hasAnalog = true;
    if (bc < 0) break;
    if (j > i + 1 && lines[j].match(/^\s*\w[\w\d_]*:\s*\{$/)) break;
  }
  
  if (targetIdx > 0 && !hasSI) {
    const analog = analogMap[entryName];
    const si = siMap[entryName];
    const toAdd = [];
    if (analog && analog.length > 0 && !hasAnalog) {
      toAdd.push("    analog: ['" + analog.join("', '") + "'],");
    }
    if (si && si.length > 0) {
      toAdd.push("    specialInstructions: ['" + si.join("', '") + "'],");
    }
    if (toAdd.length > 0) insertions.push({ idx: targetIdx, lines: toAdd });
  }
}

insertions.sort((a,b) => b.idx - a.idx);
for (const ins of insertions) lines.splice(ins.idx, 0, ...ins.lines);

writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Enriched:', insertions.length, 'entries');
console.log('Total lines added:', insertions.reduce((s,i) => s + i.lines.length, 0));

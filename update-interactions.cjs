const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/ui/screens/SupportScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace allSupport in the interactions tab dropdown to use SUPPORT_CATALOG_DATA
// Find: const allSupport = useMemo(() => supplementList, [supplementList]);
// This is used globally, so we can't change it. Instead, create a catalog-specific list.
// Add: const catalogSupportList for interaction dropdowns

const allSupportLine = "const allSupport = useMemo(() => supplementList, [supplementList]);";
const newAllSupport = `const allSupport = useMemo(() => supplementList, [supplementList]);

  // Catalog-based substance list for interactions/stacks (284 items, no duplicates)
  const catalogSupportList = useMemo(() => {
    return Object.values(SUPPORT_CATALOG_DATA).map(e => ({
      id: e.id,
      name: e.nameRu || e.name,
      type: e.tier,
      categories: e.category,
      mechanisms: e.mechanisms,
      organs: e.organs,
    }));
  }, []);`;

content = content.replace(allSupportLine, newAllSupport);

// 2. Replace interaction dropdown search from allSupport to catalogSupportList
// In the interactions tab (tab === 'interactions')
content = content.replace(
  /allSupport\.filter\(s => \(s\.name\|\|''\)\.toLowerCase\(\)\.includes\(interactionSearch\.toLowerCase\(\)\)\)\.slice\(0,10\)\.map\(s =>/g,
  'catalogSupportList.filter(s => (s.name||\'\').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0,10).map(s =>'
);

// Also in the info-view interactions section
content = content.replace(
  /allSupport\.find\(s => s\.id === id\)\?\.name \|\| id/g,
  'catalogSupportList.find(s => s.id === id)?.name || allSupport.find(s => s.id === id)?.name || id'
);

// 3. Update the synergy/conflict calculation to include catalog entry synergies/conflicts
// Find: const supportSynergiesList and update it
const synergyListStart = content.indexOf('const supportSynergiesList = useMemo');
if (synergyListStart === -1) {
  console.error('Cannot find supportSynergiesList');
  process.exit(1);
}
console.log('supportSynergiesList at char:', synergyListStart);

// Find the end of the useMemo
const synergyListEnd = content.indexOf('}, [interactionIds, allSupport]);', synergyListStart);
if (synergyListEnd === -1) {
  console.error('Cannot find end of supportSynergiesList');
  process.exit(1);
}
const synergyListEndFull = synergyListEnd + '}, [interactionIds, allSupport]);'.length;
console.log('synergiesList ends at char:', synergyListEndFull);

// Read the existing synergy calculation
const existingCalc = content.slice(synergyListStart, synergyListEndFull);
console.log('Existing calc length:', existingCalc.length);

// Replace with enhanced version that also uses SUPPORT_CATALOG_DATA synergies/conflicts
const newCalc = `const supportSynergiesList = useMemo(() => {
    const ids = validInteractionIds;
    if (ids.length < 2) return [];
    const results: any[] = [];
    // From ALL_INTERACTIONS
    const checked = new Set<string>();
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const pairKey = [ids[a], ids[b]].sort().join('||');
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);
        // Check ALL_INTERACTIONS
        for (const inter of ALL_INTERACTIONS) {
          if (!inter || !inter.substanceA || !inter.substanceB) continue;
          const iKey = [inter.substanceA, inter.substanceB].sort().join('||');
          if (iKey === pairKey) {
            results.push({ ...inter, id: inter.interactionId });
          }
        }
        // Check SUPPORT_CATALOG_DATA synergies
        const entryA = SUPPORT_CATALOG_DATA[CANONICAL_ID_MAP[ids[a]] || ids[a]];
        const entryB = SUPPORT_CATALOG_DATA[CANONICAL_ID_MAP[ids[b]] || ids[b]];
        if (entryA?.synergies) {
          for (const syn of entryA.synergies) {
            if (syn.with === ids[b] || syn.with === (CANONICAL_ID_MAP[ids[b]] || ids[b])) {
              const key = \`cat_syn_\${ids[a]}_\${ids[b]}\`;
              if (!results.some(r => r.id === key)) {
                results.push({ id: key, substanceA: ids[a], substanceB: ids[b], type: 'synergy', effect: syn.effect, mechanism: syn.mechanism, severity: syn.severity || 'MEDIUM', notes: '' });
              }
            }
          }
        }
        if (entryA?.conflicts) {
          for (const conf of entryA.conflicts) {
            if (conf.with === ids[b] || conf.with === (CANONICAL_ID_MAP[ids[b]] || ids[b])) {
              const key = \`cat_conf_\${ids[a]}_\${ids[b]}\`;
              if (!results.some(r => r.id === key)) {
                results.push({ id: key, substanceA: ids[a], substanceB: ids[b], type: 'conflict', effect: conf.effect, mechanism: conf.mechanism, severity: conf.severity || 'MEDIUM', notes: '' });
              }
            }
          }
        }
        if (entryB?.synergies) {
          for (const syn of entryB.synergies) {
            if (syn.with === ids[a] || syn.with === (CANONICAL_ID_MAP[ids[a]] || ids[a])) {
              const key = \`cat_syn_\${ids[b]}_\${ids[a]}\`;
              if (!results.some(r => r.id === key)) {
                results.push({ id: key, substanceA: ids[b], substanceA: ids[a], substanceB: ids[a], type: 'synergy', effect: syn.effect, mechanism: syn.mechanism, severity: syn.severity || 'MEDIUM', notes: '' });
              }
            }
          }
        }
      }
    }
    return results;
  }, [validInteractionIds, allSupport]);`;

content = content.slice(0, synergyListStart) + newCalc + content.slice(synergyListEndFull);

console.log('Updated interactions calculator');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Saved!');

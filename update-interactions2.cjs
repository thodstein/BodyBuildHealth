const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/ui/screens/SupportScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add catalogSupportList after allSupport
const allSupportLine = "const allSupport = useMemo(() => supplementList, [supplementList]);";
if (!content.includes(allSupportLine)) {
  console.error('Cannot find allSupport line');
  process.exit(1);
}

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

// 2. Replace the supportInteractions useMemo to include catalog synergies/conflicts
const oldSupportInteractions = `const supportInteractions = useMemo(() => {
    if (validInteractionIds.length < 2) return null;
    const subs: Record<string, string> = {};
    validInteractionIds.forEach(id => {
      const s = allSupport.find(x => x.id === id);
      if (s) subs[id] = s.name;
    });
    try {
      const norm = (s: string) => s.replace(/_/g,'').toLowerCase();
      return INTERACTIONS_DB.filter(i => {
        if (!i || !i.substanceA || !i.substanceB) return false;
        const a = norm(i.substanceA);
        const b = norm(i.substanceB);
        return validInteractionIds.some(id => {
          const up = norm(id);
          return a === up || a.includes(up) || up.includes(a);
        }) && validInteractionIds.some(id => {
          const up = norm(id);
          return b === up || b.includes(up) || up.includes(b);
        });
      });
    } catch { return []; }
  }, [interactionIds, allSupport]);`;

const newSupportInteractions = `const supportInteractions = useMemo(() => {
    if (validInteractionIds.length < 2) return null;
    const subs: Record<string, string> = {};
    validInteractionIds.forEach(id => {
      const s = catalogSupportList.find(x => x.id === id) || allSupport.find(x => x.id === id);
      if (s) subs[id] = s.name;
    });
    const results: any[] = [];
    try {
      const norm = (s: string) => s.replace(/_/g,'').toLowerCase();
      // From INTERACTIONS_DB
      for (const i of INTERACTIONS_DB) {
        if (!i || !i.substanceA || !i.substanceB) continue;
        const a = norm(i.substanceA);
        const b = norm(i.substanceB);
        const matchA = validInteractionIds.some(id => { const up = norm(id); return a === up || a.includes(up) || up.includes(a); });
        const matchB = validInteractionIds.some(id => { const up = norm(id); return b === up || b.includes(up) || up.includes(b); });
        if (matchA && matchB) results.push(i);
      }
      // From SUPPORT_CATALOG_DATA synergies/conflicts
      for (let ai = 0; ai < validInteractionIds.length; ai++) {
        for (let bi = ai + 1; bi < validInteractionIds.length; bi++) {
          const idA = validInteractionIds[ai];
          const idB = validInteractionIds[bi];
          const canA = CANONICAL_ID_MAP[idA] || CANONICAL_ID_MAP[idA.toLowerCase()] || idA;
          const canB = CANONICAL_ID_MAP[idB] || CANONICAL_ID_MAP[idB.toLowerCase()] || idB;
          const entryA = SUPPORT_CATALOG_DATA[canA] || SUPPORT_CATALOG_DATA[idA];
          const entryB = SUPPORT_CATALOG_DATA[canB] || SUPPORT_CATALOG_DATA[idB];
          if (entryA?.synergies) {
            for (const syn of entryA.synergies) {
              if (syn.with === idB || syn.with === canB) {
                const dupKey = \`cat_syn_\${canA}_\${canB}\`;
                if (!results.some(r => r.interactionId === dupKey || r.id === dupKey)) {
                  results.push({ interactionId: dupKey, substanceA: idA, substanceB: idB, type: 'synergy', effect: syn.effect, mechanisms: [syn.mechanism], severity: syn.severity || 'MEDIUM', notes: '' });
                }
              }
            }
          }
          if (entryA?.conflicts) {
            for (const conf of entryA.conflicts) {
              if (conf.with === idB || conf.with === canB) {
                const dupKey = \`cat_conf_\${canA}_\${canB}\`;
                if (!results.some(r => r.interactionId === dupKey || r.id === dupKey)) {
                  results.push({ interactionId: dupKey, substanceA: idA, substanceB: idB, type: 'conflict', effect: conf.effect, mechanisms: [conf.mechanism], severity: conf.severity || 'MEDIUM', notes: '' });
                }
              }
            }
          }
          if (entryB?.synergies) {
            for (const syn of entryB.synergies) {
              if (syn.with === idA || syn.with === canA) {
                const dupKey = \`cat_syn_\${canB}_\${canA}\`;
                if (!results.some(r => r.interactionId === dupKey || r.id === dupKey)) {
                  results.push({ interactionId: dupKey, substanceA: idB, substanceB: idA, type: 'synergy', effect: syn.effect, mechanisms: [syn.mechanism], severity: syn.severity || 'MEDIUM', notes: '' });
                }
              }
            }
          }
          if (entryB?.conflicts) {
            for (const conf of entryB.conflicts) {
              if (conf.with === idA || conf.with === canA) {
                const dupKey = \`cat_conf_\${canB}_\${canA}\`;
                if (!results.some(r => r.interactionId === dupKey || r.id === dupKey)) {
                  results.push({ interactionId: dupKey, substanceA: idB, substanceB: idA, type: 'conflict', effect: conf.effect, mechanisms: [conf.mechanism], severity: conf.severity || 'MEDIUM', notes: '' });
                }
              }
            }
          }
        }
      }
    } catch { return []; }
    return results;
  }, [interactionIds, allSupport, catalogSupportList]);`;

content = content.replace(oldSupportInteractions, newSupportInteractions);

// 3. Replace the interaction dropdown search to use catalogSupportList
content = content.replace(
  /allSupport\.filter\(s => \(s\.name\|\|''\)\.toLowerCase\(\)\.includes\(interactionSearch\.toLowerCase\(\)\)\)\.slice\(0,10\)\.map\(s =>/g,
  "catalogSupportList.filter(s => (s.name||'').toLowerCase().includes(interactionSearch.toLowerCase())).slice(0,10).map(s =>"
);

// 4. Replace selectedName lookups to prefer catalogSupportList
content = content.replace(
  /const selectedName = id \? \(allSupport\.find\(s => s\.id === id\)\?\.name \|\| id\) : '';/g,
  "const selectedName = id ? (catalogSupportList.find(s => s.id === id)?.name || allSupport.find(s => s.id === id)?.name || id) : '';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated interactions calculator with catalog data!');

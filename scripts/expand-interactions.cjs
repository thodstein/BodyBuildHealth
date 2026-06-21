const fs = require('fs');
const path = require('path');

// Read support-database.ts for ALL_INTERACTIONS
const dbPath = path.join(__dirname, '..', 'src', 'data', 'support-database.ts');
const dbContent = fs.readFileSync(dbPath, 'utf8');

// Extract all interactions
const interactions = [];
const intRegex = /interactionId:'([^']+)',substanceA:'([^']+)',substanceB:'([^']+)',type:'([^']+)',effect:'([^']+)',mechanisms:\[([^\]]*)\],severity:'([^']+)',notes:'([^']+)'/g;
let match;
while ((match = intRegex.exec(dbContent)) !== null) {
  interactions.push({
    id: match[1], a: match[2], b: match[3],
    type: match[4], effect: match[5],
    mechanisms: match[6].split(',').map(s => s.trim().replace(/'/g, '')),
    severity: match[7], notes: match[8]
  });
}
console.log(`Found ${interactions.length} interactions in support-database`);

// Build maps: catalog entry id -> known interactions
const synergyMap = {};
const conflictMap = {};

for (const int of interactions) {
  const a = int.a.toLowerCase();
  const b = int.b.toLowerCase();
  const type = int.type; // 'synergy' | 'conflict' | 'caution'
  
  if (type === 'synergy') {
    if (!synergyMap[a]) synergyMap[a] = [];
    synergyMap[a].push({ with: b, effect: int.effect, mechanism: int.notes, severity: int.severity });
    if (!synergyMap[b]) synergyMap[b] = [];
    synergyMap[b].push({ with: a, effect: int.effect, mechanism: int.notes, severity: int.severity });
  } else {
    if (!conflictMap[a]) conflictMap[a] = [];
    conflictMap[a].push({ with: b, effect: int.effect, mechanism: int.notes, severity: int.severity });
    if (!conflictMap[b]) conflictMap[b] = [];
    conflictMap[b].push({ with: a, effect: int.effect, mechanism: int.notes, severity: int.severity });
  }
}

// Read catalog
const catPath = path.join(__dirname, '..', 'src', 'data', 'support-catalog.ts');
let catContent = fs.readFileSync(catPath, 'utf8');

let updatedCount = 0;

// For each catalog entry, check if it needs expanded synergies/conflicts
for (const [entryId, synergies] of Object.entries(synergyMap)) {
  if (synergies.length === 0) continue;
  
  // Find this entry in catalog
  const entryRegex = new RegExp(`\\b${entryId}:\\{id:'${entryId}'`);
  if (!entryRegex.test(catContent)) continue;
  
  // Extract current synergies/conflicts arrays
  const synMatch = catContent.match(new RegExp(entryId + `:\\{[^}]+(?:\\{[^}]+\\}[^}]*)*synergies:\\[([^\\]]*)\\]`));
  const confMatch = catContent.match(new RegExp(entryId + `:\\{[^}]+(?:\\{[^}]+\\}[^}]*)*conflicts:\\[([^\\]]*)\\]`));
  
  if (!synMatch || !confMatch) continue;
  
  const existingSyn = synMatch[1];
  const existingConf = confMatch[1];
  
  // Add missing synergies
  let newSyn = existingSyn;
  for (const s of synergies) {
    if (!existingSyn.includes(`with:'${s.with}'`)) {
      if (newSyn.length > 0 && !newSyn.endsWith('[')) newSyn += ',';
      newSyn += `{with:'${s.with}',effect:'${s.effect.replace(/'/g, "\\'")}',mechanism:'${s.mechanism.replace(/'/g, "\\'")}',severity:'${s.severity}'}`;
      updatedCount++;
    }
  }
  
  // Add missing conflicts
  let newConf = existingConf;
  const conflicts = conflictMap[entryId] || [];
  for (const c of conflicts) {
    if (!existingConf.includes(`with:'${c.with}'`)) {
      if (newConf.length > 0 && !newConf.endsWith('[')) newConf += ',';
      newConf += `{with:'${c.with}',effect:'${c.effect.replace(/'/g, "\\'")}',mechanism:'${c.mechanism.replace(/'/g, "\\'")}',severity:'${c.severity}'}`;
      updatedCount++;
    }
  }
  
  if (newSyn !== existingSyn || newConf !== existingConf) {
    const oldEntry = new RegExp(`(${entryId}:\\{[^}]+(?:\\{[^}]+\\}[^}]*)*synergies:\\[)[^\\]]*(\\])(?:[^}]*conflicts:\\[)[^\\]]*(\\])`);
    // Simple string replacement
    const searchStr = `synergies:[${existingSyn}]`;
    const replaceStr = `synergies:[${newSyn}]`;
    catContent = catContent.replace(searchStr, replaceStr);
    
    const searchStr2 = `conflicts:[${existingConf}]`;
    const replaceStr2 = `conflicts:[${newConf}]`;
    catContent = catContent.replace(searchStr2, replaceStr2);
  }
}

fs.writeFileSync(catPath, catContent, 'utf8');
console.log(`Done. Added/updated ${updatedCount} interaction entries.`);

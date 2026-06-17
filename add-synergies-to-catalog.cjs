const fs = require("fs");
let catalogSrc = fs.readFileSync("src/data/support-catalog.ts", "utf-8");

// Load the generated synergy map
const synMapSrc = fs.readFileSync("src/data/synergy-map-generated.ts", "utf-8");

// Parse the synergy map
const synMap = {};
const entryRe = /"(\w+)": \{ synergies: \[([\s\S]*?)\], conflicts: \[([\s\S]*?)\] \}/g;
let m;
while ((m = entryRe.exec(synMapSrc)) !== null) {
  const key = m[1];
  const synStr = m[2];
  const confStr = m[3];
  
  const synRe = /\{ with: "([^"]+)", effect: "([^"]*)", mechanism: "([^"]*)", severity: "([^"]+)" \}/g;
  const synergies = [];
  let sm;
  while ((sm = synRe.exec(synStr)) !== null) {
    synergies.push({ with: sm[1], effect: sm[2], mechanism: sm[3], severity: sm[4] });
  }
  
  const confRe = /\{ with: "([^"]+)", effect: "([^"]*)", mechanism: "([^"]*)", severity: "([^"]+)" \}/g;
  const conflicts = [];
  while ((sm = confRe.exec(confStr)) !== null) {
    conflicts.push({ with: sm[1], effect: sm[2], mechanism: sm[3], severity: sm[4] });
  }
  
  synMap[key] = { synergies, conflicts };
}

console.log("Loaded synergy map for", Object.keys(synMap).length, "substances");

// Now replace empty synergies: [] and conflicts: [] in the catalog
let replaced = 0;
for (const [key, data] of Object.entries(synMap)) {
  if (data.synergies.length === 0 && data.conflicts.length === 0) continue;
  
  // Find the substance block in the catalog
  const blockStart = catalogSrc.indexOf("  " + key + ": {");
  if (blockStart === -1) {
    // Try quoted key
    const quotedStart = catalogSrc.indexOf('"' + key + '": {');
    if (quotedStart === -1) continue;
  }
  
  // Find the empty synergies: [] and replace with actual data
  const searchStr = "synergies: [],\n    conflicts: [],";
  const blockIdx = catalogSrc.indexOf("  " + key + ": {");
  if (blockIdx === -1) continue;
  
  // Find synergies: [] within this block (next ~5000 chars)
  const blockText = catalogSrc.substring(blockIdx, blockIdx + 8000);
  const synIdx = blockText.indexOf("synergies: [],");
  if (synIdx === -1) {
    // Check if synergies already has data
    const synIdx2 = blockText.indexOf("synergies: [");
    if (synIdx2 === -1) continue;
    const afterSyn = blockText.substring(synIdx2, synIdx2 + 100);
    if (!afterSyn.includes("[]")) continue; // Already has data, skip
  }
  
  const confIdx = blockText.indexOf("conflicts: [],");
  if (confIdx === -1) continue;
  
  // Build replacement strings
  const synLines = data.synergies.map(s => 
    `      { with: "${s.with}", effect: "", mechanism: "", severity: "${s.severity}" }`
  ).join(",\n");
  
  const confLines = data.conflicts.map(c => 
    `      { with: "${c.with}", effect: "", mechanism: "", severity: "${c.severity}" }`
  ).join(",\n");
  
  const synReplacement = data.synergies.length > 0 
    ? `synergies: [\n${synLines}\n    ],`
    : "synergies: [],";
  
  const confReplacement = data.conflicts.length > 0
    ? `conflicts: [\n${confLines}\n    ],`
    : "conflicts: [],";
  
  // Replace in the full file - need to be careful to replace only the right occurrence
  const fullBlockStart = blockIdx;
  const fullBlockEnd = catalogSrc.indexOf("  },\n", fullBlockStart + 100);
  if (fullBlockEnd === -1) continue;
  
  const fullBlock = catalogSrc.substring(fullBlockStart, fullBlockEnd);
  const newBlock = fullBlock
    .replace("synergies: [],", synReplacement)
    .replace("conflicts: [],", confReplacement);
  
  if (newBlock !== fullBlock) {
    catalogSrc = catalogSrc.substring(0, fullBlockStart) + newBlock + catalogSrc.substring(fullBlockEnd);
    replaced++;
  }
}

console.log("Replaced synergies/conflicts for", replaced, "substances");
fs.writeFileSync("src/data/support-catalog.ts", catalogSrc, "utf-8");
console.log("Done!");
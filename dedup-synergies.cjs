const fs = require("fs");
let f = fs.readFileSync("src/data/synergy-map-generated.ts", "utf-8");

// Deduplicate synergies and conflicts for each substance
const re = /"(\w+)": \{ synergies: \[([\s\S]*?)\], conflicts: \[([\s\S]*?)\] \}/g;
let m;
let output = "// AUTO-GENERATED: synergy/conflict mapping for catalog substances\nexport const SYNERGY_MAP: Record<string, { synergies: { with: string; effect: string; mechanism: string; severity: string }[]; conflicts: { with: string; effect: string; mechanism: string; severity: string }[] }> = {\n";
let totalSyn = 0, totalConf = 0, substanceCount = 0;

while ((m = re.exec(f)) !== null) {
  const key = m[1];
  const synStr = m[2];
  const confStr = m[3];
  
  // Parse synergies
  const synRe = /\{ with: "([^"]+)", effect: "([^"]*)", mechanism: "([^"]*)", severity: "([^"]+)" \}/g;
  const synergies = [];
  const synSeen = new Set();
  let sm;
  while ((sm = synRe.exec(synStr)) !== null) {
    const entry = { with: sm[1], effect: sm[2], mechanism: sm[3], severity: sm[4] };
    const dedupeKey = entry.with + "|" + entry.severity;
    if (!synSeen.has(dedupeKey)) {
      synergies.push(entry);
      synSeen.add(dedupeKey);
    }
  }
  
  // Parse conflicts
  const confRe = /\{ with: "([^"]+)", effect: "([^"]*)", mechanism: "([^"]*)", severity: "([^"]+)" \}/g;
  const conflicts = [];
  const confSeen = new Set();
  while ((sm = confRe.exec(confStr)) !== null) {
    const entry = { with: sm[1], effect: sm[2], mechanism: sm[3], severity: sm[4] };
    const dedupeKey = entry.with + "|" + entry.severity;
    if (!confSeen.has(dedupeKey)) {
      conflicts.push(entry);
      confSeen.add(dedupeKey);
    }
  }
  
  if (synergies.length === 0 && conflicts.length === 0) continue;
  
  substanceCount++;
  totalSyn += synergies.length;
  totalConf += conflicts.length;
  
  output += `    // ${key}: ${synergies.length} synergies, ${conflicts.length} conflicts\n`;
  output += `    "${key}": { synergies: [\n`;
  output += synergies.map(s => `        { with: "${s.with}", effect: "", mechanism: "", severity: "${s.severity}" }`).join(",\n");
  output += `\n    ], conflicts: [\n`;
  output += conflicts.map(c => `        { with: "${c.with}", effect: "", mechanism: "", severity: "${c.severity}" }`).join(",\n");
  output += `\n    ] },\n`;
}

output += `};\n`;

fs.writeFileSync("src/data/synergy-map-generated.ts", output, "utf-8");
console.log("Deduplicated! Substances:", substanceCount, "Synergies:", totalSyn, "Conflicts:", totalConf);
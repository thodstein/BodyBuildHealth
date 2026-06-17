const f = require("fs").readFileSync("src/data/support-catalog.ts", "utf8");
const lines = f.split("\n");
let found = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("omega3:") && lines[i].trim().startsWith("omega3:") || lines[i].includes('"omega3":') || lines[i].includes("'omega3':")) {
    found.push({ line: i+1, text: lines[i].trim().substring(0, 80) });
  }
}
console.log("All omega3 occurrences:", JSON.stringify(found, null, 2));
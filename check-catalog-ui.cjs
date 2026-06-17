const f = require("fs").readFileSync("src/ui/screens/SupportScreen.tsx", "utf-8");
const lines = f.split("\n");

// Find groupedSubstances
const groupLine = lines.findIndex(l => l.includes("groupedSubstances") && l.includes("useMemo"));
console.log("groupedSubstances at line:", groupLine + 1);

// Show the useMemo block
for (let i = groupLine; i < groupLine + 10 && i < lines.length; i++) {
  console.log((i+1) + ": " + lines[i].substring(0, 150));
}

console.log("\n--- Data source ---");
// Check what data source is used
for (let i = groupLine; i < groupLine + 30 && i < lines.length; i++) {
  if (lines[i].includes("ALL_SUBSTANCES") || lines[i].includes("SUPPORT_CATALOG")) {
    console.log((i+1) + ": " + lines[i].trim().substring(0, 120));
  }
}

// Find where catalog tab renders
const catalogTabs = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("catalog") && lines[i].includes("tab")) {
    catalogTabs.push(i+1);
  }
}
console.log("\n--- Catalog tab references (first 5) ---");
catalogTabs.slice(0, 5).forEach(l => console.log(l + ": " + lines[l-1].trim().substring(0, 120)));
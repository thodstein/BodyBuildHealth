const f = require("fs").readFileSync("src/ui/screens/SupportScreen.tsx", "utf8");

// Find where SUPPORT_CATALOG_DATA is actually used in the render
const lines = f.split("\n");
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("SUPPORT_CATALOG_DATA") && i > 13) {
    console.log((i+1) + ": " + lines[i].trim().substring(0, 120));
    found = true;
  }
}
if (!found) console.log("SUPPORT_CATALOG_DATA only imported, not used in render!");

// Check what groupedSubstances uses
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("groupedSubstances") && lines[i].includes("useMemo")) {
    console.log("\n--- groupedSubstances useMemo ---");
    console.log((i+1) + ": " + lines[i].trim().substring(0, 120));
    // Print next 20 lines
    for (let j = i+1; j < i+30 && j < lines.length; j++) {
      console.log((j+1) + ": " + lines[j].trim().substring(0, 120));
    }
    break;
  }
}
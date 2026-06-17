const f = require("fs").readFileSync("src/ui/screens/SupportScreen.tsx", "utf8");
const lines = f.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("catalog") && lines[i].includes("tab")) {
    console.log((i+1) + ": " + lines[i].trim().substring(0, 120));
  }
}
console.log("\n--- SUPPORT_CATALOG_DATA usage ---");
let m;
const re = /SUPPORT_CATALOG_DATA/g;
while ((m = re.exec(f)) !== null) {
  const line = f.substring(0, m.index).split("\n").length;
  console.log("Line " + line + ": " + f.substring(m.index, m.index + 100));
}
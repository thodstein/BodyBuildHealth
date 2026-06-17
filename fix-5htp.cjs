const fs = require("fs");
let c = fs.readFileSync("src/data/support-catalog.ts", "utf-8");
const lines = c.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "5htp: {") {
    lines[i] = "  x5htp: {";
    break;
  }
}
c = lines.join("\n");
c = c.replace(/id: '5htp'/g, "id: 'x5htp'");
fs.writeFileSync("src/data/support-catalog.ts", c, "utf-8");
console.log("Fixed 5htp to x5htp");

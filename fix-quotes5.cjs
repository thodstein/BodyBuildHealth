var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Fix remaining apostrophe issues in names and descriptions
// L'Lactate -> L-Lactate
d = d.replace(/L'Lactate/g, "L-Lactate");
d = d.replace(/L'Lactate/g, "L-Lactate");

// Also check for other patterns like X'Y where X and Y are uppercase
// These are likely mojibake apostrophes that should be hyphens
var regex = /([A-Z])'([A-Z])/g;
var m;
var count = 0;
while ((m = regex.exec(d)) !== null) {
  // Check if this is inside a string (between single quotes)
  // If so, replace with hyphen
  var lineStart = d.lastIndexOf("\n", m.index) + 1;
  var line = d.substring(lineStart, d.indexOf("\n", m.index));
  if (line.includes("name:") || line.includes("description:")) {
    d = d.substring(0, m.index) + m[1] + "-" + m[2] + d.substring(m.index + 3);
    count++;
  }
}
console.log("Fixed " + count + " X-Y patterns");

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Simple targeted fixes for the remaining quote issues
var fixes = [
  ["Mucin'Stimulating", "Mucin-Stimulating"],
  ["Anti'Inflammatory", "Anti-Inflammatory"],
];

fixes.forEach(function(f) {
  var count = 0;
  while (d.indexOf(f[0]) !== -1) {
    d = d.replace(f[0], f[1]);
    count++;
  }
  console.log("Fixed " + count + " instances of: " + f[0]);
});

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// The "country" field contains mojibake "Р СЃСЃРёСЏ" which should be "Россия"
// Let me find and replace it using a more flexible approach
// The pattern includes invisible chars and Cyrillic mojibake

// Search for the country pattern with mojibake
var pattern = "country: '\u0420\u0020\u0420\u0455\u0421\u0403\u0421\u0403\u0420\u0451\u0421\u040f'";
var replacement = "country: '\u0420\u043e\u0441\u0441\u0438\u044f'"; // Россия

var count = 0;
while (d.indexOf(pattern) !== -1) {
  d = d.replace(pattern, replacement);
  count++;
}
console.log("Fixed pattern 1: " + count + " instances");

// Try another pattern - the exact bytes from the file
// Let me search by finding "country: '" and then looking for mojibake after it
var searchRegex = /country:\s*'([^']*)'/g;
var match;
var fixes = [];
while ((match = searchRegex.exec(d)) !== null) {
  var val = match[1];
  if (/[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E\u0455]/.test(val)) {
    console.log("Found mojibake country: " + val);
    console.log("  Hex: " + val.split("").map(function(c) { return c.charCodeAt(0).toString(16); }).join(" "));
    fixes.push({start: match.index, end: match.index + match[0].length, old: match[0], new: "country: '\u0420\u043e\u0441\u0441\u0438\u044f'"});
  }
}

// Apply fixes
fixes.sort(function(a, b) { return b.start - a.start; });
for (var i = 0; i < fixes.length; i++) {
  var f = fixes[i];
  d = d.substring(0, f.start) + f.new + d.substring(f.end);
}
console.log("Fixed country fields: " + fixes.length);

// Check remaining
var regex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/g;
var remaining = 0;
while (regex.exec(d)) remaining++;
console.log("Remaining mojibake chars:", remaining);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

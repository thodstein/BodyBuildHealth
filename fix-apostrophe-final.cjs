var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Find ALL remaining patterns where a single quote inside a name/description
// breaks the string. Pattern: uppercase letter followed by ' followed by uppercase letter or digit
// These are mojibake apostrophes that should be hyphens
var regex = /([A-Z])'([A-Z0-9])/g;
var count = 0;
var result = d;
var m;
while ((m = regex.exec(d)) !== null) {
  var replacement = m[1] + "-" + m[2];
  result = result.replace(m[0], replacement);
  count++;
}
console.log("Fixed " + count + " uppercase-apostrophe patterns");

// Also find patterns like letter'letter in names/descriptions
// where the apostrophe is between two word characters
regex = /([a-z])'([A-Z])/g;
count = 0;
while ((m = regex.exec(result)) !== null) {
  // Only fix if it looks like a mojibake apostrophe in a name
  result = result.replace(m[0], m[1] + "-" + m[2]);
  count++;
}
console.log("Fixed " + count + " lowercase-uppercase-apostrophe patterns");

fs.writeFileSync("src/data/support-database.ts", result, "utf8");
console.log("File saved!");

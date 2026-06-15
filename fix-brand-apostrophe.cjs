var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Find ALL remaining single quotes inside string values
// These are apostrophes in Russian text that should be replaced with hyphens or escaped
// Pattern: text inside single-quoted strings that contains another single quote

// Find brand descriptions with unescaped quotes
var brandSection = d.indexOf("brandId:");
var brandEnd = d.indexOf("export", brandSection);
var brandContent = d.substring(brandSection, brandEnd);

// Find all single-quoted strings in the brand section
var regex = /description:\s*'([^']+)'/g;
var match;
var fixes = [];

while ((match = regex.exec(brandContent)) !== null) {
  var desc = match[1];
  // Find lines with description containing single quote
  var lineStart = brandContent.lastIndexOf("\n", match.index) + 1;
  var line = brandContent.substring(lineStart, brandContent.indexOf("\n", match.index));
  if (line.includes("'") && !line.includes("\\'")) {
    // Check if there's an internal quote
    var descStart = line.indexOf("description: '") + 14;
    var descEnd = line.lastIndexOf("'");
    if (descEnd > descStart) {
      var descValue = line.substring(descStart, descEnd);
      if (descValue.indexOf("'") !== -1) {
        fixes.push({line: line.substring(0, 100), descValue: descValue});
      }
    }
  }
}

console.log("Brand description fixes needed:", fixes.length);
fixes.forEach(function(f) {
  console.log("  " + f.descValue.substring(0, 60));
});

// Fix all remaining apostrophes in brand descriptions by replacing with hyphens
// Find all patterns like: text'text in single-quoted strings
// where the text before and after ' are Russian characters
d = d.replace(/([а-яА-ЯёЁ])'([а-яА-ЯёЁ0-9])/g, "$1-$2");

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

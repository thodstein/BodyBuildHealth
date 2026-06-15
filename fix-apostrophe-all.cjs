var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Find ALL remaining patterns where a single quote inside name/description breaks the string
// Check all lines with TS errors by finding unescaped apostrophes in name/description values

// Strategy: find all name: '...' and description: '...' lines where there are
// more than 2 single quotes (start + end + internal)

var lines = d.split("\n");
var fixedCount = 0;

for (var i = 0; i < lines.length; i++) {
  var line = lines[i];
  
  // Check name: '...' patterns
  var nameMatch = line.match(/^(\s*name:\s*')(.+)(',?\s*)$/);
  if (nameMatch) {
    var value = nameMatch[2];
    // Check if value contains unescaped single quotes
    if (value.indexOf("'") !== -1 && value.indexOf("\\'") === -1) {
      var escaped = value.replace(/'/g, "-");
      lines[i] = nameMatch[1] + escaped + nameMatch[3];
      fixedCount++;
    }
  }
  
  // Check description: '...' patterns
  var descMatch = line.match(/^(\s*description:\s*')(.+)(',?\s*)$/);
  if (descMatch) {
    var value = descMatch[2];
    if (value.indexOf("'") !== -1 && value.indexOf("\\'") === -1) {
      var escaped = value.replace(/'/g, "-");
      lines[i] = descMatch[1] + escaped + descMatch[3];
      fixedCount++;
    }
  }
}

console.log("Fixed " + fixedCount + " lines with unescaped quotes");

d = lines.join("\n");
fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

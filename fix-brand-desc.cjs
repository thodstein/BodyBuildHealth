var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Fix brand descriptions with unescaped quotes
// These are in a different format (brand entries with description: '...')
// The pattern is: description: 'Нейро'нутра...' where the inner ' breaks the string

// Find ALL remaining single-quoted strings that contain internal unescaped quotes
// by checking for TS syntax errors

// Strategy: find all '...' strings and escape internal quotes
// But we need to be careful not to double-escape already escaped quotes

// Let me find all description patterns in brand entries
var regex = /description:\s*'([^']*)'/g;
var match;
var problems = [];

while ((match = regex.exec(d)) !== null) {
  var val = match[1];
  // Check if there's an unescaped quote inside
  if (val.indexOf("'") !== -1 && val.indexOf("\\'") === -1) {
    // This value contains an unescaped quote
    // But wait - the regex already captures until the first ',
    // so if there's a match, the ' is actually the string delimiter,
    // and any internal ' would have been split
  }
}

// Instead, let me find the brand entries directly
var brandRegex = /\{\s*brandId:\s*'[^']+',\s*name:\s*'[^']+',\s*type:\s*'brand',\s*country:\s*'[^']+',\s*description:\s*'([^']+)'\s*\}/g;
var brandProblems = [];
while ((match = brandRegex.exec(d)) !== null) {
  var desc = match[1];
  if (desc.indexOf("'") !== -1 && desc.indexOf("\\'") === -1) {
    brandProblems.push({start: match.index, end: match.index + match[0].length, full: match[0], desc: desc});
  }
}

console.log("Brand entries with unescaped quotes in description:", brandProblems.length);
brandProblems.forEach(function(p) {
  console.log("  " + p.desc.substring(0, 60));
});

// Fix them by replacing internal quotes with escaped quotes or dashes
for (var i = 0; i < brandProblems.length; i++) {
  var p = brandProblems[i];
  // Replace the unescaped quote with a dash
  var fixedDesc = p.desc.replace(/'/g, "-");
  var fixed = p.full.replace(p.desc, fixedDesc);
  d = d.replace(p.full, fixed);
}

// Also find any remaining unescaped quotes in the file
// by searching for patterns like 'text'text' where the middle ' is problematic
var remainingRegex = /'[^']*'[^',\]}:][^']*'/g;
var count = 0;
while ((match = remainingRegex.exec(d)) !== null) {
  count++;
}
console.log("Potential remaining quote problems:", count);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

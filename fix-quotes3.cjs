var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Find and fix ALL remaining unescaped single quotes/apostrophes in name and description fields
// The problem: single quotes within single-quoted strings break TypeScript parsing

// Strategy: replace all problematic characters inside string literals
// We need to find all '...' string values that contain unescaped '

// Approach: find patterns like name: '...' where the value contains an apostrophe
// These need to be escaped as \'

// Common patterns with apostrophes
var apostropheFixes = [
  // Mucin'Stimulating -> Mucin-Stimulating
  { from: "Mucin'Stimulating", to: "Mucin-Stimulating" },
  // Anti'Inflammatory -> Anti-Inflammatory
  { from: "Anti'Inflammatory", to: "Anti-Inflammatory" },
  // Lion's -> Lion\\'s (already fixed, but check)
  { from: "Lion\\'s", to: "Lion\\'s" },  // keep as is
  // Lugol's -> Lugol\\'s (already fixed, but check)
  { from: "Lugol\\'s", to: "Lugol\\'s" },  // keep as is
];

apostropheFixes.forEach(function(f) {
  var count = 0;
  while (d.indexOf(f.from) !== -1) {
    d = d.replace(f.from, f.to);
    count++;
  }
  if (count > 0) console.log("Fixed " + count + " instances of: " + f.from);
});

// Now find ALL remaining single-quoted strings with unescaped apostrophes
// by looking for patterns like 'text'text' where the middle ' breaks the string
// We need to find lines that have TS errors

// Find all name: '...' patterns and check for unescaped quotes
var nameRegex = /name:\s*'([^']*)'/g;
var match;
var problems = [];

while ((match = nameRegex.exec(d)) !== null) {
  var val = match[1];
  // Check if the string continues past the closing quote
  var afterMatch = d.substring(match.index + match[0].length).trimStart();
  if (!afterMatch.startsWith(',') && !afterMatch.startsWith('\r') && !afterMatch.startsWith('\n')) {
    // This is a broken string - the ' in the middle broke it
    // Find the actual end of the string
    var fullLine = d.substring(match.index, match.index + 200);
    var firstQuoteEnd = match.index + match[0].length;
    
    // The string continues past the first '
    // We need to find where it actually ends and escape the internal quotes
    problems.push({
      pos: match.index,
      line: fullLine.substring(0, 80),
      val: val
    });
  }
}

console.log("Remaining name field problems:", problems.length);
problems.slice(0, 5).forEach(function(p) {
  console.log("  " + p.line);
});

// Fix the remaining problems by replacing ' with \' inside name strings
// We need a more robust approach: find all name: '...' lines and fix the quotes
var lines = d.split("\n");
var fixedLines = 0;

for (var i = 0; i < lines.length; i++) {
  var line = lines[i];
  // Check if this line starts a name field
  var nameMatch = line.match(/^\s*name:\s*'(.+)/);
  if (nameMatch) {
    // Check if the string has unescaped quotes
    var content = nameMatch[1];
    // Count quotes - if there's more than 1 unescaped quote, we have a problem
    var unescapedQuotes = 0;
    for (var j = 0; j < content.length; j++) {
      if (content[j] === "'" && (j === 0 || content[j-1] !== "\\")) {
        unescapedQuotes++;
      }
    }
    if (unescapedQuotes > 1) {
      // The name has an internal quote - escape it
      // Find the part between first and last '
      var startIdx = line.indexOf("'") + 1;
      var endIdx = line.lastIndexOf("'");
      if (endIdx > startIdx) {
        var nameValue = line.substring(startIdx, endIdx);
        var escapedName = nameValue.replace(/'/g, "\\'");
        lines[i] = line.substring(0, startIdx) + escapedName + line.substring(endIdx);
        fixedLines++;
      }
    }
  }
  
  // Same for description fields
  var descMatch = line.match(/^\s*description:\s*'(.+)/);
  if (descMatch) {
    var content = descMatch[1];
    var unescapedQuotes = 0;
    for (var j = 0; j < content.length; j++) {
      if (content[j] === "'" && (j === 0 || content[j-1] !== "\\")) {
        unescapedQuotes++;
      }
    }
    if (unescapedQuotes > 1) {
      var startIdx = line.indexOf("'") + 1;
      var endIdx = line.lastIndexOf("'");
      if (endIdx > startIdx) {
        var descValue = line.substring(startIdx, endIdx);
        var escapedDesc = descValue.replace(/'/g, "\\'");
        lines[i] = line.substring(0, startIdx) + escapedDesc + line.substring(endIdx);
        fixedLines++;
      }
    }
  }
}

console.log("Fixed lines:", fixedLines);
d = lines.join("\n");

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size:", d.length);

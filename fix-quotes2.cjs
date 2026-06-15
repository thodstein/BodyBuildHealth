var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Fix unescaped single quotes/apostrophes in name and description fields
// The pattern is: 'something's something' where the inner ' breaks the string

// Fix specific known problems
var fixes = [
  // 2'-Fucosyllactose
  { from: "2'-Fucosyllactose (2'-FL)", to: "2-prime-Fucosyllactose (2-FL)" },
  { from: "2'-FL", to: "2-FL" },
  // 3'-Galactosyllactose
  { from: "3'-Galactosyllactose (3'-GL)", to: "3-prime-Galactosyllactose (3-GL)" },
  { from: "3'-GL", to: "3-GL" },
  // 6'-Sialyllactose
  { from: "6'-Sialyllactose (6'-SL)", to: "6-prime-Sialyllactose (6-SL)" },
  { from: "6'-SL", to: "6-SL" },
  { from: "3'-Sialyllactose (3'-SL)", to: "3-prime-Sialyllactose (3-SL)" },
  { from: "3'-SL", to: "3-SL" },
];

fixes.forEach(function(f) {
  var count = 0;
  while (d.indexOf(f.from) !== -1) {
    d = d.replace(f.from, f.to);
    count++;
  }
  if (count > 0) console.log("Fixed " + count + " instances of: " + f.from);
});

// Now find ALL remaining unescaped single quotes inside single-quoted strings
// This is tricky - we need to find patterns like 'text's text' where the middle ' breaks the string
// The pattern: name: '...' where the value contains an unescaped '

var nameRegex = /name:\s*'([^']*)'/g;
var match;
var problems = [];
while ((match = nameRegex.exec(d)) !== null) {
  var val = match[1];
  // Check if the next line continues correctly
  var afterMatch = d.substring(match.index + match[0].length, match.index + match[0].length + 20);
  if (!/^\s*,/.test(afterMatch) && !/^\s*\n/.test(afterMatch)) {
    problems.push({pos: match.index, val: val.substring(0, 50), after: afterMatch.substring(0, 30)});
  }
}
console.log("Remaining name field problems:", problems.length);
problems.slice(0, 10).forEach(function(p) {
  console.log("  pos " + p.pos + ": " + JSON.stringify(p.val) + " after: " + JSON.stringify(p.after));
});

// Also check description fields
var descRegex = /description:\s*'([^']*)'/g;
while ((match = descRegex.exec(d)) !== null) {
  var val = match[1];
  var afterMatch = d.substring(match.index + match[0].length, match.index + match[0].length + 20);
  if (!/^\s*,/.test(afterMatch) && !/^\s*\n/.test(afterMatch)) {
    console.log("DESC problem at " + match.index + ": " + val.substring(0, 50));
  }
}

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

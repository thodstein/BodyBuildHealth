var iconv = require("iconv-lite");
var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

console.log("File size:", d.length);

// The remaining mojibake has a pattern: в (U+0432) + Ђ (U+0402) + some char
// This is because вЂ is the mojibake for the UTF-8 bytes E2 80 xx
// which encodes characters in the U+2000-U+20FF range (punctuation, symbols)
// We need to find these triple patterns and decode them

// Approach: find all instances of U+0432 followed by U+0402 (вЂ)
// and decode the entire context around them using iconv

// But iconv.encode with win1251 doesn't handle Ђ(TM) correctly
// because TM (U+2122) is not in CP1251

// Instead, let's manually replace known patterns
// вЂ(TM) -> ' (right single quote/apostrophe)
// вЂ" -> — (em dash)  -- but this is 2 chars: в (U+0432) + some char
// Wait, we need to check the actual patterns

// Let me find ALL remaining mojibake and fix them manually
var patterns = [
  // Pattern: Cyrillic в + Ђ + special char
  {regex: /вЂ\u2122/g, replacement: "'"},  // вЂ(TM) -> '
  {regex: /вЂ\u2019/g, replacement: "'"},  // вЂ' -> '
  {regex: /вЂ\u2018/g, replacement: "'"},  // вЂ' -> '
  {regex: /вЂ\u201C/g, replacement: "\u201C"},  // вЂ" -> "
  {regex: /вЂ\u201D/g, replacement: "\u201D"},  // вЂ" -> "
  {regex: /вЂ\u2013/g, replacement: "\u2013"},  // вЂ" -> -
  {regex: /вЂ\u2014/g, replacement: "\u2014"},  // вЂ" -> --
  {regex: /вЂ\u2026/g, replacement: "\u2026"},  // вЂ... -> ...
  {regex: /вЂ\u201A/g, replacement: "\u201A"},  // вЂ, -> ,
  {regex: /вЂ\u201E/g, replacement: "\u201E"},  // вЂ" -> ,,
  
  // Also handle в•ђ (box drawing)
  {regex: /в•ђ+/g, replacement: "="},
  
  // Handle standalone Ђ (U+0402) which is mojibake for 0x80
  // In CP1251, 0x80 = U+0402 (Ђ), but in the original UTF-8, 
  // this was part of a multi-byte sequence like E2 80 XX
];

var totalReplacements = 0;
patterns.forEach(function(p) {
  var matches = d.match(p.regex);
  if (matches) {
    console.log("Pattern " + p.regex.source + ": " + matches.length + " matches");
    d = d.replace(p.regex, p.replacement);
    totalReplacements += matches.length;
  }
});

console.log("Total replacements:", totalReplacements);

// Verify: check for remaining problematic chars
var remaining = 0;
var checkRegex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E\u2122]/g;
while (checkRegex.exec(d)) remaining++;
console.log("Remaining CP1251/TM chars:", remaining);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size:", d.length);

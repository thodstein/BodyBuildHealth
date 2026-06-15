var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Replace remaining вЂ patterns with proper characters
// вЂ(TM) = apostrophe
// Pattern: Cyrillic в (U+0432) followed by U+2019 or similar
d = d.replace(/в\u2019/g, "'");  // в(TM) -> '
d = d.replace(/в\u2018/g, "'");  // в(8-) -> '
d = d.replace(/в\u201C/g, "\u201C");  // в" -> left double quote
d = d.replace(/в\u201D/g, "\u201D");  // в" -> right double quote
d = d.replace(/в\u2013/g, "\u2013");  // в- -> en dash
d = d.replace(/в\u2014/g, "\u2014");  // в- -> em dash
d = d.replace(/в\u2026/g, "\u2026");  // в... -> ellipsis
d = d.replace(/в\u201A/g, "\u201A");  // в, -> single low quote
d = d.replace(/в\u201E/g, "\u201E");  // в„ -> double low quote

// Also fix в•ђ (box drawing chars in header)
d = d.replace(/в•ђ+/g, "=");

// Count remaining
var badPattern = /в[ЂЃ\u2019\u2018\u201C\u201D\u2013\u2014\u2026]/g;
var count = 0;
while (badPattern.exec(d)) count++;
console.log("Remaining bad patterns: " + count);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size: " + d.length);

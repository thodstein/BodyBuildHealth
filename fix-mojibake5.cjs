var iconv = require("iconv-lite");
var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

console.log("File size:", d.length);

// There are still 60 positions with remaining mojibake
// These are in string values that were not caught by the first pass
// because they contain a mix of already-decoded and still-mojibake text

// Strategy: find all single-quoted strings that contain any CP1251-specific chars
// and decode them using iconv

var badChars = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/;

// Find all string values
var stringRegex = /'([^']*)'/g;
var match;
var replacements = [];
var checked = 0;
var fixed = 0;

while ((match = stringRegex.exec(d)) !== null) {
  var val = match[1];
  if (val.length < 5) continue;
  checked++;
  
  if (badChars.test(val)) {
    try {
      var decoded = iconv.encode(val, "win1251").toString("utf8");
      if (/[а-яА-ЯёЁ]/.test(decoded) && decoded !== val) {
        // Verify it's actually better
        var escaped = decoded.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          old: match[0],
          new: "'" + escaped + "'"
        });
        fixed++;
      }
    } catch(e) {}
  }
}

console.log("Checked:", checked, "Fixed:", fixed);

// Apply replacements in reverse order
replacements.sort(function(a, b) { return b.start - a.start; });
for (var i = 0; i < replacements.length; i++) {
  var r = replacements[i];
  d = d.substring(0, r.start) + r.new + d.substring(r.end);
}

// Verify: check for remaining problematic chars
var remaining = 0;
var checkRegex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/g;
while (checkRegex.exec(d)) remaining++;
console.log("Remaining CP1251 chars:", remaining);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size:", d.length);

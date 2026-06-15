var iconv = require("iconv-lite");
var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

console.log("File size:", d.length);

// Find ALL single-quoted strings and check if they contain mojibake
// by trying to decode them with iconv and comparing results
var stringRegex = /'([^']*)'/g;
var match;
var replacements = [];
var fixed = 0;

while ((match = stringRegex.exec(d)) !== null) {
  var val = match[1];
  if (val.length < 5) continue;
  
  // Check if this string has CP1251-specific chars (mojibake indicators)
  // These are chars that appear in CP1251 double-encoding but not in normal Russian text
  if (/[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E\u0401\u0451]/.test(val)) {
    try {
      var decoded = iconv.encode(val, "win1251").toString("utf8");
      if (/[а-яА-ЯёЁ]/.test(decoded) && decoded !== val) {
        var escaped = decoded.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          newStr: "'" + escaped + "'"
        });
        fixed++;
      }
    } catch(e) {
      console.log("Error decoding:", e.message);
    }
  }
}

console.log("Strings to fix:", fixed);

// Apply replacements in reverse order
replacements.sort(function(a, b) { return b.start - a.start; });
for (var i = 0; i < replacements.length; i++) {
  var r = replacements[i];
  d = d.substring(0, r.start) + r.newStr + d.substring(r.end);
}

// Also fix any remaining standalone mojibake chars in the description field context
// by scanning for description: '...' patterns and decoding them
var descRegex = /description:\s*'([^']*)'/g;
while ((match = descRegex.exec(d)) !== null) {
  var val = match[1];
  if (/[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E\u0401\u0451]/.test(val)) {
    try {
      var decoded = iconv.encode(val, "win1251").toString("utf8");
      if (/[а-яА-ЯёЁ]/.test(decoded) && decoded !== val) {
        var escaped = decoded.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        d = d.substring(0, match.index) + "description: '" + escaped + "'" + d.substring(match.index + match[0].length);
        fixed++;
      }
    } catch(e) {}
  }
}

console.log("Total fixes:", fixed);

// Verify remaining
var remaining = 0;
var checkRegex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E\u0401\u0451]/g;
while (checkRegex.exec(d)) remaining++;
console.log("Remaining CP1251 chars:", remaining);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size:", d.length);

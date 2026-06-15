var iconv = require("iconv-lite");
var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

console.log("File size:", d.length);

// Fix remaining mojibake by decoding all string values that contain mojibake indicators
// Mojibake indicators: chars that are from CP1251/CP1252 double-encoding
// These include: Ђ (U+0402), Ѓ (U+0403), ђ (U+0452), ѓ (U+0453), etc.
// And special chars that appear in wrong context: ™ (U+2122), etc.

function hasMojibake(str) {
  // Check for CP1251-specific chars that shouldn't appear in our data
  if (/[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E\u0401\u0451]/.test(str)) return true;
  // Check for ™ that's part of mojibake (not actual trademark)
  if (/вЂ\u2122/.test(str)) return true;
  // Check for other mojibake patterns
  if (/вЂ/.test(str)) return true;
  return false;
}

function decodeMojibake(str) {
  try {
    var decoded = iconv.encode(str, "win1251").toString("utf8");
    if (/[а-яА-ЯёЁ]/.test(decoded)) {
      return decoded;
    }
    return str;
  } catch(e) {
    return str;
  }
}

// Find and fix all string values with remaining mojibake
var stringRegex = /'([^']*)'/g;
var match;
var replacements = [];
var checked = 0;
var fixed = 0;

while ((match = stringRegex.exec(d)) !== null) {
  var val = match[1];
  if (val.length < 3) continue;
  checked++;
  
  if (hasMojibake(val)) {
    var decoded = decodeMojibake(val);
    if (decoded !== val) {
      var escaped = decoded.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        old: match[0],
        new: "'" + escaped + "'"
      });
      fixed++;
    }
  }
}

console.log("Checked:", checked, "Fixed:", fixed);

// Apply replacements in reverse order
replacements.sort(function(a, b) { return b.start - a.start; });
for (var i = 0; i < replacements.length; i++) {
  var r = replacements[i];
  d = d.substring(0, r.start) + r.new + d.substring(r.end);
}

// Also fix the header comment with box-drawing chars
d = d.replace(/в•ђ+/g, "=");

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size:", d.length);

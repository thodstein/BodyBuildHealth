var iconv = require('iconv-lite');
var fs = require('fs');
var d = fs.readFileSync('src/data/support-database.ts', 'utf8');
console.log('File size:', d.length);

// Fix remaining mojibake patterns
// вЂ™ -> ' (right single quote)
// вЂ" -> — (em dash)
// вЂ" -> – (en dash)
// вЂ¦ -> … (ellipsis)
// вЂћ -> „ (double low quote)
// вЂњ -> " (left double quote)
// вЂќ -> " (right double quote)
// вЂ<80> -> various

// These are single characters that were double-encoded
var fixes = 0;

// Pattern: вЂ followed by a special char
// вЂ™ = ' (U+2019)
var result = d;
result = result.replace(/вЂ\u2019/g, "'");
result = result.replace(/вЂ\u2018/g, "'");
result = result.replace(/вЂ\u201C/g, "\u201C");
result = result.replace(/вЂ\u201D/g, "\u201D");
result = result.replace(/вЂ\u2013/g, "\u2013");
result = result.replace(/вЂ\u2014/g, "\u2014");
result = result.replace(/вЂ\u2026/g, "\u2026");
result = result.replace(/вЂ\u201A/g, "\u201A");
result = result.replace(/вЂ\u201E/g, "\u201E");

// Also fix any remaining mojibake by trying iconv decode on small strings
// Find all remaining patterns like X followed by a special char
var remaining = 0;
var re = /[\u0402\u0403\u0409\u040A\u040C\u040B\u040F\u0452\u0453\u0459\u045A\u045B\u045C\u045F\u040E\u045E\u0401\u0451]/g;
var m;
while ((m = re.exec(result)) !== null) {
  remaining++;
}

console.log('Remaining CP1251-specific chars:', remaining);

// Fix: these are individual characters that are part of mojibake
// U+0402 (Ђ) came from byte 0x80
// U+0403 (Ѓ) came from byte 0x81
// etc.
// They should be decoded back to their CP1251 byte values and then as UTF-8

// But since these are individual chars, not pairs, they might be actual Cyrillic chars
// Let me check the context
if (remaining > 0) {
  console.log('These may be legitimate Cyrillic chars (Ђ, Ѓ, etc.) or mojibake artifacts');
  console.log('Fixing known mojibake patterns...');
  
  // Fix: Ђ (U+0402) is often mojibake for byte 0x80 which in CP1251 maps to U+0402 itself
  // This is tricky - in CP1251, byte 0x80 IS U+0402 (Ђ), so it's both a valid Cyrillic char AND a mojibake artifact
  // The key question: is Ђ being used as a valid Cyrillic char or as a mojibake artifact?
  
  // In Ukrainian, Ђ is a valid letter. But in our database, it's likely mojibake.
  // Let's decode these characters properly using iconv
}

// Simple replacements for common mojibake patterns in names
// вЂ™ -> '  (Lugol's, Lion's, etc.)
result = result.replace(/вЂ\u2019/g, "'");
result = result.replace(/вЂ\u2018/g, "'");
// вЂ" -> —
result = result.replace(/вЂ\u2014/g, "—");
result = result.replace(/вЂ\u2013/g, "–");
// вЂ¦ -> …
result = result.replace(/вЂ\u2026/g, "…");

// Count remaining bad patterns
var badRe = /в[ЂЃ][^\s]/g;
var badCount = 0;
while (badRe.exec(result) !== null) badCount++;
console.log('Remaining "вЂ" patterns:', badCount);

if (badCount > 0) {
  // Try a more aggressive approach: find all single-quoted strings with mojibake and decode them
  var stringRe = /'([^']*)'/g;
  var replacements = [];
  while ((m = stringRe.exec(result)) !== null) {
    var val = m[1];
    if (/в[ЂЃ]/.test(val) || /[\u0402\u0403\u0409\u040A\u040C\u040B\u040F\u0452\u0453\u0459\u045A\u045B\u045C\u045F\u040E\u045E\u0401\u0451]/.test(val)) {
      try {
        var decoded = iconv.encode(val, 'win1251').toString('utf8');
        if (/[а-яА-ЯёЁ]/.test(decoded) && decoded !== val) {
          replacements.push({start: m.index, end: m.index + m[0].length, old: m[0], new: "'" + decoded.replace(/'/g, "\\'") + "'"});
        }
      } catch(e) {}
    }
  }
  
  // Apply replacements in reverse order
  replacements.sort(function(a, b) { return b.start - a.start; });
  for (var i = 0; i < replacements.length; i++) {
    var r = replacements[i];
    result = result.substring(0, r.start) + r.new + result.substring(r.end);
    fixes++;
  }
}

console.log('Additional fixes applied:', fixes);
fs.writeFileSync('src/data/support-database.ts', result, 'utf8');
console.log('File saved! Size:', result.length);

var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Fix the country field "Р РѕСЃСЃРёСЏ" -> "Россия"
// This is a mojibake pattern that the iconv encoder couldn't handle
// because the space makes it two separate encoded segments

// Let me manually decode: 
// Р (U+0420) = CP1251 byte 0xD0 -> part of UTF-8 sequence
// (space) = 0x20
// Р (U+0420) = CP1251 byte 0xD0
// ѕ (U+0455) = CP1251 byte 0xB5 -> actually ѕ is not in CP1251...
// С (U+0421) = CP1251 byte 0xD1
// Ѓ (U+0403) = CP1251 byte 0x81
// С (U+0421) = CP1251 byte 0xD1
// Ѓ (U+0403) = CP1251 byte 0x81
// Р (U+0420) = CP1251 byte 0xD0
// ё (U+0451) = CP1251 byte 0xB8
// С (U+0421) = CP1251 byte 0xD1
// Џ (U+040F) = CP1251 byte 0x8F

// Wait, the space splits this into two encoded segments. Let me decode each:
// "РѕСЃСЃРёСЏ" without the space:
// D0 B5 D1 81 D1 81 D0 B8 D1 8F = "оссия" in UTF-8
// But the first "Р " (Р + space) = D0 20 which is not valid UTF-8

// Actually "Р РѕСЃСЃРёСЏ" should be "Россия"
// The "Р " at the beginning might be "Рѕ" where ѕ(U+0455) was lost

// Let me just replace all instances
var old = "Р РѕСЃСЃРёСЏ";
var newStr = "Россия";
var count = 0;
while (d.indexOf(old) !== -1) {
  d = d.replace(old, newStr);
  count++;
}
console.log("Fixed country: " + count + " instances");

// Check for any remaining mojibake
var regex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/g;
var remaining = 0;
while (regex.exec(d)) remaining++;
console.log("Remaining mojibake chars:", remaining);

// If any remaining, let me find and fix them manually
if (remaining > 0) {
  // Find all remaining and replace contextually
  var positions = [];
  regex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/g;
  var m;
  while ((m = regex.exec(d)) !== null) {
    positions.push({pos: m.index, char: m[0], ctx: d.substring(Math.max(0, m.index - 30), m.index + 30)});
  }
  console.log("Positions with remaining mojibake:", positions.length);
  positions.forEach(function(p, i) {
    console.log("  " + i + ": U+" + p.char.charCodeAt(0).toString(16) + " at " + p.pos + ": " + JSON.stringify(p.ctx).substring(0, 80));
  });
}

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size:", d.length);

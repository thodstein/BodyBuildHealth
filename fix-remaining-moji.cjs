var iconv = require("iconv-lite");
var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Fix remaining mojibake in country/description fields
// "Р РѕСЃСЃРёСЏ" should be "Россия"
// These are in brand entries at the end of the file

var fixes = [
  { old: "country: 'Р РѕСЃСЃРёСЏ'", new: "country: 'Россия'" },
];

fixes.forEach(function(f) {
  var count = 0;
  while (d.indexOf(f.old) !== -1) {
    d = d.replace(f.old, f.new);
    count++;
  }
  if (count > 0) console.log("Fixed " + count + " instances of: " + f.old.substring(0, 30) + "...");
});

// Now find ALL remaining mojibake and decode them
var regex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/g;
var match;
var contexts = new Set();
while ((match = regex.exec(d)) !== null) {
  var start = Math.max(0, match.index - 50);
  var end = Math.min(d.length, match.index + 50);
  var context = d.substring(start, end);
  contexts.add(context);
}

console.log("Remaining mojibake contexts:", contexts.size);
contexts.forEach(function(ctx) {
  console.log("  " + ctx.replace(/\n/g, "\\n").substring(0, 80));
});

// Try iconv decode on the remaining contexts
if (contexts.size > 0) {
  // Find the broader strings containing these chars and decode them
  var stringRegex = /'([^']*)'/g;
  var replacements = [];
  while ((match = stringRegex.exec(d)) !== null) {
    var val = match[1];
    if (/[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/.test(val)) {
      try {
        var decoded = iconv.encode(val, "win1251").toString("utf8");
        if (/[а-яА-ЯёЁ]/.test(decoded) && decoded !== val) {
          var escaped = decoded.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
          replacements.push({
            start: match.index,
            end: match.index + match[0].length,
            newStr: "'" + escaped + "'"
          });
        }
      } catch(e) {}
    }
  }
  
  console.log("Additional string fixes:", replacements.length);
  
  // Apply in reverse order
  replacements.sort(function(a, b) { return b.start - a.start; });
  for (var i = 0; i < replacements.length; i++) {
    var r = replacements[i];
    d = d.substring(0, r.start) + r.newStr + d.substring(r.end);
  }
}

// Final check
regex = /[\u0402\u0403\u0452\u0453\u0409\u0459\u040A\u045A\u040B\u045B\u040C\u045C\u040F\u045F\u040E\u045E]/g;
var remaining = 0;
while (regex.exec(d)) remaining++;
console.log("Final remaining mojibake chars:", remaining);

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved! Size:", d.length);

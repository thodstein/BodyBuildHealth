var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Count current description quality for ALL_SUBSTANCES only
var subStart = d.indexOf("ALL_SUBSTANCES");
var subEnd = d.indexOf("ALL_INTERACTIONS");
var subSection = d.substring(subStart, subEnd);

var descRegex = /description:\s*'([^']*)'/g;
descRegex.lastIndex = 0;
var m, total = 0, short = 0, template = 0, detailed = 0;
while ((m = descRegex.exec(subSection)) !== null) {
  total++;
  var desc = m[1];
  if (desc.length < 30) short++;
  else if (/^[А-Я][а-я]+ \(/.test(desc) || desc.indexOf(", необходимый для") >= 0 || desc.indexOf(", участвующий в") >= 0) template++;
  else detailed++;
}
console.log("ALL_SUBSTANCES descriptions:");
console.log("  Total:", total);
console.log("  Short (<30):", short);
console.log("  Template (generic):", template);
console.log("  Detailed (good):", detailed);

// Show samples of each type
console.log("\n--- Short descriptions ---");
var shortDescs = [];
var shortRegex = /id:\s*'([^']+)'.*?description:\s*'([^']{0,30})'/gs;
while ((m = shortRegex.exec(subSection)) !== null && shortDescs.length < 5) {
  shortDescs.push({id: m[1], desc: m[2]});
}
shortDescs.forEach(function(s) { console.log("  " + s.id + ": '" + s.desc + "'"); });

console.log("\n--- Template descriptions ---");
var templateDescs = [];
descRegex = /description:\s*'([^']{30,150})'/g;
descRegex.lastIndex = 0;
while ((m = descRegex.exec(subSection)) !== null && templateDescs.length < 5) {
  var desc = m[1];
  if (desc.indexOf(", необходимый для") >= 0 || desc.indexOf(", участвующий в") >= 0) {
    templateDescs.push(desc);
  }
}
templateDescs.forEach(function(d, i) { console.log("  " + (i+1) + ": " + d.substring(0, 100)); });

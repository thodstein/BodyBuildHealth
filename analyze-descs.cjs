var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Count description types
var descRegex = /description:\s*'([^']*)'/g;
var m, count = 0, short = 0, template = 0, detailed = 0;
while ((m = descRegex.exec(d)) !== null) {
  count++;
  var desc = m[1];
  if (desc.length < 30) short++;
  else if (desc.indexOf("(") >= 0 && desc.indexOf("),") >= 0 && desc.length < 120) template++;
  else detailed++;
}
console.log("Total descriptions:", count);
console.log("Short (<30):", short);
console.log("Template (generic):", template);
console.log("Detailed (good):", detailed);

// Sample some short descriptions
console.log("\n--- Sample short descriptions ---");
var shortRegex = /id:\s*'([^']+)'[^]*?description:\s*'([^']{0,40})'/g;
var sm;
var sCount = 0;
while ((sm = shortRegex.exec(d)) !== null && sCount < 10) {
  sCount++;
  console.log(sCount + ": " + sm[1] + " => '" + sm[2] + "'");
}

// Sample template descriptions
console.log("\n--- Sample template descriptions ---");
descRegex = /description:\s*'([^']{30,150})'/g;
var tCount = 0;
while ((m = descRegex.exec(d)) !== null && tCount < 10) {
  var desc = m[1];
  if (desc.indexOf("(") >= 0 && desc.length < 120) {
    tCount++;
    console.log(tCount + ": " + desc.substring(0, 100));
  }
}

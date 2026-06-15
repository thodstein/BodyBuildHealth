var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");
var entries = ["VIT_A_BETA", "VIT_B1", "VIT_B3_NMN", "MIN_MAG_CITRATE", "VIT_D3"];
entries.forEach(function(id) {
  var searchStr = "id: '" + id + "'";
  var idx = d.indexOf(searchStr);
  if (idx < 0) { console.log(id + ": NOT FOUND"); return; }
  var descIdx = d.indexOf("description: ", idx);
  if (descIdx < 0) { console.log(id + ": NO DESC FIELD"); return; }
  var lineStart = d.lastIndexOf("\n", descIdx) + 1;
  var lineEnd = d.indexOf("\n", descIdx);
  var line = d.substring(lineStart, lineEnd);
  console.log(id + ": " + line.substring(0, 120));
});

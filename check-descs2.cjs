var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Check for entries with SPECIFIC_DESC
var specificIds = ["VIT_A_BETA", "VIT_B3_NMN", "MIN_MAG_CITRATE", "VIT_D3", "FUNG_CORDYCEPS", "PEP_BPC157"];
specificIds.forEach(function(id) {
  var searchStr = "id: '" + id + "'";
  var idx = d.indexOf(searchStr);
  if (idx < 0) { console.log(id + ": NOT FOUND"); return; }
  
  // Get the full entry
  var entryStart = d.lastIndexOf("{", idx);
  var entryEnd = d.indexOf("}", idx) + 1;
  var entry = d.substring(entryStart, entryEnd);
  
  // Extract description
  var descMatch = entry.match(/description:\s*'([^']*)'/);
  if (descMatch) {
    console.log(id + ": " + descMatch[1].substring(0, 100));
  } else {
    console.log(id + ": NO DESC MATCH");
  }
});

// Check total entries with old-style descriptions
var templateRegex = /description:\s*'Витамин \(/g;
var templateCount = (d.match(templateRegex) || []).length;
console.log("\nEntries with template 'Витамин (': " + templateCount);

var mineralRegex = /description:\s*'Минерал \(/g;
var mineralCount = (d.match(mineralRegex) || []).length;
console.log("Entries with template 'Минерал (': " + mineralCount);

// Count total description fields
var descRegex = /description:\s*'[^']*'/g;
var totalDescs = (d.match(descRegex) || []).length;
console.log("Total description fields: " + totalDescs);

// Check how many start with specific patterns
var specificPatterns = [
  {name: "Бета-каротин", regex: /description:\s*'Бета-каротин/g},
  {name: "Ниацин", regex: /description:\s*'Ниацин/g},
  {name: "Тиамин", regex: /description:\s*'Тиамин/g},
  {name: "Магния цитрат", regex: /description:\s*'Магния цитрат/g},
  {name: "NMN", regex: /description:\s*'NMN/g},
];
specificPatterns.forEach(function(p) {
  var count = (d.match(p.regex) || []).length;
  console.log("Specific '" + p.name + "': " + count);
});

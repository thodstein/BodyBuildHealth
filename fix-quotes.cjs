var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");

// Fix unescaped single quotes in name fields
// The apostrophe in names like "Lugol's" and "Lion's" needs to be escaped
d = d.replace(/name: 'Lugol's Iodine'/g, "name: 'Lugol\\'s Iodine'");
d = d.replace(/name: 'Lion's Mane'/g, "name: 'Lion\\'s Mane'");
d = d.replace(/name: 'Liposomal Lion's Mane'/g, "name: 'Liposomal Lion\\'s Mane'");
d = d.replace(/name: 'Lion's Mane Full Spectrum'/g, "name: 'Lion\\'s Mane Full Spectrum'");
d = d.replace(/name: 'Lion's Mane Mycelium'/g, "name: 'Lion\\'s Mane Mycelium'");
d = d.replace(/name: 'Lion's Mane Premium'/g, "name: 'Lion\\'s Mane Premium'");

// Also fix in descriptions
d = d.replace(/Lion's/g, "Lion\\'s");
d = d.replace(/Lugol's/g, "Lugol\\'s");
d = d.replace(/2's/g, "2\\'s");
d = d.replace(/3's/g, "3\\'s");
d = d.replace(/6's/g, "6\\'s");

// Check for remaining unescaped quotes
var regex = /name: '[^']*'[^',\]}]/g;
var match;
var problems = [];
while ((match = regex.exec(d)) !== null) {
  problems.push(match[0]);
}
console.log("Potential quote problems:", problems.length);
problems.slice(0, 5).forEach(function(p) { console.log("  " + p.substring(0, 80)); });

fs.writeFileSync("src/data/support-database.ts", d, "utf8");
console.log("File saved!");

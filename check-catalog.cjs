var fs = require("fs");
var d = fs.readFileSync("src/ui/screens/SupportScreen.tsx", "utf8");

// Find the catalog view section
var catalogIdx = d.indexOf("infoView === 'catalog'");
console.log("Catalog view at:", catalogIdx);
if (catalogIdx > 0) {
  var sample = d.substring(catalogIdx, catalogIdx + 2000);
  console.log(sample.substring(0, 1500));
}

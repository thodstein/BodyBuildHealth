var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");
// Search for partial matches
var partials = ["IRON", "SELENIUM", "CHROMIUM", "ASHWAGANDHA", "LIONS_MANE", "MELATONIN", "CURCUMIN", "RESVERATROL", "CARNITINE", "CREATINE", "MAG_CITRATE", "MAG_GLYCINATE", "MAG_THREONATE"];
partials.forEach(function(p) {
  var regex = new RegExp("id: '[^']*" + p + "[^']*'", "g");
  var matches = [];
  var m;
  while ((m = regex.exec(d)) !== null) {
    matches.push(m[0]);
  }
  if (matches.length === 0) {
    console.log(p + ": NOT FOUND");
  } else {
    console.log(p + ": " + matches.join(", "));
  }
});

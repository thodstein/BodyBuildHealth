var fs = require("fs");
var d = fs.readFileSync("src/data/support-database.ts", "utf8");
var ids = ["MIN_IRON_BISGLYCINATE", "MIN_SELENIUM", "MIN_CHROMIUM_PICOLINATE", "AD_ASHWAGANDHA", "FUNG_LIONS_MANE", "HORM_MELATONIN", "PP_CURCUMIN", "PP_RESVERATROL", "AA_L_CARNITINE", "AA_CREATINE"];
ids.forEach(function(id) {
  var idx = d.indexOf(id);
  if (idx < 0) {
    console.log(id + ": NOT FOUND AT ALL");
  } else {
    console.log(id + ": FOUND at " + idx + " context: " + d.substring(idx - 5, idx + id.length + 50));
  }
});

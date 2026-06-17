const f = require("fs").readFileSync("src/data/canonical-map.ts", "utf8");
// Change the canonical ID from 5htp to x5htp to match the catalog
const fixed = f.replace(/"5htp"/g, '"x5htp"');
require("fs").writeFileSync("src/data/canonical-map.ts", fixed, "utf-8");
console.log("Fixed 5htp -> x5htp in canonical map");
const f = require("fs").readFileSync("src/data/support-catalog.ts", "utf8");
const fixed = f.replace(/^  5htp:/m, "  x5htp:").replace(/id: '5htp'/g, "id: 'x5htp'");
require("fs").writeFileSync("src/data/support-catalog.ts", fixed, "utf-8");
console.log("Fixed 5htp -> x5htp");
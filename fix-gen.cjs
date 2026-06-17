const f = require("fs").readFileSync("gen-all-missing.cjs", "utf8");
const lines = f.split("\n");
lines[11] = "  const formsInput = Array.isArray(forms) ? forms : (typeof forms === 'string' ? [forms] : [nameRu + ' ' + (mg >= 1000 ? (mg/1000) + ' г' : mg < 1 ? (mg*1000) + ' мкг' : mg + ' мг')]);";
require("fs").writeFileSync("gen-all-missing.cjs", lines.join("\n"), "utf-8");
console.log("Fixed line 11");
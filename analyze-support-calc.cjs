var fs = require("fs");
var d = fs.readFileSync("src/ui/screens/SupportScreen.tsx", "utf8");

// Find the calculator tab section
var calcIdx = d.indexOf("tab === 'calculator'");
console.log("Calculator tab at:", calcIdx);

// Find what the calculator tab renders
var sample = d.substring(calcIdx, calcIdx + 3000);
console.log(sample.substring(0, 2000));

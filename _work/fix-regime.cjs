const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "engines", "meal-tier-generator.engine.ts");
let c = fs.readFileSync(filePath, "utf8");

const newFunc = fs.readFileSync(path.join(__dirname, "regime-func.txt"), "utf8");

const funcStart = c.indexOf("export function generateRegimeAdvice(goal: MealGoal, trainingDaysPerWeek: number, weightKg: number, labsContext");
if (funcStart < 0) {
  console.log("ERROR: Could not find generateRegimeAdvice");
  process.exit(1);
}

let braceCount = 0;
let funcEnd = -1;
let started = false;
for (let i = funcStart; i < c.length; i++) {
  if (c[i] === "{") { braceCount++; started = true; }
  if (c[i] === "}") { braceCount--; }
  if (started && braceCount === 0) { funcEnd = i + 1; break; }
}

c = c.substring(0, funcStart) + newFunc + c.substring(funcEnd);

fs.writeFileSync(filePath, c, "utf8");
console.log("generateRegimeAdvice rewritten from regime-func.txt");

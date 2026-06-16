const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the broken patterns using character codes
// Pattern: border:1px solid `\n                background:jointMode
// The backticks are char code 96

// Search for: border:1px solid `,
// Which in bytes is: 98 6F 72 64 65 72 3A 60 31 70 78 20 73 6F 6C 69 64 20 60 60 2C

const brokenJoint = 'border:1px solid \x60\x60,\n                background:jointMode';
const fixedJoint = "border: (jointMode ? '1px solid #8b5cf6' : '1px solid var(--border)'),\n                background:jointMode";

const brokenBoost = 'border:1px solid \x60\x60,\n                background:boostEnabled';
const fixedBoost = "border: (boostEnabled ? '1px solid #ef4444' : '1px solid var(--border)'),\n                background:boostEnabled";

let fixCount = 0;

if (content.includes(brokenJoint)) {
  content = content.replaceAll(brokenJoint, fixedJoint);
  fixCount++;
}

if (content.includes(brokenBoost)) {
  content = content.replaceAll(brokenBoost, fixedBoost);
  fixCount++;
}

// Also fix the second occurrence pattern (different whitespace - might have \r\n)
const brokenJointCRLF = 'border:1px solid \x60\x60,\r\n                background:jointMode';
const brokenBoostCRLF = 'border:1px solid \x60\x60,\r\n                background:boostEnabled';

if (content.includes(brokenJointCRLF)) {
  content = content.replaceAll(brokenJointCRLF, fixedJoint);
  fixCount++;
}

if (content.includes(brokenBoostCRLF)) {
  content = content.replaceAll(brokenBoostCRLF, fixedBoost);
  fixCount++;
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ' + fixCount + ' broken template literals');

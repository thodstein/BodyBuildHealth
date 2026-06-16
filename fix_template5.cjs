const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// The broken patterns are: border:1px solid `,
// Which appears as: border:BACKTICK1px solid BACKTICKBACKTICK,
// In the file the actual chars are: border:1px solid `,
// The fix is to replace with ternary expression

// Replace all occurrences of the broken pattern
// We need to determine context (jointMode vs boostEnabled)

let fixes = 0;

// Find all occurrences of the broken border pattern
const brokenPattern = 'border:1px solid \x60\x60,';
let searchIdx = 0;
while (true) {
  const idx = content.indexOf(brokenPattern, searchIdx);
  if (idx < 0) break;
  
  // Look ahead for context
  const afterText = content.substring(idx, idx + 200);
  if (afterText.includes('jointMode')) {
    // Replace with proper ternary
    content = content.substring(0, idx) + "border: (jointMode ? '1px solid #8b5cf6' : '1px solid var(--border)')," + content.substring(idx + brokenPattern.length);
    fixes++;
  } else if (afterText.includes('boostEnabled')) {
    content = content.substring(0, idx) + "border: (boostEnabled ? '1px solid #ef4444' : '1px solid var(--border)')," + content.substring(idx + brokenPattern.length);
    fixes++;
  }
  searchIdx = idx + 100;
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ' + fixes + ' broken template literals');

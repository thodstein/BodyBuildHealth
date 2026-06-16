const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find and fix the broken border template literals
// The broken pattern is: border:1px solid `,
// The backtick-backtick is what's left after JS consumed the template interpolation

// First occurrence (joint mode button - near "Рассчитать поддержку")
// Search for the broken pattern followed by "background:jointMode"
const broken1idx = content.indexOf('border:1px solid \x60\x60,');
let fixed = 0;
let searchFrom = 0;
while (true) {
  const idx = content.indexOf('border:1px solid \x60\x60,', searchFrom);
  if (idx < 0) break;
  
  // Check which button it belongs to by looking at nearby text
  const context = content.substring(Math.max(0, idx - 200), idx + 200);
  if (context.includes('jointMode')) {
    content = content.substring(0, idx) + "border: (jointMode ? '1px solid #8b5cf6' : '1px solid var(--border)')" + content.substring(idx + 'border:1px solid \x60\x60,'.length);
    fixed++;
  } else if (context.includes('boostEnabled')) {
    content = content.substring(0, idx) + "border: (boostEnabled ? '1px solid #ef4444' : '1px solid var(--border)')" + content.substring(idx + 'border:1px solid \x60\x60,'.length);
    fixed++;
  }
  searchFrom = idx + 100;
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ' + fixed + ' broken template literals');

const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find and fix the broken template literals in the joint/boost buttons
// The pattern has: border:1px solid `,
// Should be: border:1px solid  + (jointMode ? '#8b5cf6' : 'var(--border)') + `,

// Actually, in TSX we should use a computed value, not template literal in style prop
// Let's just replace the border with a ternary expression which works in TSX

// Fix all instances of broken template literal borders
// Pattern 1: border:1px solid `,
content = content.replace(/border:1px solid `,\s*\n\s*background:jointMode/g, 
  "border: (jointMode ? '1px solid #8b5cf6' : '1px solid var(--border)'),\n                background:jointMode");

content = content.replace(/border:1px solid `,\s*\n\s*background:boostEnabled/g, 
  "border: (boostEnabled ? '1px solid #ef4444' : '1px solid var(--border)'),\n                background:boostEnabled");

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed template literals in buttons');

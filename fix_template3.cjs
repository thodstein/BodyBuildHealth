const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the two broken template literal borders
// Pattern: border:1px solid `,
// This means the ${...} part was eaten by JS template literal evaluation
// We need to replace with proper TSX: border: (jointMode ? '1px solid #8b5cf6' : '1px solid var(--border)')

// Find each occurrence and fix based on context
let count = 0;

// Fix joint border - find the pattern "border:1px solid `,\n                background:jointMode"
const jointPattern = /border:1px solid `,\s*\n\s*background:jointMode/;
if (jointPattern.test(content)) {
  content = content.replace(jointPattern, "border: (jointMode ? '1px solid #8b5cf6' : '1px solid var(--border)'),\n                background:jointMode");
  count++;
}

// Fix boost border - find the pattern "border:1px solid `,\n                background:boostEnabled"
const boostPattern = /border:1px solid `,\s*\n\s*background:boostEnabled/;
if (boostPattern.test(content)) {
  content = content.replace(boostPattern, "border: (boostEnabled ? '1px solid #ef4444' : '1px solid var(--border)'),\n                background:boostEnabled");
  count++;
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ' + count + ' broken template literals');

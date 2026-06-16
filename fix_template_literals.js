const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix broken border patterns for joint button
content = content.replace(
  /border:1px solid ,\s*\n\s*background:jointMode\?/g,
  "border:`1px solid ${jointMode?'#8b5cf6':'var(--border)'}`,\n                background:jointMode?"
);

// Fix broken border patterns for boost button  
content = content.replace(
  /border:1px solid ,\s*\n\s*background:boostEnabled\?/g,
  "border:`1px solid ${boostEnabled?'#ef4444':'var(--border)'}`,\n                background:boostEnabled?"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed template literals');

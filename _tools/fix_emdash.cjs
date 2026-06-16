const fs = require('fs');
let content = fs.readFileSync('src/data/support-database.ts', 'utf8');
// Fix the broken em-dash - replace the literal em-dash character with a string
content = content.replace("if (!id) return \u2014;", "if (!id) return '\u2014';");
// Remove duplicate comment
content = content.replace(
  '/** Get human-readable label for a substance ID */\n/** Get human-readable label for a substance ID, using canonical names */',
  '/** Get human-readable label for a substance ID, using canonical names */'
);
fs.writeFileSync('src/data/support-database.ts', content);
console.log('Fixed em-dash and duplicate comment');

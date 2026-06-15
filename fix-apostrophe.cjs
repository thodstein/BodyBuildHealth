var fs = require('fs');
var d = fs.readFileSync('src/data/support-database.ts', 'utf8');

// Replace mojibake apostrophe patterns
// The pattern вЂ(TM) or вЂ(smth) is double-encoded UTF-8
// We need to replace these with their decoded equivalents

// вЂ(TM) = right single quotation mark / apostrophe
d = d.replace(/\u0432\u2019/g, "'");  
d = d.replace(/\u0432\u2018/g, "'");

// Count remaining bad patterns
var re = /\u0432[\u0402\u0403\u0453]/g;
var count = 0;
while (re.exec(d)) count++;
console.log('Remaining bad patterns: ' + count);

fs.writeFileSync('src/data/support-database.ts', d, 'utf8');
console.log('File saved! Size: ' + d.length);

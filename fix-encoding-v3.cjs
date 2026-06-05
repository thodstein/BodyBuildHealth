const fs = require('fs');
const iconv = require('iconv-lite');

// Read file as raw bytes
const filePath = 'D:/V9/src/ui/screens/PlanScreen.tsx';
let content = fs.readFileSync(filePath);

// First, remove BOM if present
if (content.length > 3 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
  content = content.slice(3);
}

// The content was originally Windows-1251 Cyrillic
// But was incorrectly read/encoded as UTF-8
// We need to reinterpret the bytes as Windows-1251
let str = content.toString('binary'); // Get raw bytes as Latin1 (preserves byte values)
let win1251Buffer = Buffer.from(str, 'latin1'); // These are actually Windows-1251 bytes

// Now decode as Windows-1251 to get proper Cyrillic
let correctCyrillic = iconv.decode(win1251Buffer, 'win1251');

console.log('First 200 chars of correctly decoded text:');
console.log(correctCyrillic.substring(0, 200));

// Save back as proper UTF-8
fs.writeFileSync(filePath, correctCyrillic, 'utf8');
console.log('\nFile saved with proper encoding!');

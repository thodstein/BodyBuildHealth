// fix-mojibake.cjs - Decodes all mojibake strings in support-database.ts
const iconv = require('iconv-lite');
const fs = require('fs');

console.log('Reading file...');
const d = fs.readFileSync('src/data/support-database.ts', 'utf8');
console.log('File size:', d.length, 'chars');

// Mojibake detection: chars that appear in CP1251 double-encoding
// U+2018, U+2019 (smart quotes), U+201A, U+201C, U+201D, U+2026 (ellipsis)
// These appear in mojibake but are rare in normal TS source code
const mojibakeIndicator = /[\u2018\u2019\u201A\u201C\u201D\u2026\u2013\u2014\u00AB\u00BB]/;

// Also detect by looking for sequences of Cyrillic-looking chars mixed with these
// A more reliable indicator: Р (U+0420) followed by a char that's NOT a Cyrillic letter
// In mojibake, Р (U+0420) is the CP1251 encoding of byte 0xD0
// and is followed by byte 0x80-0xBF encoded as CP1251 chars

function hasMojibake(str) {
  // Check for CP1251 double-encoding artifacts
  // The most reliable indicator: Р followed by special chars like ' (U+2019) 
  // or С followed by special chars
  if (/[\u0420\u0421][\u0400-\u04FF\u2018\u2019\u201A\u201C\u201D\u2026\u2013\u2014\u00A0-\u00FF]/.test(str)) {
    return true;
  }
  // Also check for strings that are pure mojibake (no Latin mixed in)
  if (/^\s*[\u0400-\u04FF\u2018\u2019\u201A\u201C\u201D\u2026\u2013\u2014\u00AB\u00BB\u00A0-\u00FF\s]+\s*$/.test(str) && str.length > 5) {
    return true;
  }
  return false;
}

function decodeMojibake(str) {
  try {
    const decoded = iconv.encode(str, 'win1251').toString('utf8');
    // Verify: decoded should contain proper Russian chars
    if (/[а-яА-ЯёЁ]/.test(decoded)) {
      return decoded;
    }
    return str; // Return original if decoding doesn't produce Russian
  } catch(e) {
    return str; // Return original on error
  }
}

// Find all string values in single quotes
let result = d;
let replaced = 0;
let failed = 0;

// Match: 'content' where content contains mojibake
const stringRegex = /'([^']*?)'/g;
let match;

const replacements = [];
while ((match = stringRegex.exec(d)) !== null) {
  const val = match[1];
  if (val.length < 3) continue; // Skip very short strings
  if (!hasMojibake(val)) continue; // Skip non-mojibake strings
  
  const decoded = decodeMojibake(val);
  if (decoded !== val) {
    // Need to escape any single quotes in decoded string
    const escaped = decoded.replace(/'/g, "\\'");
    replacements.push({
      original: match[0],
      replacement: "'" + escaped + "'",
      pos: match.index
    });
    replaced++;
  } else {
    failed++;
  }
}

console.log('Mojibake strings found:', replaced + failed);
console.log('Successfully decoded:', replaced);
console.log('Failed to decode:', failed);

// Apply replacements in reverse order to preserve positions
replacements.sort((a, b) => b.pos - a.pos);
for (const r of replacements) {
  result = result.substring(0, r.pos) + r.replacement + result.substring(r.pos + r.original.length);
}

// Write the result
console.log('Writing file...');
fs.writeFileSync('src/data/support-database.ts', result, 'utf8');
console.log('Done! File updated.');
console.log('New file size:', result.length, 'chars');

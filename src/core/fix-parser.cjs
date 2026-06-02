const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'lab-auto-parser.ts');
let content = fs.readFileSync(filePath, 'utf8');
// Function to deduplicate a Record<string, string> literal
function deduplicateRecord(text) {
  // Find the start and end of the MARKER_ALIASES object
  const markerStart = text.indexOf('const MARKER_ALIASES: Record<string, string> = {');
  if (markerStart === -1) return text;
  let braceCount = 0;
  let i = markerStart + 'const MARKER_ALIASES: Record<string, string> = {'.length;
  let start = i;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') braceCount++;
    if (ch === '}') {
      if (braceCount === 0) {
        // end of object
        const end = i;
        const objectText = text.slice(start, end);
        // Parse the object text as JS object (since it's a simple literal)
        // We'll use Function to parse, but safer: we can extract key-value pairs via regex.
        // Instead, we'll just remove duplicates by splitting lines and using a map.
        const lines = objectText.split(/,\\s*/);
        const seen = new Set();
        const uniqueLines = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Match key: value
          const match = trimmed.match(/^['\"]([^'\"]+)['\"]:\\s*(['\"][^'\"]+['\"])/);
          if (match) {
            const key = match[1];
            if (!seen.has(key)) {
              seen.add(key);
              uniqueLines.push(line);
            }
          } else {
            // If line doesn't match pattern, keep it as is (shouldn't happen)
            uniqueLines.push(line);
          }
        }
        const newObject = uniqueLines.join(', ');
        const newText = text.slice(0, start) + newObject + text.slice(end);
        return newText;
      } else {
        braceCount--;
      }
    }
  }
  return text;
}
content = deduplicateRecord(content);
// Similarly for UNIT_ALIASES
function deduplicateUnitRecord(text) {
  const markerStart = text.indexOf('const UNIT_ALIASES: Record<string, string> = {');
  if (markerStart === -1) return text;
  let braceCount = 0;
  let i = markerStart + 'const UNIT_ALIASES: Record<string, string> = {'.length;
  let start = i;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') braceCount++;
    if (ch === '}') {
      if (braceCount === 0) {
        const end = i;
        const objectText = text.slice(start, end);
        const lines = objectText.split(/,\\s*/);
        const seen = new Set();
        const uniqueLines = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const match = trimmed.match(/^['\"]([^'\"]+)['\"]:\\s*(['\"][^'\"]+['\"])/);
          if (match) {
            const key = match[1];
            if (!seen.has(key)) {
              seen.add(key);
              uniqueLines.push(line);
            }
          } else {
            uniqueLines.push(line);
          }
        }
        const newObject = uniqueLines.join(', ');
        const newText = text.slice(0, start) + newObject + text.slice(end);
        return newText;
      } else {
        braceCount--;
      }
    }
  }
  return text;
}
content = deduplicateUnitRecord(content);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Processed lab-auto-parser.ts');

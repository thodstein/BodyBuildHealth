const fs = require('fs');

function fixFile(file) {
  try {
    // Read as binary to get raw bytes
    let content = fs.readFileSync(file);
    
    // Remove BOM if present
    if (content.length > 3 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
      content = content.slice(3);
    }
    
    // Convert from Windows-1251 to UTF-8
    // The file was saved as Windows-1251 but is being read as UTF-8
    let str = content.toString('latin1'); // latin1 preserves byte values
    let utf8 = Buffer.from(str, 'latin1'); // This is actually the Windows-1251 bytes
    
    // Try to decode as Windows-1251
    // We need to use iconv if available, or manual conversion
    console.log('Processing:', file, 'Size:', utf8.length);
    
    fs.writeFileSync(file, utf8, 'utf8');
  } catch(e) {
    console.log('Error:', file, e.message);
  }
}

// List of files with Cyrillic that need fixing
const files = [
  'src/engines/training.engine.ts',
  'src/engines/training-periodization.engine.ts',
  'src/engines/split-selector.engine.ts',
  'src/engines/rir-matrix.engine.ts',
  'src/engines/progression.engine.ts',
  'src/ui/screens/PlanScreen.tsx',
  'src/core/exercise-catalog.ts',
  'src/engines/support.engine.ts',
  'src/engines/risk.engine.ts',
  'src/core/constants.ts',
  'src/core/risk-info.ts',
  'src/core/pharma-database.ts',
  'src/core/nutrition-database.ts',
  'src/core/data-link.ts',
  'src/core/types.ts',
];

files.forEach(f => {
  let path = 'D:/V9/' + f;
  if (fs.existsSync(path)) {
    fixFile(path);
  } else {
    console.log('Not found:', path);
  }
});

console.log('Done!');

const fs = require('fs');
const iconv = require('iconv-lite');

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath);
    
    // Remove BOM if present
    if (content.length > 3 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
      content = content.slice(3);
    }
    
    // Convert: reinterpret bytes from misencoded format to proper Windows-1251
    let str = content.toString('binary'); // Get raw bytes as Latin1 (preserves byte values)
    let win1251Buffer = Buffer.from(str, 'latin1'); // These are actually Windows-1251 bytes
    
    // Decode as Windows-1251 to get proper Cyrillic
    let correctCyrillic = iconv.decode(win1251Buffer, 'win1251');
    
    // Save back as proper UTF-8
    fs.writeFileSync(filePath, correctCyrillic, 'utf8');
    console.log('Fixed:', filePath);
  } catch(e) {
    console.log('Error processing:', filePath, e.message);
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
  let filePath = 'D:/V9/' + f;
  if (fs.existsSync(filePath)) {
    fixFile(filePath);
  } else {
    console.log('Not found:', filePath);
  }
});

console.log('\nDone!');

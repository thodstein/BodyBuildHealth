const fs = require('fs');
const p = 'D:\\BodyBuildHealth\\src\\core\\ocr-engine.ts';
let c = fs.readFileSync(p, 'utf8');

// Fix the image processing branch - parseLabFile should be awaited, and parseLabText is sync
c = c.replace(
  `        // Try to parse as lab results
        const labResult = parseLabFile(file);
        // Since parseLabFile is async and we already have text, parse directly
        const { parseLabText } = await import('../engines/pdf-parser.engine');
        const parsed = parseLabText(rawText);`,
  `        // Parse the OCR text directly (parseLabText is sync)
        const { parseLabText } = await import('../engines/pdf-parser.engine');
        const parsed = parseLabText(rawText);`
);

fs.writeFileSync(p, c, 'utf8');
console.log('Fixed ocr-engine. Length:', c.length);

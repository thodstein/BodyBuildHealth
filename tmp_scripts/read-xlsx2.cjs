const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('D:/Documents/Тренировки/Новая папка (2)/Поддержка (ЩЗ+Железо транспорт).xlsx');
// XLSX is a ZIP file (PK header)
const AdmZip = require('adm-zip');
try {
  const zip = new AdmZip(buf);
  // Read shared strings
  const ssEntry = zip.getEntry('xl/sharedStrings.xml');
  if (ssEntry) {
    const ssXml = ssEntry.getData().toString('utf8');
    const texts = [...ssXml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)];
    console.log('=== Shared Strings ===');
    texts.forEach((m, i) => {
      const t = m[1].trim();
      if (t) console.log(`  [${i}] ${t}`);
    });
  }
  // Read sheet1
  const sheetEntry = zip.getEntry('xl/worksheets/sheet1.xml');
  if (sheetEntry) {
    const sheetXml = sheetEntry.getData().toString('utf8');
    console.log('\n=== Sheet 1 XML (first 3000 chars) ===');
    console.log(sheetXml.slice(0, 3000));
  }
} catch(e) {
  console.log('adm-zip failed:', e.message);
  // try without adm-zip
  console.log('File header: ' + buf.slice(0, 4).toString('hex'));
}

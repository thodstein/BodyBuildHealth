try {
  const X = require('xlsx');
  const w = X.readFile('D:/Documents/Тренировки/Новая папка (2)/Поддержка (ЩЗ+Железо транспорт).xlsx');
  console.log('Sheets:', w.SheetNames);
  for (const s of w.SheetNames) {
    const d = X.utils.sheet_to_json(w.Sheets[s]);
    console.log('\n=== ' + s + ' ===');
    console.log(JSON.stringify(d, null, 2).slice(0, 15000));
  }
} catch(e) {
  console.log('xlsx not installed:', e.message);
  // Fallback: read as zip and try to extract XML
  try {
    const fs = require('fs');
    const buf = fs.readFileSync('D:/Documents/Тренировки/Новая папка (2)/Поддержка (ЩЗ+Железо транспорт).xlsx');
    console.log('File size:', buf.length);
    // Try to extract shared strings
    const text = buf.toString('latin1');
    // Find text between <t> tags
    const matches = [...text.matchAll(/<t[^>]*>([^<]+)<\/t>/g)];
    console.log('\nText content found:');
    matches.forEach((m, i) => console.log(`  ${m[1]}`));
    if (matches.length === 0) {
      // Try utf16
      const text2 = buf.toString('utf16le');
      const matches2 = [...text2.matchAll(/<t[^>]*>([^<]+)<\/t>/g)];
      console.log('\nUTF16 text content:');
      matches2.forEach((m, i) => console.log(`  ${m[1]}`));
    }
  } catch(e2) {
    console.log('Fallback also failed:', e2.message);
  }
}

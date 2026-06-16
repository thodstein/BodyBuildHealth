try {
  const X = require('xlsx');
  const w = X.readFile('D:/Documents/Тренировки/Новая папка (2)/Поддержка (ЩЗ+Железо транспорт).xlsx');
  console.log('Sheets:', w.SheetNames);
  for (const s of w.SheetNames) {
    const d = X.utils.sheet_to_json(w.Sheets[s]);
    console.log(s + ': ' + JSON.stringify(d, null, 1).slice(0, 10000));
  }
} catch(e) {
  console.log('xlsx not available, msg:', e.message);
  const fs = require('fs');
  const buf = fs.readFileSync('D:/Documents/Тренировки/Новая папка (2)/Поддержка (ЩЗ+Железо транспорт).xlsx');
  console.log('File size:', buf.length);
  // Try to extract text
  const str = buf.toString('utf8');
  console.log('Content sample:', str.slice(0, 2000));
}

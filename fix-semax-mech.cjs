var fs = require('fs');
var buf = fs.readFileSync('src/engines/support.engine.ts');

// Find the mechanism value for semax+selank
var searchStr = "substanceA: 'semax'";
var searchBuf = Buffer.from(searchStr, 'utf8');
var semaxPos = -1;
for (var i = 0; i < buf.length - searchBuf.length; i++) {
  var found = true;
  for (var j = 0; j < searchBuf.length; j++) {
    if (buf[i + j] !== searchBuf[j]) { found = false; break; }
  }
  if (found) { semaxPos = i; break; }
}

var mechPrefix = Buffer.from("mechanism: '", 'utf8');
var mechPos = -1;
for (var i = semaxPos; i < buf.length - mechPrefix.length; i++) {
  var found = true;
  for (var j = 0; j < mechPrefix.length; j++) {
    if (buf[i + j] !== mechPrefix[j]) { found = false; break; }
  }
  if (found) { mechPos = i; break; }
}

var mechValueStart = mechPos + mechPrefix.length;
var mechValueEnd = -1;
for (var i = mechValueStart; i < buf.length; i++) {
  if (buf[i] === 0x27) { mechValueEnd = i; break; }
}

console.log('Old value length:', mechValueEnd - mechValueStart);

// New mechanism text - using Unicode escapes to avoid encoding issues
var newValue = '\u0421\u0435\u043C\u0430\u043A\u0441 (BDNF-\u0441\u0442\u0438\u043C\u0443\u043B\u044F\u0446\u0438\u044F, \u043D\u0435\u0439\u0440\u043E\u043F\u0440\u043E\u0442\u0435\u043A\u0446\u0438\u044F \u0447\u0435\u0440\u0435\u0437 TrkB-\u0440\u0435\u0446\u0435\u043F\u0442\u043E\u0440\u044B) + \u0421\u0435\u043B\u0430\u043D\u043A (\u044D\u043D\u0434\u043E\u0440\u0444\u0438\u043D-\u043C\u043E\u0434\u0443\u043B\u044F\u0446\u0438\u044F, \u0430\u043D\u043A\u0441\u0438\u043E\u043B\u0438\u0442\u0438\u043A \u0447\u0435\u0440\u0435\u0437 GABA-\u0441\u0438\u0441\u0442\u0435\u043C\u0443) = \u0441\u0438\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043D\u0435\u0439\u0440\u043E\u043F\u0440\u043E\u0442\u0435\u043A\u0446\u0438\u044F + \u0430\u043D\u0442\u0438\u0441\u0442\u0440\u0435\u0441\u0441. \u041A\u043E\u043C\u0431\u0438\u043D\u0430\u0446\u0438\u044F \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u043E\u0431\u0430 \u043F\u0443\u0442\u0438 \u043D\u0435\u0439\u0440\u043E\u043F\u0440\u043E\u0442\u0435\u043A\u0446\u0438\u0438: \u043D\u0435\u0439\u0440\u043E\u0442\u0440\u043E\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0439 (\u0421\u0435\u043C\u0430\u043A\u0441) \u0438 \u043D\u0435\u0439\u0440\u043E\u043C\u043E\u0434\u0443\u043B\u044F\u0442\u043E\u0440\u043D\u044B\u0439 (\u0421\u0435\u043B\u0430\u043D\u043A).';

var newBuf = Buffer.from(newValue, 'utf8');
console.log('New value length (bytes):', newBuf.length);

var newFile = Buffer.concat([
  buf.slice(0, mechValueStart),
  newBuf,
  buf.slice(mechValueEnd)
]);

console.log('New file size:', newFile.length);

// Verify
var verify = newFile.slice(mechValueStart, mechValueStart + newBuf.length).toString('utf8');
console.log('Verify:', verify.substring(0, 80));

fs.writeFileSync('src/engines/support.engine.ts', newFile);
console.log('File saved!');
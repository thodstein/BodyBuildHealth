const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the first calculate button ending
const searchPattern = '\u{1F9EE} \u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0443\n              </button>\n              {calcDone && calcResult && (';
const idx = content.indexOf(searchPattern);

if (idx < 0) {
  console.log('ERROR: Could not find pattern');
  process.exit(1);
}

console.log('Found first calc button at:', idx);

const bt = String.fromCharCode(96); // backtick
const insertText = '\n              <button onClick={() => { setJointMode(!jointMode); if (!jointMode) setBoostEnabled(false); calcSupport(); }}\n                style={{width:\'100%\',padding:10,borderRadius:8,marginTop:6,\n                border:' + bt + '1px solid ' + bt + '' + bt + ',\n                background:jointMode?\'rgba(139,92,246,0.1)\':\'var(--bg-secondary)\',\n                color:jointMode?\'#8b5cf6\':\'var(--text-dim)\',fontWeight:700,cursor:\'pointer\'}}>\n                \u{1F9B4} {jointMode ? \'\u2705 \u0420\u0435\u0436\u0438\u043C \u0441\u0443\u0441\u0442\u0430\u0432\u043E\u0432 \u0432\u043A\u043B\u044E\u0447\u0451\u043D\' : \'\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0443\u0441\u0442\u0430\u0432\u044B \u0438 \u0441\u0432\u044F\u0437\u043A\u0438\'}\n              </button>\n              <button onClick={() => { setBoostEnabled(!boostEnabled); if (!boostEnabled) setJointMode(false); calcSupport(); }}\n                style={{width:\'100%\',padding:10,borderRadius:8,marginTop:4,\n                border:' + bt + '1px solid ' + bt + '' + bt + ',\n                background:boostEnabled?\'rgba(239,68,68,0.1)\':\'var(--bg-secondary)\',\n                color:boostEnabled?\'#ef4444\':\'var(--text-dim)\',fontWeight:700,cursor:\'pointer\'}}>\n                \u{1F534} {boostEnabled ? \'\u2705 \u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435 \u0441\u0442\u0435\u043A\u0430 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E\' : \'\u0423\u0441\u0438\u043B\u0438\u0442\u044C \u0441\u0442\u0435\u043A (+20 \u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u043E\u0432)\'}\n              </button>\n';

const btnEndIdx = idx + searchPattern.indexOf('{calcDone');
content = content.substring(0, btnEndIdx) + insertText + content.substring(btnEndIdx);

fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS');

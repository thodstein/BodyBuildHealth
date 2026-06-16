const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the first "Рассчитать поддержку" button closing and the calcDone block after it
const searchPattern = 'Рассчитать поддержку\n              </button>\n              {calcDone && calcResult && (';
const idx = content.indexOf(searchPattern);

if (idx < 0) {
  console.log('ERROR: Could not find pattern');
  process.exit(1);
}

console.log('Found first calc button at:', idx);

// The text to insert between </button> and {calcDone
const backtick = '`';
const insertText = `
              <button onClick={() => { setJointMode(!jointMode); if (!jointMode) setBoostEnabled(false); calcSupport(); }}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:6,
                border:${backtick}1px solid ${jointMode?'#8b5cf6':'var(--border)'}${backtick},
                background:jointMode?'rgba(139,92,246,0.1)':'var(--bg-secondary)',
                color:jointMode?'#8b5cf6':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🦴 {jointMode ? '✅ Режим суставов включён' : 'Рассчитать суставы и связки'}
              </button>
              <button onClick={() => { setBoostEnabled(!boostEnabled); if (!boostEnabled) setJointMode(false); calcSupport(); }}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:4,
                border:${backtick}1px solid ${boostEnabled?'#ef4444':'var(--border)'}${backtick},
                background:boostEnabled?'rgba(239,68,68,0.1)':'var(--bg-secondary)',
                color:boostEnabled?'#ef4444':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🔴 {boostEnabled ? '✅ Усиление стека включено' : 'Усилить стек (+20 препаратов)'}
              </button>
`;

// Insert after </button> but before {calcDone
const btnEndIdx = idx + searchPattern.indexOf('{calcDone');
content = content.substring(0, btnEndIdx) + insertText + content.substring(btnEndIdx);

fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS: Added boost/joint buttons after first calculate button');

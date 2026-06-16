const fs = require('fs');
const path = 'D:\\\\BodyBuildHealth\\\\src\\\\ui\\\\screens\\\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the first occurrence of "Рассчитать поддержку\n              </button>"
// and add boost/joint buttons after it
const searchStr = \🧮 Рассчитать поддержку
              </button>
              {calcDone && calcResult && (\;

const replaceStr = \🧮 Рассчитать поддержку
              </button>
              <button onClick={() => { setJointMode(!jointMode); if (!jointMode) setBoostEnabled(false); calcSupport(); }}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:6,
                border:\\\\\,
                background:jointMode?'rgba(139,92,246,0.1)':'var(--bg-secondary)',
                color:jointMode?'#8b5cf6':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🦴 {jointMode ? '✅ Режим суставов включён' : 'Рассчитать суставы и связки'}
              </button>
              <button onClick={() => { setBoostEnabled(!boostEnabled); if (!boostEnabled) setJointMode(false); calcSupport(); }}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:4,
                border:\\\\\,
                background:boostEnabled?'rgba(239,68,68,0.1)':'var(--bg-secondary)',
                color:boostEnabled?'#ef4444':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🔴 {boostEnabled ? '✅ Усиление стека включено' : 'Усилить стек (+20 препаратов)'}
              </button>
              {calcDone && calcResult && (\;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added boost/joint buttons after first calculate button');
} else {
  console.log('ERROR: Could not find first calculate button pattern');
}

const fs = require('fs');
const path = 'D:\\BodyBuildHealth\\src\\ui\\screens\\SupportScreen.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the first "Рассчитать поддержку" button and add boost/joint buttons after it
// The pattern is: the button text followed by </button> followed by {calcDone && calcResult && (
const marker = '🧮 Рассчитать поддержку\n              </button>\n              {calcDone && calcResult && (';

const idx = content.indexOf(marker);
console.log('First calculate button pattern at:', idx);

if (idx >= 0) {
  const insertPoint = idx + marker.length - '{calcDone && calcResult && ('.length;
  
  const btnText = `
              <button onClick={() => { setJointMode(!jointMode); if (!jointMode) setBoostEnabled(false); calcSupport(); }}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:6,
                border:{jointMode?"1px solid #8b5cf6":"1px solid var(--border)"},
                background:jointMode?'rgba(139,92,246,0.1)':'var(--bg-secondary)',
                color:jointMode?'#8b5cf6':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🦴 {jointMode ? '✅ Режим суставов включён' : 'Рассчитать суставы и связки'}
              </button>
              <button onClick={() => { setBoostEnabled(!boostEnabled); if (!boostEnabled) setJointMode(false); calcSupport(); }}
                style={{width:'100%',padding:10,borderRadius:8,marginTop:4,
                border:{boostEnabled?"1px solid #ef4444":"1px solid var(--border)"},
                background:boostEnabled?'rgba(239,68,68,0.1)':'var(--bg-secondary)',
                color:boostEnabled?'#ef4444':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>
                🔴 {boostEnabled ? '✅ Усиление стека включено' : 'Усилить стек (+20 препаратов)'}
              </button>
`;
  // Replace the border placeholders with proper template literals
  const finalBtnText = btnText.replace(/{jointMode\?/g, '` + (jointMode?').replace(/:"1px solid #8b5cf6":"1px solid var\\(--border\\)"}/g, '') + '`').replace(/{boostEnabled\?/g, '` + (boostEnabled?').replace(/:"1px solid #ef4444":"1px solid var\\(--border\\)"}/g, '') + '`');
  
  // Actually, let me just use backtick template literals directly
  const btnJoint = "              <button onClick={() => { setJointMode(!jointMode); if (!jointMode) setBoostEnabled(false); calcSupport(); }}\n                style={{width:'100%',padding:10,borderRadius:8,marginTop:6,\n                border:`1px solid ${jointMode?'#8b5cf6':'var(--border)'}`,\n                background:jointMode?'rgba(139,92,246,0.1)':'var(--bg-secondary)',\n                color:jointMode?'#8b5cf6':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>\n                🦴 {jointMode ? '✅ Режим суставов включён' : 'Рассчитать суставы и связки'}\n              </button>\n              <button onClick={() => { setBoostEnabled(!boostEnabled); if (!boostEnabled) setJointMode(false); calcSupport(); }}\n                style={{width:'100%',padding:10,borderRadius:8,marginTop:4,\n                border:`1px solid ${boostEnabled?'#ef4444':'var(--border)'}`,\n                background:boostEnabled?'rgba(239,68,68,0.1)':'var(--bg-secondary)',\n                color:boostEnabled?'#ef4444':'var(--text-dim)',fontWeight:700,cursor:'pointer'}}>\n                🔴 {boostEnabled ? '✅ Усиление стека включено' : 'Усилить стек (+20 препаратов)'}\n              </button>\n";
  
  content = content.substring(0, idx + marker.indexOf('{calcDone')) + btnJoint + content.substring(idx + marker.indexOf('{calcDone'));
  
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS: Added boost/joint buttons after first calculate button');
} else {
  console.log('ERROR: Could not find first calculate button pattern');
}

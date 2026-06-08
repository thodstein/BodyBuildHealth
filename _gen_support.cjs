const fs = require('fs');

// ============ 3. Add "calculator" tab to SupportScreen ============
let supportScreen = fs.readFileSync('src/ui/screens/SupportScreen.tsx', 'utf8');

// Add SUPPORT_BASE_COVERAGE import
supportScreen = supportScreen.replace(
  "import { getRiskColor } from '../../core/utils/risk-colors';",
  "import { getRiskColor } from '../../core/utils/risk-colors';\nimport { SUPPORT_BASE_COVERAGE } from '../../core/constants';\nimport { SUBSTANCES_BY_CLASS, PHARMA_DB } from '../../core/pharma-database';"
);

// Change SupportTab type to include 'calculator'
supportScreen = supportScreen.replace(
  "type SupportTab = 'catalog' | 'synergies' | 'recommendations';",
  "type SupportTab = 'catalog' | 'synergies' | 'recommendations' | 'calculator';"
);

// Add supportLevel, prescribedMeds state variables (after existing state)
supportScreen = supportScreen.replace(
  "const [supportClassFilter, setSupportClassFilter] = useState<string>('all');",
  "const [supportClassFilter, setSupportClassFilter] = useState<string>('all');\n  const [supportLevel, setSupportLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');\n  const [prescribedMeds, setPrescribedMeds] = useState<Record<string, boolean>>({});"
);

// Add calculator tab button
supportScreen = supportScreen.replace(
  "t === 'catalog' ? '\u041a\u0430\u0442\u0430\u043b\u043e\u0433' : t === 'synergies' ? '\u0421\u0438\u043d\u0435\u0440\u0433\u0438\u0438' : '\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438'",
  "t === 'catalog' ? '\u041a\u0430\u0442\u0430\u043b\u043e\u0433' : t === 'synergies' ? '\u0421\u0438\u043d\u0435\u0440\u0433\u0438\u0438' : t === 'recommendations' ? '\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0438' : '\u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440'"
);

// Add calculator tab content before the closing </div> of the last tab section
const calculatorTabContent = `
      {tab === 'calculator' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>\uD83D\uDD22 \u041a\u0430\u043b\u044c\u043a\u0443\u043b\u044f\u0442\u043e\u0440 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0437\u0430\u0449\u0438\u0442\u044b \u0438 \u043e\u0442\u043c\u0435\u0442\u044c\u0442\u0435 \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u044b \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u0442\u0435</p>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {(['basic', 'standard', 'enhanced', 'maximum'] as const).map(level => (
                <button key={level} onClick={() => setSupportLevel(level)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: supportLevel === level ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: supportLevel === level ? '#000' : 'var(--text-dim)',
                  border: supportLevel === level ? '1px solid var(--accent)' : '1px solid var(--border)',
                }}>
                  {level === 'basic' ? '\u0411\u0430\u0437\u043e\u0432\u044b\u0439' : level === 'standard' ? '\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442' : level === 'enhanced' ? '\u0423\u0441\u0438\u043b\u0435\u043d\u043d\u044b\u0439' : '\u041c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
              \u041e\u0442\u043c\u0435\u0442\u044c\u0442\u0435 \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u044b \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u0442\u0435:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(SUPPORT_BASE_COVERAGE).map(([sub, effects]) => (
                <button key={sub} onClick={() => setPrescribedMeds(prev => ({ ...prev, [sub]: !prev[sub] }))} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  background: prescribedMeds[sub] ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                  border: prescribedMeds[sub] ? '1px solid var(--accent)' : '1px solid var(--border)',
                  color: prescribedMeds[sub] ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: prescribedMeds[sub] ? 600 : 400,
                }}>
                  {prescribedMeds[sub] ? '\u2713 ' : ''}{sub}
                </button>
              ))}
            </div>
            {Object.keys(prescribedMeds).filter(k => prescribedMeds[k]).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 12, margin: '0 0 6px' }}>\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435 \u043f\u043e \u0441\u0438\u0441\u0442\u0435\u043c\u0430\u043c:</h4>
                {RISK_SYSTEMS.map(sys => {
                  const coverage = Object.entries(SUPPORT_BASE_COVERAGE).reduce((acc, [sub, effects]) => {
                    if (!prescribedMeds[sub]) return acc;
                    for (const [key, val] of Object.entries(effects)) {
                      if (key.startsWith(sys + '_')) {
                        acc = Math.min(1, acc + (val as number));
                      }
                    }
                    return acc;
                  }, 0);
                  if (coverage <= 0) return null;
                  return (
                    <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, minWidth: 80 }}>{systemLabels[sys]}</span>
                      <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: Math.round(coverage * 100) + '%', height: '100%', background: coverage > 0.5 ? 'var(--accent)' : '#eab308', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>{Math.round(coverage * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {supportResult && (
            <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>\u0418\u043d\u0434\u0435\u043a\u0441 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: getRiskColor(100 - supportResult.score) }}>{Math.round(supportResult.score)}%</div>
            </div>
          )}
          <button onClick={handleCalculateSupport} style={{
            width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 14,
          }}>\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u0442\u044c \u043e\u043f\u0442\u0438\u043c\u0430\u043b\u044c\u043d\u0443\u044e \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0443</button>
        </div>
      )}
`;

// Insert before the closing </div> of the component
supportScreen = supportScreen.replace(
  '    </div>\n  );\n};',
  calculatorTabContent + '\n    </div>\n  );\n};'
);

fs.writeFileSync('src/ui/screens/SupportScreen.tsx', supportScreen, 'utf8');
console.log('SupportScreen updated with calculator tab');

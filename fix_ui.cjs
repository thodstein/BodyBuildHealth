const fs = require('fs');

// Fix PharmaScreen tab bar for mobile
const pharmaPath = 'D:\\BodyBuildHealth\\src\\ui\\screens\\PharmaScreen.tsx';
let pharma = fs.readFileSync(pharmaPath, 'utf8');

// Change the tab bar to be scrollable on mobile and use compact labels
pharma = pharma.replace(
  `      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {([
          ['catalog', 'Каталог'],
          ['pkpd', 'PK/PD'],
          ['dosage', 'Дозировка'],
          ['interactions', 'Взаимодействия'],
          ['course', 'Мой курс'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={\`btn\${tab === key ? ' active' : ''}\`}
            style={{ fontSize: 12, padding: '10px 14px', whiteSpace: 'nowrap' }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>`,
  `      <div className="tab-bar" style={{ marginBottom: 8 }}>
        {([
          ['catalog', '\u{1F4D6} Каталог'],
          ['pkpd', '\u{2699}\uFE0F PK/PD'],
          ['dosage', '\u{1F4CA} Доза'],
          ['interactions', '\u26A1 Взаимод.'],
          ['course', '\u{1F48A} Курс'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={\`tab-btn \${tab === key ? 'active' : ''}\`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>`
);

fs.writeFileSync(pharmaPath, pharma, 'utf8');
console.log('PharmaScreen updated. Length:', pharma.length);

// Fix RiskMatrix for mobile - make the table responsive
const matrixPath = 'D:\\BodyBuildHealth\\src\\ui\\screens\\RiskScreen_parts\\RiskMatrix.tsx';
let matrix = fs.readFileSync(matrixPath, 'utf8');

// Replace the matrix table grid with a more mobile-friendly layout
// Change from 6-column grid to card-based view for mobile
matrix = matrix.replace(
  `            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.5fr 0.5fr 0.5fr 0.8fr', gap: 4, marginBottom: 4, fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>
              <div>Механизм</div>
              <div>Система</div>
              <div>Raw</div>
              <div>Net</div>
              <div>Защита</div>
              <div>Статус</div>
            </div>

            {/* Table rows */}
            {rows.map((row) => (
              <div key={row.mechanismKey} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.5fr 0.5fr 0.5fr 0.8fr', gap: 4, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{row.mechanismLabel}</div>
                  {row.mechanismDescription && (
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.mechanismDescription.substring(0, 60)}...
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11 }}>{row.systemLabel}</div>
                <div style={{ background: getCellColor(row.raw), borderRadius: 4, padding: '2px 4px', textAlign: 'center', fontWeight: 600 }}>{Math.round(row.raw)}%</div>
                <div style={{ background: getCellColor(row.net), borderRadius: 4, padding: '2px 4px', textAlign: 'center', fontWeight: 600, color: getTextColor(row.net) }}>{Math.round(row.net)}%</div>
                <div style={{ textAlign: 'center', color: row.coverage > 0.5 ? '#22c55e' : 'var(--text-dim)' }}>
                  {Math.round(row.coverage * 100)}%
                </div>
                <div>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    background: row.net > 60 ? 'rgba(239,68,68,0.2)' : row.net > 30 ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)',
                    color: row.net > 60 ? '#ef4444' : row.net > 30 ? '#eab308' : '#22c55e',
                  }}>
                    {row.net > 60 ? '❗ Высокий' : row.net > 30 ? '⚡ Умеренный' : '✓ Низкий'}
                  </span>
                </div>
              </div>
            ))}`,
  `            {/* Mobile-friendly cards */}
            {rows.map((row) => (
              <div key={row.mechanismKey} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, borderLeft: \`3px solid \${getTextColor(row.net)}\` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: getTextColor(row.net) }}>{row.mechanismLabel}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{row.systemLabel}</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: row.net > 60 ? 'rgba(239,68,68,0.2)' : row.net > 30 ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)', color: row.net > 60 ? '#ef4444' : row.net > 30 ? '#eab308' : '#22c55e' }}>
                      {row.net > 60 ? '\u2757 Высокий' : row.net > 30 ? '\u26A1 Умеренный' : '\u2713 Низкий'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: \`\${Math.min(100, row.net)}%\`, height: '100%', background: getRiskColor(row.net), borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: getTextColor(row.net), minWidth: 32 }}>{Math.round(row.net)}%</span>
                </div>
                {row.mechanismDescription && row.mechanismDescription.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.3 }}>{row.mechanismDescription.substring(0, 120)}{row.mechanismDescription.length > 120 ? '...' : ''}</div>
                )}
                {row.coverage > 0 && (
                  <div style={{ fontSize: 9, color: row.coverage > 0.5 ? '#22c55e' : 'var(--text-dim)', marginTop: 2 }}>
                    \u{1F6E1}\uFE0F Защита: {Math.round(row.coverage * 100)}%
                  </div>
                )}
              </div>
            ))`
);

fs.writeFileSync(matrixPath, matrix, 'utf8');
console.log('RiskMatrix updated. Length:', matrix.length);

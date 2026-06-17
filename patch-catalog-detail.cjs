const f = require("fs").readFileSync("src/ui/screens/SupportScreen.tsx", "utf8");

// Add a helper function to render catalog card data after the imports section
// Find the line after the last import
const lines = f.split("\n");

// Insert a helper function after the catDetailInteractions function definition
const funcStart = f.indexOf("const catDetailInteractions = ");
const funcEndMarker = "};\n";
const funcBodyStart = f.indexOf("{", funcStart);
// Find the closing of this function
let braceCount = 0;
let funcEnd = -1;
for (let i = funcBodyStart; i < f.length; i++) {
  if (f[i] === "{") braceCount++;
  if (f[i] === "}") braceCount--;
  if (braceCount === 0) { funcEnd = i + 1; break; }
}

// Find the line number
const funcEndLine = f.substring(0, funcEnd).split("\n").length;
console.log("catDetailInteractions function ends at line:", funcEndLine);

// Now add a helper function after it
const catalogDetailHelper = `
// Helper to render SUPPORT_CATALOG_DATA for a substance
const renderCatalogDetail = (subId: string): React.ReactNode => {
  const entry = SUPPORT_CATALOG_DATA[subId];
  if (!entry) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {entry.tier && (
        <div style={{ marginBottom: 3 }}>
          <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 3, fontWeight: 700, color: TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)', background: (TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)') + '18', border: '1px solid ' + (TIER_LABELS_CATALOG[entry.tier]?.color || 'var(--text-dim)') + '40' }}>
            {TIER_LABELS_CATALOG[entry.tier]?.emoji || ''} {TIER_LABELS_CATALOG[entry.tier]?.label || entry.tier}
          </span>
          {entry.bestForCourse && <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, marginLeft: 4, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.2)' }}>✓ На курсе</span>}
        </div>
      )}
      {entry.category && entry.category.length > 0 && (
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 3 }}>
          {entry.category.map((c, i) => (
            <span key={i} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>{CATALOG_CATEGORY_LABELS[c] || c}</span>
          ))}
        </div>
      )}
      {entry.dosage && (
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginBottom: 3 }}>
          💊 Дозировка: <span style={{ fontWeight: 600 }}>{entry.dosage.mg}{entry.dosage.mg >= 1000 ? ' г' : entry.dosage.mg < 1 ? ' мкг' : ' мг'}</span> · {entry.dosage.timing}{entry.dosage.form ? ' · ' + entry.dosage.form : ''}
        </div>
      )}
      {entry.monitoring && entry.monitoring.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>📊 Мониторинг:</div>
          {entry.monitoring.map((m, i) => (
            <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
              {m.what}{m.when ? ' · ' + m.when : ''}{m.targetRange ? ' · ' + m.targetRange : ''}
            </div>
          ))}
        </div>
      )}
      {entry.contraindications && entry.contraindications.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 1 }}>🚫 Противопоказания:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>{entry.contraindications.join(', ')}</div>
        </div>
      )}
      {entry.sideEffects && entry.sideEffects.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>⚠ Побочные:</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>{entry.sideEffects.join(', ')}</div>
        </div>
      )}
      {entry.organs && entry.organs.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#60a5fa', fontWeight: 600, marginBottom: 1 }}>🎯 Органы-мишени:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {entry.organs.map((o, i) => (
              <span key={i} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(59,130,246,0.08)', color: '#60a5fa' }}>{CATALOG_ORGAN_LABELS[o] || o}</span>
            ))}
          </div>
        </div>
      )}
      {entry.systems && entry.systems.length > 0 && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 7, color: '#a78bfa', fontWeight: 600, marginBottom: 1 }}>⚡ Системы:</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {entry.systems.map((s, i) => (
              <span key={i} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(167,139,250,0.08)', color: '#a78bfa' }}>{SYSTEM_LABELS_CATALOG[s] || s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
`;

// Insert the helper function after the catDetailInteractions function
const insertPoint = funcEnd;
const newContent = f.substring(0, insertPoint) + catalogDetailHelper + f.substring(insertPoint);

// Now replace all 4 catDetailInteractions call sites with catalog data appended
const replacements = [
  "{catDetailInteractions(sub, ALL_INTERACTIONS)}\n                                   </div>",
  "{catDetailInteractions(sub, mergedInteractions)}\n                                     </div>"
];

// Replace each occurrence: add renderCatalogDetail(sub.id || sub?.id) after catDetailInteractions
let updated = newContent;

// For the two organ/tier tab call sites (using ALL_INTERACTIONS)
updated = updated.replace(
  /{catDetailInteractions\(sub,\s*ALL_INTERACTIONS\)}/g,
  "{catDetailInteractions(sub, ALL_INTERACTIONS)}\n                                     {renderCatalogDetail(sub.id || (sub as any)?.id)}"
);

// For the two type tab call sites (using mergedInteractions)
updated = updated.replace(
  /{catDetailInteractions\(sub,\s*mergedInteractions\)}/g,
  "{catDetailInteractions(sub, mergedInteractions)}\n                                       {renderCatalogDetail(sub.id || (sub as any)?.id)}"
);

require("fs").writeFileSync("src/ui/screens/SupportScreen.tsx", updated, "utf-8");
console.log("Done! Added catalog detail rendering helper and 4 call sites.");
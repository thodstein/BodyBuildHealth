import React from 'react';
import { EVIDENCE_DOSAGES, EvidenceDosage, getEvidenceDosage } from '../../data/evidence-dosage-db';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';

interface DosageCardProps {
  substanceId: string;
  substanceName: string;
  phase?: string;
  bodyWeight?: number;
  labMarkers?: Record<string, number>;
  onClose?: () => void;
}

const DOSE_STYLES = {
  container: {
    borderRadius: 12, padding: 14, marginTop: 8,
    background: 'rgba(0,230,138,0.03)', border: '1px solid rgba(0,230,138,0.15)',
  } as React.CSSProperties,
  header: { fontSize: 11, fontWeight: 700, color: '#00e68a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, marginBottom: 3, fontSize: 9 } as React.CSSProperties,
  label: { color: 'var(--text-dim)', fontSize: 8 } as React.CSSProperties,
  value: { fontWeight: 700, color: 'var(--text-light)', fontSize: 10 } as React.CSSProperties,
  sourceBadge: { padding: '2px 6px', borderRadius: 4, fontSize: 6, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', fontFamily: 'monospace' } as React.CSSProperties,
  noteBox: { padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.08)', fontSize: 7, color: 'var(--text-dim)', lineHeight: 1.4, marginBottom: 4 } as React.CSSProperties,
  contraindication: { padding: '2px 6px', borderRadius: 4, fontSize: 7, background: 'rgba(239,68,68,0.08)', color: '#ef4444', display: 'inline-block', margin: '1px 2px' } as React.CSSProperties,
  warningBox: { padding: '6px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 7, color: '#f59e0b', lineHeight: 1.4, marginBottom: 4 } as React.CSSProperties,
};

export const DosageCalculator: React.FC<{
  substanceId: string;
  substanceName: string;
  phase?: string;
  bodyWeight?: number;
}> = ({ substanceId, substanceName, phase, bodyWeight }) => {
  const ev = getEvidenceDosage(substanceId);
  const catalogEntry = SUPPORT_CATALOG_DATA[substanceId] || SUPPORT_CATALOG_DATA[substanceId.toUpperCase()];

  if (!ev) {
    // Fallback: show catalog dosage if available
    if (catalogEntry?.dosage?.mg) {
      return (
        <div style={DOSE_STYLES.container}>
          <div style={DOSE_STYLES.header}>
            <span>📋</span> Дозировка: {substanceName}
          </div>
          <div style={DOSE_STYLES.noteBox}>
            Базовая доза из каталога: <b>{catalogEntry.dosage.mg} мг</b> — {catalogEntry.dosage.timing}
            {catalogEntry.dosage.form && <span> ({catalogEntry.dosage.form})</span>}
          </div>
          <div style={{ fontSize: 7, color: 'var(--text-dim)', textAlign: 'center' }}>
            ℹ️ Нет данных из подтверждённых источников в БД дозировок. Добавьте evidence-dosage-db.ts.
          </div>
        </div>
      );
    }
    return null;
  }

  // Calculate adjusted optimal dose
  let adjustedOpt = ev.optMg;
  const adjustments: string[] = [];

  if (phase && ev.adjustments?.phaseMultiplier?.[phase]) {
    const mult = ev.adjustments.phaseMultiplier[phase];
    if (mult !== 1) {
      adjustedOpt = Math.round(adjustedOpt * mult);
      const phaseLabels: Record<string, string> = { course: '💉 Курс', bridge: '🌉 Мост', pct: '🔄 ПКТ', fertility: '⚧ Ферт.' };
      adjustments.push(`Фаза ${phaseLabels[phase] || phase}: ×${mult}`);
    }
  }

  if (bodyWeight && ev.adjustments?.weightBased) {
    const wb = ev.adjustments.weightBased;
    const weightDose = Math.round(bodyWeight * wb.perKg);
    const clampedDose = Math.max(wb.min, Math.min(wb.max, weightDose));
    if (clampedDose !== adjustedOpt) {
      adjustedOpt = clampedDose;
      adjustments.push(`Вес ${bodyWeight} кг: ${bodyWeight}×${wb.perKg}=${weightDose} ${ev.unit}`);
    }
  }

  // Build reference list (только текст — без неверифицированных PMID)
  const refLinks = ev.references.map(ref => ({ label: ref }));

  // Current phase timing adjust
  const timingPrefix = phase && phase !== 'course' ? `⚠️ Фаза ${phase}: уточнить дозировку` : '';
  const timingDisplay = timingPrefix ? `${timingPrefix}\n${ev.timing}` : ev.timing;

  // Unit display
  const unitDisp = ev.unit === 'мг' ? '' : ` ${ev.unit}`;

  return (
    <div style={DOSE_STYLES.container}>
      {/* Header */}
      <div style={DOSE_STYLES.header}>
        <span>📋</span> Дозировка: {substanceName}
        <span style={{ fontSize: 7, color: 'var(--text-dim)', fontWeight: 400 }}>— на основе клин. исследований</span>
      </div>

      {/* Main dosage range */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
        <div style={DOSE_STYLES.row}>
          <span style={DOSE_STYLES.label}>⬇ Мин</span>
          <span style={{ ...DOSE_STYLES.value, color: '#60a5fa' }}>{ev.minMg}{unitDisp}</span>
        </div>
        <div style={DOSE_STYLES.row}>
          <span style={DOSE_STYLES.label}>⭐ Оптимум</span>
          <span style={{ ...DOSE_STYLES.value, color: '#22c55e' }}>{adjustedOpt}{unitDisp}</span>
        </div>
        <div style={DOSE_STYLES.row}>
          <span style={DOSE_STYLES.label}>⬆ Макс</span>
          <span style={{ ...DOSE_STYLES.value, color: '#ef4444' }}>{ev.maxMg}{unitDisp}</span>
        </div>
      </div>

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <div style={DOSE_STYLES.warningBox}>
          🔄 Коррекция: {adjustments.join(' · ')}
        </div>
      )}

      {/* Timing */}
      <div style={DOSE_STYLES.noteBox}>
        <b style={{ color: '#8b5cf6' }}>🕐 Приём:</b> {timingDisplay.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
      </div>

      {/* Duration */}
      <div style={DOSE_STYLES.noteBox}>
        <b style={{ color: '#f59e0b' }}>⏳ Длительность:</b> {ev.duration}
      </div>

      {/* Clinical notes */}
      {ev.notes && (
        <div style={DOSE_STYLES.noteBox}>
          <b style={{ color: 'var(--text-light)' }}>💡 Примечание:</b> {ev.notes}
        </div>
      )}

      {/* Titration */}
      {ev.titration && ev.titration.length > 0 && (
        <div style={DOSE_STYLES.noteBox}>
          <b style={{ color: '#60a5fa' }}>📈 Титрование:</b>{' '}
          {ev.titration.map((d, i) => (
            <span key={i} style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.08)', color: '#60a5fa', fontSize: 7, margin: '0 2px' }}>
              {d}{unitDisp}{i < ev.titration!.length - 1 ? ' →' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Contraindications */}
      {ev.contraindications.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, display: 'block', marginBottom: 2 }}>⚠️ Противопоказания:</span>
          <div>
            {ev.contraindications.map((c, i) => (
              <span key={i} style={DOSE_STYLES.contraindication}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Evidence sources */}
      <details>
        <summary style={{ fontSize: 8, fontWeight: 600, color: '#818cf8', cursor: 'pointer', marginTop: 4 }}>
          📚 Источники дозировки ({refLinks.length})
        </summary>
        <div style={{ marginTop: 4, fontSize: 7, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          {refLinks.map((r, i) => (
            <div key={i} style={{ marginBottom: 3, padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.08)' }}>
              {r.label}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

/** Full-screen dosage calculator view — shows all planned substances with evidence dosing */
export const DosageCalculatorView: React.FC<{
  subs: { id: string; name: string }[];
  phase?: string;
  bodyWeight?: number;
  onClose?: () => void;
}> = ({ subs, phase, bodyWeight, onClose }) => {
  // Group by evidence status
  const withEv = subs.filter(s => getEvidenceDosage(s.id));
  const withoutEv = subs.filter(s => !getEvidenceDosage(s.id));

  return (
    <div style={{ padding: '0 0 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-light)' }}>📋 Калькулятор дозировок</h3>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>
            Дозировки на основе клинических справочников (NIH ODS, FDA, EMA, ESC/ESH, WHO)
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, fontSize: 8 }}>
        <span style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.06)', color: 'var(--accent)' }}>
          ✅ {withEv.length} с источниками
        </span>
        {withoutEv.length > 0 && (
          <span style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', color: '#f59e0b' }}>
            ⚠️ {withoutEv.length} без данных
          </span>
        )}
        {phase && (
          <span style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.06)', color: '#8b5cf6' }}>
            🔄 Фаза: {phase}
          </span>
        )}
      </div>

      {/* Phase-level dose summary */}
      {phase && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', fontSize: 8, color: 'var(--text-dim)', marginBottom: 10 }}>
          <b style={{ color: '#8b5cf6' }}>🔧 Фазовая коррекция доз:</b>
          <div style={{ marginTop: 4, lineHeight: 1.5 }}>
            {Object.entries(EVIDENCE_DOSAGES).map(([id, d]) => {
              const mult = d.adjustments?.phaseMultiplier?.[phase || 'course'];
              if (mult && mult !== 1) {
                const cat = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
                const name = cat?.nameRu || cat?.name || id;
                return <div key={id}>• {name}: ×{mult} (→ {Math.round(d.optMg * mult)} {d.unit})</div>;
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Substances with evidence */}
      {withEv.map(s => (
        <DosageCalculator key={s.id} substanceId={s.id} substanceName={s.name} phase={phase} bodyWeight={bodyWeight} />
      ))}

      {/* Substances without evidence - show catalog fallback */}
      {withoutEv.map(s => (
        <DosageCalculator key={s.id} substanceId={s.id} substanceName={s.name} phase={phase} bodyWeight={bodyWeight} />
      ))}
    </div>
  );
};

/** Dedicated tab: full dose database with search */
export const DosageDatabaseView: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Build list of all substances with evidence entries
  const allItems = React.useMemo(() => {
    const items: { id: string; name: string; ev: EvidenceDosage; cat: any }[] = [];
    const seen = new Set<string>();
    for (const id of Object.keys(EVIDENCE_DOSAGES)) {
      const ev = getEvidenceDosage(id);
      if (!ev) continue;
      const cat = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
      const name = cat?.nameRu || cat?.name || id;
      const key = id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ id, name, ev, cat });
    }
    items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return items;
  }, []);

  const filtered = search.length >= 2
    ? allItems.filter(it => it.name.toLowerCase().includes(search.toLowerCase()) || it.id.toLowerCase().includes(search.toLowerCase()))
    : allItems;

  // Category filter chips
  const categories = React.useMemo(() => {
    const cats = new Map<string, number>();
    for (const it of allItems) {
      const tier = it.cat?.tier || it.ev?.references?.[0]?.includes('FDA') ? 'pharma' : 'supplement';
      cats.set(tier, (cats.get(tier) || 0) + 1);
    }
    return Array.from(cats.entries());
  }, [allItems]);

  const [catFilter, setCatFilter] = React.useState<string | null>(null);
  const displayList = catFilter
    ? filtered.filter(it => {
        const tier = it.cat?.tier || (it.ev?.references?.[0]?.includes('FDA') ? 'pharma' : 'supplement');
        return tier === catFilter;
      })
    : filtered;

  return (
    <div style={{ padding: '0 8px 80px' }}>
      {/* Header */}
      <div style={{ padding: '12px 0 8px' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-light)' }}>📋 База клинических дозировок</h3>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
          Дозировки из официальных источников: FDA prescribing info, NIH ODS, ESC/ESH, Endocrine Society, EMA, WHO, Cochrane. Без непроверенных PMID.
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Поиск по названию вещества..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 10, outline: 'none',
          marginBottom: 8,
        }}
      />

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setCatFilter(null)}
          style={{
            padding: '4px 12px', borderRadius: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: !catFilter ? 'var(--accent)' : 'var(--bg-secondary)',
            color: !catFilter ? '#000' : 'var(--text-dim)',
            border: '1px solid ' + (!catFilter ? 'var(--accent)' : 'var(--border)'),
          }}
        >
          Все ({allItems.length})
        </button>
        <button onClick={() => setCatFilter('pharma')} style={{ padding: '4px 12px', borderRadius: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer',
          background: catFilter === 'pharma' ? '#ef4444' : 'var(--bg-secondary)',
          color: catFilter === 'pharma' ? '#fff' : '#ef4444',
          border: '1px solid ' + (catFilter === 'pharma' ? '#ef4444' : 'var(--border)'),
        }}>💊 Фарма ({categories.find(c => c[0] === 'pharma')?.[1] || 0})</button>
        <button onClick={() => setCatFilter('supplement')} style={{ padding: '4px 12px', borderRadius: 16, fontSize: 9, fontWeight: 700, cursor: 'pointer',
          background: catFilter === 'supplement' ? '#22c55e' : 'var(--bg-secondary)',
          color: catFilter === 'supplement' ? '#000' : '#22c55e',
          border: '1px solid ' + (catFilter === 'supplement' ? '#22c55e' : 'var(--border)'),
        }}>🌿 БАДы ({categories.find(c => c[0] === 'supplement')?.[1] || 0})</button>
      </div>

      {/* Stats */}
      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 8 }}>
        Показано {displayList.length} из {allItems.length} веществ
        {search.length >= 2 && <span> — поиск: «{search}»</span>}
      </div>

      {/* Substance cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {displayList.map(it => {
          const isOpen = expandedId === it.id;
          return (
            <div key={it.id} style={{ borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* Clickable header */}
              <div
                onClick={() => setExpandedId(isOpen ? null : it.id)}
                style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-light)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.name}
                  </div>
                  <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>
                    {it.ev.optMg}{it.ev.unit === 'мг' ? ' мг' : ' ' + it.ev.unit} — {it.ev.timing.split(',')[0]}
                  </div>
                </div>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
              </div>
              {/* Expanded: full dosage card */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <DosageCalculator substanceId={it.id} substanceName={it.name} />
                </div>
              )}
            </div>
          );
        })}
        {displayList.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 10 }}>
            Ничего не найдено по запросу «{search}»
          </div>
        )}
      </div>
    </div>
  );
};

export default DosageCalculator;

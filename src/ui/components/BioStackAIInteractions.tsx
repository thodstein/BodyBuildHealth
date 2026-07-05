import React, { useState, useMemo } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS, ALL_SUBSTANCES } from '../../data/support-database';
import { INTERACTION_ENRICHMENT } from '../../data/support-interaction-enrichment';
import { GlassCard } from './BioStackAIConstants';
import { calcStackSynergyScore, suggestSynergyAdditions } from '../../engines/support-plan/display';

const MAX_ITEMS = 10;

/* ─── Helpers ─── */
const TIER_COLORS: Record<string, string> = { core: '#00e68a', standard: '#60a5fa', advanced: '#a78bfa', specialty: '#f59e0b' };
const LVL_COLORS: Record<string, string> = { excellent: '#22c55e', good: '#4ade80', moderate: '#f59e0b', poor: '#ef4444', risky: '#dc2626' };
const LVL_LABELS: Record<string, string> = { excellent: 'Отлично', good: 'Хорошо', moderate: 'Умеренно', poor: 'Плохо', risky: 'Рискованно' };
const TYPE_ICON: Record<string, string> = { conflict: '🚫', caution: '⚡', synergy: '🤝' };
const SEV_COLOR = (s: string) => s === 'HIGH' ? '#ef4444' : s === 'MEDIUM' ? '#f59e0b' : '#22c55e';

/* ─── Organ load keywords per substance field ─── */
const HEPATIC_KEYWORDS = ['hepatotox', 'liver', 'печень', 'ALT', 'AST', 'ГГТ'];
const RENAL_KEYWORDS = ['nephrotox', 'kidney', 'почк', 'creatinine', 'креатинин'];
const CARDIO_KEYWORDS = ['cardiotox', 'blood pressure', 'heart rate', 'pressure', 'давление', 'ЧСС', 'тромб'];

function cardTitleColor(tier?: string): string {
  return TIER_COLORS[tier || ''] || 'rgba(255,255,255,0.5)';
}

/* ─── Organ load estimation from SUPPORT_CATALOG_DATA ─── */
function estimateOrganLoad(ids: string[]): {
  hepatic: { score: number; items: string[] };
  renal: { score: number; items: string[] };
  cardio: { score: number; items: string[] };
} {
  const h = { score: 0, items: [] as string[] };
  const r = { score: 0, items: [] as string[] };
  const c = { score: 0, items: [] as string[] };
  ids.forEach(id => {
    const e = SUPPORT_CATALOG_DATA[id];
    if (!e) return;
    const desc = (e.description || '').toLowerCase();
    const si = (e.specialInstructions || []).join(' ').toLowerCase();
    const contra = (e.contraindications || []).join(' ').toLowerCase();
    const se = (e.sideEffects || []).join(' ').toLowerCase();
    const all = [desc, si, contra, se].join(' ');
    const cat = Array.isArray(e.category) ? e.category.map((x: string) => x.toLowerCase()) : [];
    if (HEPATIC_KEYWORDS.some(k => all.includes(k)) || cat.includes('hepatoprotector') || cat.includes('liver')) {
      h.score += 1;
      h.items.push(e.nameRu || e.name || id);
    }
    if (RENAL_KEYWORDS.some(k => all.includes(k))) {
      r.score += 1;
      r.items.push(e.nameRu || e.name || id);
    }
    if (CARDIO_KEYWORDS.some(k => all.includes(k)) || cat.includes('cardioprotector') || cat.includes('heart')) {
      c.score += 1;
      c.items.push(e.nameRu || e.name || id);
    }
  });
  return {
    hepatic: { score: Math.min(h.score, 5), items: h.items },
    renal: { score: Math.min(r.score, 5), items: r.items },
    cardio: { score: Math.min(c.score, 5), items: c.items },
  };
}

/* ─── Timing recommendations ─── */
function buildTimingAdvice(ids: string[]): string[] {
  const tips: string[] = [];
  const fatMap: Record<string, boolean> = {};
  const fastingMap: Record<string, boolean> = {};
  ids.forEach(id => {
    const e = SUPPORT_CATALOG_DATA[id];
    if (!e) return;
    const si = (e.specialInstructions || []).join(' ').toLowerCase();
    const name = e.nameRu || e.name || id;
    if (si.includes('жир') || si.includes('fat') || si.includes('с едой')) {
      if (!fatMap[name]) { fatMap[name] = true; tips.push(`${name} — принимать с жирной пищей для абсорбции`); }
    }
    if (si.includes('натощак') || si.includes('fasting') || si.includes('до еды') || si.includes('за 30')) {
      if (!fastingMap[name]) { fastingMap[name] = true; tips.push(`${name} — натощак за 30 мин до еды`); }
    }
    if (si.includes('вечер') || si.includes('перед сном')) {
      tips.push(`${name} — вечером перед сном`);
    } else if (si.includes('утро') || si.includes('утром')) {
      tips.push(`${name} — утром после завтрака`);
    }
    if (si.includes('calcium') || si.includes('кальций') || si.includes('железо') || si.includes('iron') || si.includes('цинк') || si.includes('zinc')) {
      tips.push(`⚠ ${name}: разделить с кальцием/железом/цинком (интервал 2 ч)`);
    }
  });
  if (tips.length > 6) {
    const unique = [...new Set(tips)];
    return unique.slice(0, 6);
  }
  return [...new Set(tips)];
}

/* ─── Contraindication merge from profile ─── */
function checkProfileContraindications(ids: string[], profile: BioStackProfile): Array<{ id: string; name: string; issue: string }> {
  const issues: Array<{ id: string; name: string; issue: string }> = [];
  if (!profile?.healthConditions?.length) return issues;
  ids.forEach(id => {
    const e = SUPPORT_CATALOG_DATA[id];
    if (!e?.contraindications?.length) return;
    const name = e.nameRu || e.name || id;
    const c = e.contraindications.map((x: string) => x.toLowerCase());
    profile.healthConditions!.forEach(cond => {
      if (cond === 'heart' && (c.some(x => x.includes('серд') || x.includes('cardio') || x.includes('pressure')))) {
        issues.push({ id, name, issue: 'Противопоказан при заболеваниях ССС' });
      }
      if (cond === 'kidney' && (c.some(x => x.includes('почк') || x.includes('kidney') || x.includes('renal')))) {
        issues.push({ id, name, issue: 'Противопоказан при заболеваниях почек' });
      }
      if (cond === 'liver' && (c.some(x => x.includes('печен') || x.includes('liver') || x.includes('hepat')))) {
        issues.push({ id, name, issue: 'Противопоказан при заболеваниях печени' });
      }
      if (cond === 'diabetes' && c.some(x => x.includes('диабет') || x.includes('diabet') || x.includes('glucose'))) {
        issues.push({ id, name, issue: 'Противопоказан при сахарном диабете' });
      }
      if (cond === 'stomach' && (c.some(x => x.includes('желуд') || x.includes('ulcer') || x.includes('gastr')))) {
        issues.push({ id, name, issue: 'Противопоказан при заболеваниях ЖКТ' });
      }
    });
  });
  return issues;
}

/* ─── Resolve interaction enrichment ─── */
function getEnrichedMechanisms(pairKey: string): string[] {
  const enr = INTERACTION_ENRICHMENT[pairKey];
  if (enr?.mechanismRu?.length) return enr.mechanismRu;
  return [];
}

/* ─── Main Component ─── */
export function InteractionsTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds?: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedSub, setExpandedSub] = useState<Record<string, boolean>>({});
  const [expandedPair, setExpandedPair] = useState<Record<string, boolean>>({});

  const allSubstances = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ id: string; name: string; tier: string; category: string[] }> = [];
    ALL_SUBSTANCES.forEach(s => {
      const id = (s.id || '').toLowerCase();
      if (!seen.has(id) && SUPPORT_CATALOG_DATA[id]) {
        seen.add(id);
        const entry = SUPPORT_CATALOG_DATA[id];
        items.push({
          id, name: entry?.nameRu || entry?.name || id,
          tier: entry?.tier || '',
          category: (entry?.category || []).slice(0, 2),
        });
      }
    });
    Object.entries(SUPPORT_CATALOG_DATA).forEach(([key, val]) => {
      const id = key.toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id, name: val?.nameRu || val?.name || id,
          tier: val?.tier || '',
          category: (val?.category || []).slice(0, 2),
        });
      }
    });
    return items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return allSubstances.slice(0, 20);
    const q = search.toLowerCase();
    return allSubstances.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q)).slice(0, 15);
  }, [search, allSubstances]);

  const addItem = (id: string) => {
    if (selected.length >= MAX_ITEMS || selected.includes(id)) return;
    setSelected(prev => [...prev, id]);
    setSearch('');
  };
  const removeItem = (id: string) => setSelected(prev => prev.filter(x => x !== id));
  const clearAll = () => { setSelected([]); setExpandedSub({}); setExpandedPair({}); };
  const loadFromStack = () => {
    setSelected(prev => {
      const set = new Set(prev);
      stackIds.forEach(id => set.add(id));
      return Array.from(set).slice(0, MAX_ITEMS);
    });
  };
  const toggleSub = (id: string) => setExpandedSub(prev => ({ ...prev, [id]: !prev[id] }));

  const analysis = useMemo(() => {
    if (selected.length < 2) return null;
    const ids = selected;
    const stackScore = calcStackSynergyScore(ids);
    const suggestions = suggestSynergyAdditions(ids, 5);
    const pairs: any[] = [];
    const pairSet = new Set<string>();
    ALL_INTERACTIONS.forEach(i => {
      const a = (i.substanceA || '').toLowerCase();
      const b = (i.substanceB || '').toLowerCase();
      if (ids.includes(a) && ids.includes(b)) {
        const key = [a, b].sort().join('|');
        if (!pairSet.has(key)) {
          pairSet.add(key);
          pairs.push({
            key, a, b,
            nameA: SUPPORT_CATALOG_DATA[a]?.nameRu || SUPPORT_CATALOG_DATA[a]?.name || a,
            nameB: SUPPORT_CATALOG_DATA[b]?.nameRu || SUPPORT_CATALOG_DATA[b]?.name || b,
            type: i.type || 'unknown',
            severity: i.severity || 'LOW',
            effect: i.effect || '',
            mechanisms: i.mechanisms || [],
            notes: i.notes || '',
          });
        }
      }
    });
    const critical = pairs.filter(p => p.severity === 'HIGH' && p.type === 'conflict');
    const moderate = pairs.filter(p => p.severity === 'MEDIUM' || (p.severity === 'HIGH' && p.type !== 'conflict'));
    const safe = pairs.filter(p => p.severity === 'LOW' || p.type === 'synergy');
    const organLoad = estimateOrganLoad(ids);
    const timingTips = buildTimingAdvice(ids);
    const contraIssues = checkProfileContraindications(ids, profile);
    return { stackScore, suggestions, pairs, critical, moderate, safe, organLoad, timingTips, contraIssues };
  }, [selected, profile]);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* ─── PANEL 1: Подбор препаратов ─── */}
      <GlassCard title="🧪 Калькулятор совместимости БАД" icon="⚡" color="#a855f7">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 8, lineHeight: 1.3 }}>
          Профессиональная проверка совместимости: синергии, конфликты, нагрузка на органы, режим приёма
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, minHeight: 28 }}>
          {selected.length === 0 ? (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>Нет выбранных препаратов</span>
          ) : selected.map(id => {
            const e = SUPPORT_CATALOG_DATA[id];
            const n = e?.nameRu || e?.name || id;
            const tc = cardTitleColor(e?.tier);
            return (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600, background: tc + '12', border: `1px solid ${tc}25`, color: tc }}>
                {n}
                {e?.tier && <span style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: tc + '22', color: tc, marginLeft: 2 }}>{e.tier}</span>}
                <span onClick={() => removeItem(id)} style={{ cursor: 'pointer', opacity: 0.4, fontSize: 10, marginLeft: 2 }}>✕</span>
              </span>
            );
          })}
        </div>
        {selected.length < MAX_ITEMS && (
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <input value={search} placeholder="🔍 Начните вводить название БАД/препарата..." onChange={e => setSearch(e.target.value)} style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 10,
              background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', boxSizing: 'border-box', outline: 'none',
            }} />
            {search && filtered.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#202023', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
                {filtered.map(s => {
                  const tc = cardTitleColor(s.tier);
                  return (
                    <div key={s.id} onClick={() => addItem(s.id)} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{s.name}</span>
                      {s.tier && <span style={{ fontSize: 6, padding: '1px 5px', borderRadius: 3, background: tc + '22', color: tc, fontWeight: 600 }}>{s.tier}</span>}
                      {s.category?.map((c: string, i: number) => (
                        <span key={i} style={{ fontSize: 6, padding: '1px 4px', borderRadius: 3, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>{c}</span>
                      ))}
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>{s.id}</span>
                      {selected.includes(s.id) && <span style={{ color: '#22c55e', fontSize: 8 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {selected.length > 0 && (
            <button onClick={clearAll} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>✕ Очистить все</button>
          )}
          {stackIds.length > 0 && (
            <button onClick={loadFromStack} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}>📋 Загрузить из активного стека</button>
          )}
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginLeft: 'auto' }}>{selected.length}/{MAX_ITEMS}</span>
        </div>
      </GlassCard>

      {analysis && (
        <>
          {/* ─── PANEL 2: Профессиональная сводка ─── */}
          <GlassCard title="📊 Профессиональная сводка совместимости" icon="🏥" color={LVL_COLORS[analysis.stackScore.level]}>
            {/* Overall score */}
            <div style={{ padding: '10px 12px', borderRadius: 10, background: `${LVL_COLORS[analysis.stackScore.level]}08`, border: `1px solid ${LVL_COLORS[analysis.stackScore.level]}22`, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: LVL_COLORS[analysis.stackScore.level] }}>{analysis.stackScore.score}/100</span>
                <span style={{ fontSize: 9, padding: '2px 10px', borderRadius: 6, fontWeight: 700, background: `${LVL_COLORS[analysis.stackScore.level]}22`, color: LVL_COLORS[analysis.stackScore.level] }}>{LVL_LABELS[analysis.stackScore.level]}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: analysis.stackScore.score + '%', height: '100%', background: LVL_COLORS[analysis.stackScore.level], borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 8, flexWrap: 'wrap' }}>
                <span style={{ color: '#22c55e' }}>⊕ {analysis.stackScore.synergies} синергий</span>
                <span style={{ color: '#ef4444' }}>⊖ {analysis.stackScore.conflicts} конфликтов</span>
                <span style={{ color: '#f59e0b' }}>⚠ {analysis.stackScore.cautions} осторожностей</span>
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>? {analysis.stackScore.unknownPairs} неизвестно</span>
              </div>
            </div>

            {/* Organ load — 3 gauges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              {[
                { key: 'hepatic', label: '🫁 Печень', color: analysis.organLoad.hepatic.score >= 3 ? '#ef4444' : analysis.organLoad.hepatic.score >= 2 ? '#f59e0b' : '#22c55e', score: analysis.organLoad.hepatic.score },
                { key: 'renal', label: '🫘 Почки', color: analysis.organLoad.renal.score >= 3 ? '#ef4444' : analysis.organLoad.renal.score >= 2 ? '#f59e0b' : '#22c55e', score: analysis.organLoad.renal.score },
                { key: 'cardio', label: '❤️ ССС', color: analysis.organLoad.cardio.score >= 3 ? '#ef4444' : analysis.organLoad.cardio.score >= 2 ? '#f59e0b' : '#22c55e', score: analysis.organLoad.cardio.score },
              ].map(g => (
                <div key={g.key} style={{ padding: '8px 6px', borderRadius: 8, background: g.color + '06', border: `1px solid ${g.color}15`, textAlign: 'center' }}>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{g.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: g.color }}>{g.score}/5</div>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', marginTop: 4 }}>
                    <div style={{ width: (g.score / 5) * 100 + '%', height: '100%', borderRadius: 2, background: g.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Timing tips */}
            {analysis.timingTips.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#60a5fa', marginBottom: 3 }}>🕐 Рекомендации по режиму приёма</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {analysis.timingTips.map((tip, i) => (
                    <div key={i} style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)', padding: '3px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.04)', lineHeight: 1.3 }}>{tip}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Profile contraindications */}
            {analysis.contraIssues.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>⚠ Противопоказания с учётом профиля здоровья</div>
                {analysis.contraIssues.map((ci, i) => (
                  <div key={i} style={{ fontSize: 8, color: '#ef4444', padding: '3px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.04)', marginBottom: 2, lineHeight: 1.3 }}>
                    <strong>{ci.name}</strong>: {ci.issue}
                  </div>
                ))}
              </div>
            )}

            {/* Compatibility matrix */}
            {selected.length >= 2 && selected.length <= 8 && (
              <div style={{ marginBottom: 8, overflowX: 'auto' }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>🔬 Матрица совместимости {selected.length}×{selected.length}</div>
                <div style={{ display: 'inline-block', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                  {(() => {
                    const names = selected.map(id => {
                      const n = SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id;
                      return n.length > 7 ? n.substring(0, 6) + '…' : n;
                    });
                    const cellSize = Math.max(26, Math.min(42, Math.floor(240 / selected.length)));
                    const pairCell = (a: string, b: string) => {
                      if (a === b) return null;
                      return analysis.stackScore.matrix.find(m =>
                        (m.a.toLowerCase() === a && m.b.toLowerCase() === b) ||
                        (m.a.toLowerCase() === b && m.b.toLowerCase() === a)
                      ) || null;
                    };
                    const cellEmoji = (type: string) => type === 'synergy' ? '⊕' : type === 'conflict' ? '⊖' : type === 'caution' ? '⚠' : '·';
                    const cellColor = (type: string) => type === 'synergy' ? '#22c55e' : type === 'conflict' ? '#ef4444' : type === 'caution' ? '#f59e0b' : 'rgba(255,255,255,0.12)';
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: `${cellSize + 4}px repeat(${selected.length}, ${cellSize}px)`, gap: 0 }}>
                        <div style={{ padding: 2, background: 'rgba(0,0,0,0.2)' }} />
                        {names.map((n, ci) => (
                          <div key={ci} style={{ padding: 2, background: 'rgba(0,0,0,0.2)', fontSize: 5, color: 'rgba(255,255,255,0.35)', textAlign: 'center', writingMode: selected.length > 5 ? 'vertical-rl' : 'horizontal-tb', transform: selected.length > 5 ? 'rotate(180deg)' : 'none', lineHeight: 1.1 }}>{n}</div>
                        ))}
                        {selected.map((rowId, ri) => (
                          <React.Fragment key={ri}>
                            <div style={{ padding: '2px 4px', background: 'rgba(0,0,0,0.2)', fontSize: 5, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap', overflow: 'hidden' }}>{names[ri]}</div>
                            {selected.map((colId, ci) => {
                              const cell = pairCell(rowId, colId);
                              return (
                                <div key={ci} style={{ width: cellSize, height: cellSize, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cell ? cellColor(cell.type) + '12' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', fontSize: cellSize > 30 ? 10 : 7, color: cell ? cellColor(cell.type) : 'rgba(255,255,255,0.15)', fontWeight: 700, cursor: 'default' }}
                                  title={cell ? `${SUPPORT_CATALOG_DATA[rowId]?.nameRu || rowId} + ${SUPPORT_CATALOG_DATA[colId]?.nameRu || colId}: ${cell.effect}` : ''}>
                                  {cell ? cellEmoji(cell.type) : '·'}
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 6, color: 'rgba(255,255,255,0.25)' }}>
                  <span><span style={{ color: '#22c55e', fontWeight: 700 }}>⊕</span> синергия</span>
                  <span><span style={{ color: '#ef4444', fontWeight: 700 }}>⊖</span> конфликт</span>
                  <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>⚠</span> осторожность</span>
                  <span><span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span> нет данных</span>
                </div>
              </div>
            )}

            {/* Synergy suggestions */}
            {analysis.suggestions.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>🔮 Рекомендации для усиления стека</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {analysis.suggestions.map((sug, si) => (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
                      <button onClick={() => addItem(sug.id)} disabled={selected.includes(sug.id) || selected.length >= MAX_ITEMS} style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 8, cursor: 'pointer',
                        background: selected.includes(sug.id) ? 'rgba(255,255,255,0.05)' : 'rgba(168,85,247,0.15)',
                        border: `1px solid ${selected.includes(sug.id) ? 'rgba(255,255,255,0.1)' : 'rgba(168,85,247,0.3)'}`,
                        color: selected.includes(sug.id) ? 'rgba(255,255,255,0.2)' : '#a855f7', fontWeight: 700,
                        opacity: selected.includes(sug.id) ? 0.4 : 1,
                      }}>{selected.includes(sug.id) ? '✓' : '+ Добавить'}</button>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', minWidth: 50 }}>{sug.name}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', flex: 1 }}>
                        ⊕ {sug.synergiesWith.length} синергий: {(sug.synergiesWith || []).slice(0, 3).map((x: string) => SUPPORT_CATALOG_DATA[x]?.nameRu || SUPPORT_CATALOG_DATA[x]?.name || x).join(', ')}
                      </span>
                      <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontWeight: 700 }}>{sug.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apply to stack */}
            {setStackIds && (
              <button onClick={() => setStackIds(selected)} style={{
                width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
              }}>📋 Сохранить как активный стек BioStack</button>
            )}
          </GlassCard>

          {/* ─── PANEL 3: Карточки препаратов (профессиональные монографии) ─── */}
          <GlassCard title="💊 Монографии препаратов" icon="📋" color="#818cf8">
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Нажмите на препарат для раскрытия полной клинической информации</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selected.map(id => {
                const e = SUPPORT_CATALOG_DATA[id];
                if (!e) return null;
                const name = e.nameRu || e.name || id;
                const open = expandedSub[id] ?? false;
                const tierColor = cardTitleColor(e.tier);
                const allTips: string[] = [
                  ...(e.specialInstructions || []),
                  ...(e.forms?.map((d: any) => d.notes).filter(Boolean) || []),
                ];
                return (
                  <div key={id} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div onClick={() => toggleSub(id)} style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{name}</span>
                        {e.tier && <span style={{ fontSize: 7, padding: '1px 6px', borderRadius: 3, background: tierColor + '22', color: tierColor, fontWeight: 600, marginLeft: 6 }}>{e.tier}</span>}
                      </div>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{open ? '▲' : '▼'}</span>
                    </div>
                    {open && (
                      <div style={{ padding: '0 10px 10px', fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                        {e.description && <div style={{ marginBottom: 4 }}>{e.description}</div>}
                        {e.mechanisms?.length > 0 && (
                          <div style={{ marginBottom: 3 }}>
                            <span style={{ color: '#a78bfa', fontWeight: 600 }}>⚙️ Механизмы: </span>
                            <span>{(Array.isArray(e.mechanisms) ? e.mechanisms : []).join(', ')}</span>
                          </div>
                        )}
                        {e.contraindications?.length > 0 && (
                          <div style={{ marginBottom: 3 }}>
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>🚫 Противопоказания: </span>
                            {e.contraindications.join('; ')}
                          </div>
                        )}
                        {e.sideEffects?.length > 0 && (
                          <div style={{ marginBottom: 3 }}>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚠ Побочные: </span>
                            {(e.sideEffects || []).join(', ')}
                          </div>
                        )}
                        {allTips.length > 0 && (
                          <div style={{ marginBottom: 3 }}>
                            <span style={{ color: '#60a5fa', fontWeight: 600 }}>📋 Указания: </span>
                            {allTips.join(' · ')}
                          </div>
                        )}
                        {e.monitoring?.length > 0 && (
                          <div>
                            <span style={{ color: '#22c55e', fontWeight: 600 }}>🔬 Мониторинг: </span>
                            {(e.monitoring || []).map((m: any) => typeof m === 'string' ? m : `${m.what || ''} (${m.when || ''})`).join('; ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* ─── PANEL 4: Детальный разбор взаимодействий ─── */}
          {analysis.critical.length > 0 && (
            <GlassCard title={`🔴 Критические взаимодействия (${analysis.critical.length})`} icon="🚫" color="#ef4444">
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6, lineHeight: 1.3 }}>
                Эти комбинации требуют обязательного разделения приёма или замены одного из компонентов
              </div>
              {analysis.critical.map((p, i) => {
                const pk = p.key || `${p.a}|${p.b}`;
                const enrMechs = getEnrichedMechanisms(pk);
                return (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                      <span style={{ fontSize: 11 }}>🚫</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{p.nameA}</span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>+</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{p.nameB}</span>
                      <span style={{ marginLeft: 'auto', padding: '1px 6px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: '#ef444418', color: '#ef4444' }}>🔴 Высокий</span>
                    </div>
                    {p.effect && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3, marginBottom: 2, paddingLeft: 16 }}>{p.effect}</div>}
                    {enrMechs.length > 0 && (
                      <div style={{ fontSize: 7, color: '#a78bfa', paddingLeft: 16, marginBottom: 2 }}>🧬 {enrMechs.join('; ')}</div>
                    )}
                    {p.notes && <div style={{ fontSize: 7, color: '#f59e0b', paddingLeft: 16, lineHeight: 1.3 }}>📝 {p.notes}</div>}
                    <div style={{ fontSize: 7, color: '#ef4444', paddingLeft: 16, marginTop: 2, fontWeight: 600 }}>
                      💡 Рекомендация: разделить приём с интервалом ≥4 ч или заменить один из компонентов
                    </div>
                  </div>
                );
              })}
            </GlassCard>
          )}

          {analysis.moderate.length > 0 && (
            <GlassCard title={`🟡 Умеренные взаимодействия (${analysis.moderate.length})`} icon="⚡" color="#f59e0b">
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 6, lineHeight: 1.3 }}>
                Рекомендуется контроль состояния и корректировка доз
              </div>
              {analysis.moderate.map((p, i) => {
                const pk = p.key || `${p.a}|${p.b}`;
                const enrMechs = getEnrichedMechanisms(pk);
                const [expKey, setExp] = [pk + '_mod', () => setExpandedPair(prev => ({ ...prev, [pk + '_mod']: !prev[pk + '_mod'] }))];
                const open = expandedPair[pk + '_mod'] ?? false;
                return (
                  <div key={i} style={{ padding: '7px 9px', borderRadius: 8, marginBottom: 4, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                    <div onClick={setExp} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10 }}>{p.type === 'caution' ? '⚡' : '⚠'}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{p.nameA} ↔ {p.nameB}</span>
                      <span style={{ marginLeft: 'auto', padding: '1px 5px', borderRadius: 4, fontSize: 6, fontWeight: 700, background: '#f59e0b18', color: '#f59e0b' }}>
                        {p.severity === 'MEDIUM' ? '🟡 Средний' : '⚠ Высокий'}
                      </span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{open ? '▲' : '▼'}</span>
                    </div>
                    {open && (
                      <div style={{ paddingLeft: 16, marginTop: 3 }}>
                        {p.effect && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3, marginBottom: 2 }}>{p.effect}</div>}
                        {enrMechs.length > 0 && (
                          <div style={{ fontSize: 7, color: '#a78bfa', marginBottom: 2 }}>🧬 {enrMechs.join('; ')}</div>
                        )}
                        {p.mechanisms && p.mechanisms.length > 0 && !enrMechs.length && (
                          <div style={{ fontSize: 7, color: '#a78bfa', marginBottom: 2 }}>🧬 {p.mechanisms.join(', ')}</div>
                        )}
                        {p.notes && <div style={{ fontSize: 7, color: '#f59e0b', lineHeight: 1.3 }}>📝 {p.notes}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </GlassCard>
          )}

          {analysis.safe.length > 0 && (
            <GlassCard title={`🟢 Безопасные комбинации и синергии (${analysis.safe.length})`} icon="🤝" color="#22c55e">
              {analysis.safe.slice(0, 10).map((p, i) => (
                <div key={i} style={{ padding: '5px 8px', borderRadius: 6, marginBottom: 3, background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.06)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{p.type === 'synergy' ? '🤝' : '➖'}</span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>{p.nameA} ↔ {p.nameB}</span>
                  {p.effect && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.effect}</span>}
                </div>
              ))}
              {analysis.safe.length > 10 && (
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: 2 }}>
                  + ещё {analysis.safe.length - 10} пар
                </div>
              )}
            </GlassCard>
          )}

          {analysis.pairs.length === 0 && (
            <GlassCard title="🔬 Нет зарегистрированных взаимодействий" icon="➖" color="#60a5fa">
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: 12, lineHeight: 1.4 }}>
                Для данной комбинации не найдено известных клинических взаимодействий в базе данных. Это не гарантирует полную безопасность — начинайте с минимальных доз.
              </div>
            </GlassCard>
          )}

          {/* ─── PANEL 5: Фармацевтическая справка ─── */}
          <GlassCard title="📋 Фармацевтическое заключение" icon="📝" color="#22c55e">
            {(() => {
              const lines: string[] = [];
              const n = selected.length;
              lines.push(`Комбинация: ${n} препаратов`);
              if (analysis.stackScore.score >= 80) {
                lines.push('✅ Совместимость высокая — комбинация клинически обоснована');
              } else if (analysis.stackScore.score >= 60) {
                lines.push('🟡 Совместимость умеренная — требуется контроль');
              } else {
                lines.push('🔴 Совместимость низкая — рекомендуется пересмотреть состав');
              }
              if (analysis.critical.length > 0) {
                lines.push(`🔴 ${analysis.critical.length} критических пар — требуется разделение приёма или замена`);
              }
              if (analysis.organLoad.hepatic.score >= 3) {
                lines.push('🫁 Повышенная нагрузка на печень — добавьте гепатопротектор (NAC, TUDCA)');
              }
              if (analysis.organLoad.renal.score >= 3) {
                lines.push('🫘 Повышенная нагрузка на почки — контроль креатинина каждые 4 нед');
              }
              if (analysis.organLoad.cardio.score >= 3) {
                lines.push('❤️ Повышенная нагрузка на ССС — контроль давления и ЧСС');
              }
              if (analysis.contraIssues.length > 0) {
                lines.push(`⚠ ${analysis.contraIssues.length} противопоказаний по профилю здоровья`);
              }
              if (analysis.timingTips.length > 0) {
                lines.push(`🕐 ${analysis.timingTips.length} рекомендаций по режиму приёма`);
              }
              if (analysis.suggestions.length > 0) {
                lines.push(`🔮 ${analysis.suggestions.length} предложений по усилению стека`);
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {lines.map((l, i) => (
                    <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{l}</div>
                  ))}
                </div>
              );
            })()}
          </GlassCard>
        </>
      )}
    </div>
  );
}

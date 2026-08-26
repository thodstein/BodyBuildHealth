import React, { useState, useMemo, useEffect } from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import {
  checkDrugInteractions,
  getClassInstructions,
  getCourseRecommendations,
  findInteractionsForSubstance,
  calculateInteractions,
  filterAndSortInteractions,
  type InteractionAlert,
} from '../../../engines/interactions-calculator';
import { UnifiedInteractionCard } from '../../components/UnifiedInteractionCard';
import { TimingTelemetryPanel } from '../../components/TimingTelemetryPanel';
import type { CourseEntry } from '../../../core/types';
import { resolveInteractionId, type Interaction as SupportInteraction } from '../../../data/support-interactions-db';
import { SYNERGY_PAIRS } from '../../../engines/support.engine';
import { decodeGarbled } from '../../../utils/text-sanitizer';
import { useDataLink } from '../../../core/data-link';

const PHARMA_INTERACT_FILTER = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','igf1','mgf','insulin','peptide_ghrh','peptide_ghrp','peptide_gnrh','peptide_fat_loss','peptide_other']);

export const InteractionCheckerTab: React.FC = () => {
  const linked = useDataLink();
  const [interactSub, setInteractSub] = useState<'interactions' | 'synergies' | 'unified'>('interactions');
  const [unifiedOnlyCritical, setUnifiedOnlyCritical] = useState(false);
  const [unifiedSeverity, setUnifiedSeverity] = useState<'CRITICAL'|'HIGH'|'ALL'>('HIGH');
  const [interactDetail, setInteractDetail] = useState<'conflicts' | 'instructions'>('conflicts');
  const allSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      !!s?.name && PHARMA_INTERACT_FILTER.has(s.class)
    );
  }, []);
  const synergyToPharmaId = (id: string): string => {
    const map: Record<string, string> = {
      testosterone_enanthate: 'test_enan', testosterone_cypionate: 'test_cyp', testosterone_propionate: 'test_prop',
      trenbolone_acetate: 'tren_acet', trenbolone_enanthate: 'tren_enan', nandrolone_decanoate: 'deca',
      nandrolone_phenylprop: 'npp', boldenone_undecylenate: 'bold_undec', methenolone_enanthate: 'prim_enan',
      methandienone: 'methand', oxandrolone: 'oxan', oxymetholone: 'anadrol', stanozolol: 'stan',
      drostanolone_propionate: 'masteron', drostanolone_enanthate: 'masteron_enan',
      cabergoline: 'caberg', anastrozole: 'anastro', hcg: 'hcg', tamoxifen: 'tamox',
      clomiphene: 'clomi', letrozole: 'letrozole', raloxifene: 'raloxifene',
    };
    return map[id] || id;
  };

  const pharmaSynergyMap = useMemo(() => {
    const map: Record<string, Array<{ partnerId: string; partnerName: string; pair: typeof SYNERGY_PAIRS[0] }>> = {};
    const pharmaIds = new Set(allSubstances.map(s => s.id));
    for (const p of SYNERGY_PAIRS) {
      const aKey = synergyToPharmaId(p.substanceA);
      const bKey = synergyToPharmaId(p.substanceB);
      if (!pharmaIds.has(aKey) || !pharmaIds.has(bKey)) continue;
      if (!map[aKey]) map[aKey] = [];
      if (!map[bKey]) map[bKey] = [];
      const aName = (PHARMA_DB[aKey]?.name || p.substanceA).replace(/\(.*\)/, '').trim();
      const bName = (PHARMA_DB[bKey]?.name || p.substanceB).replace(/\(.*\)/, '').trim();
      map[aKey].push({ partnerId: bKey, partnerName: bName, pair: p });
      map[bKey].push({ partnerId: aKey, partnerName: aName, pair: p });
    }
    return map;
  }, []);

  const pharmaSubstancesWithSynergies = useMemo(() => {
    return allSubstances.filter(s => pharmaSynergyMap[s.id]?.length > 0).sort((a, b) => (b.name||'').localeCompare(a.name||''));
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>(['', '']);
  const [doseMgWk, setDoseMgWk] = useState(300);
  useEffect(() => {
    const courseIds = (linked.course || []).map(c => c.substanceId).filter(Boolean);
    if (courseIds.length > 0 && selectedIds.every(id => !id)) {
      setSelectedIds(courseIds.slice(0, Math.min(4, courseIds.length)));
    }
  }, [(linked.course || []).length]);

  const addDrug = () => setSelectedIds([...selectedIds, '']);
  const removeDrug = (idx: number) => setSelectedIds(selectedIds.filter((_, i) => i !== idx));
  const updateDrug = (idx: number, value: string) => {
    const updated = [...selectedIds];
    updated[idx] = value;
    setSelectedIds(updated);
  };

  const validIds = useMemo(() => selectedIds.filter(Boolean), [selectedIds]);
  const selectedPharma = useMemo(() => {
    if (validIds.length === 0) return allSubstances;
    const idSet = new Set(validIds);
    return allSubstances.filter(s => idSet.has(s.id));
  }, [allSubstances, validIds]);

  const alerts = useMemo(() => {
    if (validIds.length < 2) return [];
    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`, substanceId: id, doseValue: doseMgWk, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12,
    }));
    try { return checkDrugInteractions(course); } catch { return []; }
  }, [selectedIds, doseMgWk]);

  const courseRecs = useMemo(() => {
    if (validIds.length < 1) return [];
    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`, substanceId: id, doseValue: doseMgWk, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12,
    }));
    try { return getCourseRecommendations(course); } catch { return []; }
  }, [validIds, doseMgWk]);

  const classInstructions = useMemo(() => {
    if (validIds.length < 1) return [];
    const course: CourseEntry[] = validIds.map((id, i) => ({
      id: `${id}-${i}`, substanceId: id, doseValue: doseMgWk, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12,
    }));
    try { return getClassInstructions(course); } catch { return []; }
  }, [validIds]);

  const hasAlerts = alerts.length > 0;
  const hasRecs = courseRecs.length > 0;
  const hasInstructions = classInstructions.length > 0;

  const supportCrossAlerts = useMemo(() => {
    if (validIds.length < 2) return [];
    const results: SupportInteraction[] = [];
    const resolvedIds = validIds.map(id => ({ original: id, resolved: resolveInteractionId(id) }));
    for (const { resolved: resolvedId } of resolvedIds) {
      const interactions = findInteractionsForSubstance(resolvedId);
      for (const inter of interactions) {
        const otherResolved = resolveInteractionId(inter.substanceA) === resolvedId ? resolveInteractionId(inter.substanceB) : resolveInteractionId(inter.substanceA);
        const otherOriginal = resolvedIds.find(r => r.resolved === otherResolved);
        if (otherOriginal && !results.some(r => r.id === inter.id)) results.push(inter);
      }
    }
    return results;
  }, [validIds]);
  const hasSupportAlerts = supportCrossAlerts.length > 0;

  const alertTypeColors: Record<InteractionAlert['type'], { bg: string; border: string; text: string; label: string }> = {
    critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.18)', text: '#f87171', label: 'КРИТИЧНО' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', text: '#fbbf24', label: 'ВНИМАНИЕ' },
    info: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.18)', text: '#60a5fa', label: 'ИНФО' },
  };

  const subTabs: Array<{ id: 'interactions' | 'synergies' | 'unified'; label: string }> = [
    { id: 'interactions', label: '⚡ Взаимодействия' },
    { id: 'synergies', label: '💥 Синергии' },
    { id: 'unified', label: '🔬 Unified' },
  ];

  const card: React.CSSProperties = { background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:14, boxShadow:'0 6px 18px rgba(0,0,0,0.18)' };

  const unifiedView = useMemo((): React.ReactElement => {
    const validIdsForUnified = validIds.length > 0 ? validIds : [''];
    const courseForUnified: CourseEntry[] = validIdsForUnified.filter(Boolean).map((id, i) => ({
      id: `${id}-${i}`, substanceId: id, doseValue: doseMgWk, doseUnit: 'mg/wk', frequency: '2x/week', startWeek: 0, endWeek: 12,
    }));
    try {
      const result = calculateInteractions({
        substances: validIdsForUnified.filter(Boolean),
        course: courseForUnified.filter(c => c.substanceId),
      });
      const items = filterAndSortInteractions(result.all,
        unifiedOnlyCritical ? { onlyCritical: true } :
        unifiedSeverity === 'HIGH' ? { maxSeverity: 'HIGH' } : {}
      );
      return (
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
            <span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.18)', fontSize:11 }}>🔬</span>
            <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Unified View</span>
            <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>{result.all.length} пар</span>
          </div>
          <p style={{ fontSize:11, color:'#fff', margin:'0 0 10px', lineHeight:1.4 }}>
            Объединённый список из AAS/PED и БАД-правил — единый safety score.
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap', background:'rgba(0,0,0,0.18)', padding:'8px 10px', borderRadius:11, border:'1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>Score</span>
            <span style={{ fontSize:18, fontWeight:900, color: result.score < 50 ? '#f87171' : result.score < 80 ? '#fbbf24' : '#00e68a' }}>{result.score}/100</span>
            {result.blocked && <span style={{ fontSize:10, fontWeight:800, padding:'3px 7px', borderRadius:20, background:'rgba(239,68,68,0.12)', color:'#f87171', border:'1px solid rgba(239,68,68,0.18)' }}>⛔ BLOCKED</span>}
            <span style={{ fontSize:10, color:'#fff' }}>{result.bySeverity.CRITICAL.length} CRIT · {result.bySeverity.HIGH.length} HIGH</span>
            <div style={{ marginLeft:'auto', display:'flex', gap:2 }}>
              {(['CRITICAL','HIGH','ALL'] as const).map(s => (
                <button key={s} onClick={() => { if (s==='CRITICAL') { setUnifiedOnlyCritical(true); } else { setUnifiedOnlyCritical(false); setUnifiedSeverity(s); } }} style={{
                  padding:'5px 8px', borderRadius: s==='CRITICAL'?'20px 0 0 20px': s==='ALL'?'0 20px 20px 0':'0', fontSize:10, fontWeight:800, cursor:'pointer',
                  background: (s==='CRITICAL'&&unifiedOnlyCritical)||(s==='HIGH'&&!unifiedOnlyCritical&&unifiedSeverity==='HIGH')||(s==='ALL'&&!unifiedOnlyCritical&&unifiedSeverity==='ALL') ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.06)',
                  color: (s==='CRITICAL'&&unifiedOnlyCritical)||(s==='HIGH'&&!unifiedOnlyCritical&&unifiedSeverity==='HIGH')||(s==='ALL'&&!unifiedOnlyCritical&&unifiedSeverity==='ALL') ? '#fff' : 'rgba(255,255,255,0.52)',
                  border:'1px solid rgba(255,255,255,0.07)',
                }}>{s==='CRITICAL'?'🔴 Крит':s==='HIGH'?'⚠ Высокие':'Все'}</button>
              ))}
            </div>
          </div>
          <TimingTelemetryPanel autoRefreshMs={3000} />
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:10 }}>
            {items.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'#fff', fontSize:12, background:'rgba(0,0,0,0.14)', borderRadius:10, border:'1px dashed rgba(255,255,255,0.06)' }}>
                {unifiedOnlyCritical ? '✅ Нет CRITICAL' : 'Нет взаимодействий — стек чист'}
              </div>
            ) : items.map((item, i) => (
              <UnifiedInteractionCard key={i} item={item} />
            ))}
          </div>
        </div>
      );
    } catch (e) {
      return <div style={{ textAlign:'center', padding:20, color:'#f87171', fontSize:12, ...card }}>Ошибка: {String(e)}</div>;
    }
  }, [validIds, doseMgWk, unifiedOnlyCritical, unifiedSeverity]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.06))', border:'1px solid rgba(239,68,68,0.12)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.18)', fontSize:12 }}>⚡</span>
          <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Проверка взаимодействий</span>
        </div>
        <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.45 }}>Собери стек — увидишь конфликты, синергии и рекомендации по защите. Данные тянутся из курса.</div>
      </div>

      {/* drug selector */}
      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
          <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>💊 Стек для проверки</span>
          <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{validIds.length} выбрано</span>
          <button onClick={addDrug} style={{ padding:'5px 10px', borderRadius:20, border:'1px dashed rgba(139,92,246,0.32)', background:'rgba(139,92,246,0.08)', color:'#a78bfa', fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Препарат</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:8 }}>
          {selectedIds.map((id, idx)=>(
            <div key={idx} style={{ display:'flex', gap:6, alignItems:'center' }}>
              <select value={id} onChange={e=>updateDrug(idx, e.target.value)} style={{ flex:1, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:600, outline:'none' }}>
                <option value="" style={{ background:'#1a1a1f' }}>— выбери препарат —</option>
                {allSubstances.map(s=> <option key={s.id} value={s.id} style={{ background:'#1a1a1f' }}>{s.name} · {s.class}</option>)}
              </select>
              {selectedIds.length>1 && <button onClick={()=>removeDrug(idx)} style={{ width:30, height:30, borderRadius:9, border:'1px solid rgba(239,68,68,0.18)', background:'rgba(239,68,68,0.10)', color:'#f87171', cursor:'pointer', fontWeight:800 }}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4 }}>Доза на препарат (мг/нед)</label>
            <input type="number" value={doseMgWk} onChange={e=>setDoseMgWk(parseFloat(e.target.value)||0)} style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
          </div>
          <div style={{ display:'flex', alignItems:'flex-end' }}>
            <div style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', padding:'8px 10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.06)', flex:1 }}>
              Подсказка: доза влияет на силу алертов. Оставь 300 для теста.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
        {subTabs.map((t) => (
          <button key={t.id} onClick={() => setInteractSub(t.id)} style={{
            padding:'7px 13px', borderRadius:20, fontSize:11, fontWeight:800, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0, transition:'all 0.18s ease',
            background: interactSub === t.id ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(255,255,255,0.06)',
            color: interactSub === t.id ? '#fff' : 'rgba(255,255,255,0.62)',
            border:`1px solid ${interactSub === t.id ? 'rgba(239,68,68,0.32)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: interactSub===t.id ? '0 4px 12px rgba(239,68,68,0.18)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {interactSub === 'synergies' ? (
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
            <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.12)', fontSize:11 }}>💥</span>
            <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Синергии по препаратам</span>
            <span style={{ marginLeft:'auto', fontSize:10, color:'#fff' }}>{pharmaSubstancesWithSynergies.length} с парами</span>
          </div>
          <p style={{ fontSize:11, color:'#fff', margin:'0 0 10px', lineHeight:1.4 }}>
            Готовые стеки с оценкой синергии — для планирования комбинаций.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:520, overflowY:'auto', paddingRight:2 }}>
            {pharmaSubstancesWithSynergies.map(sub => {
              const synergies = pharmaSynergyMap[sub.id] || [];
              return (
                <div key={sub.id} style={{ borderRadius:12, padding:'11px', background:'rgba(0,0,0,0.16)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>
                    💊 {sub.name} <span style={{ background:'rgba(0,230,138,0.10)', color:'#00e68a', padding:'2px 7px', borderRadius:20, fontSize:10, border:'1px solid rgba(0,230,138,0.14)' }}>{synergies.length} синергий</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {synergies.map((s, i) => {
                      const p = s.pair;
                      const stColor = p.synergyType === 'synergistic' ? '#00e68a' : p.synergyType === 'additive' ? '#60a5fa' : p.synergyType === 'potentiative' ? '#f59e0b' : '#a78bfa';
                      const stBg = p.synergyType === 'synergistic' ? 'rgba(0,230,138,0.08)' : p.synergyType === 'additive' ? 'rgba(59,130,246,0.08)' : p.synergyType === 'potentiative' ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.08)';
                      return (
                        <div key={i} style={{ padding:'8px 10px', borderRadius:10, background: stBg, border:`1px solid ${stColor}18` }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                            <span style={{ fontSize:10, fontWeight:800, padding:'3px 7px', borderRadius:20, background:`${stColor}14`, color: stColor, border:`1px solid ${stColor}22` }}>
                              {p.synergyType === 'synergistic' ? '⊕ Синергия' : p.synergyType === 'additive' ? '+ Аддитивно' : p.synergyType === 'potentiative' ? '↗ Усиление' : '↔ Дополнение'}
                            </span>
                            <span style={{ fontSize:11, fontWeight:800, color: stColor }}>{Math.round(p.strength * 100)}%</span>
                          </div>
                          <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginBottom:2 }}>+ {s.partnerName}</div>
                          <div style={{ fontSize:10, color:'#fff', lineHeight:1.35 }}>{decodeGarbled(p.mechanism).slice(0, 140)}{p.mechanism.length>140?'…':''}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {pharmaSubstancesWithSynergies.length === 0 && (
              <div style={{ textAlign:'center', padding:20, color:'#fff', fontSize:12 }}>Нет синергий для отображения</div>
            )}
          </div>
        </div>
      ) : interactSub === 'unified' ? unifiedView : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {hasAlerts && (
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,0.12)', fontSize:11 }}>🚨</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>Обнаруженные взаимодействия</span>
                <span style={{ marginLeft:'auto', background:'rgba(239,68,68,0.12)', color:'#f87171', padding:'2px 7px', borderRadius:20, fontSize:10, fontWeight:800, border:'1px solid rgba(239,68,68,0.16)' }}>{alerts.length}</span>
              </div>
              <p style={{ fontSize:11, color:'#fff', margin:'0 0 10px' }}>Авто-детект для выбранного стека</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {alerts.map((alert, i) => {
                  const colors = alertTypeColors[alert.type];
                  return (
                    <div key={i} style={{ padding:'11px', borderRadius:12, background: colors.bg, border:`1px solid ${colors.border}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:10, fontWeight:800, padding:'3px 7px', borderRadius:20, background:`${colors.text}16`, color: colors.text, border:`1px solid ${colors.border}`, letterSpacing:0.3 }}>{colors.label}</span>
                        <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{alert.drugs.map(d => PHARMA_DB[d]?.name || d).join(' + ')}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#fff', lineHeight:1.45, background:'rgba(0,0,0,0.14)', padding:'7px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>
                        <b style={{ color:'#fff' }}>Механизм:</b> {alert.mechanism}
                      </div>
                      <div style={{ fontSize:11, color: colors.text, lineHeight:1.45, padding:'7px 8px', borderRadius:8, background:`${colors.text}0d`, border:`1px solid ${colors.border}`, marginTop:6 }}>
                        <b>Рекомендация:</b> {alert.recommendation}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasRecs && (
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(59,130,246,0.12)', fontSize:11 }}>📋</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#60a5fa' }}>Рекомендации для курса</span>
              </div>
              <p style={{ fontSize:11, color:'#fff', margin:'0 0 10px' }}>Защита органов и лаб-мониторинг</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {courseRecs.map((rec, i) => {
                  const typeColor = rec.type === 'critical' ? '#f87171' : rec.type === 'warning' ? '#fbbf24' : '#60a5fa';
                  const bg = rec.type==='critical' ? 'rgba(239,68,68,0.06)' : rec.type==='warning' ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.06)';
                  return (
                    <div key={i} style={{ padding:'11px', borderRadius:12, background:bg, border:`1px solid ${typeColor}18` }}>
                      <div style={{ fontSize:12, fontWeight:800, color: typeColor, marginBottom:6 }}>{rec.title}</div>
                      {rec.items.map((item, j) => (
                        <div key={j} style={{ fontSize:11, color:'#fff', lineHeight:1.45, padding:'3px 0 3px 14px', position:'relative' }}>
                          <span style={{ position:'absolute', left:0, color: typeColor, fontWeight:800 }}>•</span>{item}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {hasInstructions && (
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.12)', fontSize:11 }}>📌</span>
                <span style={{ fontSize:13, fontWeight:800, color:'#fbbf24' }}>Особые указания по классам</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                {classInstructions.map((cls, i) => (
                  <div key={i} style={{ padding:'11px', borderRadius:12, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#fbbf24', marginBottom:8 }}>💊 {cls.className}</div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#00e68a', marginBottom:4 }}>Инструкции</div>
                      {cls.instructions.map((inst, j) => (
                        <div key={j} style={{ fontSize:11, color:'#fff', lineHeight:1.4, padding:'2px 0 2px 14px', position:'relative' }}>
                          <span style={{ position:'absolute', left:0, color:'#00e68a' }}>•</span>{inst}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#fbbf24', marginBottom:4 }}>🩸 Мониторинг</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {cls.monitoring.map((m, j) => (
                          <span key={j} style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(245,158,11,0.10)', color:'#fbbf24', border:'1px solid rgba(245,158,11,0.14)', fontWeight:600 }}>{m}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:800, color:'#f87171', marginBottom:4 }}>⚠ Предупреждения</div>
                      {cls.warnings.map((w, j) => (
                        <div key={j} style={{ fontSize:11, color:'#fff', lineHeight:1.4, padding:'4px 0 4px 10px', borderLeft:'3px solid rgba(239,68,68,0.22)', marginBottom:4, background:'rgba(239,68,68,0.04)', borderRadius:6 }}>{w}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ display:'flex', gap:6, marginBottom:10, overflowX:'auto', scrollbarWidth:'none' }}>
              {(['conflicts','instructions'] as const).map(t => (
                <button key={t} onClick={() => setInteractDetail(t)} style={{
                  padding:'6px 12px', borderRadius:20, fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap',
                  background: interactDetail === t ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                  color: interactDetail === t ? '#f87171' : 'rgba(255,255,255,0.52)',
                  border:`1px solid ${interactDetail === t ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)'}`,
                }}>{t === 'conflicts' ? '🔴 Конфликты' : '📋 Указания'}</button>
              ))}
            </div>

            {interactDetail === 'conflicts' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:6 }}>⚡ Взаимодействия по препаратам <span style={{ marginLeft:'auto', fontSize:10, color:'#fff' }}>{validIds.length ? `${selectedPharma.length} показано` : `${allSubstances.length} всего`}</span></div>
                {(validIds.length === 0 ? allSubstances : selectedPharma).slice(0, 12).map(sub => {
                  const conflicts = sub.conflicts || [];
                  const linkedSubs = (sub.linkedSubstances || []).filter(ls => PHARMA_DB[ls.id]);
                  if (conflicts.length === 0 && linkedSubs.length === 0) return null;
                  return (
                    <div key={sub.id} style={{ borderRadius:11, padding:'10px', background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:6 }}>💊 {sub.name}</div>
                      {conflicts.length > 0 && (
                        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:6 }}>
                          {conflicts.slice(0,3).map((c, i) => {
                            const sevColor = c.severity === 'HIGH' ? '#f87171' : c.severity === 'MEDIUM' ? '#fbbf24' : '#9ca3af';
                            const bg = c.severity==='HIGH' ? 'rgba(239,68,68,0.08)' : c.severity==='MEDIUM' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)';
                            return (
                              <div key={i} style={{ padding:'7px 8px', borderRadius:9, background:bg, border:`1px solid ${sevColor}22` }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                                  <span style={{ fontSize:10, fontWeight:800, color: sevColor }}>{c.with}</span>
                                  <span style={{ fontSize:9, padding:'1px 6px', borderRadius:20, background:`${sevColor}16`, color: sevColor, fontWeight:800, border:`1px solid ${sevColor}22` }}>{c.severity}</span>
                                </div>
                                <div style={{ fontSize:10, color:'#fff', lineHeight:1.35 }}>{c.effect}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {linkedSubs.length > 0 && (
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {linkedSubs.slice(0,4).map((ls, i) => (
                            <span key={i} style={{ fontSize:10, padding:'3px 7px', borderRadius:20,
                              background: ls.type === 'synergy' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                              border:`1px solid ${ls.type === 'synergy' ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)'}`,
                              color: ls.type === 'synergy' ? '#4ade80' : '#f87171', fontWeight:600,
                            }}>
                              {ls.type === 'synergy' ? '⊕' : '⊖'} {PHARMA_DB[ls.id]?.name || ls.id}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(validIds.length === 0 ? allSubstances : selectedPharma).length > 12 && (
                  <div style={{ textAlign:'center', fontSize:11, color:'#fff', padding:6 }}>Показаны первые 12 — сузь стек для фокуса</div>
                )}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto', paddingRight:2 }}>
                {allSubstances.filter(s=> (s.specialInstructions?.length||0)>0 || (s.contraindications?.length||0)>0).slice(0,10).map(sub => (
                  <div key={sub.id} style={{ borderRadius:11, padding:'10px', background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:6 }}>💊 {sub.name}</div>
                    {(sub.specialInstructions||[]).slice(0,2).map((si, j) => (
                      <div key={j} style={{ fontSize:10, color:'#fff', lineHeight:1.4, padding:'2px 0 2px 12px', position:'relative' }}>
                        <span style={{ position:'absolute', left:0, color:'#fbbf24' }}>•</span>{si}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasSupportAlerts && (
            <div style={card}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.12)', fontSize:11 }}>🔗</span>
                <span style={{ fontSize:12, fontWeight:800, color:'#c4b5fd' }}>Кросс-взаимодействия с поддержкой</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {supportCrossAlerts.slice(0,5).map((inter, i) => (
                  <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#c4b5fd' }}>{inter.substanceA} ↔ {inter.substanceB}</div>
                    <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>{inter.effect}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasAlerts && !hasRecs && !hasInstructions && validIds.length >= 2 && (
            <div style={{ ...card, textAlign:'center', padding:18 }}>
              <div style={{ width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px', background:'rgba(0,230,138,0.10)', border:'1px solid rgba(0,230,138,0.14)', fontSize:16 }}>✅</div>
              <div style={{ fontSize:12, fontWeight:800, color:'#00e68a' }}>Не обнаружено критических взаимодействий</div>
              <div style={{ fontSize:11, color:'#fff', marginTop:4 }}>Стек выглядит чистым — но соблюдай дозировки и мониторинг.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

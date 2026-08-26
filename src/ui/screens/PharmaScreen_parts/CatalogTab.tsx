import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PHARMA_DB, getPharmaDetail } from '../../../core/pharma-database';
import { db } from '../../../core/db';
import { PHARMA_DETAILS, type PharmaDetail } from '../../../data/support-category-data';
import type { PharmaSubstance, PD } from '../../../core/types';
import { decodeGarbled } from '../../../utils/text-sanitizer';
import { getDrugTzMechanisms, TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS } from '../../../data/support-db';
import { getLabEffectsForDrug, getMarkerName } from '../../../data/support-lab-effects';
import { getPharmaLabMarkers } from '../../../data/pharma-lab-marker-map';
import {
  SYSTEM_LABELS, CLASS_LABELS, PD_LABELS, PD_MECHANISMS, PHARMA_MECH_LABELS,
  CV_LABELS, CV_VALUE_LABELS, CV_VALUE_COLORS, pdBarColor, formatHalfLife,
  PHARMA_CLASSES, type PharmaClass,
} from './constants';

export const DrugDetailCard: React.FC<{ sub: PharmaSubstance; detail?: PharmaDetail }> = React.memo(({ sub, detail }) => {
  const pd = sub.pd || {} as PharmaSubstance['pd'];
  const pdEntries = Object.entries(pd) as [keyof PD, number][];
  const [expandedPD, setExpandedPD] = useState<string | null>(null);

  const handleAddToCourse = useCallback(() => {
    const dr = (detail?.dosageRange || sub.dosageRange);
    const val = dr ? Math.round((dr.min + dr.max) / 2) : 250;
    const unit = dr?.unit || 'mg/wk';
    db.put('course_log', {
      id: crypto.randomUUID(), substanceId: sub.id,
      doseValue: val, doseUnit: unit,
      frequency: typeof dr?.frequency === 'number' ? dr.frequency : 2,
      startWeek: 1, endWeek: 12,
    }).catch(() => {});
  }, [sub.id, sub.dosageRange, detail?.dosageRange]);

  const handleAddToCart = useCallback(() => {
    try {
      const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
      if (!existing.some((x: any) => x.id === sub.id)) {
        localStorage.setItem('supportCart', JSON.stringify([...existing, { id: sub.id, name: sub.name, dose: (detail?.dosageRange || sub.dosageRange)?.min ? `${(detail?.dosageRange || sub.dosageRange)!.min} ${(detail?.dosageRange || sub.dosageRange)!.unit}` : '—', timing: 'daily' }]));
      }
    } catch {}
  }, [sub.id, sub.name, sub.dosageRange, detail?.dosageRange]);

  const riskLabels = useMemo(() => {
    const labels: string[] = [];
    if (pd.hepatotoxicity >= 2) labels.push('Гепатотоксичен');
    if (pd.aromatization >= 0.7) labels.push('Ароматизируется');
    if (pd.progestogenic >= 0.3) labels.push('Прогестагенный');
    if (pd.neuro_toxicity >= 0.3) labels.push('Нейротоксичен');
    if (pd.lipid_impact <= -0.5) labels.push('Ухудшает липиды');
    if (pd.hct_impact >= 4) labels.push('Повышает HCT');
    return labels;
  }, [pd.hepatotoxicity, pd.aromatization, pd.progestogenic, pd.neuro_toxicity, pd.lipid_impact, pd.hct_impact]);

  const effectLabels = useMemo(() => {
    const labels: string[] = [];
    if (pd.AR_affinity >= 1.0) labels.push('Высокая андрогенность');
    else if (pd.AR_affinity >= 0.7) labels.push('Средняя андрогенность');
    if (pd.five_alpha_reduction >= 0.5) labels.push('Восст. в ДГТ');
    if (pd.aromatization === 0) labels.push('Не ароматизируется');
    if (sub.class === 'sarm') labels.push('SARM (селективный)');
    return labels;
  }, [pd.AR_affinity, pd.five_alpha_reduction, pd.aromatization, sub.class]);

  const labMarkers = useMemo(() => getPharmaLabMarkers(sub.id), [sub.id]);

  const tzGroupedData = useMemo(() => {
    const tzMechs = getDrugTzMechanisms(sub.id);
    if (!tzMechs.length) return null;
    const grouped: Record<string, { mechId: string; label: string; weight: number }[]> = {};
    for (const m of tzMechs) {
      if (!grouped[m.organId]) grouped[m.organId] = [];
      grouped[m.organId].push({ mechId: m.mechId, label: TZ_MECH_LABELS[m.mechId] || m.mechId, weight: m.weight });
    }
    return grouped;
  }, [sub.id]);

  const labInfoData = useMemo(() => getLabEffectsForDrug(sub.id), [sub.id]);
  const dirColor: Record<string, string> = { up: '#ef4444', down: '#00e68a', normalize: '#60a5fa' };
  const dirArrow: Record<string, string> = { up: '↑', down: '↓', normalize: '↕' };

  return (
    <div style={{ fontSize:12, lineHeight:1.6, display:'flex', flexDirection:'column', gap:12 }}>
      {/* hero header */}
      <div style={{ padding:'14px', borderRadius:14, background:'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(59,130,246,0.08))', border:'1px solid rgba(139,92,246,0.18)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 320px 140px at 85% 0%, rgba(139,92,246,0.18), transparent 60%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', display:'flex', alignItems:'flex-start', gap:10 }}>
          <div style={{ width:40, height:40, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', fontSize:16, flexShrink:0, boxShadow:'0 6px 16px rgba(139,92,246,0.35)' }}>🧬</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', letterSpacing:-0.3, lineHeight:1.1 }}>{sub.name}</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
              <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.78)', fontWeight:700 }}>{CLASS_LABELS[sub.class] || sub.class}</span>
              {sub.pk && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(0,230,138,0.10)', border:'1px solid rgba(0,230,138,0.18)', color:'#00e68a', fontWeight:700 }}>T½ {formatHalfLife(sub.pk.halfLifeHours)}</span>}
              {sub.pk && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'rgba(59,130,246,0.10)', border:'1px solid rgba(59,130,246,0.18)', color:'#60a5fa', fontWeight:700 }}>{(sub.pk.bioavailability*100).toFixed(0)}% биодоступность</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {[
          { k:'Класс', v: CLASS_LABELS[sub.class] || sub.class },
          { k:'T½', v: sub.pk ? formatHalfLife(sub.pk.halfLifeHours) : '—' },
          { k:'Биодоступность', v: sub.pk ? (sub.pk.bioavailability * 100).toFixed(0)+'%' : '—' },
          { k:'Vd', v: sub.pk ? sub.pk.Vd + ' л' : '—' },
        ].map(i=>(
          <div key={i.k} style={{ padding:'8px 10px', borderRadius:11, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:700, letterSpacing:0.4, textTransform:'uppercase' as const }}>{i.k}</div>
            <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginTop:2 }}>{i.v}</div>
          </div>
        ))}
        <div style={{ gridColumn:'1 / -1', padding:'8px 10px', borderRadius:11, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:700, letterSpacing:0.4, textTransform:'uppercase' as const }}>Эстеры</div>
          <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginTop:2 }}>{sub.esters?.join(', ') || '—'}</div>
        </div>
      </div>

      {sub.targetSystems && sub.targetSystems.length > 0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.12)' }}>
          <div style={{ fontSize:10, color:'#818cf8', fontWeight:800, marginBottom:6, letterSpacing:0.3 }}>🎯 Системы-мишени</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {sub.targetSystems.map(s => (
              <span key={s} style={{ fontSize:10, padding:'4px 9px', borderRadius:20, background:'rgba(99,102,241,0.12)', color:'#a5b4fc', fontWeight:700, border:'1px solid rgba(99,102,241,0.18)' }}>{SYSTEM_LABELS[s] || s}</span>
            ))}
          </div>
        </div>
      )}

      {sub.cvProfile && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.12)' }}>
          <div style={{ fontSize:10, color:'#f87171', fontWeight:800, marginBottom:6 }}>❤️ Сердечно-сосудистый профиль</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {Object.entries(sub.cvProfile).map(([key, val]) => {
              const lbl = CV_VALUE_LABELS[key]?.[val] || val;
              const clr = CV_VALUE_COLORS[key]?.[val] || '#9e9e9e';
              return (
                <span key={key} style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:`${clr}14`, color:clr, fontWeight:700, border:`1px solid ${clr}22` }}>{CV_LABELS[key] || key}: {lbl}</span>
              );
            })}
          </div>
        </div>
      )}
      {labMarkers.length > 0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)' }}>
          <div style={{ fontSize:10, color:'#f59e0b', fontWeight:800, marginBottom:6 }}>🩸 Контролировать анализы</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {labMarkers.map((marker: string) => (
              <span key={marker} style={{ fontSize:10, padding:'4px 9px', borderRadius:20, background:'rgba(245,158,11,0.12)', color:'#fbbf24', fontWeight:700, border:'1px solid rgba(245,158,11,0.18)' }}>{marker}</span>
            ))}
          </div>
        </div>
      )}

      {sub.linkedRisks && sub.linkedRisks.length > 0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', fontWeight:800, marginBottom:6 }}>Связанные риски</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {sub.linkedRisks.map((r, i) => (
              <span key={i} style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background: r.direction === 'down' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)', color: r.direction === 'down' ? '#4ade80' : '#f87171', fontWeight:700, border:`1px solid ${r.direction==='down'?'rgba(34,197,94,0.18)':'rgba(239,68,68,0.18)'}` }}>
                {SYSTEM_LABELS[r.system] || r.system} {r.direction === 'up' ? '↑' : '↓'} {Math.round(r.strength * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {sub.linkedSubstances && sub.linkedSubstances.length > 0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
          <div style={{ fontSize:11, color:'#00e68a', fontWeight:800, marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>🔗 Связанные вещества <span style={{ marginLeft:'auto', fontSize:10, background:'rgba(0,230,138,0.12)', padding:'2px 7px', borderRadius:20, color:'#00e68a' }}>{sub.linkedSubstances.length}</span></div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {sub.linkedSubstances.map((ls, i) => {
              const linked = PHARMA_DB[ls.id];
              const isSynergy = ls.type === 'synergy';
              const clr = isSynergy ? '#00e68a' : '#ef4444';
              const bg = isSynergy ? 'rgba(0,230,138,0.08)' : 'rgba(239,68,68,0.08)';
              const border = isSynergy ? 'rgba(0,230,138,0.18)' : 'rgba(239,68,68,0.18)';
              return (
                <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:bg, border:`1px solid ${border}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:clr }}>{isSynergy ? '⊕' : '⊖'} {linked?.name || ls.id}</span>
                    <span style={{ fontSize:9, padding:'2px 6px', borderRadius:20, background:`${clr}18`, color:clr, fontWeight:800 }}>
                      {isSynergy ? 'СИНЕРГИЯ' : 'АНТАГОНИЗМ'} {Math.round(ls.strength * 100)}%
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.72)', lineHeight:1.4 }}>{ls.mechanism}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sub.conflicts && sub.conflicts.length > 0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.14)' }}>
          <div style={{ fontSize:11, color:'#f87171', fontWeight:800, marginBottom:7 }}>🔴 Конфликты и несовместимости</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {sub.conflicts.map((c, i) => {
              const sevBg = c.severity === 'HIGH' ? 'rgba(239,68,68,0.10)' : c.severity === 'MEDIUM' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)';
              const sevBorder = c.severity === 'HIGH' ? 'rgba(239,68,68,0.22)' : c.severity === 'MEDIUM' ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.07)';
              const sevColor = c.severity === 'HIGH' ? '#f87171' : c.severity === 'MEDIUM' ? '#fbbf24' : '#9ca3af';
              return (
                <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:sevBg, border:`1px solid ${sevBorder}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:10, fontWeight:800, color:sevColor }}>{c.with}</span>
                    <span style={{ fontSize:9, padding:'2px 6px', borderRadius:20, background:`${sevColor}16`, color:sevColor, fontWeight:800 }}>{c.severity}</span>
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.78)', lineHeight:1.4 }}>{c.effect}</div>
                  {c.mechanism && <div style={{ fontSize:9, color:'rgba(255,255,255,0.42)', marginTop:4, fontStyle:'italic' }}>{c.mechanism}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sub.specialInstructions && sub.specialInstructions.length > 0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.16)' }}>
          <div style={{ fontSize:11, color:'#fbbf24', fontWeight:800, marginBottom:7 }}>📋 Особые указания</div>
          {sub.specialInstructions.map((si, i) => (
            <div key={i} style={{ fontSize:10, color:'rgba(255,255,255,0.84)', lineHeight:1.5, padding:'4px 0 4px 14px', position:'relative', borderBottom: i < sub.specialInstructions!.length-1 ? '1px solid rgba(245,158,11,0.08)' : 'none' }}>
              <span style={{ position:'absolute', left:0, color:'#f59e0b', fontWeight:800 }}>•</span>{si}
            </div>
          ))}
        </div>
      )}

      {(sub.contraindications || detail?.contraindications) && (sub.contraindications || detail?.contraindications || []).length>0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)' }}>
          <div style={{ fontSize:10, color:'#f87171', fontWeight:800, marginBottom:6 }}>🚫 Противопоказания</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {(sub.contraindications || detail?.contraindications || []).map((c: string, i: number) => (
              <span key={i} style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(239,68,68,0.08)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.12)', fontWeight:600 }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {(sub.sideEffects || detail?.sideEffects) && (sub.sideEffects || detail?.sideEffects || []).length>0 && (
        <div style={{ padding:'10px 12px', borderRadius:12, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.12)' }}>
          <div style={{ fontSize:10, color:'#fbbf24', fontWeight:800, marginBottom:6 }}>⚠ Побочные эффекты</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {(sub.sideEffects || detail?.sideEffects || []).map((se: any, i: number) => {
              if (typeof se === 'string') return <span key={i} style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background:'rgba(245,158,11,0.08)', color:'#fcd34d', border:'1px solid rgba(245,158,11,0.12)' }}>{se}</span>;
              return <span key={i} style={{ fontSize:10, padding:'4px 8px', borderRadius:20, background: se.frequency === 'common' ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.04)', color: se.frequency === 'common' ? '#fcd34d' : 'rgba(255,255,255,0.58)', border:`1px solid ${se.frequency==='common'?'rgba(245,158,11,0.14)':'rgba(255,255,255,0.06)'}` }}>{se.effect} <span style={{ opacity:0.6, fontSize:9 }}>• {se.frequency==='common'?'часто':se.frequency==='rare'?'редко':'очень редко'}</span></span>;
            })}
          </div>
        </div>
      )}

      <div style={{ padding:'12px', borderRadius:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>📊 Фармакодинамика <span style={{ marginLeft:'auto', fontSize:9, color:'rgba(255,255,255,0.42)' }}>тапни для описания</span></div>
            {pdEntries.map(([key, val]) => {
              const absVal = Math.abs(val);
              const maxScale = key === 'AR_affinity' ? 2 : key === 'hct_impact' ? 6 : key === 'hepatotoxicity' ? 4 : 1.2;
              const pct = Math.min(100, (absVal / maxScale) * 100);
              const mechanism = PD_MECHANISMS[key] || '';
              const isExpanded = expandedPD === key;
              return (
                <div key={key} style={{ marginBottom:8, padding:'7px 8px', borderRadius:9, background: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent', border:`1px solid ${isExpanded ? 'rgba(255,255,255,0.06)' : 'transparent'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', cursor:'pointer', alignItems:'center' }} onClick={() => setExpandedPD(isExpanded ? null : key)}>
                    <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.88)' }}>{PD_LABELS[key] || key} <span style={{ fontSize:9, color:'rgba(255,255,255,0.32)' }}>{isExpanded ? '▾' : '▸'}</span></span>
                    <span style={{ color: pdBarColor(key, val), fontWeight:800, fontSize:11, background:`${pdBarColor(key,val)}14`, padding:'2px 7px', borderRadius:20 }}>{val.toFixed(2)}</span>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:20, height:6, marginTop:6, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, background: pdBarColor(key, val), height:6, borderRadius:20, minWidth:2, boxShadow:`0 0 8px ${pdBarColor(key,val)}55` }} />
                  </div>
                  {isExpanded && mechanism && (
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.62)', lineHeight:1.45, marginTop:6, padding:'6px 8px', background:'rgba(0,0,0,0.18)', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>
                      {mechanism}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {effectLabels.length > 0 && (
        <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.12)', display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:10, fontWeight:800, color:'#22c55e', whiteSpace:'nowrap' }}>Эффекты:</span>
          <span style={{ fontSize:10, color:'#86efac', fontWeight:600 }}>{effectLabels.join(' • ')}</span>
        </div>
      )}
      {riskLabels.length > 0 && (
        <div style={{ padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.12)', display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:10, fontWeight:800, color:'#ef4444', whiteSpace:'nowrap' }}>Риски:</span>
          <span style={{ fontSize:10, color:'#fca5a5', fontWeight:600 }}>{riskLabels.join(' • ')}</span>
        </div>
      )}

      {tzGroupedData && (
        <div style={{ padding:'12px', borderRadius:12, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#00e68a', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>🧬 Механизм-ориентированная модель <span style={{ marginLeft:'auto', fontSize:10, background:'rgba(0,230,138,0.12)', padding:'2px 7px', borderRadius:20 }}>{Object.keys(tzGroupedData).length} систем</span></div>
          {Object.entries(tzGroupedData).map(([organId, mechs]) => (
              <details key={organId} style={{ marginBottom:6, background:'rgba(255,255,255,0.02)', borderRadius:9, border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden' }}>
                <summary style={{ cursor:'pointer', padding:'8px 10px', fontSize:11, fontWeight:700, listStyle:'none', display:'flex', alignItems:'center', gap:6, color:'#fff' }}>
                  <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.12)', fontSize:11 }}>{TZ_SYSTEM_ICONS[organId] || '•'}</span> {TZ_SYSTEM_LABELS[organId] || organId}
                  <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{mechs.length} мех.</span>
                </summary>
                <div style={{ padding:'6px 8px 8px', display:'flex', flexDirection:'column', gap:4 }}>
                  {mechs.map(m => (
                    <div key={m.mechId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:8, fontSize:10, background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color:'rgba(255,255,255,0.84)', flex:1, fontWeight:600 }}>{m.label}</span>
                      <span style={{ fontWeight:800, padding:'2px 7px', borderRadius:20, fontSize:10, background:m.weight >= 4 ? 'rgba(239,68,68,0.14)' : m.weight >= 3 ? 'rgba(249,115,22,0.14)' : m.weight >= 2 ? 'rgba(234,179,8,0.14)' : 'rgba(34,197,94,0.14)', color:m.weight >= 4 ? '#f87171' : m.weight >= 3 ? '#fb923c' : m.weight >= 2 ? '#facc15' : '#4ade80', border:`1px solid ${m.weight>=4?'rgba(239,68,68,0.18)':m.weight>=3?'rgba(249,115,22,0.18)':m.weight>=2?'rgba(234,179,8,0.18)':'rgba(34,197,94,0.18)'}` }}>
                        w={m.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
      )}

      {labInfoData.effects.length > 0 && (
        <div style={{ padding:'12px', borderRadius:12, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.12)' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#f87171', marginBottom:8 }}>🩸 Влияние на анализы</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {labInfoData.effects.map((eff, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:`${dirColor[eff.direction]}18`, color: dirColor[eff.direction], fontWeight:800, fontSize:12, flexShrink:0, border:`1px solid ${dirColor[eff.direction]}30` }}>{dirArrow[eff.direction]}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#fff' }}>
                      {getMarkerName(eff.marker)}
                      <span style={{ marginLeft:6, fontSize:9, color:'rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.06)', padding:'1px 6px', borderRadius:20 }}>
                        {eff.strength >= 0.4 ? 'значимо' : eff.strength >= 0.2 ? 'умеренно' : 'слабо'} {(eff.strength * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.58)', lineHeight:1.4, marginTop:2 }}>{eff.reason}</div>
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {(sub.description || (detail?.description)) && (
        <div style={{ padding:'12px', borderRadius:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginBottom:6 }}>📝 Описание</div>
          <div style={{ color:'rgba(255,255,255,0.72)', lineHeight:1.5, fontSize:11 }}>{decodeGarbled((detail?.description || sub.description) || '')}</div>
        </div>
      )}
      {(detail?.mechanism || sub.mechanisms?.length) && (
        <div style={{ padding:'12px', borderRadius:12, background:'rgba(139,92,246,0.04)', border:'1px solid rgba(139,92,246,0.12)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa', marginBottom:6 }}>⚙️ Механизм действия</div>
          {detail?.mechanism ? (
            <div style={{ color:'rgba(255,255,255,0.72)', lineHeight:1.5, fontSize:11 }}>{decodeGarbled(detail.mechanism)}</div>
          ) : sub.mechanisms?.length ? (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {sub.mechanisms.map((m, i) => (
                <span key={i} style={{ fontSize:10, padding:'4px 9px', borderRadius:20, background:'rgba(139,92,246,0.12)', color:'#c4b5fd', fontWeight:700, border:'1px solid rgba(139,92,246,0.18)' }}>{PHARMA_MECH_LABELS[m] || m.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {(detail?.dosageRange || sub.dosageRange) && (
        <div style={{ padding:'12px', borderRadius:12, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#60a5fa', marginBottom:8 }}>💉 Диапазон дозировок</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {(() => { const dr = detail?.dosageRange || sub.dosageRange; if (!dr) return null; return <>
              <div style={{ padding:'7px 9px', borderRadius:9, background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.04)' }}><div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:700 }}>Минимум</div><div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{dr.min} <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>{dr.unit}</span></div></div>
              <div style={{ padding:'7px 9px', borderRadius:9, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.14)' }}><div style={{ fontSize:9, color:'#fbbf24', fontWeight:700 }}>Максимум</div><div style={{ fontSize:12, fontWeight:800, color:'#fbbf24' }}>{dr.max} <span style={{ fontSize:10, color:'#fbbf24' }}>{dr.unit}</span></div></div>
              <div style={{ gridColumn:'1 / -1', padding:'7px 9px', borderRadius:9, background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.04)' }}><div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:700 }}>Частота</div><div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{String(dr.frequency)}</div></div>
            </>; })()}
          </div>
        </div>
      )}
      {(detail?.synergies && detail.synergies.length > 0) && (
        <div style={{ padding:'12px', borderRadius:12, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.12)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#00e68a', marginBottom:8 }}>💥 Синергии и комбинации</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(() => { try { return detail!.synergies.map((s: any, i: number) => {
              const linkedName = (typeof s.with === 'string' && PHARMA_DB[s.with]) ? PHARMA_DB[s.with].name : s.with || '—';
              const isSyn = s.type === 'synergistic';
              const isAnt = s.type === 'antagonistic';
              const clr = isSyn ? '#00e68a' : isAnt ? '#f87171' : '#60a5fa';
              const bg = isSyn ? 'rgba(0,230,138,0.08)' : isAnt ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)';
              const lbl = isSyn ? '⊕ Синергия' : isAnt ? '⊖ Антагонизм' : '→ Комплемент';
              return (
                <div key={i} style={{ padding:'8px 10px', borderRadius:10, background:bg, border:`1px solid ${clr}22` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:9, fontWeight:800, padding:'3px 7px', borderRadius:20, background:`${clr}18`, color:clr, border:`1px solid ${clr}30` }}>{lbl}</span>
                    <span style={{ fontSize:11, fontWeight:800, color:clr }}>{linkedName}</span>
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.72)', lineHeight:1.4 }}>{s.desc || ''}</div>
                </div>
              );
            }); } catch { return null; }})()}
          </div>
        </div>
      )}
      {((detail?.sideEffects && detail.sideEffects.length > 0) || (sub.sideEffects && sub.sideEffects.length > 0)) && (
        <div style={{ padding:'12px', borderRadius:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginBottom:8 }}>⚠️ Побочные эффекты</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {(detail?.sideEffects || sub.sideEffects || []).map((se, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:8, background:'rgba(0,0,0,0.16)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.84)' }}>{se.effect}</span>
              <span style={{ color: se.frequency === 'common' ? '#fbbf24' : se.frequency === 'rare' ? '#60a5fa' : '#f87171', fontWeight:800, fontSize:10, background:`${se.frequency==='common'?'rgba(251,191,36,0.12)':se.frequency==='rare'?'rgba(96,165,250,0.12)':'rgba(248,113,113,0.12)'}`, padding:'2px 7px', borderRadius:20, border:`1px solid ${se.frequency==='common'?'rgba(251,191,36,0.18)':se.frequency==='rare'?'rgba(96,165,250,0.18)':'rgba(248,113,113,0.18)'}` }}>
                {se.frequency === 'common' ? 'часто' : se.frequency === 'rare' ? 'редко' : se.frequency === 'very_rare' ? 'очень редко' : se.frequency}
              </span>
            </div>
          ))}
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, position:'sticky', bottom:0, paddingTop:8, background:'linear-gradient(180deg, transparent, #18181b 28%)' }}>
        <button onClick={handleAddToCourse} style={{
          flex:1, padding:'11px 12px', borderRadius:12, border:'1px solid rgba(0,230,138,0.22)', cursor:'pointer',
          fontSize:12, fontWeight:800, background:'linear-gradient(135deg, #00e68a, #00b368)', color:'#000', boxShadow:'0 4px 14px rgba(0,230,138,0.22)',
        }}>+ В курс</button>
        <button onClick={handleAddToCart} style={{
          flex:1, padding:'11px 12px', borderRadius:12, border:'1px solid rgba(245,158,11,0.18)', cursor:'pointer',
          fontSize:12, fontWeight:800, background:'rgba(245,158,11,0.10)', color:'#fbbf24',
        }}>🛒 В корзину</button>
      </div>
    </div>
  );
});

const CatalogRow = React.memo<{
  s: PharmaSubstance;
  selected: boolean;
  flat?: boolean;
  onSelect: (id: string) => void;
  onAddCourse: (s: PharmaSubstance) => void;
  onAddCart: (s: PharmaSubstance) => void;
}>(({ s, selected, flat, onSelect, onAddCourse, onAddCart }) => {
  const isSelected = selected;
  return (
    <div onClick={() => onSelect(s.id)} style={{
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
      padding: flat ? '9px 10px' : '8px 10px 8px 12px', borderRadius:12, cursor:'pointer', marginBottom:6,
      background: isSelected ? 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(139,92,246,0.06))' : 'rgba(255,255,255,0.04)',
      border: isSelected ? '1px solid rgba(139,92,246,0.32)' : '1px solid rgba(255,255,255,0.06)',
      borderLeft: !flat && isSelected ? '3px solid #8b5cf6' : !flat ? '3px solid transparent' : undefined,
      boxShadow: isSelected ? '0 4px 14px rgba(139,92,246,0.12)' : 'none',
      transition:'all 0.18s ease',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0, flex:1 }}>
        <div style={{ width:30, height:30, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background: isSelected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.06)', border:`1px solid ${isSelected ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.06)'}`, fontSize:12, flexShrink:0 }}>
          {s.class.includes('test') ? '💉' : s.class.includes('oral') ? '💊' : s.class.includes('pept') ? '🧪' : s.class.includes('sarm') ? '🧬' : '🔬'}
        </div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontWeight:800, fontSize:12, color: isSelected ? '#fff' : 'rgba(255,255,255,0.92)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:-0.2 }}>{s.name}</div>
          <div style={{ fontSize:10, color: isSelected ? '#a78bfa' : 'rgba(255,255,255,0.48)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{CLASS_LABELS[s.class] || s.class}{s.pk ? ` · T½ ${formatHalfLife(s.pk.halfLifeHours)}` : ''}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
        <button onClick={() => onAddCourse(s)} style={{ width:28, height:28, borderRadius:9, border:'1px solid rgba(0,230,138,0.18)', background:'rgba(0,230,138,0.10)', color:'#00e68a', cursor:'pointer', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
        <button onClick={() => onAddCart(s)} style={{ width:28, height:28, borderRadius:9, border:'1px solid rgba(245,158,11,0.16)', background:'rgba(245,158,11,0.08)', color:'#fbbf24', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>🛒</button>
      </div>
    </div>
  );
});
CatalogRow.displayName = 'CatalogRow';

export const CatalogTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const pharmaSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  const groupedByClass = useMemo(() => {
    const map: Record<string, typeof pharmaSubstances> = {};
    for (const s of pharmaSubstances) {
      if (!map[s.class]) map[s.class] = [];
      map[s.class].push(s);
    }
    return map;
  }, [pharmaSubstances]);

  const filteredList = useMemo(() => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return pharmaSubstances.filter(s => (s.name||'').toLowerCase().includes(q) || (s.id||'').toLowerCase().includes(q) || (s.class && s.class.toLowerCase().includes(q)));
    }
    if (filterClass === 'all') return pharmaSubstances;
    return pharmaSubstances.filter(s => s.class === filterClass);
  }, [filterClass, debouncedSearch, pharmaSubstances]);

  const toggleClass = (cls: string) => {
    setCollapsedClasses(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  const filteredGrouped = useMemo(() => {
    if (filterClass !== 'all' || debouncedSearch) return null;
    return groupedByClass;
  }, [filterClass, debouncedSearch, groupedByClass]);

  const selected = useMemo(() => selectedId ? getPharmaDetail(selectedId) : null, [selectedId]);
  const detail = useMemo(() => selectedId ? (PHARMA_DETAILS as Record<string, PharmaDetail>)[selectedId] : undefined, [selectedId]);

  const addToCourse = useCallback((s: PharmaSubstance) => {
    const dr = s.dosageRange;
    const val = dr ? Math.round((dr.min + dr.max) / 2) : 250;
    const unit = dr?.unit || 'mg/wk';
    db.put('course_log', {
      id: crypto.randomUUID(), substanceId: s.id,
      doseValue: val, doseUnit: unit,
      frequency: dr?.frequency || '2x/wk',
      startWeek: 1, endWeek: 12,
    }).catch(() => {});
  }, []);

  const addToCart = useCallback((s: PharmaSubstance) => {
    try {
      const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
      if (!existing.some((x: any) => x.id === s.id)) {
        localStorage.setItem('supportCart', JSON.stringify([...existing, { id: s.id, name: s.name, dose: '—', timing: 'daily' }]));
      }
    } catch {}
  }, []);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* search */}
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:13, opacity:0.5, pointerEvents:'none' }}>🔍</span>
        <input type="text" placeholder="Поиск по названию, классу, эфиру..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          style={{ width:'100%', padding:'11px 36px 11px 36px', borderRadius:14, border:'1px solid rgba(255,255,255,0.07)',
            background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:13, fontWeight:500, boxSizing:'border-box', backdropFilter:'blur(8px)', outline:'none' }} />
        {searchQuery && (
          <button onClick={()=>setSearchQuery('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', width:26, height:26, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.72)', cursor:'pointer', fontSize:10 }}>✕</button>
        )}
      </div>

      <div style={{ padding:'10px 10px', borderRadius:14, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.62)', letterSpacing:0.4, textTransform:'uppercase' as const }}>Фильтр по классу</span>
          <span style={{ marginLeft:'auto', fontSize:10, color:'rgba(255,255,255,0.38)', background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{filteredList.length} поз.</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          <button onClick={() => setFilterClass('all')} style={{
            padding:'6px 12px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:800,
            background: filterClass === 'all' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.05)',
            color: filterClass === 'all' ? '#fff' : 'rgba(255,255,255,0.62)',
            border:`1px solid ${filterClass === 'all' ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: filterClass==='all' ? '0 4px 12px rgba(34,197,94,0.18)' : 'none',
          }}>Все</button>
          {PHARMA_CLASSES.map(cls => (
            <button key={cls} onClick={() => setFilterClass(cls)} style={{
              padding:'6px 11px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:700,
              background: filterClass === cls ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.05)',
              color: filterClass === cls ? '#fff' : 'rgba(255,255,255,0.62)',
              border:`1px solid ${filterClass === cls ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.07)'}`,
              boxShadow: filterClass===cls ? '0 4px 12px rgba(34,197,94,0.14)' : 'none',
            }}>{CLASS_LABELS[cls] || cls}</button>
          ))}
        </div>
      </div>

      {filteredGrouped ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {Object.entries(filteredGrouped).map(([cls, substances]) => {
            const isCollapsed = collapsedClasses[cls] ?? false;
            return (
              <div key={cls} style={{ borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
                <div onClick={() => toggleClass(cls)} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 12px', cursor:'pointer',
                  background: isCollapsed ? 'rgba(255,255,255,0.02)' : 'linear-gradient(90deg, rgba(139,92,246,0.10), rgba(139,92,246,0.02))', borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:800, color:'#fff' }}>
                    <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.18)', fontSize:11 }}>🧬</span>
                    {CLASS_LABELS[cls] || cls}
                    <span style={{ fontSize:10, color:'#a78bfa', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.14)', padding:'2px 7px', borderRadius:20, fontWeight:800 }}>
                      {substances.length}
                    </span>
                  </span>
                  <span style={{ width:24, height:24, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'rgba(255,255,255,0.72)' }}>{isCollapsed ? '▸' : '▾'}</span>
                </div>
                {!isCollapsed && <div style={{ padding:'8px', display:'flex', flexDirection:'column', gap:0 }}>{substances.map(s => (
                  <CatalogRow
                    key={s.id}
                    s={s}
                    selected={selectedId === s.id}
                    onSelect={handleSelect}
                    onAddCourse={addToCourse}
                    onAddCart={addToCart}
                  />
                ))}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {filteredList.map(s => (
            <CatalogRow
              key={s.id}
              s={s}
              flat
              selected={selectedId === s.id}
              onSelect={handleSelect}
              onAddCourse={addToCourse}
              onAddCart={addToCart}
            />
          ))}
        </div>
      )}
      {filteredList.length === 0 && (
        <div style={{ padding:24, textAlign:'center', borderRadius:14, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:22, marginBottom:6, opacity:0.6 }}>🔍</div>
          <div style={{ color:'rgba(255,255,255,0.62)', fontSize:12, fontWeight:600 }}>{debouncedSearch ? 'Ничего не найдено' : 'Нет данных'}</div>
          {debouncedSearch && <div style={{ color:'rgba(255,255,255,0.38)', fontSize:10, marginTop:4 }}>Попробуй другой запрос или сбрось фильтр</div>}
        </div>
      )}

      {selected && (
        <div style={{
          position:'fixed', inset:0, zIndex:300,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.72)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', padding:12,
        }} onClick={() => setSelectedId(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width:'100%', maxWidth:520, maxHeight:'88vh',
            borderRadius:20, background:'linear-gradient(180deg, #1a1a1f, #121214)',
            border:'1px solid rgba(255,255,255,0.08)',
            boxShadow:'0 24px 64px rgba(0,0,0,0.55)',
            overflow:'hidden', display:'flex', flexDirection:'column',
          }}>
            <div style={{ height:3, background:'linear-gradient(90deg, #8b5cf6, #00e68a)' }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                <div style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.18)', fontSize:13 }}>🧬</div>
                <span style={{ fontSize:13, fontWeight:900, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selected.name}</span>
              </div>
              <button onClick={() => setSelectedId(null)} style={{
                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
                color:'rgba(255,255,255,0.72)', borderRadius:10, padding:'6px 10px',
                cursor:'pointer', fontSize:11, fontWeight:800, flexShrink:0,
              }}>✕ Закрыть</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'12px 12px 14px' }}>
              <DrugDetailCard sub={selected} detail={detail} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { steadyStatePeak, steadyStateTrough, eliminationConstant } from '../../../engines/pk-pd.engine';
import { calculateMultiSubstancePKPD } from '../../../engines/pkpd-superposition.engine';
import type { CourseEntry } from '../../../core/types';
import { useDataLink } from '../../../core/data-link';
import { CLASS_LABELS, INJECTABLE_WITH_ESTERS, type PharmaClass } from './constants';

interface DrugDose {
  substanceId: string;
  doseMg: number;
  frequencyDays: number[];
  totalWeeks: number;
}

const DRUG_COLORS = ['#8b5cf6', '#ef4444', '#00e68a', '#f59e0b', '#3b82f6', '#ec4899', '#06b6d4', '#a855f7', '#f97316', '#14b8a6'];
const parseFreqToDays = (freq: string): number[] => {
  const match = freq.match(/(\d+)\s*x\s*\/\s*week/i);
  if (match) {
    const n = parseInt(match[1]);
    if (n <= 0) return [1];
    if (n >= 7) return [1, 2, 3, 4, 5, 6, 7];
    const days = [];
    for (let i = 0; i < n; i++) days.push(i + 1);
    return days;
  }
  return [1, 4];
};

export const PKPDSimulationTab: React.FC = () => {
  const linked = useDataLink();
  const [drugDoses, setDrugDoses] = useState<DrugDose[]>(() => {
    const courseDrugs = linked.course.slice(0, 5).map(c => ({
      substanceId: c.substanceId,
      doseMg: c.doseValue ?? 250,
      frequencyDays: c.frequency ? parseFreqToDays(String(c.frequency)) : [1, 4],
      totalWeeks: (c.endWeek ?? 12) - (c.startWeek ?? 0),
    }));
    return courseDrugs.length > 0 ? courseDrugs : [
      { substanceId: 'test_enan', doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 },
    ];
  });
  const [simResult, setSimResult] = useState<{
    points: { week: number; cp: number; effect: number; tol: number }[];
    perDrug: { substanceId: string; name: string; points: { week: number; cp: number }[] }[];
    peak: number; trough: number; ssDays: number;
  } | null>(null);
  const [pkSearch, setPkSearch] = useState('');
  const [pkClass, setPkClass] = useState<string>('');
  const [showAllDrugs, setShowAllDrugs] = useState(true);
  const [visibleDrugs, setVisibleDrugs] = useState<Set<string>>(new Set());
  const [pkEsterPopup, setPkEsterPopup] = useState<{ baseClass: string; label: string } | null>(null);

  const allSubstances = useMemo(() => {
    const PKPD_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','oral_17aa','sarm','drostanolone','dht_derivative','insulin']);
    return Object.values(PHARMA_DB).filter(s => !!s?.name && PKPD_CLASSES.has(s.class));
  }, []);

  const unusedSubstances = useMemo(() => {
    const used = new Set(drugDoses.map(d => d.substanceId));
    return allSubstances.filter(s => !used.has(s.id));
  }, [drugDoses, allSubstances]);

  const pkFiltered = useMemo(() => {
    if (pkSearch.trim() || pkClass) {
      const q = pkSearch.toLowerCase();
      let list = allSubstances;
      if (pkClass) list = list.filter(s => s.class === pkClass);
      if (pkSearch.trim()) list = list.filter(s => (s.name||'').toLowerCase().includes(q) || (s.id||'').toLowerCase().includes(q));
      return list;
    }
    return unusedSubstances;
  }, [pkSearch, pkClass, allSubstances, unusedSubstances]);

  const addDrug = (id: string) => {
    setDrugDoses([...drugDoses, { substanceId: id, doseMg: 250, frequencyDays: [1, 4], totalWeeks: 12 }]);
    setPkSearch('');
    setVisibleDrugs(prev => { const n = new Set(prev); n.add(id); return n; });
  };

  const removeDrug = (idx: number) => {
    const removed = drugDoses[idx];
    setDrugDoses(drugDoses.filter((_, i) => i !== idx));
    if (removed) setVisibleDrugs(prev => { const n = new Set(prev); n.delete(removed.substanceId); return n; });
  };

  const updateDrug = (idx: number, field: keyof DrugDose, value: string | number | number[]) => {
    const updated = [...drugDoses];
    updated[idx] = { ...updated[idx], [field]: value };
    setDrugDoses(updated);
  };

  const buildEntries = (doses: DrugDose[]): CourseEntry[] => {
    const result: CourseEntry[] = [];
    doses.forEach((dd) => {
      const weeklyDose = dd.doseMg * dd.frequencyDays.length;
      for (let w = 0; w < dd.totalWeeks; w++) {
        result.push({
          id: `${dd.substanceId}-w${w}`,
          substanceId: dd.substanceId,
          doseValue: weeklyDose,
          doseUnit: 'mg/wk',
          frequency: `${dd.frequencyDays.length}x/week`,
          startWeek: w,
          endWeek: w + 1,
        });
      }
    });
    return result;
  };

  const runSimulation = () => {
    const maxWeeks = Math.max(...drugDoses.map(d => d.totalWeeks), 1);
    const allEntries = buildEntries(drugDoses);
    if (allEntries.length === 0) return;
    const superpositionResult = calculateMultiSubstancePKPD(allEntries, maxWeeks);
    const perDrug: { substanceId: string; name: string; points: { week: number; cp: number }[] }[] = [];
    drugDoses.forEach((dd) => {
      const singleEntries = buildEntries([dd]);
      const singleResult = calculateMultiSubstancePKPD(singleEntries, maxWeeks);
      const sub = PHARMA_DB[dd.substanceId];
      perDrug.push({
        substanceId: dd.substanceId,
        name: sub?.name || dd.substanceId,
        points: singleResult.map(p => ({ week: p.week, cp: p.cp })),
      });
    });
    setVisibleDrugs(new Set(drugDoses.map(d => d.substanceId)));
    const firstDrug = PHARMA_DB[drugDoses[0].substanceId];
    let peak = 0;
    let trough = Infinity;
    let ssDays = 0;
    if (firstDrug && drugDoses[0].frequencyDays.length > 0) {
      const intervalH = (168 / drugDoses[0].frequencyDays.length);
      try {
        peak = steadyStatePeak({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
        trough = steadyStateTrough({
          dose: drugDoses[0].doseMg,
          bioavailability: firstDrug.pk.bioavailability * 100,
          Vd: firstDrug.pk.Vd,
          tHalfHours: firstDrug.pk.halfLifeHours,
          intervalHours: intervalH,
        });
      } catch { peak = 0; trough = 0; }
      ssDays = Math.ceil(5 * (firstDrug.pk.halfLifeHours / 24));
    }
    setSimResult({ points: superpositionResult, perDrug, peak, trough, ssDays });
  };

  const chart = useMemo(() => {
    if (!simResult || simResult.points.length === 0) return null;
    const W = 700;
    const H = 280;
    const PAD = 40;
    const pts = simResult.points;
    const visiblePerDrug = simResult.perDrug.filter(d => showAllDrugs || visibleDrugs.has(d.substanceId));
    const allCp = [...pts.map(p => p.cp), ...visiblePerDrug.flatMap(d => (d.points || []).map(p => p.cp))];
    const maxCp = Math.max(...allCp, 1);
    const maxWeek = pts[pts.length - 1].week;
    const toX = (w: number) => PAD + (w / maxWeek) * (W - 2 * PAD);
    const toY = (cp: number) => H - PAD - (cp / maxCp) * (H - 2 * PAD);
    const totalPathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.cp).toFixed(1)}`).join(' ');
    const effectPathD = pts.map((p, i) => {
      const ey = H - PAD - (p.effect / 100) * (H - 2 * PAD);
      return `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${ey.toFixed(1)}`;
    }).join(' ');
    const perDrugPaths = visiblePerDrug.map((drug, di) => {
      const idx = simResult.perDrug.findIndex(d => d.substanceId === drug.substanceId);
      const color = DRUG_COLORS[idx % DRUG_COLORS.length];
      const d = (drug.points || []).map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.week).toFixed(1)},${toY(p.cp).toFixed(1)}`).join(' ');
      return { substanceId: drug.substanceId, name: drug.name, d, color };
    });
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
      const y = H - PAD - frac * (H - 2 * PAD);
      const label = (maxCp * frac).toFixed(1);
      return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="0.7"/>
        <text x="${PAD - 8}" y="${y + 3}" fill="rgba(255,255,255,0.42)" font-size="8" text-anchor="end">${label}</text>`;
    });
    const weekMarkers: string[] = [];
    const step = maxWeek <= 12 ? 1 : maxWeek <= 24 ? 2 : 4;
    for (let w = 0; w <= maxWeek; w += step) {
      const x = toX(w);
      weekMarkers.push(`<text x="${x}" y="${H - 4}" fill="rgba(255,255,255,0.42)" font-size="9" text-anchor="middle">${w}</text>`);
    }
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'rgba(0,0,0,0.22)', borderRadius: 12, border:'1px solid rgba(255,255,255,0.06)' }}>
        {gridLines.map((l, i) => <g key={i} dangerouslySetInnerHTML={{ __html: l }} />)}
        {perDrugPaths.map((pd) => (
          <g key={pd.substanceId}>
            <path d={pd.d} fill="none" stroke={pd.color} strokeWidth="1.7" strokeDasharray="5 3" opacity={0.62} />
          </g>
        ))}
        <path d={totalPathD} fill="none" stroke="#8b5cf6" strokeWidth="2.8" opacity={0.95} style={{ filter:'drop-shadow(0 0 6px rgba(139,92,246,0.35))' } as any} />
        <path d={effectPathD} fill="none" stroke="#00e68a" strokeWidth="1.8" strokeDasharray="6 3" opacity={0.82} />
        {weekMarkers.map((m, i) => <g key={`w${i}`} dangerouslySetInnerHTML={{ __html: m }} />)}
        <text x={W / 2} y={H - 1} fill="rgba(255,255,255,0.42)" fontSize="10" textAnchor="middle">Недели</text>
      </svg>
    );
  }, [simResult, showAllDrugs, visibleDrugs]);

  return (
    <div className="pharma-pkpd" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(59,130,246,0.06))', border:'1px solid rgba(139,92,246,0.16)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.18)', fontSize:12 }}>⚗️</span>
          <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>PK/PD симуляция</span>
          <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{drugDoses.length} преп.</span>
        </div>
        <div style={{ fontSize:11, color:'#fff', lineHeight:1.45 }}>
          Мульти-вещество: суперпозиция концентраций + эффект + толерантность. Задай дозу и дни — получи Cmax/Cmin и стационар.
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        {drugDoses.map((dd, idx) => {
          const sub = PHARMA_DB[dd.substanceId];
          return (
            <div key={idx} style={{
              background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
              borderRadius:14, padding:'11px 12px', boxShadow:'0 6px 18px rgba(0,0,0,0.22)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9 }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                  <div style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', fontSize:11, fontWeight:800, flexShrink:0 }}>{idx+1}</div>
                  <span style={{ fontWeight:800, fontSize:13, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {sub?.name || dd.substanceId}
                  </span>
                  <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, fontWeight:700,
                    background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.18)', whiteSpace:'nowrap' }}>
                    {CLASS_LABELS[sub?.class as string] || sub?.class}
                  </span>
                </div>
                {drugDoses.length > 1 && (
                  <button onClick={() => removeDrug(idx)} style={{
                    width:28, height:28, borderRadius:9, cursor:'pointer', fontSize:12,
                    background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', color:'#f87171',
                    display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800,
                  }}>✕</button>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div>
                  <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Доза на инъекцию (мг)</label>
                  <input type="number" value={dd.doseMg} onChange={(e) => updateDrug(idx, 'doseMg', parseFloat(e.target.value) || 0)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Длительность (нед)</label>
                  <input type="number" value={dd.totalWeeks} onChange={(e) => updateDrug(idx, 'totalWeeks', parseFloat(e.target.value) || 0)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:6, letterSpacing:0.2 }}>Дни инъекций</label>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {[1,2,3,4,5,6,7].map(d => {
                    const active = (dd.frequencyDays || []).includes(d);
                    return (
                      <button key={d} type="button" onClick={() => {
                        const fDays = dd.frequencyDays || [];
                        const next = active ? fDays.filter(x => x !== d) : [...fDays, d].sort();
                        updateDrug(idx, 'frequencyDays', next);
                      }} style={{
                        flex:1, minWidth:36, height:30, borderRadius:9, fontSize:10, fontWeight:800, cursor:'pointer',
                        background: active ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.04)', color: active ? '#fff' : 'rgba(255,255,255,0.62)',
                        border:`1px solid ${active ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
                        boxShadow: active ? '0 4px 12px rgba(139,92,246,0.22)' : 'none',
                      }}>{['','Пн','Вт','Ср','Чт','Пт','Сб','Вс'][d]}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
        borderRadius:14, padding:'12px', boxShadow:'0 6px 18px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{ flex:1, position:'relative' }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, opacity:0.5 }}>🔍</span>
            <input type="text" value={pkSearch} onChange={e => setPkSearch(e.target.value)}
              placeholder={drugDoses.length === 0 ? 'Начни вводить название...' : 'Поиск препарата...'}
              style={{ width:'100%', padding:'8px 10px 8px 30px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', fontSize:12, boxSizing:'border-box', outline:'none' }} />
          </div>
          {pkSearch && <button onClick={()=>setPkSearch('')} style={{ width:30, height:30, borderRadius:9, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>✕</button>}
        </div>

        {(() => {
          const pkGrouped: { cls: string; label: string }[] = [];
          const pkSingles: typeof allSubstances = [];
          const seenCls = new Set<string>();
          for (const s of pkFiltered) {
            if (INJECTABLE_WITH_ESTERS.has(s.class)) {
              if (!seenCls.has(s.class)) { seenCls.add(s.class); pkGrouped.push({ cls: s.class, label: CLASS_LABELS[s.class] || s.class }); }
            } else { pkSingles.push(s); }
          }
          return (<>
            {(showAllDrugs || pkClass || pkSearch) && (pkGrouped.length + pkSingles.length > 0) && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(132px, 1fr))', gap:6, maxHeight:210, overflowY:'auto', paddingRight:2 }}>
                {pkGrouped.map(g => (
                  <div key={g.cls} onClick={() => setPkEsterPopup({ baseClass: g.cls, label: g.label })} style={{
                    padding:'10px 10px', borderRadius:12, cursor:'pointer',
                    background:'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', border:'1px solid rgba(139,92,246,0.22)', textAlign:'center',
                  }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#a78bfa', marginBottom:2 }}>{g.label}</div>
                    <div style={{ fontSize:10, color:'#fff', fontWeight:600 }}>👆 Эфиры</div>
                  </div>
                ))}
                {pkSingles.map(s => (
                  <div key={s.id} onClick={() => addDrug(s.id)} style={{
                    padding:'9px 10px', borderRadius:12, cursor:'pointer',
                    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', transition:'all 0.15s',
                  }}>
                    <div style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{s.name}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#fff', marginTop:3 }}>
                      <span>{CLASS_LABELS[s.class] || s.class}</span>
                      <span style={{ color:'#a78bfa', fontWeight:700 }}>{s.pk?.halfLifeHours ? `${(s.pk.halfLifeHours / 24).toFixed(1)} дн` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!showAllDrugs && !pkClass && !pkSearch && drugDoses.length > 0 && (
              <div style={{ fontSize:11, color:'#fff', textAlign:'center', padding:10, background:'rgba(255,255,255,0.02)', borderRadius:10, border:'1px dashed rgba(255,255,255,0.07)' }}>
                Введи название или выбери эфир выше
              </div>
            )}
            {pkFiltered.length === 0 && (pkClass || pkSearch) && (
              <div style={{ fontSize:11, color:'#fff', textAlign:'center', padding:10 }}>
                Все препараты этого класса уже добавлены
              </div>
            )}
          </>);
        })()}

        {pkEsterPopup && (
          <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.64)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }} onClick={() => setPkEsterPopup(null)}>
            <div style={{ background:'linear-gradient(180deg, #1a1a1f, #111113)', borderRadius:16, padding:16, maxWidth:360, width:'100%', maxHeight:'72vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{ width:26, height:26, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', fontSize:12 }}>🧬</span>
                <h3 style={{ margin:0, fontSize:14, fontWeight:800, color:'#fff' }}>{pkEsterPopup.label} — эфир</h3>
                <button onClick={()=>setPkEsterPopup(null)} style={{ marginLeft:'auto', width:28, height:28, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>✕</button>
              </div>
              {allSubstances.filter(p => p.class === pkEsterPopup.baseClass).map(p => (
                <div key={p.id} onClick={() => { addDrug(p.id); setPkEsterPopup(null); }} style={{
                  padding:'11px 12px', borderRadius:12, cursor:'pointer', marginBottom:6,
                  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'#fff', marginTop:2 }}>
                    T½ {(p.pk.halfLifeHours/24).toFixed(1)} дн {p.esters?.[0] ? `• ${p.esters[0]}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button onClick={runSimulation} style={{
        width:'100%', padding:'13px 0', borderRadius:14, border:'1px solid rgba(139,92,246,0.35)',
        background:'linear-gradient(135deg, #8b5cf6, #7c3aed)', color:'#fff', fontWeight:800, fontSize:14,
        cursor:'pointer', boxShadow:'0 8px 20px rgba(139,92,246,0.28)', letterSpacing:0.2,
      }}>▶ Запустить симуляцию</button>

      {simResult && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{
            background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
            borderRadius:14, padding:'12px', boxShadow:'0 6px 18px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
              {[
                { label:'Cmax', v: simResult.peak.toFixed(1), unit:'мг/л', color:'#a78bfa' },
                { label:'Cmin', v: simResult.trough.toFixed(1), unit:'мг/л', color:'#60a5fa' },
                { label:'Стационар', v:`≈${simResult.ssDays}`, unit:'дн', color:'#00e68a' },
              ].map(c=>(
                <div key={c.label} style={{ textAlign:'center', padding:'10px 6px', background:'rgba(0,0,0,0.22)', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize:9, color:'#fff', fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>{c.label}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:c.color, marginTop:2 }}>{c.v}</div>
                  <div style={{ fontSize:9, color:'#fff' }}>{c.unit}</div>
                </div>
              ))}
            </div>
            {simResult.peak > 50 && (
              <div style={{ color:'#f87171', fontWeight:700, fontSize:11, textAlign:'center', padding:'7px 10px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.16)', borderRadius:10 }}>
                ⚠ Высокая пиковая концентрация — риск побочных эффектов
              </div>
            )}
            {simResult.points.length > 0 && simResult.points[simResult.points.length - 1].tol > 0.3 && (
              <div style={{ color:'#fbbf24', fontWeight:700, fontSize:11, textAlign:'center', padding:'7px 10px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.16)', borderRadius:10, marginTop:6 }}>
                ⚠ Толерантность {(simResult.points[simResult.points.length - 1].tol * 100).toFixed(0)}%
              </div>
            )}
          </div>

          <div style={{
            background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
            borderRadius:14, padding:10, boxShadow:'0 6px 18px rgba(0,0,0,0.18)',
          }}>
            {chart}
            <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:10, marginTop:8, fontSize:11, color:'#fff' }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ width:14, height:3, borderRadius:2, background:'#8b5cf6', display:'inline-block' }} /> Суммарная</span>
              {simResult.perDrug.map((d, i) => (
                <span key={d.substanceId} style={{ display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ width:14, height:3, borderRadius:2, background:DRUG_COLORS[i % DRUG_COLORS.length], display:'inline-block', opacity:0.7, borderTop:'1px dashed rgba(255,255,255,0.6)' }} /> {d.name}</span>
              ))}
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ width:14, height:3, borderRadius:2, background:'#00e68a', display:'inline-block' }} /> Эффект</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

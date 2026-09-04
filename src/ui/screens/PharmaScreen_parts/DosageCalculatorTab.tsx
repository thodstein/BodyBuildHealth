import React, { useState, useMemo, useEffect } from 'react';
import { PHARMA_DB, getPharmaDetail } from '../../../core/pharma-database';
import { calculateDose } from '../../../engines/dosage.engine';
import { DRUG_THRESHOLDS } from '../../../core/constants';
import {
  CLASS_LABELS, INJECTABLE_WITH_ESTERS, PHARMA_CLASSES, formatHalfLife, type PharmaClass,
} from './constants';

const DRUG_OPTIONS = Object.keys(DRUG_THRESHOLDS);

const AndrogenicIndexCalculator: React.FC = () => {
  const [entries, setEntries] = useState<{ drug: string; doseMgWeek: number }[]>([
    { drug: 'testosterone_enanthate', doseMgWeek: 300 }
  ]);
  const [aiResult, setAiResult] = useState<number | null>(null);
  const [aiEsterPopup, setAiEsterPopup] = useState<{ baseClass: string; label: string; entryIdx: number } | null>(null);

  const allAiDrugs = useMemo(() => {
    return DRUG_OPTIONS.filter(d => PHARMA_DB[d]?.name && DRUG_THRESHOLDS[d]?.androgenicity);
  }, []);

  const aiFiltered = allAiDrugs.map(d => PHARMA_DB[d]).filter((s): s is NonNullable<typeof s> => !!s);
  const aiKeepClasses = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','dht_derivative','pct_gonadotropin','insulin','igf1','mgf']);
  const { aiGrouped, aiSingles } = useMemo(() => {
    const keep = aiFiltered.filter(s => aiKeepClasses.has(s.class));
    const grouped: { cls: string; label: string }[] = [];
    const singles = new Set<string>();
    const seenCls = new Set<string>();
    for (const s of keep) {
      if (INJECTABLE_WITH_ESTERS.has(s.class)) {
        if (!seenCls.has(s.class)) { seenCls.add(s.class); grouped.push({ cls: s.class, label: CLASS_LABELS[s.class] || s.class }); }
      } else { singles.add(s.id); }
    }
    return { aiGrouped: grouped, aiSingles: singles };
  }, [aiFiltered]);

  const addEntry = () => setEntries([...entries, { drug: 'testosterone_enanthate', doseMgWeek: 300 }]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const setDrugFor = (i: number, drugId: string) => {
    const next = [...entries];
    next[i] = { ...next[i], drug: drugId };
    setEntries(next);
  };
  const setDoseFor = (i: number, val: number) => {
    const next = [...entries];
    next[i] = { ...next[i], doseMgWeek: val };
    setEntries(next);
  };

  const calcAI = () => {
    let total = 0;
    entries.forEach(e => {
      const dt = DRUG_THRESHOLDS[e.drug];
      if (dt) total += e.doseMgWeek * dt.androgenicity / 100;
    });
    setAiResult(total);
  };

  return (
    <div style={{ background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:'14px', boxShadow:'0 6px 18px rgba(0,0,0,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.18)', fontSize:12 }}>📊</span>
        <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Андрогенный индекс стека</span>
        {aiResult!==null && <span style={{ marginLeft:'auto', fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:20, background: aiResult>3?'rgba(239,68,68,0.12)': aiResult>1.5?'rgba(245,158,11,0.12)':'rgba(0,230,138,0.12)', color: aiResult>3?'#f87171':aiResult>1.5?'#fbbf24':'#00e68a', border:`1px solid ${aiResult>3?'rgba(239,68,68,0.18)':aiResult>1.5?'rgba(245,158,11,0.18)':'rgba(0,230,138,0.18)'}` }}>{aiResult.toFixed(2)}</span>}
      </div>
      <div style={{ fontSize:11, color:'#fff', marginBottom:12, lineHeight:1.45 }}>
        Σ (доза × AR_affinity / 100) — сложи вклады каждого препарата. Выбери эфир — доза подтянется.
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(132px, 1fr))', gap:6, maxHeight:170, overflowY:'auto', marginBottom:12, paddingRight:2 }}>
        {aiGrouped.map(g => (
          <div key={g.cls} onClick={() => setAiEsterPopup({ baseClass: g.cls, label: g.label, entryIdx: entries.length - 1 })} style={{
            padding:'10px 9px', borderRadius:12, cursor:'pointer', textAlign:'center',
            background:'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(0,230,138,0.04))', border:'1px solid rgba(0,230,138,0.22)',
          }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#00e68a', marginBottom:2 }}>{g.label}</div>
            <div style={{ fontSize:10, color:'#fff', fontWeight:600 }}>👆 Выбрать эфир</div>
          </div>
        ))}
        {Array.from(aiSingles).slice(0, 20).map(id => {
          const s = PHARMA_DB[id];
          if (!s) return null;
          return (
            <div key={id} onClick={() => setDrugFor(0, id)} style={{
              padding:'9px 10px', borderRadius:12, cursor:'pointer',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#fff', marginBottom:2 }}>{s.name}</div>
              <div style={{ fontSize:10, color:'#fff' }}>AR {DRUG_THRESHOLDS[id]?.androgenicity}%</div>
            </div>
          );
        })}
      </div>

      {entries.map((entry, i) => (
        <div key={i} style={{
          background:'rgba(0,0,0,0.22)', borderRadius:12, padding:'10px 11px',
          marginBottom:8, border:'1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', color:'#a78bfa', fontSize:10, fontWeight:800 }}>#{i + 1}</span>
            <span style={{ flex:1, fontSize:12, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {PHARMA_DB[entry.drug]?.name || entry.drug}
            </span>
            {entries.length > 1 && (
              <button onClick={() => removeEntry(i)} style={{
                width:26, height:26, borderRadius:8, cursor:'pointer', fontSize:11,
                background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', color:'#f87171',
                display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800,
              }}>✕</button>
            )}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input type="number" value={entry.doseMgWeek} onChange={e => setDoseFor(i, parseFloat(e.target.value) || 0)}
              style={{ flex:1, padding:'8px 10px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
            <span style={{ fontSize:11, color:'#fff', fontWeight:700, whiteSpace:'nowrap' }}>мг/нед</span>
          </div>
          <div style={{ fontSize:10, color:'#fff', marginTop:6, display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>AR {DRUG_THRESHOLDS[entry.drug]?.androgenicity}%</span>
            <span>· Вклад <b style={{ color:'#fff' }}>{(entry.doseMgWeek * (DRUG_THRESHOLDS[entry.drug]?.androgenicity || 0) / 100).toFixed(1)}</b></span>
          </div>
        </div>
      ))}

      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button onClick={addEntry} style={{
          flex:1, padding:'9px 0', borderRadius:12, cursor:'pointer', fontSize:11, fontWeight:800,
          border:'1px dashed rgba(139,92,246,0.32)', background:'rgba(139,92,246,0.08)', color:'#a78bfa',
        }}>+ Добавить препарат</button>
        <button onClick={calcAI} style={{
          flex:1, padding:'9px 0', borderRadius:12, border:'1px solid rgba(0,230,138,0.22)',
          background:'linear-gradient(135deg, #00e68a, #00b368)', color:'#000', fontWeight:800, cursor:'pointer', fontSize:11, boxShadow:'0 4px 12px rgba(0,230,138,0.20)',
        }}>Рассчитать</button>
      </div>

      {aiResult !== null && (
        <div style={{ marginTop:12, background:'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(0,230,138,0.04))', border:'1px solid rgba(0,230,138,0.16)', borderRadius:14, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:10, color:'#fff', marginBottom:4, fontWeight:700, letterSpacing:0.4, textTransform:'uppercase' as const }}>Андрогенный индекс стека</div>
          <div style={{ fontSize:30, fontWeight:900, color: aiResult > 3 ? '#f87171' : aiResult > 1.5 ? '#fbbf24' : '#00e68a', letterSpacing:-0.8 }}>{aiResult.toFixed(2)}</div>
          <div style={{ fontSize:11, color:'#fff', marginTop:4, fontWeight:600 }}>
            {aiResult > 3 ? '⚡ Высокая андрогенная нагрузка' : aiResult > 1.5 ? '⚠ Умеренная — следи за давлением и липидами' : '✓ Низкая — мягкий курс'}
          </div>
        </div>
      )}

      {aiEsterPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.64)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }} onClick={() => setAiEsterPopup(null)}>
          <div style={{ background:'linear-gradient(180deg, #1a1a1f, #111113)', borderRadius:16, padding:14, maxWidth:340, width:'100%', maxHeight:'72vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <h3 style={{ margin:0, fontSize:13, fontWeight:800, color:'#fff', flex:1 }}>{aiEsterPopup.label} — выбери эфир</h3>
              <button onClick={()=>setAiEsterPopup(null)} style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>✕</button>
            </div>
            {aiFiltered.filter(s => s.class === aiEsterPopup.baseClass).map(s => (
              <div key={s.id} onClick={() => { setDrugFor(aiEsterPopup.entryIdx, s.id); setAiEsterPopup(null); }} style={{
                padding:'10px 12px', borderRadius:11, cursor:'pointer', marginBottom:6,
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{s.name}</div>
                <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>
                  AR {DRUG_THRESHOLDS[s.id]?.androgenicity}% {s.esters?.[0] ? `• ${s.esters[0]}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};



export const DosageCalculatorTab: React.FC = () => {
  const [dosageSub, setDosageSub] = useState<'dosage' | 'androgen'>('dosage');
  const allPharma = useMemo(
    () => Object.values(PHARMA_DB).filter((s) => PHARMA_CLASSES.includes(s.class as PharmaClass)),
    []
  );
  const [drug, setDrug] = useState('');
  const [doseMode, setDoseMode] = useState<'per_kg' | 'weekly'>('per_kg');
  const [mgKg, setMgKg] = useState(2);
  const [weeklyMg, setWeeklyMg] = useState(500);
  const [weight, setWeight] = useState(90);
  const [injectionsPerWeek, setInjectionsPerWeek] = useState(2);
  const [concentration, setConcentration] = useState(250);
  const [vialMl, setVialMl] = useState(10);
  const [syringeMl, setSyringeMl] = useState(1);
  const [doseResult, setDoseResult] = useState<ReturnType<typeof calculateDose> | null>(null);
  const [esterPopup, setEsterPopup] = useState<{ baseClass: string; label: string } | null>(null);

  const subDetail = drug ? getPharmaDetail(drug) : null;
  const handleDrugChange = (id: string) => {
    setDrug(id);
    setEsterPopup(null);
    const sub = PHARMA_DB[id];
    if ((sub as any)?.concentration) setConcentration(Number((sub as any).concentration));
  };

  const run = () => {
    if (!drug) return;
    const baseMg = doseMode === 'per_kg' ? mgKg * weight : weeklyMg;
    const perInjectionMg = baseMg / Math.max(1, injectionsPerWeek);
    const dose = calculateDose({
      targetDoseMg: perInjectionMg,
      concentrationMgPerMl: concentration,
      roundingStepMl: 0.01,
      syringeVolumeMl: syringeMl,
      vialVolumeMl: vialMl,
      divisionsPerMl: 100,
    });
    setDoseResult(dose);
  };

  useEffect(() => { run(); }, [drug, doseMode, mgKg, weeklyMg, weight, injectionsPerWeek, concentration, vialMl, syringeMl]);

  const weeklyTotal = doseMode === 'per_kg' ? mgKg * weight : weeklyMg;
  const perInjectionMg = weeklyTotal / Math.max(1, injectionsPerWeek);

  const KEEP_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','pct_gonadotropin']);
  const { pharmaFiltered, grouped, singles } = useMemo(() => {
    const filtered = allPharma.filter(p => KEEP_CLASSES.has(p.class));
    const grouped: { type: 'class'; cls: string; label: string }[] = [];
    const singles: typeof filtered = [];
    const seenClasses = new Set<string>();
    for (const p of filtered) {
      if (INJECTABLE_WITH_ESTERS.has(p.class)) {
        if (!seenClasses.has(p.class)) { seenClasses.add(p.class); grouped.push({ type:'class', cls: p.class, label: CLASS_LABELS[p.class] || p.class }); }
      } else { singles.push(p); }
    }
    return { pharmaFiltered: filtered, grouped, singles };
  }, [allPharma]);

  return (
    <div className="pharma-dose" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {esterPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.64)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }} onClick={() => setEsterPopup(null)}>
          <div style={{ background:'linear-gradient(180deg, #1a1a1f, #111113)', borderRadius:16, padding:14, maxWidth:340, width:'100%', maxHeight:'72vh', overflowY:'auto', border:'1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <h3 style={{ margin:0, fontSize:13, fontWeight:800, color:'#fff', flex:1 }}>{esterPopup.label} — эфир</h3>
              <button onClick={()=>setEsterPopup(null)} style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer' }}>✕</button>
            </div>
            {pharmaFiltered.filter(p => p.class === esterPopup.baseClass).map(p => (
              <div key={p.id} onClick={() => handleDrugChange(p.id)} style={{
                padding:'10px 12px', borderRadius:11, cursor:'pointer', marginBottom:6,
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{p.name}</div>
                <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>
                  T½ {(p.pk.halfLifeHours/24).toFixed(1)} дн {p.esters?.[0] ? `• ${p.esters[0]}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
        {(['dosage','androgen'] as const).map(t => (
          <button key={t} onClick={() => setDosageSub(t)} style={{
            padding:'7px 13px', borderRadius:20, fontSize:11, fontWeight:800, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0, transition:'all 0.18s ease',
            background: dosageSub === t ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(255,255,255,0.06)',
            color: dosageSub === t ? '#fff' : 'rgba(255,255,255,0.62)',
            border:`1px solid ${dosageSub === t ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: dosageSub===t ? '0 4px 14px rgba(139,92,246,0.22)' : 'none',
          }}>{t === 'dosage' ? '💉 Дозировка' : '🧬 Андрогенный индекс'}</button>
        ))}
      </div>

      {dosageSub === 'dosage' && <>
        <div style={{
          background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
          borderRadius:14, padding:'14px', boxShadow:'0 6px 18px rgba(0,0,0,0.18)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.14)', border:'1px solid rgba(139,92,246,0.18)', fontSize:12 }}>💉</span>
            <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Фармакология</span>
            {drug && <span style={{ marginLeft:'auto', fontSize:11, color:'#a78bfa', background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.18)', padding:'3px 8px', borderRadius:20, fontWeight:700 }}>{PHARMA_DB[drug]?.name}</span>}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(132px, 1fr))', gap:6, maxHeight:210, overflowY:'auto', marginBottom:12, paddingRight:2 }}>
            {grouped.map(g => (
              <div key={g.cls} onClick={() => setEsterPopup({ baseClass: g.cls, label: g.label })} style={{
                padding:'10px 10px', borderRadius:12, cursor:'pointer', textAlign:'center',
                background:'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', border:'1px solid rgba(139,92,246,0.22)',
              }}>
                <div style={{ fontSize:11, fontWeight:800, color:'#a78bfa', marginBottom:2 }}>{g.label}</div>
                <div style={{ fontSize:10, color:'#fff', fontWeight:600 }}>👆 Выбрать эфир</div>
              </div>
            ))}
            {singles.map(p => {
              const isSelected = drug === p.id;
              return (
                <div key={p.id} onClick={() => handleDrugChange(p.id)} style={{
                  padding:'9px 10px', borderRadius:12, cursor:'pointer',
                  background: isSelected ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(0,230,138,0.06))' : 'rgba(255,255,255,0.04)',
                  border: isSelected ? '1px solid rgba(0,230,138,0.28)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{ fontSize:11, fontWeight:800, color: isSelected ? '#00e68a' : '#fff', marginBottom:2 }}>{p.name}</div>
                  <div style={{ fontSize:10, color:'#fff' }}>{CLASS_LABELS[p.class] || p.class}</div>
                </div>
              );
            })}
          </div>

          {drug && subDetail && (
            <div style={{ marginBottom:12, padding:'9px 11px', background:'linear-gradient(135deg, rgba(0,230,138,0.07), rgba(0,230,138,0.03))', borderRadius:11, border:'1px solid rgba(0,230,138,0.14)', display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ fontSize:11, color:'#fff' }}><b style={{ color:'#00e68a' }}>Конц.:</b> {(subDetail as any).concentration || '—'} мг/мл</div>
              <div style={{ fontSize:11, color:'#fff' }}><b style={{ color:'#00e68a' }}>T½:</b> {subDetail.pk?.halfLifeHours ? formatHalfLife(subDetail.pk.halfLifeHours) : '—'}</div>
              <div style={{ fontSize:11, color:'#fff' }}><b style={{ color:'#00e68a' }}>Эфир:</b> {(subDetail as any).esters?.[0] || '—'}</div>
            </div>
          )}

          <div style={{ display:'flex', gap:6, marginBottom:12, padding:3, background:'rgba(0,0,0,0.18)', borderRadius:12, border:'1px solid rgba(255,255,255,0.05)' }}>
            <button onClick={() => setDoseMode('per_kg')} style={{
              flex:1, padding:'8px 0', borderRadius:10, fontSize:11, fontWeight:800, cursor:'pointer',
              background: doseMode === 'per_kg' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'transparent',
              border:'none',
              color: doseMode === 'per_kg' ? '#fff' : 'rgba(255,255,255,0.55)',
              boxShadow: doseMode==='per_kg' ? '0 4px 12px rgba(139,92,246,0.22)' : 'none',
            }}>мг/кг/нед</button>
            <button onClick={() => setDoseMode('weekly')} style={{
              flex:1, padding:'8px 0', borderRadius:10, fontSize:11, fontWeight:800, cursor:'pointer',
              background: doseMode === 'weekly' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'transparent',
              border:'none',
              color: doseMode === 'weekly' ? '#fff' : 'rgba(255,255,255,0.55)',
              boxShadow: doseMode==='weekly' ? '0 4px 12px rgba(139,92,246,0.22)' : 'none',
            }}>мг/нед</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            {doseMode === 'per_kg' ? (
              <>
                <div>
                  <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>мг/кг/нед</label>
                  <input type="number" value={mgKg} onChange={(e) => setMgKg(parseFloat(e.target.value) || 0)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Вес (кг)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
                </div>
              </>
            ) : (
              <div style={{ gridColumn:'1 / -1' }}>
                <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Недельная доза (мг/нед)</label>
                <input type="number" value={weeklyMg} onChange={(e) => setWeeklyMg(parseFloat(e.target.value) || 0)}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Инъекций/нед</label>
              <select value={injectionsPerWeek} onChange={(e) => setInjectionsPerWeek(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, outline:'none' }}>
                {[1, 2, 3, 4, 5, 6, 7].map(v => <option key={v} value={v} style={{ background:'#1a1a1f' }}>{v}x/нед</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Конц-ция (мг/мл)</label>
              <input type="number" value={concentration} onChange={(e) => setConcentration(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Флакон (мл)</label>
              <input type="number" value={vialMl} onChange={(e) => setVialMl(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, boxSizing:'border-box', outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:10, color:'#fff', fontWeight:700, display:'block', marginBottom:4, letterSpacing:0.2 }}>Шприц (мл)</label>
              <select value={syringeMl} onChange={(e) => setSyringeMl(parseFloat(e.target.value) || 0)}
                style={{ width:'100%', padding:'8px 10px', borderRadius:10, background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, fontWeight:700, outline:'none' }}>
                {[0.3, 0.5, 1, 3, 5, 10, 20].map(v => <option key={v} value={v} style={{ background:'#1a1a1f' }}>{v} мл</option>)}
              </select>
            </div>
          </div>
        </div>

        {doseResult ? (
          <div style={{ background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:'14px', boxShadow:'0 6px 18px rgba(0,0,0,0.18)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ width:24, height:24, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.12)', border:'1px solid rgba(0,230,138,0.18)', fontSize:11 }}>📋</span>
              <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Результат</span>
              <span style={{ marginLeft:'auto', fontSize:10, color:'#00e68a', background:'rgba(0,230,138,0.10)', border:'1px solid rgba(0,230,138,0.16)', padding:'3px 8px', borderRadius:20, fontWeight:700 }}>готово</span>
            </div>
              <div style={{ display:'grid', gap:9 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ background:'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(139,92,246,0.04))', border:'1px solid rgba(139,92,246,0.14)', borderRadius:12, padding:'12px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#fff', marginBottom:4, fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Недельная доза</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#a78bfa' }}>{weeklyTotal.toFixed(0)}</div>
                  <div style={{ fontSize:10, color:'#fff' }}>мг/нед</div>
                </div>
                <div style={{ background:'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(59,130,246,0.04))', border:'1px solid rgba(59,130,246,0.14)', borderRadius:12, padding:'12px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#fff', marginBottom:4, fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>На инъекцию</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#60a5fa' }}>{perInjectionMg.toFixed(1)}</div>
                  <div style={{ fontSize:10, color:'#fff' }}>мг × {injectionsPerWeek}/нед</div>
                </div>
              </div>
              <div style={{ background:'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(0,230,138,0.04))', border:'1px solid rgba(0,230,138,0.14)', borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#fff', marginBottom:4, fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Объём инъекции</div>
                <div style={{ fontSize:34, fontWeight:900, color:'#00e68a', letterSpacing:-0.8 }}>{doseResult.volumeMl}</div>
                <div style={{ fontSize:11, color:'#fff' }}>мл</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div style={{ background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'12px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#fff', marginBottom:4, fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Деления шприца</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{doseResult.divisions}</div>
                </div>
                <div style={{ background:'rgba(0,0,0,0.22)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'12px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#fff', marginBottom:4, fontWeight:700, letterSpacing:0.3, textTransform:'uppercase' as const }}>Доз / флакон</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{doseResult.dosesPerVial || '—'}</div>
                </div>
              </div>
              {doseResult.flags.length > 0 ? (
                <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.16)', borderRadius:11, padding:'9px 12px', fontSize:11, color:'#fbbf24', display:'flex', gap:7, alignItems:'center' }}>
                  <span style={{ width:20, height:20, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.14)', fontSize:10 }}>⚠</span> {doseResult.flags.join(', ')}
                </div>
              ) : (
                <div style={{ background:'rgba(0,230,138,0.08)', border:'1px solid rgba(0,230,138,0.14)', borderRadius:11, padding:'9px 12px', fontSize:11, color:'#00e68a', textAlign:'center', fontWeight:700 }}>
                  ✓ Готово к введению — проверь асептику и ротацию зон
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background:'rgba(22,22,26,0.42)', border:'1px dashed rgba(255,255,255,0.08)', backdropFilter:'blur(8px)',
            borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center',
            minHeight:160, color:'#fff', fontSize:12, flexDirection:'column', gap:6,
          }}>
            <div style={{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(139,92,246,0.10)', border:'1px solid rgba(139,92,246,0.14)', fontSize:20 }}>💉</div>
            <div style={{ textAlign:'center', lineHeight:1.4 }}>
              <div style={{ color:'#fff', fontWeight:700 }}>Выбери препарат и дозировку</div>
              <div style={{ fontSize:11, color:'#fff' }}>объём рассчитается автоматически</div>
            </div>
          </div>
        )}
      </>}
      {dosageSub === 'androgen' && <AndrogenicIndexCalculator />}
    </div>
  );
};

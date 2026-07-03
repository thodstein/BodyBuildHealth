import React, { useState, useMemo, useEffect } from 'react';
import { PHARMA_DB, getPharmaDetail } from '../../../core/pharma-database';
import { calculateDose } from '../../../engines/dosage.engine';
import { DRUG_THRESHOLDS } from '../../../core/constants';
import {
  PEPTIDE_DB, PEPTIDE_LIST, PEPTIDE_GOAL_PROFILES,
  computeDilution, computeEffectiveDose, computePK, computePeptideRisks,
  generatePeptideProtocol, getPeptideSynergiesFor, getPeptideConflictsFor,
  ROUTE_LABELS, SYRINGE_TYPES, type DilutionInput, type DilutionResult,
  type BioavailabilityResult, type PKResult,
} from '../../../engines/peptide-calculator.engine';
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
  const [showGrid, setShowGrid] = useState(false);

  const allAiDrugs = useMemo(() => {
    return DRUG_OPTIONS.filter(d => PHARMA_DB[d]?.name && DRUG_THRESHOLDS[d]?.androgenicity);
  }, []);

  const aiFiltered = allAiDrugs.map(d => PHARMA_DB[d]).filter((s): s is NonNullable<typeof s> => !!s);
  const aiKeepClasses = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','dht_derivative','pct_gonadotropin','insulin','igf1','mgf']);
  const aiKeep = aiFiltered.filter(s => aiKeepClasses.has(s.class));
  const aiGrouped: { cls: string; label: string }[] = [];
  const aiSingles = new Set<string>();
  const seenCls = new Set<string>();
  for (const s of aiKeep) {
    if (INJECTABLE_WITH_ESTERS.has(s.class)) {
      if (!seenCls.has(s.class)) { seenCls.add(s.class); aiGrouped.push({ cls: s.class, label: CLASS_LABELS[s.class] || s.class }); }
    } else { aiSingles.add(s.id); }
  }

  const addEntry = () => setEntries([...entries, { drug: 'testosterone_enanthate', doseMgWeek: 300 }]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const setDrugFor = (i: number, drugId: string) => {
    const next = [...entries];
    next[i] = { ...next[i], drug: drugId };
    setEntries(next);
    setShowGrid(false);
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
    <div style={{
      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 12, padding: '14px 16px', marginTop: 8,
    }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: 14, color: 'var(--accent)' }}>📊 Андрогенный индекс стека</h3>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.4 }}>
        Σ (доза × AR_affinity / 100) — выберите препараты из каталога ниже
      </div>

      {/* Drug selection grid (like Фармакология) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 5, maxHeight: 160, overflowY: 'auto', marginBottom: 12 }}>
        {aiGrouped.map(g => (
          <div key={g.cls} onClick={() => setAiEsterPopup({ baseClass: g.cls, label: g.label, entryIdx: entries.length - 1 })} style={{
            padding:'10px 8px', borderRadius:8, cursor:'pointer',
            background:'var(--bg-secondary)', border:'1px solid var(--accent)',
          }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>{g.label}</div>
            <div style={{ fontSize:9, color:'var(--text-dim)' }}>👆 Выбрать эфир</div>
          </div>
        ))}
        {Array.from(aiSingles).slice(0, 20).map(id => {
          const s = PHARMA_DB[id];
          if (!s) return null;
          return (
            <div key={id} onClick={() => setDrugFor(0, id)} style={{
              padding:'8px 8px', borderRadius:8, cursor:'pointer',
              background:'var(--bg-secondary)', border:'1px solid var(--border)',
            }}>
              <div style={{ fontSize:10, fontWeight:600, color:'var(--text)', marginBottom:2 }}>{s.name}</div>
              <div style={{ fontSize:9, color:'var(--text-dim)' }}>AR {DRUG_THRESHOLDS[id]?.androgenicity}%</div>
            </div>
          );
        })}
      </div>

      {/* Selected entries with dose inputs */}
      {entries.map((entry, i) => (
        <div key={i} style={{
          background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 12px',
          marginBottom: 8, border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', minWidth: 16 }}>#{i + 1}</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
              {PHARMA_DB[entry.drug]?.name || entry.drug}
            </span>
            {entries.length > 1 && (
              <button onClick={() => removeEntry(i)} style={{
                width: 24, height: 24, borderRadius: 6, cursor: 'pointer', fontSize: 11,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" value={entry.doseMgWeek} onChange={e => setDoseFor(i, parseFloat(e.target.value) || 0)}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12,
                boxSizing: 'border-box' }} />
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>мг/нед</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
            AR {DRUG_THRESHOLDS[entry.drug]?.androgenicity}% · Вклад: {(entry.doseMgWeek * (DRUG_THRESHOLDS[entry.drug]?.androgenicity || 0) / 100).toFixed(1)}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button onClick={addEntry} style={{
          flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11,
          border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)',
        }}>+ Добавить препарат</button>
        <button onClick={calcAI} style={{
          flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 11,
        }}>Рассчитать</button>
      </div>

      {aiResult !== null && (
        <div style={{ marginTop: 10, background: 'rgba(0,230,138,0.08)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Андрогенный индекс стека</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: aiResult > 3 ? '#ef4444' : aiResult > 1.5 ? '#f59e0b' : 'var(--accent)' }}>{aiResult.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            {aiResult > 3 ? '⚡ Высокая андрогенная нагрузка' : aiResult > 1.5 ? '⚠ Умеренная' : '✓ Низкая'}
          </div>
        </div>
      )}

      {/* AI ester popup */}
      {aiEsterPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setAiEsterPopup(null)}>
          <div style={{ background:'var(--bg)', borderRadius:16, padding:20, maxWidth:320, width:'90%', maxHeight:'70vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 12px', fontSize:15 }}>{aiEsterPopup.label} — выберите эфир</h3>
            {aiKeep.filter(s => s.class === aiEsterPopup.baseClass).map(s => (
              <div key={s.id} onClick={() => { setDrugFor(aiEsterPopup.entryIdx, s.id); setAiEsterPopup(null); }} style={{
                padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:4,
                background:'var(--bg-secondary)', border:'1px solid var(--border)',
              }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{s.name}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                  AR {DRUG_THRESHOLDS[s.id]?.androgenicity}% {s.esters?.[0] ? `| ${s.esters[0]}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PeptideCalcTab: React.FC = () => {
  const [pepTab, setPepTab] = useState<'peptides' | 'growth'>('peptides');
  const [peptideId, setPeptideId] = useState('cjc1295');
  const [growthId, setGrowthId] = useState<string | null>(null);
  const [pepAmount, setPepAmount] = useState(2);
  const [pepAmountUnit, setPepAmountUnit] = useState<'mg' | 'mcg'>('mg');
  const [pepDilution, setPepDilution] = useState(2);
  const [pepDose, setPepDose] = useState(100);
  const [pepDoseUnit, setPepDoseUnit] = useState<'mg' | 'mcg'>('mcg');
  const [pepSyringe, setPepSyringe] = useState<'U100_1ml' | 'U100_05ml' | 'U100_03ml' | 'U40_1ml'>('U100_1ml');
  const [pepRoute, setPepRoute] = useState('sc');
  const [pepSchedule, setPepSchedule] = useState(['Mon', 'Wed', 'Fri']);
  const [pepTotalDays, setPepTotalDays] = useState(30);
  const [pepResult, setPepResult] = useState<{ dilution: DilutionResult; effective: BioavailabilityResult; pk: PKResult } | null>(null);
  const [pepProtocol, setPepProtocol] = useState<ReturnType<typeof generatePeptideProtocol> | null>(null);

  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const runPepCalc = () => {
    const p = PEPTIDE_DB[peptideId];
    if (!p) return;
    const bio = p.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
    const dilInput: DilutionInput = {
      amountValue: pepAmount, amountUnit: pepAmountUnit,
      dilutionVolumeMl: pepDilution, doseValue: pepDose, doseUnit: pepDoseUnit,
      syringeType: pepSyringe,
    };
    const dilution = computeDilution(dilInput);
    const effective = computeEffectiveDose(dilution.doseMcg, bio);
    const pk = computePK({
      doseMcg: dilution.doseMcg, bioAvg: bio.avg,
      tHalfHours: p.tHalfHours, scheduleDays: pepSchedule, totalDays: pepTotalDays,
    });
    setPepResult({ dilution, effective, pk });
  };

  const growthSel = growthId ? getPharmaDetail(growthId) : null;

  return (
    <div>
      <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
        <h3 style={{ margin:'0 0 4px 0', fontSize:14, color:'var(--accent)' }}>🧪 Калькулятор пептидов</h3>
        <p style={{ fontSize:11, color:'var(--text-dim)', margin:0 }}>Разведение, PK‑модель, риски и протоколы</p>
      </div>

      {/* Unified peptide + growth factor selector */}
      <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, maxHeight:160, overflowY:'auto' }}>
          {PEPTIDE_LIST.map(p => {
            const sel = peptideId === p.id;
            return <div key={p.id} onClick={() => { setPeptideId(p.id); const pd = PEPTIDE_DB[p.id]; if (pd) { setPepAmount(pd.amountMg); setPepRoute(pd.routes[0]); setPepResult(null); setGrowthId(null); }}} style={{
              padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:10,
              background: sel ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
              border: sel ? '1.5px solid #00e68a' : '1px solid var(--border)',
              color: sel ? '#00e68a' : 'var(--text)', fontWeight: sel ? 700 : 400,
            }}>{p.shortName}</div>;
          })}
          {(() => {
            const GROWTH_CLASSES = new Set(['peptide_ghrh','peptide_ghrp','igf1','mgf','insulin','peptide_gnrh','peptide_fat_loss','peptide_other']);
            const inPeptideDb = new Set(PEPTIDE_LIST.map(p => (PEPTIDE_DB[p.id]?.name||'').toLowerCase()));
            return Object.values(PHARMA_DB).filter(s => !!s?.name && GROWTH_CLASSES.has(s.class) && s.id !== 'mk677' && !inPeptideDb.has((s.name||'').toLowerCase())).map(s => {
              const sel = growthId === s.id;
              return <div key={s.id} onClick={() => { setGrowthId(s.id); setPepResult(null); }} style={{
                padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:10,
                background: sel ? 'rgba(139,92,246,0.15)' : 'var(--bg-secondary)',
                border: sel ? '1.5px solid #8b5cf6' : '1px solid var(--border)',
                color: sel ? '#8b5cf6' : 'var(--text)', fontWeight: sel ? 700 : 400,
              }}>{s.name}</div>;
            });
          })()}
        </div>
        {PEPTIDE_DB[peptideId] && PEPTIDE_DB[peptideId].effects && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
            {PEPTIDE_DB[peptideId].effects.map(e => (
              <span key={e} style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'rgba(0,230,138,0.1)', color:'#00e68a' }}>{e}</span>
            ))}
          </div>
        )}
        {growthId && PHARMA_DB[growthId] && (
          <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(139,92,246,0.06)', borderRadius:8, fontSize:10, color:'var(--text-dim)', lineHeight:1.6 }}>
            <b>{PHARMA_DB[growthId].name}</b> — T½ {(PHARMA_DB[growthId].pk?.halfLifeHours ?? 0).toFixed(0)}ч, био {((PHARMA_DB[growthId].pk?.bioavailability ?? 0) * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Dilution calculator */}
        <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>💧 Разведение</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Во флаконе</label>
              <div style={{ display:'flex', gap:4 }}>
                <input type="number" value={pepAmount} onChange={e => setPepAmount(parseFloat(e.target.value) || 0)} style={{ width:'60%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12 }} />
                <select value={pepAmountUnit || ''} onChange={e => setPepAmountUnit(e.target.value as 'mg'|'mcg')} style={{ flex:1, padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                  <option value="mg">мг</option><option value="mcg">мкг</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Растворитель (мл)</label>
              <input type="number" step="0.1" value={pepDilution} onChange={e => setPepDilution(parseFloat(e.target.value) || 0)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Доза</label>
              <div style={{ display:'flex', gap:4 }}>
                <input type="number" value={pepDose} onChange={e => setPepDose(parseFloat(e.target.value) || 0)} style={{ width:'60%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12 }} />
                <select value={pepDoseUnit || ''} onChange={e => setPepDoseUnit(e.target.value as 'mg'|'mcg')} style={{ flex:1, padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                  <option value="mcg">мкг</option><option value="mg">мг</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Шприц</label>
              <select value={pepSyringe} onChange={e => setPepSyringe(e.target.value as 'U100_1ml' | 'U100_05ml' | 'U100_03ml' | 'U40_1ml')} style={{ width:'100%', padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                {Object.entries(SYRINGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:9, color:'var(--text-dim)' }}>Способ введения</label>
              <select value={pepRoute} onChange={e => setPepRoute(e.target.value)} style={{ width:'100%', padding:'6px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:11 }}>
                {Object.entries(ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Course params */}
        <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>📅 Параметры курса</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
            {WEEK.map(d => (
              <button key={d} onClick={() => setPepSchedule(pepSchedule.includes(d) ? pepSchedule.filter(x => x !== d) : [...pepSchedule, d].sort((a,b) => WEEK.indexOf(a)-WEEK.indexOf(b)))} style={{
                padding:'5px 10px', borderRadius:16, fontSize:10, cursor:'pointer',
                background: pepSchedule.includes(d) ? 'rgba(0,230,138,0.2)' : 'var(--bg-secondary)',
                border: pepSchedule.includes(d) ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: pepSchedule.includes(d) ? '#00e68a' : 'var(--text-dim)', fontWeight: pepSchedule.includes(d) ? 700 : 400,
              }}>{d === 'Mon' ? 'Пн' : d === 'Tue' ? 'Вт' : d === 'Wed' ? 'Ср' : d === 'Thu' ? 'Чт' : d === 'Fri' ? 'Пт' : d === 'Sat' ? 'Сб' : 'Вс'}</button>
            ))}
          </div>
          <div>
            <label style={{ fontSize:9, color:'var(--text-dim)' }}>Длительность (дней)</label>
            <input type="number" value={pepTotalDays} onChange={e => setPepTotalDays(parseFloat(e.target.value) || 0)} style={{ width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }} />
          </div>
        </div>

        <button onClick={runPepCalc} style={{
          width:'100%', padding:12, borderRadius:8, border:'none', cursor:'pointer',
          background:'linear-gradient(135deg, #00e68a, #00c853)', color:'#000', fontWeight:700, fontSize:13, marginBottom:12,
        }}>🧬 Рассчитать</button>

        {/* Results */}
        {pepResult && (<>
          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>📊 Результаты разведения</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px', fontSize:11 }}>
              <span style={{ color:'var(--text-dim)' }}>Концентрация:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.concentrationMcgPerMl.toFixed(1)} мкг/мл</span>
              <span style={{ color:'var(--text-dim)' }}>Объём дозы:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.doseVolumeMl.toFixed(3)} мл</span>
              <span style={{ color:'var(--text-dim)' }}>Деления шприца:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.syringeUnitsDisplay}</span>
              <span style={{ color:'var(--text-dim)' }}>Доз во флаконе:</span><span style={{ fontWeight:600 }}>{pepResult.dilution.dosesPerVial.toFixed(1)}</span>
            </div>
          </div>

          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>💉 Биодоступность ({ROUTE_LABELS[pepRoute]})</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:11 }}>
              <div style={{ textAlign:'center', background:'var(--bg-secondary)', borderRadius:6, padding:6 }}>
                <div style={{ color:'var(--text-dim)', fontSize:9 }}>Мин</div>
                <div style={{ fontWeight:600 }}>{pepResult.effective.effectiveMinMcg.toFixed(0)} мкг</div>
              </div>
              <div style={{ textAlign:'center', background:'rgba(0,230,138,0.1)', borderRadius:6, padding:6 }}>
                <div style={{ color:'var(--text-dim)', fontSize:9 }}>Средняя</div>
                <div style={{ fontWeight:700, color:'#00e68a' }}>{pepResult.effective.effectiveAvgMcg.toFixed(0)} мкг</div>
              </div>
              <div style={{ textAlign:'center', background:'var(--bg-secondary)', borderRadius:6, padding:6 }}>
                <div style={{ color:'var(--text-dim)', fontSize:9 }}>Макс</div>
                <div style={{ fontWeight:600 }}>{pepResult.effective.effectiveMaxMcg.toFixed(0)} мкг</div>
              </div>
            </div>
          </div>

          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>📈 PK‑модель</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', fontSize:10, marginBottom:8 }}>
              <span style={{ color:'var(--text-dim)' }}>Макс. концентрация:</span><span style={{ fontWeight:600 }}>{pepResult.pk.maxConcentration.toFixed(1)}</span>
              <span style={{ color:'var(--text-dim)' }}>Средняя концентрация:</span><span style={{ fontWeight:600 }}>{pepResult.pk.avgConcentration.toFixed(1)}</span>
              <span style={{ color:'var(--text-dim)' }}>Steady-state (день):</span><span style={{ fontWeight:600 }}>~{pepResult.pk.steadyStateDay}</span>
              <span style={{ color:'var(--text-dim)' }}>t½ (дни):</span><span style={{ fontWeight:600 }}>{pepResult.pk.halfLifeDays.toFixed(2)}</span>
            </div>
            <div style={{ maxHeight:140, overflowY:'auto', border:'1px solid var(--border)', borderRadius:6 }}>
              <table style={{ width:'100%', fontSize:9, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--bg-secondary)', position:'sticky', top:0 }}>
                    <th style={{ padding:'2px 4px', textAlign:'left' }}>День</th>
                    <th style={{ padding:'2px 4px' }}>Инъекция</th>
                    <th style={{ padding:'2px 4px', textAlign:'right' }}>Конц.</th>
                  </tr>
                </thead>
                <tbody>
                  {pepResult.pk.days.map(d => (
                    <tr key={d.day} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', background:d.inject ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
                      <td style={{ padding:'2px 4px' }}>{d.day}</td>
                      <td style={{ padding:'2px 4px', textAlign:'center' }}>{d.inject ? '💉' : ''}</td>
                      <td style={{ padding:'2px 4px', textAlign:'right', fontFamily:'monospace' }}>{d.concentration.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risks */}
          {PEPTIDE_DB[peptideId] && (
            <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>⚠ Риски: {PEPTIDE_DB[peptideId].shortName}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {computePeptideRisks(PEPTIDE_DB[peptideId]).map((r, i) => (
                  <div key={i} style={{
                    padding:'4px 8px', borderRadius:6, fontSize:10,
                    background: r.riskPercent > 25 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${r.riskPercent > 25 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    color: r.riskPercent > 25 ? '#ef4444' : '#f59e0b',
                  }}>
                    {r.label}: {r.riskPercent}%
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synergies & Conflicts */}
          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>🔗 Синергии и конфликты</div>
            {getPeptideSynergiesFor(peptideId).length > 0 && (
              <div style={{ marginBottom:4 }}>
                <span style={{ fontSize:10, color:'#22c55e', fontWeight:600 }}>Синергии:</span>
                {getPeptideSynergiesFor(peptideId).map(s => (
                  <span key={s.partner} style={{ fontSize:9, marginLeft:6, color:'#22c55e' }}>{s.partnerName} (+{s.strength})</span>
                ))}
              </div>
            )}
            {getPeptideConflictsFor(peptideId).length > 0 && (
              <div>
                <span style={{ fontSize:10, color:'#ef4444', fontWeight:600 }}>Конфликты:</span>
                {getPeptideConflictsFor(peptideId).map(c => (
                  <span key={c.partner} style={{ fontSize:9, marginLeft:6, color:'#ef4444' }}>{c.partnerName} ({c.severity})</span>
                ))}
              </div>
            )}
            {getPeptideSynergiesFor(peptideId).length === 0 && getPeptideConflictsFor(peptideId).length === 0 && (
              <span style={{ fontSize:10, color:'var(--text-dim)' }}>Нет данных</span>
            )}
          </div>

          {/* Protocol generator */}
          <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>🎯 Генератор протокола по цели</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
              {Object.keys(PEPTIDE_GOAL_PROFILES).map(goal => (
                <button key={goal} onClick={() => setPepProtocol(generatePeptideProtocol(goal))} style={{
                  padding:'5px 10px', borderRadius:6, fontSize:10, cursor:'pointer',
                  background:'rgba(139,92,246,0.1)', border:'1px solid rgba(139,92,246,0.2)', color:'#8b5cf6', fontWeight:500,
                }}>
                  {goal === 'muscle_growth' ? '💪 Рост мышц' : goal === 'fat_loss' ? '🔥 Жиросжигание' : goal === 'recovery' ? '🔄 Восстановление' : goal === 'gi_healing' ? '🫃 ЖКТ' : goal === 'mitochondria' ? '🧬 Митохондрии' : goal === 'focus' ? '🎯 Фокус' : '😴 Сон'}
                </button>
              ))}
            </div>
            {pepProtocol && (
              <div style={{ background:'var(--bg-secondary)', borderRadius:8, padding:10 }}>
                <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>{pepProtocol.goal}: оценка синергии <span style={{ color:'#8b5cf6' }}>{pepProtocol.synergyScore.toFixed(1)}</span></div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {pepProtocol.peptides.map(p => (
                    <span key={p.id} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)', color:'#8b5cf6', fontWeight:600 }}>
                      {p.shortName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>)}
      {/* ─── GROWTH FACTOR DETAIL (always visible when selected) ─── */}
      {growthId && growthSel && (
        <div style={{ background:'var(--glass-bg)', border:'1px solid var(--glass-border)', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>{growthSel.name}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10, color:'var(--text-dim)', lineHeight:1.6 }}>
            <span><b>Класс:</b> {CLASS_LABELS[growthSel.class] || growthSel.class}</span>
            <span><b>T½:</b> {growthSel.pk?.halfLifeHours ? `${(growthSel.pk.halfLifeHours).toFixed(0)}ч` : '—'}</span>
            <span><b>Биодоступность:</b> {growthSel.pk?.bioavailability ? `${(growthSel.pk.bioavailability * 100).toFixed(0)}%` : '—'}</span>
            <span><b>Vd:</b> {growthSel.pk?.Vd ? `${growthSel.pk.Vd} л` : '—'}</span>
          </div>

        </div>
      )}
    </div>
  );
};

export const DosageCalculatorTab: React.FC = () => {
  const [dosageSub, setDosageSub] = useState<'dosage' | 'androgen' | 'peptides'>('dosage');
  const allPharma = Object.values(PHARMA_DB).filter((s) => PHARMA_CLASSES.includes(s.class as PharmaClass));
  const [drug, setDrug] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dosageClass, setDosageClass] = useState('');
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
  const wastePerVial = vialMl && doseResult ? Math.max(0, vialMl - (doseResult?.dosesPerVial || 0) * doseResult.volumeMl) : 0;

  const KEEP_CLASSES = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','pct_gonadotropin']);
  const pharmaFiltered = allPharma.filter(p => KEEP_CLASSES.has(p.class));
  const grouped: { type: 'class'; cls: string; label: string }[] = [];
  const singles: typeof pharmaFiltered = [];
  const seenClasses = new Set<string>();
  for (const p of pharmaFiltered) {
    if (INJECTABLE_WITH_ESTERS.has(p.class)) {
      if (!seenClasses.has(p.class)) { seenClasses.add(p.class); grouped.push({ type:'class', cls: p.class, label: CLASS_LABELS[p.class] || p.class }); }
    } else { singles.push(p); }
  }

  return (
    <div>
      {/* Ester popup */}
      {esterPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setEsterPopup(null)}>
          <div style={{ background:'var(--bg)', borderRadius:16, padding:20, maxWidth:320, width:'90%', maxHeight:'70vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 12px', fontSize:15 }}>{esterPopup.label} — выберите эфир</h3>
            {pharmaFiltered.filter(p => p.class === esterPopup.baseClass).map(p => (
              <div key={p.id} onClick={() => handleDrugChange(p.id)} style={{
                padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:4,
                background:'var(--bg-secondary)', border:'1px solid var(--border)',
              }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                  T½={(p.pk.halfLifeHours/24).toFixed(1)}дн {p.esters?.[0] ? `| Эфир: ${p.esters[0]}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab pills */}
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {(['dosage','androgen','peptides'] as const).map(t => (
          <button key={t} onClick={() => setDosageSub(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: dosageSub === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: dosageSub === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${dosageSub === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'dosage' ? '💉 Фармакология' : t === 'androgen' ? '🧬 Андрогенный индекс' : '🧪 Пептиды'}</button>
        ))}
      </div>

      {dosageSub === 'dosage' && <><div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 12,
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--accent)' }}>💉 Фармакология</h3>

        {/* Drug cards grid: grouped injectable classes + singles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 5, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
          {grouped.map(g => (
            <div key={g.cls} onClick={() => setEsterPopup({ baseClass: g.cls, label: g.label })} style={{
              padding:'10px 10px', borderRadius:8, cursor:'pointer',
              background:'var(--bg-secondary)', border:'1px solid var(--accent)',
            }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>{g.label}</div>
              <div style={{ fontSize:9, color:'var(--text-dim)' }}>👆 Выбрать эфир</div>
            </div>
          ))}
          {singles.map(p => {
            const isSelected = drug === p.id;
            return (
              <div key={p.id} onClick={() => handleDrugChange(p.id)} style={{
                padding:'8px 10px', borderRadius:8, cursor:'pointer',
                background: isSelected ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
                border: isSelected ? '1.5px solid #00e68a' : '1px solid var(--border)',
              }}>
                <div style={{ fontSize:11, fontWeight:600, color: isSelected ? '#00e68a' : 'var(--text)', marginBottom:2 }}>{p.name}</div>
                <div style={{ fontSize:9, color:'var(--text-dim)' }}>{CLASS_LABELS[p.class] || p.class}</div>
              </div>
            );
          })}
        </div>

        {drug && subDetail && (
          <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(0,230,138,0.06)', borderRadius: 8, border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}><b style={{ color: 'var(--text)' }}>Концентрация:</b> {(subDetail as any).concentration || '—'} мг/мл</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}><b style={{ color: 'var(--text)' }}>Период полувыведения:</b> {subDetail.pk?.halfLifeHours ? formatHalfLife(subDetail.pk.halfLifeHours) : '—'}</div>
          </div>
        )}

        {/* Pill toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => setDoseMode('per_kg')} style={{
            flex: 1, padding: '7px 0', borderRadius: 20, fontSize: 11, fontWeight: doseMode === 'per_kg' ? 700 : 400, cursor: 'pointer',
            background: doseMode === 'per_kg' ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            border: doseMode === 'per_kg' ? '1.5px solid #00e68a' : '1px solid var(--border)',
            color: doseMode === 'per_kg' ? '#00e68a' : 'var(--text-dim)',
          }}>мг/кг/нед</button>
          <button onClick={() => setDoseMode('weekly')} style={{
            flex: 1, padding: '7px 0', borderRadius: 20, fontSize: 11, fontWeight: doseMode === 'weekly' ? 700 : 400, cursor: 'pointer',
            background: doseMode === 'weekly' ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)',
            border: doseMode === 'weekly' ? '1.5px solid #00e68a' : '1px solid var(--border)',
            color: doseMode === 'weekly' ? '#00e68a' : 'var(--text-dim)',
          }}>мг/нед</button>
        </div>

        {/* Input fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {doseMode === 'per_kg' ? (
            <>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>мг/кг/нед</label>
                <input type="number" value={mgKg} onChange={(e) => setMgKg(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Вес (кг)</label>
                <input type="number" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </>
          ) : (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Недельная доза (мг/нед)</label>
              <input type="number" value={weeklyMg} onChange={(e) => setWeeklyMg(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Инъекций/нед</label>
            <select value={injectionsPerWeek} onChange={(e) => setInjectionsPerWeek(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}>
              {[1, 2, 3, 4, 5, 6, 7].map(v => <option key={v} value={v}>{v}x/нед</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Конц-ция (мг/мл)</label>
            <input type="number" value={concentration} onChange={(e) => setConcentration(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Флакон (мл)</label>
            <input type="number" value={vialMl} onChange={(e) => setVialMl(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Шприц (мл)</label>
            <select value={syringeMl} onChange={(e) => setSyringeMl(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}>
              {[0.3, 0.5, 1, 3, 5, 10, 20].map(v => <option key={v} value={v}>{v} мл</option>)}
            </select>
          </div>
        </div>
      </div>

      {doseResult ? (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--accent)' }}>📋 Результат</h3>
            <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Недельная доза</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{weeklyTotal.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>мг/нед</div>
              </div>
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>На инъекцию</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{perInjectionMg.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>мг × {injectionsPerWeek}/нед</div>
              </div>
            </div>
            <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 12, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Объём инъекции</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)' }}>{doseResult.volumeMl}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>мл</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Деления шприца</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{doseResult.divisions}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>Доз / флакон</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{doseResult.dosesPerVial || '—'}</div>
              </div>
            </div>
            {doseResult.flags.length > 0 ? (
              <div style={{ background: 'rgba(255,152,0,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#ff9800' }}>
                ⚠ {doseResult.flags.join(', ')}
              </div>
            ) : (
              <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#00e68a', textAlign: 'center' }}>
                ✓ Готово к введению
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 180, color: 'var(--text-dim)', fontSize: 12,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💉</div>
            <div>Выберите препарат и дозировку,</div>
            <div>чтобы рассчитать объём инъекции</div>
          </div>
        </div>
      )}

      {/* ═══ Androgenic Index Calculator ═══ */}
      </>}
      {dosageSub === 'androgen' && <AndrogenicIndexCalculator />}
      {dosageSub === 'peptides' && <PeptideCalcTab />}
    </div>
  );
};
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
  const [showGrid, setShowGrid] = useState(false);

  const allAiDrugs = useMemo(() => {
    return DRUG_OPTIONS.filter(d => PHARMA_DB[d]?.name && DRUG_THRESHOLDS[d]?.androgenicity);
  }, []);

  const aiFiltered = allAiDrugs.map(d => PHARMA_DB[d]).filter((s): s is NonNullable<typeof s> => !!s);
  const aiKeepClasses = new Set(['testosterone','trenbolone','nandrolone','boldenone','primobolan','drostanolone','dht_derivative','pct_gonadotropin','insulin','igf1','mgf']);
  const { aiKeep, aiGrouped, aiSingles } = useMemo(() => {
    const keep = aiFiltered.filter(s => aiKeepClasses.has(s.class));
    const grouped: { cls: string; label: string }[] = [];
    const singles = new Set<string>();
    const seenCls = new Set<string>();
    for (const s of keep) {
      if (INJECTABLE_WITH_ESTERS.has(s.class)) {
        if (!seenCls.has(s.class)) { seenCls.add(s.class); grouped.push({ cls: s.class, label: CLASS_LABELS[s.class] || s.class }); }
      } else { singles.add(s.id); }
    }
    return { aiKeep: keep, aiGrouped: grouped, aiSingles: singles };
  }, [aiFiltered]);

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



export const DosageCalculatorTab: React.FC = () => {
  const [dosageSub, setDosageSub] = useState<'dosage' | 'androgen'>('dosage');
  const allPharma = useMemo(
    () => Object.values(PHARMA_DB).filter((s) => PHARMA_CLASSES.includes(s.class as PharmaClass)),
    []
  );
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
        {(['dosage','androgen'] as const).map(t => (
          <button key={t} onClick={() => setDosageSub(t)} style={{
            padding:'6px 14px', borderRadius:16, fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: dosageSub === t ? 'var(--accent)' : 'var(--bg-secondary)',
            color: dosageSub === t ? '#000' : 'var(--text-dim)',
            border: `1px solid ${dosageSub === t ? 'var(--accent)' : 'var(--border)'}`,
          }}>{t === 'dosage' ? '💉 Фармакология' : '🧬 Андрогенный индекс'}</button>
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
    </div>
  );
};
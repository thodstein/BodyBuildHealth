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

const DRUG_COLORS = ['#7c4dff', '#ff1744', '#00e68a', '#ff9100', '#3b82f6', '#f44336', '#4caf50', '#9c27b0', '#ff5722', '#2196f3'];
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

  // Show unused (not in current simulation) by default
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

  // Class-grouped substances for quick-pick
  const substancesByClass = useMemo(() => {
    const map: Record<string, typeof allSubstances> = {};
    for (const s of allSubstances) {
      if (!map[s.class]) map[s.class] = [];
      map[s.class].push(s);
    }
    return map;
  }, [allSubstances]);

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

      const k = eliminationConstant(firstDrug.pk.halfLifeHours);
      ssDays = Math.ceil(5 * (firstDrug.pk.halfLifeHours / 24));
    }

    setSimResult({ points: superpositionResult, perDrug, peak, trough, ssDays });
  };

  const toggleDrugVisibility = (id: string) => {
    setVisibleDrugs(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
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
      return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>
        <text x="${PAD - 4}" y="${y + 3}" fill="var(--text-dim)" font-size="8" text-anchor="end">${label}</text>`;
    });

    const weekMarkers: string[] = [];
    const step = maxWeek <= 12 ? 1 : maxWeek <= 24 ? 2 : 4;
    for (let w = 0; w <= maxWeek; w += step) {
      const x = toX(w);
      weekMarkers.push(`<text x="${x}" y="${H - 3}" fill="var(--text-dim)" font-size="9" text-anchor="middle">${w}</text>`);
    }

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'var(--bg-secondary)', borderRadius: 8 }}>
        {gridLines.map((l, i) => <g key={i} dangerouslySetInnerHTML={{ __html: l }} />)}
        {perDrugPaths.map((pd) => (
          <g key={pd.substanceId}>
            <path d={pd.d} fill="none" stroke={pd.color} strokeWidth="2" strokeDasharray="4 2" opacity={0.7} />
          </g>
        ))}
        <path d={totalPathD} fill="none" stroke="var(--accent)" strokeWidth="3" opacity={0.95} />
        <path d={effectPathD} fill="none" stroke="#4caf50" strokeWidth="2" strokeDasharray="6 3" opacity={0.85} />
        {weekMarkers.map((m, i) => <g key={`w${i}`} dangerouslySetInnerHTML={{ __html: m }} />)}
        <text x={W / 2} y={H - 1} fill="var(--text-dim)" fontSize="10" textAnchor="middle">Недели</text>
      </svg>
    );
  }, [simResult, showAllDrugs, visibleDrugs]);

  return (
    <div>
      {/* Current simulation drugs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {drugDoses.map((dd, idx) => {
          const sub = PHARMA_DB[dd.substanceId];
          return (
            <div key={idx} style={{
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              borderRadius: 12, padding: '10px 12px', fontSize: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                    {sub?.name || dd.substanceId}
                  </span>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(0,230,138,0.12)', color: 'var(--accent)' }}>
                    {CLASS_LABELS[sub?.class as string] || sub?.class}
                  </span>
                </div>
                {drugDoses.length > 1 && (
                  <button onClick={() => removeDrug(idx)} style={{
                    width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                )}
              </div>
              {/* Row 1: Dose + Weeks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                <div>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Доза (мг)</label>
                  <input type="number" value={dd.doseMg} onChange={(e) => updateDrug(idx, 'doseMg', parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 2 }}>Недель</label>
                  <input type="number" value={dd.totalWeeks} onChange={(e) => updateDrug(idx, 'totalWeeks', parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Row 2: Days — full width */}
              <div>
                <label style={{ fontSize: 9, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Дни инъекций:</label>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7].map(d => {
                    const active = (dd.frequencyDays || []).includes(d);
                    return (
                      <button key={d} type="button" onClick={() => {
                        const fDays = dd.frequencyDays || [];
                        const next = active ? fDays.filter(x => x !== d) : [...fDays, d].sort();
                        updateDrug(idx, 'frequencyDays', next);
                      }} style={{
                        flex: 1, minWidth: 36, height: 28, borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                        background: active ? 'var(--accent)' : 'var(--bg-secondary)', color: active ? '#000' : 'var(--text-dim)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      }}>{['','Пн','Вт','Ср','Чт','Пт','Сб','Вс'][d]}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drug selector */}
      <div style={{
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 12,
      }}>
        <input type="text" value={pkSearch} onChange={e => setPkSearch(e.target.value)}
          placeholder={drugDoses.length === 0 ? 'Начните вводить название...' : 'Поиск препарата...'}
          style={{ width: '100%', padding: '6px 10px', borderRadius: 8, background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, marginBottom: 6,
            boxSizing: 'border-box' }} />

        {/* Drug grid with ester grouping */}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {pkGrouped.map(g => (
                  <div key={g.cls} onClick={() => setPkEsterPopup({ baseClass: g.cls, label: g.label })} style={{
                    padding:'8px 9px', borderRadius:8, cursor:'pointer',
                    background:'var(--bg-secondary)', border:'1px solid var(--accent)',
                  }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:2 }}>{g.label}</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)' }}>👆 Эфиры</div>
                  </div>
                ))}
                {pkSingles.map(s => (
                  <div key={s.id} onClick={() => addDrug(s.id)} style={{
                    padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                      <span>{CLASS_LABELS[s.class] || s.class}</span>
                      <span>{s.pk?.halfLifeHours ? `${(s.pk.halfLifeHours / 24).toFixed(1)} дн` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showAllDrugs && !pkClass && !pkSearch && drugDoses.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>
                Выберите класс или начните поиск
              </div>
            )}

            {pkFiltered.length === 0 && (pkClass || pkSearch) && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>
                Все препараты этого класса уже добавлены
              </div>
            )}
          </>);
        })()}

        {/* PK ester popup */}
        {pkEsterPopup && (
          <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setPkEsterPopup(null)}>
            <div style={{ background:'var(--bg)', borderRadius:16, padding:20, maxWidth:320, width:'90%', maxHeight:'70vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin:'0 0 12px', fontSize:15 }}>{pkEsterPopup.label} — выберите эфир</h3>
              {allSubstances.filter(p => p.class === pkEsterPopup.baseClass).map(p => (
                <div key={p.id} onClick={() => { addDrug(p.id); setPkEsterPopup(null); }} style={{
                  padding:'10px 12px', borderRadius:10, cursor:'pointer', marginBottom:4,
                  background:'var(--bg-secondary)', border:'1px solid var(--border)',
                }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                  <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                    T½={(p.pk.halfLifeHours/24).toFixed(1)}дн {p.esters?.[0] ? `| ${p.esters[0]}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Run simulation */}
      <div style={{ marginBottom: 12 }}>
        <button onClick={runSimulation} style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #00e68a, #00c853)', color: '#000', fontWeight: 700, fontSize: 14,
          cursor: 'pointer',
        }}>▶ Запустить симуляцию</button>
      </div>

      {simResult && (
        <div>
          {/* PK metrics */}
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: '12px 14px', marginBottom: 8, fontSize: 12,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
              <div style={{ textAlign: 'center', padding: '6px 2px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Cmax</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{simResult.peak.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>мг/л</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 2px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Cmin</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{simResult.trough.toFixed(1)}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>мг/л</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 2px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>SS</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>≈{simResult.ssDays}</div>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>дн</div>
              </div>
            </div>
            {simResult.peak > 50 && (
              <div style={{ color: '#ff1744', fontWeight: 600, fontSize: 10, textAlign: 'center', padding: '4px 8px', background: 'rgba(255,23,68,0.08)', borderRadius: 6 }}>
                ⚠ Высокая пиковая концентрация — риск побочных эффектов
              </div>
            )}
            {simResult.points.length > 0 && simResult.points[simResult.points.length - 1].tol > 0.3 && (
              <div style={{ color: '#ff9100', fontWeight: 600, fontSize: 10, textAlign: 'center', padding: '4px 8px', background: 'rgba(255,145,0,0.08)', borderRadius: 6, marginTop: 4 }}>
                ⚠ Толерантность {(simResult.points[simResult.points.length - 1].tol * 100).toFixed(0)}%
              </div>
            )}
          </div>

          {/* Chart */}
          <div style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: 12, padding: 8, marginBottom: 8,
          }}>
            {chart}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
              <span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>━</span> Суммарная</span>
              {simResult.perDrug.map((d, i) => (
                <span key={d.substanceId}><span style={{ color: DRUG_COLORS[i % DRUG_COLORS.length], fontWeight: 700 }}>- -</span> {d.name}</span>
              ))}
              <span><span style={{ color: '#4CAF50', fontWeight: 700 }}>━</span> Эффект</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
import React, { useState, useMemo } from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { AAS_PROTOCOLS, EVIDENCE_LEVELS } from '../../../data/aas-support-protocols';
import { detectFemaleCyclePhase, femaleVirilizationWarnings, femaleBaseWarnings } from '../../../engines/female-support-layer';

interface FemalePharmaEntry {
  drugId: string;
  doseMgWeek: number;
  ester?: string;
  weeksOn: number;
}

const FEMALE_AAS_OPTIONS = [
  'test_enan', 'test_prop', 'test_cyp', 'tren_acet', 'tren_enan',
  'nand_deca', 'nand_phenyl', 'oxan', 'stan', 'methand', 'anadrol', 'dbol',
  'prim_enan', 'prim_methen', 'masteron', 'drosta',
  'hcg', 'clomi', 'tamoxifen', 'anastro', 'letro', 'exemest',
];

export const FemalePharmaCalculator: React.FC<{ cycleDay?: number; labs?: Record<string, number> }> = ({ cycleDay, labs }) => {
  const [entries, setEntries] = useState<FemalePharmaEntry[]>([]);

  const addEntry = () => setEntries([...entries, { drugId: 'test_enan', doseMgWeek: 100, weeksOn: 8 }]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const setDrugFor = (i: number, drugId: string) => {
    const next = [...entries];
    next[i] = { ...next[i], drugId };
    setEntries(next);
  };
  const setDoseFor = (i: number, val: number) => {
    const next = [...entries];
    next[i] = { ...next[i], doseMgWeek: val };
    setEntries(next);
  };

  const virilizationWarnings = useMemo(() => {
    const drugIds = entries.map(e => e.drugId);
    return femaleVirilizationWarnings(drugIds);
  }, [entries]);

  const cyclePhase = useMemo(() => detectFemaleCyclePhase(cycleDay), [cycleDay]);

  const matchedProtocols = useMemo(() => {
    const drugClasses = entries.map(e => PHARMA_DB[e.drugId]?.class).filter(Boolean);
    return AAS_PROTOCOLS.filter(p => p.substances.some(s => drugClasses.includes(s.id)));
  }, [entries]);

  return (
    <div style={{ padding:'0 8px 80px' }}>
      <div style={{ padding:'12px 0 8px' }}>
        <h3 style={{ margin:0, fontSize:14, color:'#f472b6' }}>♀ Женский калькулятор фармакологии</h3>
        <div style={{ fontSize:8, color:'#fff', marginTop:2 }}>
          Мульти-ввод препаратов с оценкой рисков вирилизации и фазой цикла
        </div>
      </div>

      {cyclePhase && (
        <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(244,114,182,0.06)', border:'1px solid rgba(244,114,182,0.14)', fontSize:10, color:'#fff', marginBottom:10 }}>
          🩸 <b>Фаза цикла:</b> {cyclePhase.phase} (неделя {cyclePhase.weekOfCycle}) — {cyclePhase.note}
        </div>
      )}

      {femaleBaseWarnings().length > 0 && (
        <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.14)', marginBottom:10 }}>
          {femaleBaseWarnings().map((w, i) => (
            <div key={i} style={{ fontSize:9, color:'#fbbf24', marginTop:i>0?4:0 }}>{w}</div>
          ))}
        </div>
      )}

      {virilizationWarnings.length > 0 && (
        <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', marginBottom:10 }}>
          {virilizationWarnings.map((w, i) => (
            <div key={i} style={{ fontSize:9, color:'#f87171', marginTop:i>0?4:0 }}>{w}</div>
          ))}
        </div>
      )}

      <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginBottom:8 }}>Препараты курса</div>

      {entries.length === 0 && (
        <div style={{ padding:'16px', borderRadius:10, background:'rgba(244,114,182,0.04)', border:'1px dashed rgba(244,114,182,0.2)', textAlign:'center', fontSize:11, color:'#fff' }}>
          Добавь первый препарат
        </div>
      )}

      {entries.map((entry, i) => {
        const drug = PHARMA_DB[entry.drugId];
        return (
          <div key={i} style={{ background:'rgba(0,0,0,0.22)', borderRadius:12, padding:'10px 11px', marginBottom:8, border:'1px solid rgba(244,114,182,0.08)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(244,114,182,0.14)', color:'#f472b6', fontSize:10, fontWeight:800 }}>#{i + 1}</span>
              <span style={{ flex:1, fontSize:12, fontWeight:800, color:'#fff' }}>{drug?.name || entry.drugId}</span>
              {entries.length > 1 && (
                <button onClick={() => removeEntry(i)} aria-label="Удалить" style={{ width:32, height:32, minWidth:32, minHeight:32, borderRadius:10, cursor:'pointer', fontSize:12, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.18)', color:'#f87171', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>✕</button>
              )}
            </div>
            <select
              value={entry.drugId}
              onChange={e => setDrugFor(i, e.target.value)}
              style={{ width:'100%', padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12, marginBottom:8 }}
            >
              {FEMALE_AAS_OPTIONS.map(id => (
                <option key={id} value={id} style={{ background:'#1a1a1e', color:'#fff' }}>
                  {PHARMA_DB[id]?.name || id}
                </option>
              ))}
            </select>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" value={entry.doseMgWeek} onChange={e => setDoseFor(i, parseFloat(e.target.value) || 0)}
                style={{ flex:1, padding:'12px', borderRadius:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:13, fontWeight:700, boxSizing:'border-box', outline:'none', minHeight:44 }} />
              <span style={{ fontSize:11, color:'#fff', fontWeight:700, whiteSpace:'nowrap' }}>мг/нед</span>
            </div>
          </div>
        );
      })}

      <button onClick={addEntry} style={{ width:'100%', minHeight:44, padding:'12px 0', borderRadius:12, cursor:'pointer', fontSize:12, fontWeight:800, border:'1px dashed rgba(244,114,182,0.32)', background:'rgba(244,114,182,0.08)', color:'#f472b6' }}>
        + Добавить препарат
      </button>

      {matchedProtocols.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#fff', marginBottom:8 }}>📋 Подходящие протоколы поддержки</div>
          {matchedProtocols.map(p => (
            <div key={p.id} style={{ background:'rgba(0,0,0,0.22)', borderRadius:10, padding:'10px 11px', marginBottom:6, border:'1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{p.title}</div>
              <div style={{ fontSize:10, color:'#fff', marginTop:4, lineHeight:1.45 }}>{p.evidenceNote}</div>
              {p.substances.length > 0 && (
                <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:4 }}>
                  {p.substances.map(s => (
                    <span key={s.id} style={{ fontSize:9, padding:'3px 8px', borderRadius:20, background:'rgba(139,92,246,0.10)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.18)' }}>{s.name}: {s.dose}</span>
                  ))}
                </div>
              )}
              {p.monitoring.length > 0 && (
                <div style={{ fontSize:9, color:'#fff', marginTop:6 }}>🔬 {p.monitoring.join(' · ')}</div>
              )}
              {p.warnings.length > 0 && (
                <div style={{ fontSize:9, color:'#fbbf24', marginTop:4 }}>⚠️ {p.warnings.join(' · ')}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

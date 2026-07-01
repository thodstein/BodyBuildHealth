import React, { useMemo, useState } from 'react';
import { estimate1RMFormula, estimate1RMConsensus, type RMFormula } from '../../../engines/pro/estimate1rm.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };
const FORMULAS: RMFormula[] = ['epley', 'brzycki', 'lander', 'lombardi', 'mayhew', 'oconner', 'wathen'];
const RU: Record<string, string> = { epley: 'Epley', brzycki: 'Brzycki', lander: 'Lander', lombardi: 'Lombardi', mayhew: 'Mayhew', oconner: "O'Conner", wathen: 'Wathen' };

export const OneRmCalcTab: React.FC = () => {
  const [weight, setWeight] = useState<number>(80);
  const [reps, setReps] = useState<number>(5);

  const results = useMemo(() => {
    if (weight <= 0 || reps <= 0) return null;
    const per: { f: RMFormula; v: number }[] = FORMULAS.map(f => ({ f, v: Math.round(estimate1RMFormula(weight, reps, f) * 10) / 10 }));
    const cons = estimate1RMConsensus(weight, reps);
    return { per, cons: Math.round((cons.mean ?? 0) * 10) / 10, min: Math.round((cons.min ?? 0) * 10) / 10, max: Math.round((cons.max ?? 0) * 10) / 10 };
  }, [weight, reps]);

  const pctTable = useMemo(() => {
    if (!results) return [];
    const one = results.cons || 0;
    return [100, 95, 90, 85, 80, 75, 70, 65, 60].map(p => ({ p, kg: Math.round(one * p / 100) }));
  }, [results]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор 1RM (оценка максимума)</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Введите вес и повторения в рабочем сете — оценка 1RM по 7 формулам + консенсус и таблица %1RM.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Вес, кг</label>
          <input type="number" value={weight} min={0} max={500} onChange={e => setWeight(+e.target.value)} style={IN} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Повторения</label>
          <input type="number" value={reps} min={1} max={20} onChange={e => setReps(+e.target.value)} style={IN} />
        </div>
      </div>

      {!results ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Введите вес &gt; 0 и повторения ≥ 1.</div>
      ) : (
        <>
          <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Консенсус 1RM ({weight}кг × {reps})</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: ACCENT }}>{results.cons} <span style={{ fontSize: 14 }}>кг</span></div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>диапазон: {results.min}–{results.max} кг</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>По формулам</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {results.per.map(r => (
              <div key={r.f} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-dim)' }}>{RU[r.f]}</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{r.v} кг</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Таблица %1RM (от консенсуса)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {pctTable.map(t => (
              <div key={t.p} style={{ padding: '6px 2px', borderRadius: 6, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{t.p}%</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{t.kg}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>💡 Консенсус — среднее по формулам. Epley/Brzycki точнее для 1–10 повт; для &gt;10 повт оценка грубее. Обновите workMax в профиле, если 1RM выше текущего.</div>
        </>
      )}
    </div>
  );
};

export default React.memo(OneRmCalcTab);
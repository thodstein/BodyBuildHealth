/**
 * TonnageCalculator.tsx — калькулятор тренировочного тоннажа/КПШ/интенсивности/УОИ.
 * Пользователь вводит 1ПМ и список подходов (вес×повторения×подходы) — система считает
 * тоннаж, КПШ, средний вес, относительную интенсивность и УОИ.
 */
import React, { useMemo, useState } from 'react';
import { MetricCard, PopupNumber, SaveButton } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };

interface Row { id: string; weight: number; reps: number; sets: number; }

export const TonnageCalculator: React.FC = () => {
  const [oneRM, setOneRM] = useState(100);
  const [rows, setRows] = useState<Row[]>([
    { id: 'r1', weight: 80, reps: 5, sets: 4 },
    { id: 'r2', weight: 70, reps: 8, sets: 3 },
  ]);

  const upd = (id: string, field: keyof Row, val: number) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addRow = () => setRows(prev => [...prev, { id: 'r' + Date.now(), weight: 60, reps: 6, sets: 3 }]);
  const delRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const m = useMemo(() => {
    const tonnage = rows.reduce((s, r) => s + r.sets * r.reps * r.weight, 0);
    const kpsh = rows.reduce((s, r) => s + r.sets * r.reps, 0);
    const avgWeight = kpsh > 0 ? tonnage / kpsh : 0;
    const relInt = oneRM > 0 ? (avgWeight / oneRM) * 100 : 0;
    const uoi = relInt; // УОИ ≈ средняя относительная интенсивность
    return { tonnage, kpsh, avgWeight, relInt, uoi };
  }, [rows, oneRM]);

  return (
    <div className="card" style={{ padding: '12px 14px', background: 'rgba(20,22,30,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, marginBottom: 8 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 13, color: ACCENT }}>📦 Калькулятор тоннажа / КПШ / интенсивности</h3>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 10 }}>Тоннаж = Σ подходы × повторения × вес; КПШ = Σ подходы × повторения; УОИ ≈ средняя относительная интенсивность к 1ПМ.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontSize:9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '0 4px 2px' }}>
        <span style={{ textAlign: 'center' }}>Вес</span><span style={{ textAlign: 'center' }}>Повт</span><span style={{ textAlign: 'center' }}>Подходы</span><span></span>
      </div>
      {rows.map(r => (
        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 4, marginBottom: 4 }}>
          <input type="number" value={r.weight} onChange={e => upd(r.id, 'weight', +e.target.value)} style={IN} />
          <input type="number" value={r.reps} onChange={e => upd(r.id, 'reps', +e.target.value)} style={IN} />
          <input type="number" value={r.sets} onChange={e => upd(r.id, 'sets', +e.target.value)} style={IN} />
          <button onClick={() => delRow(r.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 12, padding: '0 10px' }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 10 }}>
        <button onClick={addRow} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>＋ Строка</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>1ПМ упражнения, кг</div><input type="number" value={oneRM} onChange={e => setOneRM(+e.target.value)} style={IN} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ background: 'rgba(0,230,138,0.08)', borderRadius: 8, padding: 8, textAlign: 'center', border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Тоннаж</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{m.tonnage.toFixed(0)}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>кг·пов</div>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 8, padding: 8, textAlign: 'center', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>КПШ</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{m.kpsh}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>подходов×повт</div>
        </div>
        <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: 8, textAlign: 'center', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Средний вес</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{m.avgWeight.toFixed(1)}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>кг</div>
        </div>
        <div style={{ background: 'rgba(168,85,247,0.08)', borderRadius: 8, padding: 8, textAlign: 'center', border: '1px solid rgba(168,85,247,0.15)' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>УОИ (инт. отн.)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>{m.relInt.toFixed(1)}%</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>к 1ПМ</div>
        </div>
      </div>
    </div>
  );
};

export default TonnageCalculator;
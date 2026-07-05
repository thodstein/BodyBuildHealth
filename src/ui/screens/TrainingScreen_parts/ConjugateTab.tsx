import React, { useState, useMemo } from 'react';
import { generateConjugateWeek, getAllVariations, type ConjugateDay } from '../../../engines/conjugate.engine';

const ACCENT = '#00e68a';
const GLASS: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 10 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8 };
const LABEL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 10, margin: '6px 0 4px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 };
const PILL = (on: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 14, fontSize: 10, fontWeight: 700, cursor: 'pointer',
  border: on ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)',
  background: on ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.02)',
  color: on ? '#00e68a' : 'rgba(255,255,255,0.6)',
});

const LIFT_OPTIONS = [
  { id: 'squat' as const, label: 'Присед' },
  { id: 'bench' as const, label: 'Жим лёжа' },
  { id: 'deadlift' as const, label: 'Становая' },
];

const ConjugateTab: React.FC = () => {
  const [lift, setLift] = useState<'squat' | 'bench' | 'deadlift'>('squat');
  const [block, setBlock] = useState(0);

  const schedule = useMemo(() => generateConjugateWeek(lift, block), [lift, block]);
  const variations = useMemo(() => getAllVariations(lift), [lift]);

  const dayColor = (type: string): string => {
    if (type === 'me') return '#ff6b35';
    if (type === 'de') return '#3b82f6';
    return '#22c55e';
  };
  const dayLabel = (type: string): string => {
    if (type === 'me') return 'ME — Max Effort';
    if (type === 'de') return 'DE — Dynamic Effort';
    return 'RE — Repetition';
  };

  return (
    <div>
      <div style={GLASS}>
        <div style={H}>🔁 Конъюгат (Westside Barbell)</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
          ME-день (тяжёлый сингл) + DE-день (speed work) + RE-дни (объём/слабые места).
          Каждые 1-3 нед — смена ME-упражнения.
        </div>
        <div style={LABEL}>Основное движение</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {LIFT_OPTIONS.map(o => (
            <button key={o.id} onClick={() => { setLift(o.id); setBlock(0); }} style={PILL(lift === o.id)}>{o.label}</button>
          ))}
        </div>
        <div style={LABEL}>Вариация ME (блок {block + 1})</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {variations.map((v, i) => (
            <button key={i} onClick={() => setBlock(i)} style={PILL(block === i)}>{v}</button>
          ))}
        </div>
      </div>

      {schedule.days.map((day, di) => (
        <div key={di} style={{ ...GLASS, borderLeft: `3px solid ${dayColor(day.type)}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: dayColor(day.type) }}>{dayLabel(day.type)}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{day.name}</span>
          </div>
          <div style={LABEL}>Упражнения</div>
          {day.exercises.map((ex, ei) => {
            const intensity = ex.type === 'main' ? `${Math.round(ex.intensity * 100)}%` : '';
            return (
              <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ color: ex.type === 'main' ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: ex.type === 'main' ? 700 : 400 }}>
                  {ex.name}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {ex.sets}×{ex.reps} {intensity} @RIR {ex.rir}
                </span>
              </div>
            );
          })}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{day.notes}</div>
        </div>
      ))}

      <div style={GLASS}>
        <div style={H}>📋 Все ME-вариации ({lift})</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {variations.map((v, i) => (
            <span key={i} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 9,
              background: i === block ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
              color: i === block ? ACCENT : 'rgba(255,255,255,0.5)',
              border: '1px solid ' + (i === block ? '#00e68a' : 'rgba(255,255,255,0.04)'),
            }}>
              {i + 1}. {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConjugateTab;

/**
 * ArmTechniqueCard.tsx — диагностика слабых звеньев (как PlDeadpointsBarPathCard).
 * Выбираешь где проваливаешься — получаешь рекомендации в слабые зоны.
 */
import React, { useState } from 'react';
import { diagnoseArmWeakPoint } from '../../../engines/arm/arm-weakpoint.engine';

const STORAGE_KEY = 'he_arm_technique_card_v1';

export function ArmTechniqueCard({ onApplyWeak }: { onApplyWeak?: (weak: string[]) => void }) {
  const [fails, setFails] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });
  const [technique, setTechnique] = useState<string>('balanced');

  const diag = diagnoseArmWeakPoint({
    weakTest: {
      cupFails: !!fails.cup,
      risingFails: !!fails.rising,
      pronationFails: !!fails.pronation,
      supinationFails: !!fails.supination,
      sidePressureFails: !!fails.side,
      backPressureFails: !!fails.back,
    },
    technique,
  });

  const toggle = (k: string) => {
    const next = { ...fails, [k]: !fails[k] };
    setFails(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const apply = () => {
    if (onApplyWeak) onApplyWeak(diag.weakMuscles.slice(0, 2));
  };

  return (
    <div style={{ border: '1px solid #1f3a5f', borderRadius: 12, padding: 12, background: '#0f1e35' }}>
      <h3 style={{ margin: '0 0 8px', color: '#fff' }}>🎯 Диагностика слабых звеньев</h3>
      <p style={{ color: '#9ab', fontSize: 13, margin: '0 0 8px' }}>Где проваливаешься за столом? Отметь — получишь слабые мышцы и упражнения.</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <select value={technique} onChange={e => setTechnique(e.target.value)} style={{ background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px' }}>
          <option value="balanced">Сбалансировано</option>
          <option value="hook">Хук</option>
          <option value="toproll">Топролл</option>
          <option value="press">Пресс</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {[
          ['cup','Кисть открывается (cup)'],
          ['rising','Пальцы уходят (rising)'],
          ['pronation','Топролл не держит'],
          ['supination','Хук проваливается'],
          ['side','Не дожимает боком'],
          ['back','Тяга на себя слабая'],
          ['grip','Хват слабеет (pinch)'],
          ['thumb','Большой палец уходит'],
          ['ulnar','Ulnar/radial дисбаланс'],
        ].map(([k,label]) => (
          <button
            key={k}
            onClick={() => toggle(k)}
            aria-pressed={!!fails[k]}
            style={{
              padding: '6px 10px', borderRadius: 999, border: '1px solid',
              borderColor: fails[k] ? '#00e68a' : '#1f3a5f',
              background: fails[k] ? 'rgba(0,230,138,0.15)' : '#0a1629',
              color: fails[k] ? '#00e68a' : '#9ab', cursor: 'pointer', fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {diag.priorities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {diag.priorities.map((p,i) => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f' }}>
              <b style={{ color: '#fff' }}>{p.muscle}</b> <span style={{ color: '#9ab' }}>— {p.reason}</span>
              <div style={{ color: '#5ee', fontSize: 12 }}>{p.exercises.join(', ')}</div>
            </div>
          ))}
          <button onClick={apply} style={{ marginTop: 6, background: '#00e68a', color: '#001', border: 0, borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}>
            ➕ В слабые зоны
          </button>
        </div>
      ) : <div style={{ color: '#6a8a9a', fontSize: 13 }}>Слабые звенья не выявлены — баланс.</div>}
      <div style={{ marginTop: 8, color: '#6a8a9a', fontSize: 12 }}>{diag.rationale.join(' · ')}</div>
    </div>
  );
}

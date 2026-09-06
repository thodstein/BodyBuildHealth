/**
 * ArmTechniqueCard.tsx — диагностика слабых звеньев (как PlDeadpointsBarPathCard).
 * Выбираешь где проваливаешься — получаешь рекомендации в слабые зоны.
 * Редизайн на arm-design-system; логика и строки 1-в-1.
 */
import React, { useState } from 'react';
import { diagnoseArmWeakPoint } from '../../../engines/arm/arm-weakpoint.engine';
import { AdCard, AdChip, AdBtn } from './arm-design-system';

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
    <div className="train-armtech">
      <AdCard>
        <div className="ad-sec-h">
          <div className="ad-sec-t">🎯 Диагностика слабых звеньев</div>
        </div>
        <p className="ad-muted">Где проваливаешься за столом? Отметь — получишь слабые мышцы и упражнения.</p>
        <div className="ad-row">
          <select value={technique} onChange={e => setTechnique(e.target.value)} aria-label="Техника">
            <option value="balanced">Сбалансировано</option>
            <option value="hook">Хук</option>
            <option value="toproll">Топролл</option>
            <option value="press">Пресс</option>
          </select>
        </div>
        <div className="ad-row">
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
            <AdChip key={k} active={!!fails[k]} onClick={() => toggle(k)}>
              {label}
            </AdChip>
          ))}
        </div>
        {diag.priorities.length > 0 ? (
          <div className="ad-list">
            {diag.priorities.map((p,i) => (
              <div key={i} className="ad-sec">
                <b>{p.muscle}</b> <span className="ad-muted">— {p.reason}</span>
                <div className="ad-tip">{p.exercises.join(', ')}</div>
              </div>
            ))}
            <AdBtn variant="primary" onClick={apply}>➕ В слабые зоны</AdBtn>
          </div>
        ) : <div className="ad-muted">Слабые звенья не выявлены — баланс.</div>}
        <div className="ad-muted">{diag.rationale.join(' · ')}</div>
      </AdCard>
    </div>
  );
}

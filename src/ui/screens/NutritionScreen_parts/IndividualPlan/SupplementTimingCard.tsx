/**
 * SupplementTimingCard.tsx — «💊 Схема приёма добавок» (PRO): когда принимать добавки
 * относительно приёмов/тренировки дня. Источник — чистый движок
 * `planner-supplement-timing.engine` (каталог поддержки + план дня). Только подача.
 */
import React, { useMemo } from 'react';
import { GlassCard } from './ui';
import {
  buildSupplementTiming,
  type SuppTimingMeal,
} from './planner-supplement-timing.engine';

interface Props {
  supplements: { id: string; name?: string; nameRu?: string; dosage?: string; timing?: string }[];
  meals: SuppTimingMeal[];
  trainStartMin?: number;
  trainDurationMin?: number;
  isTrainingDay: boolean;
  weightKg: number;
  sex: 'male' | 'female';
  goal?: string;
}

export const SupplementTimingCard: React.FC<Props> = (props) => {
  const t = useMemo(() => buildSupplementTiming({
    supplements: props.supplements,
    meals: props.meals,
    trainStartMin: props.trainStartMin,
    trainDurationMin: props.trainDurationMin,
    isTrainingDay: props.isTrainingDay,
    weightKg: props.weightKg,
    sex: props.sex,
    goal: props.goal,
  }), [props.supplements, props.meals, props.trainStartMin, props.trainDurationMin, props.isTrainingDay, props.weightKg, props.sex, props.goal]);

  if (t.slots.length === 0) return null;

  return (
    <GlassCard title="Схема приёма добавок" icon="💊" color="#22c55e">
      <div data-suppl-timing="1">
        {t.slots.map((s) => (
          <div key={s.slot} data-suppl-slot={s.slot} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ flexShrink: 0, width: 54, fontSize: 12, fontWeight: 800, color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>{s.time}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{s.label}</div>
              {s.items.map((it) => (
                <div key={it.id} data-suppl-item={it.id} style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.45, marginTop: 2 }}>
                  <b>{it.name}</b>{it.dose && it.dose !== 'по инструкции' ? ` — ${it.dose}` : ''}
                  <span style={{ color: '#fff' }}> · {it.reason}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div data-suppl-notes style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {t.notes.map((n, i) => <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.45 }}>{n}</div>)}
        </div>
      </div>
    </GlassCard>
  );
};

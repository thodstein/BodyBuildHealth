/**
 * PlanFeedbackCard.tsx — карта «дневник → план»: по каждому упражнению
 * последней недели показывает ФАКТ (последняя запись) и рекомендацию на
 * следующую неделю (вес/повт/RIR), с кнопкой «Применить факт» — добавляет
 * в план неделю N+1 с весами/RIR из рекомендации.
 *
 * Замыкает цикл: тренировка → лог → корректировка плана. Это авто-регулируемая
 * прогрессия (вес растёт по факту, а не слепой линейкой).
 */
import React, { useMemo } from 'react';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';
import type { LoadStrategy } from '../../../engines/bb/bb-autocoach.engine';
import { loadSessions } from '../../../engines/workout-logger.engine';
import { computePlanFeedback, applyFeedbackToNextWeek, type ExerciseFeedback } from '../../../engines/bb/bb-progression-feedback.engine';
import { GROUP_RU } from './program-types';
import { CARD, ACCENT } from './training-ui';

const btn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.3)', color: ACCENT };

export const PlanFeedbackCard: React.FC<{
  plan: BBPlan | null;
  workMax: Record<string, number>;
  strategy: LoadStrategy;
  onApply: (nextPlan: BBPlan) => void;
}> = ({ plan, workMax, strategy, onApply }) => {
  const feedback = useMemo<ExerciseFeedback[]>(() => {
    if (!plan || plan.weeks.length === 0) return [];
    return computePlanFeedback(plan, loadSessions(), workMax, strategy, plan.weeks.length);
  }, [plan, workMax, strategy]);

  if (!plan || feedback.length === 0) return null;

  const withFact = feedback.filter(f => f.last);
  const noData = feedback.length - withFact.length;
  const apply = () => {
    const next = applyFeedbackToNextWeek(plan, feedback);
    onApply(next);
  };

  return (
    <div className="train-planfeedback" style={{ ...CARD, padding: 10, marginBottom: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>↻ Дневник → план (прогрессия по факту)</span>
        <span style={{ fontSize: 10, color: '#fff' }}>{withFact.length} из {feedback.length} с данными{noData > 0 ? ` · ${noData} без лога` : ''}</span>
        <button style={{ ...btn, marginLeft: 'auto' }} onClick={apply} disabled={withFact.length === 0}>↻ Применить факт → нед. {plan.weeks[plan.weeks.length-1].week + 1}</button>
      </div>

      {withFact.length === 0 ? (
        <div style={{ fontSize: 11, color: '#fff', padding: '8px 0' }}>
          Нет выполненных тренировок в дневнике. Проведите тренировку по плану — здесь появится факт и рекомендация на следующую неделю.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {withFact.slice(0, 14).map(f => {
            const heavy = (f.rirDelta ?? 0) <= -1; // факт тяжелее цели (RIR факт < цели)
            const easy = (f.rirDelta ?? 0) >= 1;   // факт легче цели
            const recColor = f.recommendation.source === 'fact' ? (heavy ? '#ef4444' : easy ? '#60a5fa' : ACCENT) : '#fff';
            return (
              <div key={f.planKey} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.02)', fontSize: 11 }}>
                <span style={{ flex: '0 0 110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff', fontWeight: 700 }}>{f.planExerciseName}</span>
                <span style={{ flex: '0 0 70px', fontSize: 10, color: '#fff' }}>{GROUP_RU[f.muscle] || f.muscle}</span>
                <span style={{ flex: '0 0 130px', fontSize: 10, color:'#fff' }}>
                  Факт: <b style={{ color: '#fff' }}>{f.last!.topWeight}×{f.last!.topReps}</b> RIR{f.last!.actualRir}
                  <span style={{ opacity: 0.6 }}> · e1RM {f.last!.e1rm}</span>
                </span>
                <span style={{ flex: 1, fontSize: 10, color: recColor, fontWeight: 700 }}>
                  → {f.recommendation.nextWeight}×{f.recommendation.nextReps} RIR{f.recommendation.nextRir}
                  {heavy && ' ⚠ тяжелее цели'}
                  {easy && ' ↘ легче цели'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 11, color: '#fff', lineHeight: 1.4 }}>
        RIR-дельта = факт − цель. Отрицательная (тяжелее цели) → вес растём осторожнее; положительная (легче) → +вес. Стратегия: {strategy}.
      </div>
    </div>
  );
};
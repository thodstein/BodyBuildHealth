/**
 * ExerciseCalcTab.tsx — подвкладка «Калькулятор упражнений».
 * Выбор упражнения + 1ПМ → расчёт назначения (подходы/повторения/%1RM/RIR/отдых)
 * через calcExercisePrescription. Перенесён из вкладки «Калькуляторы».
 */
import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { calcExercisePrescription } from '../../../engines/training.engine';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import type { Exercise } from '../../../core/types';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 40, width: '100%', boxSizing: 'border-box' as const, fontSize: 11 };

const GROUPS = ['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = { all: 'Все группы', chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };

export const ExerciseCalcTab: React.FC = () => {
  const [group, setGroup] = useState<string>('chest');
  const [exId, setExId] = useState<string>('');
  const [oneRM, setOneRM] = useState<number>(100);
  const [goal, setGoal] = useState<string>('strength');
  const [level, setLevel] = useState<string>('intermediate');
  const [week, setWeek] = useState<number>(1);
  const [totalWeeks, setTotalWeeks] = useState<number>(12);

  const exList = useMemo(() => group === 'all' ? EXERCISE_CATALOG : EXERCISE_CATALOG.filter(e => e.group === group), [group]);
  const ex: Exercise | undefined = useMemo(() => EXERCISE_CATALOG.find(e => e.id === exId), [exId]);

  const presc = useMemo(() => {
    if (!ex) return null;
    try {
      return calcExercisePrescription(ex, goal, level, false, false, 1, week, totalWeeks);
    } catch { return null; }
  }, [ex, goal, level, week, totalWeeks]);

  const reps0 = ex && presc ? (parseInt(presc.reps) || 5) : 5;
  const pct = Math.round(100 / (1 + reps0 / 30));
  const workWeight = ex && presc ? +(oneRM * pct / 100).toFixed(1) : 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🧮 Калькулятор упражнений</div>
      <div style={{ ...SMALL, marginBottom: 10 }}>Выберите упражнение и введите свой 1ПМ — система рассчитает назначение: подходы, повторения, %1RM, рабочий вес, RIR и отдых.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupSelect label="Группа мышц" value={group} onChange={setGroup} options={GROUPS.map(g => ({ id: g, label: GROUP_RU[g] }))} />
        <PopupSelect label="Упражнение" value={exId} onChange={setExId} hint="Выберите упражнение из каталога." options={exList.slice(0, 200).map(e => ({ id: e.id, label: e.name, desc: `${e.type === 'compound' ? 'Базовое' : 'Изолирующее'} · ${e.equipment}` }))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupNumber label="Ваш 1ПМ" value={oneRM} min={5} max={600} suffix=" кг" onChange={v => setOneRM(v)} />
        <PopupSelect label="Цель" value={goal} onChange={setGoal} options={[['strength','Сила'],['mass','Гипертрофия'],['endurance','Выносливость'],['peak','Пик'],['mixed','Смешанная']].map(([id,label]) => ({ id, label }))} />
        <PopupSelect label="Уровень" value={level} onChange={setLevel} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Продвинутый'],['enhanced','Enhanced']].map(([id,label]) => ({ id, label }))} />
        <PopupNumber label="Неделя цикла" value={week} min={1} max={24} onChange={v => setWeek(v)} />
      </div>

      {ex && presc && (
        <>
          <MetricCard title={`Назначение: ${ex.name}`} icon="🎯">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Подходы × повторения</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{presc.sets} × {presc.reps}</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Рабочий вес ({pct}% 1RM)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{workWeight} кг</div>
              </div>
              <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>RIR (повторения в резерве)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{presc.rir}</div>
              </div>
              <div style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Отдых между подходами</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>{presc.rest} с</div>
              </div>
            </div>
            {presc.dropSet && <div style={{ ...SMALL, marginTop: 8 }}>🔻 Дроп-сет: {presc.dropSetReps}</div>}
            {presc.backoffSet && <div style={{ ...SMALL }}>↩️ Включить backoff-сет (объёмный доборный подход).</div>}
          </MetricCard>

          <ExpandableCard title="Как строится назначение" icon="📖" short={presc.progressionNote} full={
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
              <div>Фаза мезоцикла для недели {week} из {totalWeeks} определяет RIR и интенсивность. RIR-матрица учитывает цель («{goal}») и уровень («{level}»).</div>
              <div style={{ marginTop: 6 }}>Рабочий вес = 1ПМ × %1RM, где %1RM оценён по повторениям (≈ 100/(1+reps/30)). Для точного %1RM используйте вкладку «Калькуляторы» → RPE↔%1RM.</div>
              <div style={{ marginTop: 6 }}>{presc.progressionNote}</div>
            </div>
          } />
        </>
      )}

      {!ex && <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Выберите упражнение выше.</div>}
    </div>
  );
};

export default ExerciseCalcTab;
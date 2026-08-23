/**
 * HybridPlanPanel.tsx — powerbuilder (сила + масса): ПЛ-цикл (faithful) +
 * ББ-аксессуары. ПЛ-цикл immutable; аксессуары генерируются движком.
 *
 * U1: подключён к data flow — принимает program/hybrid как prop и при изменении
 * обновляет обратно через onChange. Раньше компонент использовал свой локальный state
 * и данные терялись при сохранении.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { buildHybridPlan, type HybridPlan, type HybridDay } from '../../../engines/bb/hybrid-plan.engine';
import type { LMSPlanExercise, LMSWorkSet } from '../../../engines/lms/lms-builder.engine';
import type { UserProgram, HybridProgramBody } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { CARD, ACCENT, IN, SMALL, DIM, DIM_STRONG, BTN } from './training-ui';
import { EditorPopupSelect } from './EditorPopup';

const LIFT_LABEL: Record<string, string> = { squat: '🦵 Присед', bench: '💪 Жим', deadlift: '🏋 Тяга', other: '⚙ Другое' };
const LIFT_COLOR: Record<string, string> = { squat: '#f59e0b', bench: '#00e68a', deadlift: '#a78bfa', other: '#60a5fa' };

function fmtHeavy(ex: LMSPlanExercise): string {
  const sets = ex.workSets.reduce((s: number, w: LMSWorkSet) => s + w.sets, 0);
  const top = ex.workSets[ex.workSets.length - 1];
  return `${sets}×${top?.reps ?? '?'} @${Math.round(top?.weight ?? 0)}кг (${Math.round((top?.pct ?? 0) * 100)}%) RIR${ex.rir}`;
}

export const HybridPlanPanel: React.FC<{
  program: UserProgram;
  onChange: (hybrid: HybridProgramBody) => void;
  onSave: (note?: string) => void;
}> = ({ program, onChange, onSave }) => {
  // PL cycles = powerlifting direction OR strength period.
  const plCycles = useMemo(() => LMS_CYCLES.filter(c => c.meta.direction === 'powerlifting' || c.meta.period === 'strength'), []);
  const initial = program.hybrid;
  const [cycleId, setCycleId] = useState<string>(initial?.plRef?.sourceCycleId || plCycles[0]?.meta.id || '');
  const [squat, setSquat] = useState(initial?.workMax?.squat || 120);
  const [bench, setBench] = useState(initial?.workMax?.bench || 100);
  const [dead, setDead] = useState(initial?.workMax?.deadlift || 140);
  const [weeks, setWeeks] = useState<number>(initial?.weeksOverride || plCycles[0]?.meta.weeks || 8);
  const [level, setLevel] = useState(initial?.level || program.meta.level || 'intermediate');
  const [built, setBuilt] = useState<HybridPlan | null>(null);
  const [notes, setNotes] = useState(initial?.notes || '');

  // При изменении props (program) — синхронизируем с локальным state (только если external changed)
  useEffect(() => {
    if (initial) {
      setCycleId(initial.plRef?.sourceCycleId || plCycles[0]?.meta.id || '');
      setSquat(initial.workMax?.squat || 120);
      setBench(initial.workMax?.bench || 100);
      setDead(initial.workMax?.deadlift || 140);
      setWeeks(initial.weeksOverride || plCycles[0]?.meta.weeks || 8);
      setLevel(initial.level || program.meta.level || 'intermediate');
      setNotes(initial.notes || '');
    }
  }, [program.meta.id]);

  const build = () => setBuilt(buildHybridPlan({ cycleId, pmMap: { squat, bench, dead }, weeks, level, equipment: ['barbell', 'dumbbell', 'cable', 'machine'] }));

  // Применить собранный план к program.hybrid
  const apply = () => {
    if (!built) return;
    const newHybrid: HybridProgramBody = {
      direction: 'hybrid',
      plRef: { sourceCycleId: built.cycle.meta.id, sessionIndices: [] },
      bbWeeks: built.daysByWeek.map((days, wi) => ({
        week: wi + 1,
        phase: 'accumulation' as const,
        deload: false,
        sessions: days.map((d, di) => ({
          id: 'ses_h_' + wi + '_' + di,
          name: `${LIFT_LABEL[d.mainLift] || 'День'} ${di + 1}`,
          focus: d.mainLift,
          blocks: [
            ...d.heavy.exercises.map((e, ei) => ({
              id: 'blk_h_' + wi + '_' + di + '_h' + ei,
              type: 'compound' as const,
              exerciseName: e.name,
              muscle: (d.mainLift === 'squat' ? 'quads' : d.mainLift === 'bench' ? 'chest' : 'back') as any,
              role: 'primary' as const,
              sets: [{ reps: e.workSets[e.workSets.length - 1]?.reps || 5, rir: e.rir, weight: e.workSets[e.workSets.length - 1]?.weight || 0, restSec: 180 }],
            })),
            ...d.accessories.map((a, ai) => ({
              id: 'blk_h_' + wi + '_' + di + '_a' + ai,
              type: 'accessory' as const,
              exerciseName: a.name,
              muscle: a.muscle as any,
              role: 'accessory' as const,
              sets: [{ reps: a.workSets[0]?.reps || 10, rir: a.rir, weight: a.workSets[0]?.weight || 0, restSec: 90 }],
            })),
          ],
        })),
      })),
      workMax: { squat, bench, deadlift: dead },
      notes,
    };
    onChange(newHybrid);
    onSave('Hybrid powerbuilder-план');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#3b82f6' }}>⚡ Powerbuilder (сила + масса)</div>
      <div style={{ fontSize: 11, color: DIM }}>Проф. ПЛ-цикл (тяжёлые присед/жим/тяга, immutable) + ББ-аксессуары на мышцы-антагонисты после каждого тяжёлого дня.</div>

      <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
          ПЛ-цикл (источник силы)
          <EditorPopupSelect
            value={cycleId}
            options={plCycles.map(c => ({ id: c.meta.id, label: `${c.meta.title} · ${c.meta.sessionsPerWeek}д/нед · ${c.meta.weeks}нед · ${c.meta.level}` }))}
            onChange={v => { setCycleId(v); const c = LMS_CYCLES.find(x => x.meta.id === v); if (c) setWeeks(c.meta.weeks); }}
            ariaLabel="ПЛ-цикл (источник силы)"
            title="ПЛ-цикл (источник силы)"
          />
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['Присед', squat, setSquat], ['Жим', bench, setBench], ['Тяга', dead, setDead]] as const).map(([lbl, v, set]) => (
            <label key={lbl} style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>{lbl} PM (кг)<input type="number" style={IN} value={v} onChange={e => set(parseFloat(e.target.value) || 0)} /></label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>Недель<input type="number" style={IN} value={weeks} min={1} max={16} onChange={e => setWeeks(parseInt(e.target.value) || 1)} /></label>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>Уровень
          <EditorPopupSelect
            value={level}
            options={[
              { id: 'beginner', label: 'Новичок' }, { id: 'intermediate', label: 'Средний' },
              { id: 'advanced', label: 'Опытный' }, { id: 'enhanced', label: 'Enhanced' },
            ]}
            onChange={setLevel}
            ariaLabel="Уровень подготовки"
            title="Уровень подготовки"
          />
        </label>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...BTN, flex: 1 }} onClick={build}>🔧 Собрать powerbuilder-план</button>
          {built && <button style={{ ...BTN, flex: 1, background: '#3b82f6' }} onClick={apply}>💾 Применить к программе</button>}
        </div>
        <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 2 }}>
          Заметки
          <textarea style={{ ...IN, minHeight: 50, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Акценты, адаптации под восстановление" />
        </label>
      </div>

      {built && (
        <div style={{ ...CARD, padding: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>📋 {built.cycle.meta.title}</div>
          <div style={{ fontSize: 11, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>{built.rationale}</div>
          {built.daysByWeek.map((days, wi) => (
            <div key={wi} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: DIM_STRONG, marginBottom: 4 }}>Неделя {built.heavyWeeks[wi].week}</div>
              {days.map((d: HybridDay, di) => (
                <div key={di} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', marginBottom: 6, borderLeft: `3px solid ${LIFT_COLOR[d.mainLift]}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: LIFT_COLOR[d.mainLift], marginBottom: 4 }}>{LIFT_LABEL[d.mainLift]} — день {d.dayIdx + 1}</div>
                  <div style={{ fontSize: 11, color: '#fff', marginBottom: 2 }}>🏋 Сила (цикл):</div>
                  {d.heavy.exercises.map((ex, ei) => (
                    <div key={ei} style={{ fontSize: 11, color: DIM_STRONG, padding: '2px 0 2px 8px' }}><b>{ex.name}</b> — {fmtHeavy(ex)}</div>
                  ))}
                  {d.accessories.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, color: ACCENT, marginTop: 4, marginBottom: 2 }}>💪 Масса (аксессуары):</div>
                      {d.accessories.map((a, ai) => (
                        <div key={ai} style={{ fontSize: 11, color: '#fff', padding: '2px 0 2px 8px' }}><b>{a.name}</b> — {a.sets}×{a.workSets[0]?.reps} @{a.workSets[0]?.weight}кг RIR{a.rir} <span style={{ opacity: 0.6 }}>({GROUP_RU[a.muscle] || a.muscle})</span></div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
          {built.daysByWeek.length > 2 && <div style={{ fontSize: 10, color: DIM }}>… ещё {built.daysByWeek.length - 2} нед. (структура повторяется с прогрессией цикла)</div>}
        </div>
      )}
    </div>
  );
};
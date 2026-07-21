/**
 * HybridPlanPanel.tsx — powerbuilder (сила + масса): ПЛ-цикл (faithful) +
 * ББ-аксессуары. ПЛ-цикл immutable; аксессуары генерируются движком.
 */
import React, { useMemo, useState } from 'react';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { buildHybridPlan, type HybridPlan, type HybridDay } from '../../../engines/bb/hybrid-plan.engine';
import type { LMSPlanExercise, LMSWorkSet } from '../../../engines/lms/lms-builder.engine';
import { GROUP_RU } from './program-types';
import { CARD, ACCENT, IN, SMALL, DIM, DIM_STRONG, BTN } from './training-ui';

const LIFT_LABEL: Record<string, string> = { squat: '🦵 Присед', bench: '💪 Жим', deadlift: '🏋 Тяга', other: '⚙ Другое' };
const LIFT_COLOR: Record<string, string> = { squat: '#f59e0b', bench: '#00e68a', deadlift: '#a78bfa', other: '#60a5fa' };

function fmtHeavy(ex: LMSPlanExercise): string {
  const sets = ex.workSets.reduce((s: number, w: LMSWorkSet) => s + w.sets, 0);
  const top = ex.workSets[ex.workSets.length - 1];
  return `${sets}×${top?.reps ?? '?'} @${Math.round(top?.weight ?? 0)}кг (${Math.round((top?.pct ?? 0) * 100)}%) RIR${ex.rir}`;
}

export const HybridPlanPanel: React.FC = () => {
  // PL cycles = powerlifting direction OR strength period.
  const plCycles = useMemo(() => LMS_CYCLES.filter(c => c.meta.direction === 'powerlifting' || c.meta.period === 'strength'), []);
  const [cycleId, setCycleId] = useState<string>(plCycles[0]?.meta.id || '');
  const [squat, setSquat] = useState(120);
  const [bench, setBench] = useState(100);
  const [dead, setDead] = useState(140);
  const [weeks, setWeeks] = useState<number>(() => plCycles[0]?.meta.weeks || 8);
  const [level, setLevel] = useState('intermediate');
  const [built, setBuilt] = useState<HybridPlan | null>(null);

  const build = () => setBuilt(buildHybridPlan({ cycleId, pmMap: { squat, bench, dead }, weeks, level, equipment: ['barbell', 'dumbbell', 'cable', 'machine'] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#3b82f6' }}>⚡ Powerbuilder (сила + масса)</div>
      <div style={{ fontSize: 11, color: DIM }}>Проф. ПЛ-цикл (тяжёлые присед/жим/тяга, immutable) + ББ-аксессуары на мышцы-антагонисты после каждого тяжёлого дня.</div>

      <div style={{ ...CARD, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ ...SMALL, display: 'flex', flexDirection: 'column', gap: 4 }}>
          ПЛ-цикл (источник силы)
          <select style={IN} value={cycleId} onChange={e => { setCycleId(e.target.value); const c = LMS_CYCLES.find(x => x.meta.id === e.target.value); if (c) setWeeks(c.meta.weeks); }}>
            {plCycles.map(c => <option key={c.meta.id} value={c.meta.id}>{c.meta.title} · {c.meta.sessionsPerWeek}д/нед · {c.meta.weeks}нед · {c.meta.level}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['Присед', squat, setSquat], ['Жим', bench, setBench], ['Тяга', dead, setDead]] as const).map(([lbl, v, set]) => (
            <label key={lbl} style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>{lbl} PM (кг)<input type="number" style={IN} value={v} onChange={e => set(parseFloat(e.target.value) || 0)} /></label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>Недель<input type="number" style={IN} value={weeks} min={1} max={16} onChange={e => setWeeks(parseInt(e.target.value) || 1)} /></label>
          <label style={{ ...SMALL, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>Уровень<select style={IN} value={level} onChange={e => setLevel(e.target.value)}><option value="beginner">Новичок</option><option value="intermediate">Средний</option><option value="advanced">Опытный</option><option value="enhanced">Enhanced</option></select></label>
        </div>
        <button style={{ ...BTN, width: '100%' }} onClick={build}>⚡ Собрать powerbuilder-план</button>
      </div>

      {built && (
        <div style={{ ...CARD, padding: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>📋 {built.cycle.meta.title}</div>
          <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.4 }}>{built.rationale}</div>
          {built.daysByWeek.slice(0, 2).map((days, wi) => (
            <div key={wi} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: DIM_STRONG, marginBottom: 4 }}>Неделя {built.heavyWeeks[wi].week}</div>
              {days.map((d: HybridDay, di) => (
                <div key={di} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', marginBottom: 6, borderLeft: `3px solid ${LIFT_COLOR[d.mainLift]}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: LIFT_COLOR[d.mainLift], marginBottom: 4 }}>{LIFT_LABEL[d.mainLift]} — день {d.dayIdx + 1}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>🏋 Сила (цикл):</div>
                  {d.heavy.exercises.map((ex, ei) => (
                    <div key={ei} style={{ fontSize: 11, color: DIM_STRONG, padding: '2px 0 2px 8px' }}><b>{ex.name}</b> — {fmtHeavy(ex)}</div>
                  ))}
                  {d.accessories.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, color: ACCENT, marginTop: 4, marginBottom: 2 }}>💪 Масса (аксессуары):</div>
                      {d.accessories.map((a, ai) => (
                        <div key={ai} style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', padding: '2px 0 2px 8px' }}><b>{a.name}</b> — {a.sets}×{a.workSets[0]?.reps} @{a.workSets[0]?.weight}кг RIR{a.rir} <span style={{ opacity: 0.5 }}>({GROUP_RU[a.muscle] || a.muscle})</span></div>
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
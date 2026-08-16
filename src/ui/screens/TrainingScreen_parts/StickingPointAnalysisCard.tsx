import React, { useMemo, useState } from 'react';
import type { WorkoutLog } from '../../../core/types';
import { diagnoseLift, phaseForReps } from '../../../engines/pro/lift-diagnostics.engine';
import { epley1RM } from '../../../engines/e1rm';
import { WEAK_POINTS_BY_LIFT, type Lift, type WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { applyToPlanner } from './planner-bridge';

interface LiftFailureData {
  lift: Lift;
  label: string;
  currentMax: number;
  totalFailedSets: number;
  failureRate: number;
  likelyPhase: WeakPoint | null;
  diagnosis: any;
  sumoHardSets: number;
}

function detectFailures(sessions: WorkoutLog[], lift: Lift, aliases: string[]): LiftFailureData | null {
  const phaseCounts: Record<string, number> = {};
  let totalHard = 0;
  let sumoHard = 0;
  let currentMax = 0;
  let hasLift = false;
  sessions.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
    const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
    if (!aliases.some(a => en.includes(a))) return;
    hasLift = true;
    const isSumo = lift === 'deadlift' && /сумо|sumo/.test(en);
    (e.sets || []).forEach((s: any) => {
      const weight = s.weight || 0;
      const reps = s.reps || 0;
      // RPE может отсутствовать в логе (поле опционально), но RIR всегда есть.
      // Конвертируем RIR→RPE (RPE = 10 − RIR), чтобы тяжёлые подходы определялись корректно.
      const rpe = (s.rpe && s.rpe > 0) ? s.rpe : (s.rir != null ? 10 - s.rir : 0);
      const e1rm = epley1RM(weight, reps);
      if (Number.isFinite(e1rm) && e1rm > currentMax) currentMax = Math.round(e1rm);
      // Тяжёлый подход (RPE ≥ 8 / низкие повторы без RPE): кандидат в срыв.
      const isHard = (rpe >= 8 && weight > 0) || (rpe === 0 && reps > 0 && reps <= 2 && weight > 0);
      if (!isHard) return;
      totalHard += 1;
      // Фаза срыва: сумо → sumo_start/sumo_lockout (эвристика); иначе каноническая
      // phaseForReps (reps ≥ 6 → фаза не определяется, подход учитывается как тяжёлый).
      const phaseHint = isSumo
        ? (reps <= 2 ? 'sumo_start' : reps <= 5 ? 'sumo_lockout' : null)
        : phaseForReps(reps, lift);
      if (isSumo) sumoHard += 1;
      if (phaseHint) phaseCounts[phaseHint] = (phaseCounts[phaseHint] || 0) + 1;
    });
  }));
  if (!hasLift) return null;
  // Наиболее вероятная слабая фаза = модальная фаза по зафиксированным срывам
  const phases = WEAK_POINTS_BY_LIFT[lift] ?? [];
  let likelyPhase: WeakPoint | null;
  if (totalHard > 0 && Object.keys(phaseCounts).length > 0) {
    const top = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0];
    likelyPhase = (phases.includes(top[0] as WeakPoint) ? top[0] : null) as WeakPoint | null;
  } else {
    likelyPhase = null;
  }
  const diagnosis = likelyPhase ? diagnoseLift(lift, likelyPhase) : null;
  const totalSets = sessions.reduce((s, w: any) => s + (w.exercises || []).reduce((ss: number, e: any) => {
    const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
    return ss + (aliases.some(a => en.includes(a)) ? (e.sets || []).length : 0);
  }, 0), 0);
  const labels: Record<Lift, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Становая тяга', ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной' };
  return {
    lift, label: labels[lift] || lift,
    currentMax,
    totalFailedSets: totalHard,
    failureRate: totalSets > 0 ? Math.round((totalHard / totalSets) * 100) : 0,
    likelyPhase,
    diagnosis,
    sumoHardSets: sumoHard,
  };
}

const LIFT_ALIASES: Record<Lift, string[]> = {
  squat: ['squat', 'присед', 'приседания', 'barbell squat'],
  bench: ['bench', 'жим', 'жим лёжа', 'bench press'],
  deadlift: ['deadlift', 'тяга', 'становая тяга', 'conventional deadlift'],
  ohp: ['overhead press', 'жим стоя', 'ohp', 'military press'],
  row: ['barbell row', 'тяга в наклоне', 'bent over row', 'pendlay row'],
  pulldown: ['pulldown', 'тяга верхнего', 'lat pulldown', 'подтягивания'],
  incline_press: ['incline bench', 'жим на наклонной', 'жим под углом', 'incline press'],
};

const PHASE_LABELS: Record<string, string> = {
  off_chest: 'Срыв с груди',
  mid: 'Середина амплитуды',
  lockout: 'Дожим',
  start: 'Старт',
  bottom: 'Яма (нижняя точка)',
  sumo_start: 'Сумо: старт (срыв)',
  sumo_lockout: 'Сумо: дожим (замыкание)',
  ohp_start: 'Старт с плеч',
  ohp_mid: 'Середина',
  ohp_lockout: 'Дожим вверх',
  row_start: 'Старт (съём)',
  row_mid: 'Середина',
  row_squeeze: 'Сведение лопаток',
  pd_top: 'Верх (старт)',
  pd_mid: 'Середина',
  pd_squeeze: 'Сведение к груди',
  inc_off: 'Сход с груди (верх)',
  inc_mid: 'Середина',
  inc_lockout: 'Дожим',
};

const StickingPointAnalysisCard: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const [selectedLift, setSelectedLift] = useState<Lift>('bench');

  const analysis = useMemo(() => {
    if (!sessions.length) return [];
    const lifts: Lift[] = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'];
    return lifts.map(l => detectFailures(sessions, l, LIFT_ALIASES[l])).filter(Boolean) as LiftFailureData[];
  }, [sessions]);

  if (!analysis.length) return (
    <div className="card" style={{ padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        🔬 Анализ мёртвых точек (sticking points)
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.4 }}>
        Нет данных по приседу, жиму лёжа, становой тяге и другим движениям. Чтобы рассчитать срывы, выполните эти упражнения через «▶ Проведение тренировки» — тяжёлые подходы (RPE≥8 по данным RIR) будут отмечены автоматически.
      </div>
    </div>
  );

  const active = analysis.find(a => a.lift === selectedLift) || analysis[0];

  return (
    <div className="card" style={{ padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        🔬 Анализ мёртвых точек (sticking points)
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {analysis.map(a => (
          <button key={a.lift} onClick={() => setSelectedLift(a.lift)} style={{
            flex: 1, padding: '4px 6px', borderRadius: 6, border: a.lift === selectedLift ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
            background: a.lift === selectedLift ? 'rgba(0,230,138,0.1)' : 'transparent',
            color: a.lift === selectedLift ? 'var(--accent)' : 'var(--text-dim)', fontSize: 10, fontWeight: a.lift === selectedLift ? 600 : 400, cursor: 'pointer',
          }}>
            {a.label} {a.failureRate > 0 && <span style={{ color: a.failureRate > 20 ? '#ef4444' : '#f59e0b' }}>({a.failureRate}% срывов)</span>}
          </button>
        ))}
      </div>
      {active && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 }}>
            <span style={{ color: 'var(--text-dim)' }}>Текущий максимум:</span>
            <span style={{ fontWeight: 600, color: '#00e68a' }}>{active.currentMax} кг</span>
          </div>
          {active.totalFailedSets > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10 }}>
              <span style={{ color: 'var(--text-dim)' }}>Тяжёлых подходов (RPE≥8):</span>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>{active.totalFailedSets} сетов ({active.failureRate}%)</span>
            </div>
          )}
          {active.sumoHardSets > 0 && (
            <div style={{ marginBottom: 6, padding: 4, borderRadius: 6, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', fontSize: 10, color: '#60a5fa' }}>
              🤸 Сумо-тяга: {active.sumoHardSets} тяжёлых подходов — проверьте фазы «Сумо: старт» и «Сумо: дожим».
            </div>
          )}
          {active.likelyPhase && (
            <div style={{ marginBottom: 6, padding: 6, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>
                Вероятная слабая фаза: {PHASE_LABELS[active.likelyPhase] || active.likelyPhase}
              </div>
              {active.diagnosis && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>
                    {active.diagnosis.biomechanicalReason}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>
                    Слабые мышцы: {active.diagnosis.weakMuscles.join(', ')}
                  </div>
                  <div style={{ fontSize: 10 }}>
                    <span style={{ color: '#22c55e' }}>Корректирующие упражнения:</span>
                    <ul style={{ margin: '2px 0 0 14px', padding: 0 }}>
                      {active.diagnosis.corrections.slice(0, 4).map((c: string, i: number) => (
                        <li key={i} style={{ color: 'var(--text-dim)', fontSize: 10, marginBottom: 1 }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ fontSize: 10, color: '#818cf8', marginTop: 2 }}>
                    🎯 {active.diagnosis.loadCues}
                  </div>
                </>
              )}
            </div>
          )}
          {active.totalFailedSets === 0 && (
            <div style={{ fontSize: 10, color: '#22c55e', padding: '4px 6px', background: 'rgba(34,197,94,0.08)', borderRadius: 4 }}>
              ✅ Срывов не обнаружено. Прогрессия стабильна.
            </div>
          )}
        </div>
      )}
{active && active.diagnosis && active.diagnosis.weakMuscles && active.diagnosis.weakMuscles.length > 0 && (() => { const mapM = (m: string) => { const l = m.toLowerCase(); if (/трицеп|бицеп|arm/.test(l)) return 'arms'; if (/дельт|плеч|shoulder/.test(l)) return 'shoulders'; if (/груд|chest|pec/.test(l)) return 'chest'; if (/спин|широк|трап|back|lat|разгибат/.test(l)) return 'back'; if (/квадр|ягод|икр|бедр|ног|привод|leg|quad|glute|calf|adductor/.test(l)) return 'legs'; if (/пресс|кор|core|ab/.test(l)) return 'core'; return null; }; const groups = Array.from(new Set(active.diagnosis.weakMuscles.map(mapM).filter(Boolean) as string[])); return (
      <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>🔗 Слабые мышцы по срывам «{active.label}»: {active.diagnosis.weakMuscles.join(', ')} → приоритет групп планировщику.</div>
        <button onClick={() => applyToPlanner({ kind: 'weakpoints', label: 'Срывы ' + active.label + ': ' + groups.join(', '), data: { groups, lift: active.lift } })} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, minHeight: 40 }}>🛠 Слабые мышцы → планировщик</button>
      </div>
    ); })()}
    </div>
  );
};

export default React.memo(StickingPointAnalysisCard);

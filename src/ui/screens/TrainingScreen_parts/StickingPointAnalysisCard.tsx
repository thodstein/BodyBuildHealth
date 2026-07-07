import React, { useMemo, useState } from 'react';
import type { WorkoutLog } from '../../../core/types';
import { diagnoseLift, stickingPhases } from '../../../engines/pro/lift-diagnostics.engine';
import type { Lift, WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { applyToPlanner } from './planner-bridge';

interface LiftFailureData {
  lift: Lift;
  label: string;
  currentMax: number;
  totalFailedSets: number;
  failureRate: number;
  likelyPhase: WeakPoint | null;
  diagnosis: any;
}

function detectFailures(sessions: WorkoutLog[], lift: Lift, aliases: string[]): LiftFailureData | null {
  const failedSets: { phaseHint: string; set: any; exerciseName: string }[] = [];
  let currentMax = 0;
  sessions.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
    const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
    if (!aliases.some(a => en.includes(a))) return;
    (e.sets || []).forEach((s: any) => {
      const weight = s.weight || 0;
      const reps = s.reps || 0;
      const rpe = s.rpe || 0;
      const e1rm = weight * (1 + reps / 30);
      if (e1rm > currentMax) currentMax = Math.round(e1rm);
      // Failure indicators: high RPE (>=9) with low reps (<=3), or low reps relative to weight
      if (rpe >= 9 && reps <= 3 && weight > 0) {
        failedSets.push({ phaseHint: 'lockout', set: s, exerciseName: e.exerciseName || '' });
      } else if (rpe >= 8 && reps <= 2 && weight > 0) {
        failedSets.push({ phaseHint: 'lockout', set: s, exerciseName: e.exerciseName || '' });
      }
    });
  }));
  if (failedSets.length === 0 && currentMax === 0) return null;
  const phases = stickingPhases(lift);
  // Determine most likely weak phase based on failure patterns
  const likelyPhase: WeakPoint | null = phases.length > 0 ? phases[1] || phases[0] : null;
  const diagnosis = likelyPhase ? diagnoseLift(lift, likelyPhase) : null;
  const totalSets = sessions.reduce((s, w: any) => s + (w.exercises || []).reduce((ss: number, e: any) => {
    const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
    return ss + (aliases.some(a => en.includes(a)) ? (e.sets || []).length : 0);
  }, 0), 0);
  const labels: Record<Lift, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Становая тяга' };
  return {
    lift, label: labels[lift] || lift,
    currentMax,
    totalFailedSets: failedSets.length,
    failureRate: totalSets > 0 ? Math.round((failedSets.length / totalSets) * 100) : 0,
    likelyPhase,
    diagnosis,
  };
}

const LIFT_ALIASES: Record<Lift, string[]> = {
  squat: ['squat', 'присед', 'приседания', 'barbell squat'],
  bench: ['bench', 'жим', 'жим лёжа', 'bench press'],
  deadlift: ['deadlift', 'тяга', 'становая тяга', 'conventional deadlift'],
};

const PHASE_LABELS: Record<string, string> = {
  off_chest: 'Срыв с груди',
  mid: 'Середина амплитуды',
  lockout: 'Дожим',
  start: 'Старт',
  bottom: 'Яма (нижняя точка)',
};

const StickingPointAnalysisCard: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const [selectedLift, setSelectedLift] = useState<Lift>('bench');

  const analysis = useMemo(() => {
    if (!sessions.length) return [];
    const lifts: Lift[] = ['bench', 'squat', 'deadlift'];
    return lifts.map(l => detectFailures(sessions, l, LIFT_ALIASES[l])).filter(Boolean) as LiftFailureData[];
  }, [sessions]);

  if (!analysis.length) return null;

  const active = analysis.find(a => a.lift === selectedLift) || analysis[0];

  return (
    <div className="card" style={{ padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
        🔬 Анализ мёртвых точек (sticking points)
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
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
              <span style={{ color: 'var(--text-dim)' }}>Срывов (RPE≥9, reps≤3):</span>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>{active.totalFailedSets} сетов ({active.failureRate}%)</span>
            </div>
          )}
          {active.likelyPhase && (
            <div style={{ marginBottom: 6, padding: 6, borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>
                Вероятная слабая фаза: {PHASE_LABELS[active.likelyPhase] || active.likelyPhase}
              </div>
              {active.diagnosis && (
                <>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>
                    {active.diagnosis.biomechanicalReason}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>
                    Слабые мышцы: {active.diagnosis.weakMuscles.join(', ')}
                  </div>
                  <div style={{ fontSize: 9 }}>
                    <span style={{ color: '#22c55e' }}>Корректирующие упражнения:</span>
                    <ul style={{ margin: '2px 0 0 14px', padding: 0 }}>
                      {active.diagnosis.corrections.slice(0, 4).map((c: string, i: number) => (
                        <li key={i} style={{ color: 'var(--text-dim)', fontSize: 9, marginBottom: 1 }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ fontSize: 9, color: '#818cf8', marginTop: 2 }}>
                    🎯 {active.diagnosis.loadCues}
                  </div>
                </>
              )}
            </div>
          )}
          {active.totalFailedSets === 0 && (
            <div style={{ fontSize: 9, color: '#22c55e', padding: '4px 6px', background: 'rgba(34,197,94,0.08)', borderRadius: 4 }}>
              ✅ Срывов не обнаружено. Прогрессия стабильна.
            </div>
          )}
        </div>
      )}
{active && active.diagnosis && active.diagnosis.weakMuscles && active.diagnosis.weakMuscles.length > 0 && (() => { const mapM = (m: string) => { const l = m.toLowerCase(); if (/трицеп|бицеп|arm/.test(l)) return 'arms'; if (/дельт|плеч|shoulder/.test(l)) return 'shoulders'; if (/груд|chest|pec/.test(l)) return 'chest'; if (/спин|широк|трап|back|lat/.test(l)) return 'back'; if (/квадр|ягод|икр|бедр|ног|leg|quad|glute|calf/.test(l)) return 'legs'; if (/пресс|кор|core|ab/.test(l)) return 'core'; return null; }; const groups = Array.from(new Set(active.diagnosis.weakMuscles.map(mapM).filter(Boolean) as string[])); return (
      <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>🔗 Слабые мышцы по срывам «{active.label}»: {active.diagnosis.weakMuscles.join(', ')} → приоритет групп планировщику.</div>
        <button onClick={() => applyToPlanner({ kind: 'weakpoints', label: 'Срывы ' + active.label + ': ' + groups.join(', '), data: { groups, lift: active.lift } })} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, minHeight: 40 }}>🛠 Слабые мышцы → планировщик</button>
      </div>
    ); })()}
    </div>
  );
};

export default React.memo(StickingPointAnalysisCard);

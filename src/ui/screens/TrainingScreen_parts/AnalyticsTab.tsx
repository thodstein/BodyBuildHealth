import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { calcTraining, calcExercisePrescription, EXERCISE_DB, TRAINING_SPLITS, TRAINING_LEVEL_CONFIGS, LEVEL_VOLUMES } from '../../../engines/training.engine';
import { generateMacrocycle, generateBlockPlan, getCurrentWeekPlan, BLOCK_SEQUENCES, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../engines/training-periodization.engine';
import { selectSplit, getSplitOptions, type SplitCandidate } from '../../../engines/split-selector.engine';
import { selectProgressionRule } from '../../../engines/progression.engine';
import { RIR_MATRIX, generateWeeklyPlan } from '../../../engines/rir-matrix.engine';
import { StrengthDiary, type StrengthStats, type WeeklyProgress, type ProgressionAlert } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';
import { generateCooldown } from '../../../engines/cooldown.engine';
import { selectSetScheme } from '../../../engines/set-scheme.engine';
import { selectTempo, formatTempo } from '../../../engines/tempo.engine';
import { useDataLink } from '../../../core/data-link';
import type { TrainingInput, TrainingOutput, Exercise, MovementPattern } from '../../../core/types';
import { computeAnalytics, type AnalyticsSnapshot, type WeeklyBreakdown } from '../../../engines/analytics-engine';
import { computeConstraints } from '../../../engines/training-constraints.engine';
import { generatePeriodization, getPhaseParams } from '../../../engines/cycle-periodization.engine';
import { getTrainingMethods, getMethodsByCategory, getVolumeReferences, getVolumeByMuscle, getSplitVisuals, type TrainingMethod } from '../../../engines/training-methodology.engine';
import { buildVisualDashboard, computeWeeklyChart, computeMuscleVolume, computeProgression, type VizSessionData } from '../../../engines/training-visualization.engine';
import { getProgramById, getProgramsByGoal, FULL_PROGRAM_LIBRARY } from '../../../engines/complete-program-library.engine';
import { getExerciseBio } from '../../../data/exercise-biomechanics-db';
import { getStrengthLevel, getNextLevelTarget } from '../../../engines/performance-analytics.engine';
import { computeStructuredAnalytics } from '../../../engines/structured-analytics.engine';
import {
  GOALS, LEVELS, MUSCLE_GROUPS, GROUP_LABELS, EQUIP_LABELS, JOINT_LABELS,
  PHASE_LABELS, PHASE_HINTS, TAB_LABELS,
  type TrainingTab, type TrainingPage,
} from './shared';


export const AnalyticsTab: React.FC<{ sessions: WorkoutLog[]; onRefresh?: () => void }> = ({ sessions, onRefresh }) => {
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const analytics = useMemo(() => {
    if (sessions.length === 0) return null;
    try {
    const mapped = sessions.map(w => ({
      sessionId: w.id,
      date: w.date,
      focus: w.split || 'fullbody',
      durationMin: w.duration || 60,
      sets: (w.exercises || []).flatMap((ex: any) =>
        (ex.sets || []).map((s: any, i: number) => ({
          exerciseId: ex.exerciseId || ex.name || 'unknown',
          exerciseName: ex.name || 'Exercise',
          reps: s.reps || 0,
          weight: s.weight || 0,
          rpe: s.rpe || 5,
          rir: s.rir || 3,
          date: w.date,
          setIndex: i,
        }))
      ),
    }));
    if (mapped.length === 0 || !mapped.some(m => m.sets.length > 0)) return null;
    return computeAnalytics({ sessions: mapped, weeks: 4 });
    } catch (e) { return null; }
  }, [sessions]);

  useEffect(() => {
    if (analytics === null && sessions.length > 0) {
      setAnalyticsError('Не удалось рассчитать аналитику');
    } else {
      setAnalyticsError(null);
    }
  }, [analytics, sessions.length]);

  if (!analytics || sessions.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 30 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>
          {sessions.length === 0
            ? 'Нет данных для аналитики. Запишите тренировки во вкладке «Дневник».'
            : 'Недостаточно данных для расчёта (нужны сеты с весом).'}
        </div>
        {sessions.length > 0 && <div style={{ fontSize: 10, color: '#fff' }}>Найдено тренировок: {sessions.length}</div>}
        {analyticsError && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>Ошибка: {analyticsError}</div>}
        <button onClick={() => onRefresh?.()} style={{
          marginTop: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent)',
          background: 'transparent', color: 'var(--accent)', fontSize: 10, cursor: 'pointer',
        }}>🔄 Обновить данные</button>
      </div>
    );
  }

  const { volume, intensity, strength, fatigue, recovery } = analytics;

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff' }}>Объём/нед</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#00e68a' }}>{volume.weeklyVolumeKg.toLocaleString()} кг</div>
          <div style={{ fontSize: 10, color: volume.volumeTrend >= 0 ? '#22c55e' : '#ef4444' }}>
            {volume.volumeTrend >= 0 ? '↑' : '↓'} {Math.abs(volume.volumeTrend)}% vs пред.
          </div>
        </div>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff' }}>Интенсивность</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{intensity.avgIntensity}%</div>
          <div style={{ fontSize: 10, color: '#fff' }}>
            RPE avg: {intensity.avgRPE}
          </div>
        </div>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff' }}>Усталость</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: fatigue.weeklyFatigue > 0.7 ? '#ef4444' : fatigue.weeklyFatigue > 0.4 ? '#f59e0b' : '#22c55e' }}>
            {Math.round(fatigue.weeklyFatigue * 100)}%
          </div>
        </div>
        <div className="card" style={{ padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff' }}>Готовность</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: recovery.readinessEstimate > 60 ? '#22c55e' : recovery.readinessEstimate > 40 ? '#f59e0b' : '#ef4444' }}>
            {recovery.readinessEstimate}%
          </div>
        </div>
      </div>

      {/* Intensity distribution */}
      <div className="card" style={{ marginBottom: 10, padding: '8px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Распределение нагрузки</div>
        <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ width: `${intensity.intensityDistribution.strength}%`, background: '#ef4444' }} title="" />
          <div style={{ width: `${intensity.intensityDistribution.hypertrophy}%`, background: '#f59e0b' }} title="" />
          <div style={{ width: `${intensity.intensityDistribution.endurance}%`, background: '#22c55e' }} title="" />
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#fff' }}>
          <span>🔴 Сила {intensity.intensityDistribution.strength}%</span>
          <span>🟠 Гипертрофия {intensity.intensityDistribution.hypertrophy}%</span>
          <span>🟢 Выносливость {intensity.intensityDistribution.endurance}%</span>
        </div>
      </div>

      {/* Volume by group */}
      <div className="card" style={{ marginBottom: 10, padding: '8px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Объём по группам мышц</div>
        {Object.entries(volume.volumeByGroup)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([group, vol]) => {
            const maxVol = Math.max(...Object.values(volume.volumeByGroup), 1);
            return (
              <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ width: 80, fontSize: 10, color: '#fff', textAlign: 'right' }}>{group}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ width: `${(vol / maxVol) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10, color: '#fff', width: 50 }}>{Math.round(vol).toLocaleString()} кг</span>
              </div>
            );
          })}
      </div>

      {/* Strength estimates */}
      {Object.keys(strength.estimated1RM).length > 0 && (
        <div className="card" style={{ marginBottom: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Расчётный 1RM</div>
          {Object.entries(strength.estimated1RM)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([exId, rm]) => {
              const trend = strength.strengthTrend[exId] || 0;
              return (
                <div key={exId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                  <span style={{ color: '#fff' }}>{exId}</span>
                  <span>
                    <strong>{rm} кг</strong>
                    <span style={{ marginLeft: 6, fontSize: 10, color: trend >= 0 ? '#22c55e' : '#ef4444' }}>
                      {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Fatigue details */}
      <div className="card" style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Метрики усталости</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
          <div>
            <span style={{ color: '#fff' }}>Монотонность: </span>
            <span style={{ fontWeight: 600, color: fatigue.monotony > 2 ? '#ef4444' : 'var(--accent)' }}>{fatigue.monotony}</span>
          </div>
          <div>
            <span style={{ color: '#fff' }}>Напряжение: </span>
            <span style={{ fontWeight: 600, color: fatigue.strain > 300 ? '#ef4444' : 'var(--accent)' }}>{fatigue.strain}</span>
          </div>
          <div>
            <span style={{ color: '#fff' }}>ЦНС: </span>
            <span style={{ fontWeight: 600, color: fatigue.cnsFatigue > 0.7 ? '#ef4444' : 'var(--accent)' }}>{Math.round(fatigue.cnsFatigue * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * rir-calibration.engine.ts — Калибровка RIR по факту выполнения.
 *
 * Сравнивает плановый RIR с реальным (10−RPE) по каждому подходу,
 * вычисляет систематическое смещение (bias) и корректирует целевой RIR.
 * Хранит историю в localStorage('he_rir_calibration').
 */
import type { WorkoutSession } from './workout-logger.engine';

const KEY = 'he_rir_calibration';

export interface RIRCalibrationPoint {
  date: string;
  sessionFocus: string;
  exerciseId: string;
  exerciseName: string;
  plannedRIR: number;
  actualRIR: number;   // 10 − RPE (если RPE=0 → не учитываем)
  weight: number;
  reps: number;
  setNumber: number;
}

export interface RIRExerciseCalibration {
  exerciseId: string;
  exerciseName: string;
  totalPoints: number;
  avgBias: number;           // plannedRIR − actualRIR. >0 = недобор (может больше), <0 = перебор (слишком тяжело)
  consistencyScore: number;  // 0-100
  lastAdjustedRIR: number;
  lastDate: string;
  trend: 'stable' | 'improving' | 'declining';
}

export interface RIRCalibrationStats {
  totalSets: number;
  totalExercises: number;
  overallAvgBias: number;
  overallConsistency: number;
  exercises: RIRExerciseCalibration[];
  lastUpdated: string;
}

function loadPoints(): RIRCalibrationPoint[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function savePoints(points: RIRCalibrationPoint[]): void {
  localStorage.setItem(KEY, JSON.stringify(points.slice(-5000)));
}

/** Извлечь калибровочные точки из завершённой сессии и сохранить. */
export function recordSessionRIR(session: WorkoutSession, dayPlan: { exercises: { name: string; targetSets: { rir: number }[] }[] }): void {
  const points: RIRCalibrationPoint[] = [];
  const planExercises = dayPlan.exercises || [];

  session.exercises.forEach((ex) => {
    const planEx = planExercises.find(p => p.name === ex.exerciseName) || planExercises.find(p => p.name.toLowerCase() === ex.exerciseName.toLowerCase());
    if (!planEx) return;

    ex.sets.forEach((set, si) => {
      if (set.rpe <= 0) return;
      const plannedRIR = planEx.targetSets[si]?.rir ?? 2;
      const actualRIR = Math.max(0, 10 - set.rpe);

      points.push({
        date: session.date,
        sessionFocus: session.focus,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        plannedRIR,
        actualRIR,
        weight: set.weightKg,
        reps: set.reps,
        setNumber: set.setNumber,
      });
    });
  });

  if (points.length === 0) return;
  const existing = loadPoints();
  savePoints([...existing, ...points]);
}

/** Получить калибровку для конкретного упражнения (по id или имени). */
export function getExerciseCalibration(exerciseKey: string): RIRExerciseCalibration | null {
  const points = loadPoints().filter(p =>
    p.exerciseId === exerciseKey || p.exerciseName === exerciseKey
  );
  if (points.length < 2) return null;

  const biases = points.map(p => p.plannedRIR - p.actualRIR);
  const avgBias = Math.round(biases.reduce((a, b) => a + b, 0) / biases.length * 10) / 10;

  const absDeviations = biases.map(b => Math.abs(b - avgBias));
  const mad = absDeviations.reduce((a, b) => a + b, 0) / absDeviations.length;
  const consistencyScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(mad, 5) / 5) * 100)));

  // тренд: последняя треть vs первая треть
  const third = Math.max(1, Math.floor(points.length / 3));
  const recent = biases.slice(-third);
  const early = biases.slice(0, third);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length;
  const trend = Math.abs(recentAvg - earlyAvg) < 0.3 ? 'stable' : recentAvg < earlyAvg ? 'improving' : 'declining';

  return {
    exerciseId: points[0].exerciseId,
    exerciseName: points[0].exerciseName,
    totalPoints: points.length,
    avgBias,
    consistencyScore,
    lastAdjustedRIR: Math.max(0, Math.round((points[points.length - 1].plannedRIR + avgBias) * 2) / 2),
    lastDate: points[points.length - 1].date,
    trend,
  };
}

/** Получить скорректированный RIR для упражнения. */
export function getAdjustedRIR(exerciseKey: string, plannedRIR: number): { adjustedRIR: number; bias: number; rationale: string } {
  const cal = getExerciseCalibration(exerciseKey);
  if (!cal || cal.totalPoints < 2) {
    return { adjustedRIR: plannedRIR, bias: 0, rationale: 'Недостаточно данных для калибровки' };
  }
  const adjusted = Math.max(0, Math.round((plannedRIR + cal.avgBias) * 2) / 2);
  const direction = cal.avgBias > 0.3 ? 'выполняете легче плана' :
    cal.avgBias < -0.3 ? 'выполняете тяжелее плана' : 'в цели';
  return {
    adjustedRIR: adjusted,
    bias: cal.avgBias,
    rationale: `По данным ${cal.totalPoints} подходов: bias ${cal.avgBias > 0 ? '+' : ''}${cal.avgBias} RIR (${direction}). Рекомендуемый RIR: ${adjusted} вместо ${plannedRIR}`,
  };
}

/** Получить общую статистику калибровки. */
export function getCalibrationStats(): RIRCalibrationStats {
  const points = loadPoints();
  const exercises = [...new Set(points.map(p => p.exerciseId || p.exerciseName))];
  const exCals = exercises.map(id => getExerciseCalibration(id)).filter(Boolean) as RIRExerciseCalibration[];

  const allBiases = points.map(p => p.plannedRIR - p.actualRIR);
  const overallAvgBias = allBiases.length > 0
    ? Math.round(allBiases.reduce((a, b) => a + b, 0) / allBiases.length * 10) / 10
    : 0;
  const overallConsistency = exCals.length > 0
    ? Math.round(exCals.reduce((s, c) => s + c.consistencyScore, 0) / exCals.length)
    : 0;

  return {
    totalSets: points.length,
    totalExercises: exercises.length,
    overallAvgBias,
    overallConsistency,
    exercises: exCals.sort((a, b) => b.totalPoints - a.totalPoints),
    lastUpdated: points.length > 0 ? points[points.length - 1].date : '',
  };
}

/** RIR-калибровка: текстовый фидбек по сессии. */
export function getSessionRIRFeedback(session: WorkoutSession, dayPlan: { exercises: { name: string; targetSets: { rir: number }[] }[] }): {
  exerciseFeedbacks: { name: string; bias: number; consistency: number; recommendation: string }[];
  overallBias: number;
  sessionQuality: 'отлично' | 'хорошо' | 'средне' | 'плохо';
} {
  const feedbacks: { name: string; bias: number; consistency: number; recommendation: string }[] = [];

  session.exercises.forEach((ex, ei) => {
    const planEx = dayPlan.exercises[ei];
    if (!planEx) return;
    const setsWithRPE = ex.sets.filter(s => s.rpe > 0);
    if (setsWithRPE.length < 1) return;

    const biases = setsWithRPE.map(s => {
      const si = s.setNumber - 1;
      const plannedRIR = planEx.targetSets[si]?.rir ?? 2;
      const actualRIR = Math.max(0, 10 - s.rpe);
      return plannedRIR - actualRIR;
    });
    const avgBias = Math.round(biases.reduce((a, b) => a + b, 0) / biases.length * 10) / 10;

    // Рекомендация
    let recommendation = '';
    if (avgBias > 1) recommendation = `Недобор ${avgBias} RIR — пробуйте +2.5-5% вес или +1 повтор`;
    else if (avgBias > 0.3) recommendation = `Лёгкий недобор ${avgBias} RIR — можно добавить 1 повтор`;
    else if (avgBias < -1) recommendation = `Перебор ${Math.abs(avgBias)} RIR — снизьте вес на 2.5-5% или RIR+1`;
    else if (avgBias < -0.3) recommendation = `Легкий перебор ${Math.abs(avgBias)} RIR — чуть снизьте темп`;
    else recommendation = `RIR в цели — продолжайте`;

    const cal = getExerciseCalibration(ex.exerciseId || ex.exerciseName);

    feedbacks.push({
      name: ex.exerciseName,
      bias: avgBias,
      consistency: cal?.consistencyScore ?? 0,
      recommendation,
    });
  });

  const overallBias = feedbacks.length > 0
    ? Math.round(feedbacks.reduce((s, f) => s + f.bias, 0) / feedbacks.length * 10) / 10
    : 0;

  let sessionQuality: 'отлично' | 'хорошо' | 'средне' | 'плохо' = 'средне';
  if (feedbacks.every(f => Math.abs(f.bias) <= 0.5)) sessionQuality = 'отлично';
  else if (feedbacks.every(f => Math.abs(f.bias) <= 1)) sessionQuality = 'хорошо';
  else if (feedbacks.some(f => Math.abs(f.bias) > 2)) sessionQuality = 'плохо';

  return { exerciseFeedbacks: feedbacks, overallBias, sessionQuality };
}

/** Сбросить калибровку. */
export function clearCalibrationData(): void {
  localStorage.removeItem(KEY);
}

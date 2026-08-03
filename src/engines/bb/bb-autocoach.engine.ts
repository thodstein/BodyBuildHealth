/**
 * bb-autocoach.engine.ts — PRO-ББ тренерские алгоритмы (загрузка стратегий, делод-протоколы,
 * RIR-drift, feeder-сеты, прогрессивная перегрузка, распределение упражнений по фазам).
 *
 * Вынесено из BbAutoConstructor.tsx для чистоты UI.
 */
import type { BBWeek, BBSession, BBExercise, BBSet, BBPlan } from './bb-builder.engine';
import { defaultWorkMax } from './bb-builder.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { PHASE_CONFIGS, distributePhases } from '../periodization';
import { PCT_FOR_RIR } from '../rir-table';

/* ──────────── BB phase ──────────── */
export type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';

/* ──────────── Load strategies ──────────── */
export type LoadStrategy = 'double_progression' | 'linear' | 'wave' | 'rpe_based';

export interface LoadStrategyPrescription {
  nextWeight: number;
  nextReps: number;
  nextRIR: number;
  label: string;
}

export function prescribeLoad(
  strategy: LoadStrategy,
  currentWeight: number,
  currentReps: number,
  currentRIR: number,
  maxWeight: number,
  week: number,
  totalWeeks: number,
  phase: string,
  exType?: string,
  role?: 'primary' | 'accessory',
  /** P1-7 (audit 2026-07): целевой RIR плана. Если задан, prescribeLoad корректирует
   *  прогрессию по отклонению факта от цели: RIR≥planned+1 → +reps/+weight,
   *  RIR≤planned−2 → −5% weight (too heavy). */
  plannedRir?: number,
): LoadStrategyPrescription {
  // P1-7: success-aware коррекция по RIR-отклонению факта от цели.
  // Если plannedRir задан — корректируем прогрессию.
  if (plannedRir != null) {
    const rirDeviation = currentRIR - plannedRir;
    if (rirDeviation >= 2) {
      // Слишком легко (RIR на 2+ выше цели) → +1 rep или +weight
      return { nextWeight: currentWeight, nextReps: currentReps + 1, nextRIR: Math.max(0, plannedRir - 1), label: `Успех: RIR${currentRIR} > цели ${plannedRir} → +1 повтор` };
    }
    if (rirDeviation <= -2) {
      // Слишком тяжело (RIR на 2+ ниже цели) → −5% weight, сохранить reps
      return { nextWeight: Math.round(currentWeight * 0.95 * 10) / 10, nextReps: currentReps, nextRIR: Math.min(5, plannedRir + 1), label: `Перегруз: RIR${currentRIR} < цели ${plannedRir} → −5% вес` };
    }
    // RIR в пределах ±1 от цели → нормальная прогрессия (fallthrough)
  }
  switch (strategy) {
    case 'double_progression': {
      const repCap = phase === 'intensification' ? 8 : 12;
      if (currentReps < repCap) {
        return { nextWeight: currentWeight, nextReps: currentReps + 1, nextRIR: Math.max(0, currentRIR - 1), label: `Добейте ${currentReps + 1} повторов (цель ${repCap})` };
      }
      return { nextWeight: Math.round(currentWeight * 1.05), nextReps: Math.max(6, repCap - 4), nextRIR: Math.min(3, currentRIR + 1), label: `Повысьте вес до ${Math.round(currentWeight * 1.05)} кг` };
    }
    case 'linear': {
      const phaseMult = week < totalWeeks * 0.75 ? 1.0 : 0.5;
      const typeBase: Record<string, number> = { compound: 2.5, machine_compound: 1.5, cable: 1.25, machine: 1.0, isolation: 1.0, accessory: 0.5 };
      const baseIncr = typeBase[exType || 'compound'] ?? (role === 'accessory' ? 0.5 : 1.5);
      const increment = baseIncr * phaseMult;
      return { nextWeight: Math.round((currentWeight + increment) * 10) / 10, nextReps: currentReps, nextRIR: Math.max(0, currentRIR - 1), label: `Линейная +${increment.toFixed(1)} кг/нед` };
    }
    case 'wave': {
      const pos = (week - 1) % 3;
      const waveMult = pos === 0 ? 1.05 : pos === 1 ? 1.0 : 0.92;
      return { nextWeight: Math.round(currentWeight * waveMult * 10) / 10, nextReps: currentReps, nextRIR: currentRIR, label: `Волновая: нед ${week}` };
    }
    case 'rpe_based': {
      const phaseStartRir: Record<string, [number, number]> = { accumulation: [3, 1], intensification: [2, 0], peaking: [1, 0], deload: [4, 4] };
      const rirRange = phaseStartRir[phase] || [2, 0];
      const phaseProgress = totalWeeks > 1 ? (week - 1) / (totalWeeks - 1) : 0;
      const targetRir = Math.max(0, Math.round(rirRange[0] - phaseProgress * (rirRange[0] - rirRange[1])));
      const rirDelta = currentRIR - targetRir;
      const weightMult = rirDelta >= 1 ? 1.025 : rirDelta <= -1 ? 0.97 : 1.0;
      return { nextWeight: Math.round(currentWeight * weightMult * 10) / 10, nextReps: currentReps, nextRIR: targetRir, label: `RPE: RIR ${currentRIR} → target ${targetRir}` };
    }
    default: return { nextWeight: currentWeight, nextReps: currentReps, nextRIR: currentRIR, label: 'Продолжайте по плану' };
  }
}

/* ──────────── Deload protocols ──────────── */
export type DeloadType = 'pump' | 'neural' | 'full_rest' | 'mini';

export interface DeloadProtocol {
  type: DeloadType;
  volumeMultiplier: number;
  intensityMultiplier: number;
  rirTarget: number;
  repRange: [number, number];
  restSeconds: number;
  keepOriginalReps?: boolean;
  description: string;
  instructions: string;
}

export const DELOAD_PROTOCOLS: Record<DeloadType, DeloadProtocol> = {
  pump: { type: 'pump', volumeMultiplier: 0.5, intensityMultiplier: 0.55, rirTarget: 4, repRange: [15, 20], restSeconds: 45, description: 'Pump-разгрузка', instructions: '50% объёма, 55% веса, отдых 45с.' },
  neural: { type: 'neural', volumeMultiplier: 0.4, intensityMultiplier: 0.7, rirTarget: 3, repRange: [3, 5], restSeconds: 180, description: 'Нейральная разгрузка', instructions: '40% объёма, 70% веса, отдых 3мин.' },
  full_rest: { type: 'full_rest', volumeMultiplier: 0.2, intensityMultiplier: 0.4, rirTarget: 5, repRange: [10, 12], restSeconds: 60, description: 'Полный отдых', instructions: '20% объёма, 40% веса.' },
  mini: { type: 'mini', volumeMultiplier: 0.70, intensityMultiplier: 0.92, rirTarget: 3, repRange: [6, 12], restSeconds: 120, keepOriginalReps: true, description: 'Мини-делоад', instructions: '70% объёма, 92% веса, RIR 3.' },
};

const DELOAD_SWAP_MAP: Record<string, string> = {
  'жим штанги лёжа': 'жим гантелей лёжа',
  'жим гантелей лёжа': 'жим в тренажёре',
  'жим стоя': 'жим гантелей сидя',
  'присед со штангой': 'жим ногами',
  'становой тяга': 'румынская тяга с гантелями',
  'тяга в наклоне': 'тяга верхнего блока',
  'подтягивания': 'тяга верхнего блока',
  'армейский жим': 'жим гантелей сидя',
};

function findDeloadSwap(exName: string): string | null {
  const n = (exName || '').toLowerCase();
  for (const [heavy, light] of Object.entries(DELOAD_SWAP_MAP)) {
    if (n.includes(heavy.toLowerCase()) || heavy.toLowerCase().includes(n)) return light;
  }
  return null;
}

export function applyDeloadToWeek(week: BBWeek, protocol: DeloadProtocol): BBWeek {
  const w2 = JSON.parse(JSON.stringify(week)) as BBWeek;
  for (const s of w2.sessions) {
    for (const e of s.exercises) {
      const swapName = findDeloadSwap(e.exerciseName || e.name || '');
      if (swapName) {
        const swapEx = (EXERCISE_CATALOG as any).find((ex: any) =>
          (ex.name || '').toLowerCase().includes(swapName.toLowerCase()) ||
          swapName.toLowerCase().includes((ex.name || '').toLowerCase())
        );
        if (swapEx) {
          e.name = swapEx.name;
          e.exerciseName = swapEx.name;
          e.muscle = swapEx.targetMuscle || e.muscle;
          if (!protocol.keepOriginalReps) e.repsRange = [protocol.repRange[0], protocol.repRange[1]];
          e.sets = Math.max(1, Math.round(e.sets * protocol.volumeMultiplier));
          e.rir = protocol.rirTarget;
          const originalSets = e.workSets.slice();
          e.workSets = originalSets.slice(0, e.sets);
          while (e.workSets.length < e.sets) {
            e.workSets.push({ ...(originalSets[originalSets.length - 1] || { reps: protocol.repRange[0], rir: protocol.rirTarget, weight: 0 }) });
          }
          for (const ws of e.workSets) {
            if (!protocol.keepOriginalReps) ws.reps = Math.round((protocol.repRange[0] + protocol.repRange[1]) / 2);
            ws.rir = protocol.rirTarget;
            ws.weight = Math.round(ws.weight * protocol.intensityMultiplier * 10) / 10;
            ws.restSeconds = protocol.restSeconds;
          }
          continue;
        }
      }
      e.sets = Math.max(1, Math.round(e.sets * protocol.volumeMultiplier));
      e.rir = protocol.rirTarget;
      if (!protocol.keepOriginalReps) e.repsRange = [protocol.repRange[0], protocol.repRange[1]];
      const originalSets = e.workSets.slice();
      e.workSets = originalSets.slice(0, e.sets);
      while (e.workSets.length < e.sets) {
        e.workSets.push({ ...(originalSets[originalSets.length - 1] || { reps: protocol.repRange[0], rir: protocol.rirTarget, weight: 0 }) });
      }
      for (const ws of e.workSets) {
        if (!protocol.keepOriginalReps) ws.reps = Math.round((protocol.repRange[0] + protocol.repRange[1]) / 2);
        ws.rir = protocol.rirTarget;
        ws.weight = Math.round(ws.weight * protocol.intensityMultiplier * 10) / 10;
        ws.restSeconds = protocol.restSeconds;
      }
    }
  }
  return w2;
}

/* ──────────── RIR drift within phase ──────────── */
/**
 * RIR дрейф внутри фазы: RIR снижается на 1 каждые N недель внутри фазы.
 * @param baseRir — базовый RIR фазы (из PHASE_RIR)
 * @param weekInPhase — номер недели внутри текущей фазы (1-based)
 * @param phaseWeeks — общая длительность фазы
 */
export function rirDrift(baseRir: [number, number], weekInPhase: number, phaseWeeks: number): number {
  const [start, end] = baseRir;
  if (phaseWeeks <= 1) return start;
  const drift = Math.floor((weekInPhase - 1) / 2); // снижение на 1 каждые 2 недели
  return Math.max(end, start - drift);
}

/* ──────────── Intensity techniques (P6) ──────────── */
/**
 * Реальные intensity techniques, применяемые к финальному подходу упражнения.
 * Каждая техника модифицирует reps/tempo/weight/notes упражнения.
 *
 * rest_pause: 1×8+15s+1×3-4+15s+1×3-4 = 1 «сет» из 14-16 reps
 * drop_set: 1×10+30s+1×6(-20%)+30s+1×4(-20%) = 1 «сет» из 20 reps
 * myo_reps: 1×12-15+3-5 mini-сетов × 3-5 reps (5с отдых) = 21-30 reps
 * pause_rep: +2-3с пауза в нижней точке (модифицирует tempo)
 * mechanical_drop: смена угла без отдыха
 */
export type IntensityTechnique = 'rest_pause' | 'drop_set' | 'myo_reps' | 'pause_rep' | 'mechanical_drop' | 'none';

export interface IntensityTechniqueMeta {
  type: IntensityTechnique;
  label: string;
  appliesTo: ('compound' | 'isolation' | 'accessory')[];
  /** Фазы, в которых техника уместна */
  phases: BBPhase[];
  /** Описание для UI */
  description: string;
}

export const INTENSITY_TECHNIQUES: Record<IntensityTechnique, IntensityTechniqueMeta> = {
  none: { type: 'none', label: 'Без техники', appliesTo: ['compound','isolation','accessory'], phases: ['accumulation','intensification','deload','peaking'], description: 'Стандартное выполнение.' },
  rest_pause: {
    type: 'rest_pause', label: 'Rest-pause', appliesTo: ['compound','isolation'],
    phases: ['intensification','peaking'],
    description: 'Финальный сет: 1×8 → 15с отдых → 1×3-4 → 15с → 1×3-4. Итого 14-16 reps в 1 «сете».',
  },
  drop_set: {
    type: 'drop_set', label: 'Drop-set', appliesTo: ['isolation','accessory'],
    phases: ['intensification','accumulation'],
    description: 'Финальный сет: 1×10 → -20% веса → 1×6 → -20% → 1×4. 3 дропа без полного отдыха.',
  },
  myo_reps: {
    type: 'myo_reps', label: 'Myo-reps', appliesTo: ['isolation','accessory'],
    phases: ['accumulation','intensification'],
    description: '1×12-15 (активация) → 5с × 3-5 mini-сетов по 3-5 reps. Итого 21-30 reps.',
  },
  pause_rep: {
    type: 'pause_rep', label: 'Pause-rep', appliesTo: ['compound','isolation'],
    phases: ['accumulation','intensification','peaking'],
    description: 'Пауза 1-3с в нижней точке каждого повторения (модифицирует tempo).',
  },
  mechanical_drop: {
    type: 'mechanical_drop', label: 'Mechanical drop', appliesTo: ['compound','isolation'],
    phases: ['intensification','peaking'],
    description: 'Смена угла/хвата без отдыха: наклон → горизонт → снизу (для жима).',
  },
};

/** Дефолтные техники по фазам (для primary упражнений).
 *  P0-2 (audit 2026-07): accumulation → 'none' (раньше 'pause_rep').
 *  Накопление идёт через ПРОГРЕССИЮ ОБЪЁМА, а не через pause_rep на ВСЕх primary —
 *  pause_rep повышает RPE без роста процентов и истощает восстановление в 8-12 нед мезо
 *  (Grgic 2021 failure-set frequency; Helms 2018). Техники — только в intensification/peaking. */
export const DEFAULT_TECHNIQUE_BY_PHASE: Record<BBPhase, IntensityTechnique> = {
  accumulation: 'none',
  intensification: 'rest_pause',
  peaking: 'rest_pause',
  deload: 'none',
};

/**
 * Применить intensity technique к упражнению. Модифицирует workSets + comments.
 * Не меняет sets/rir (они фазо-корректные из buildSession) — только reps/tempo/notes.
 */
function applyIntensityTechniqueToExercise(
  e: { workSets: BBSet[]; comment?: string; role: string; muscle: string },
  technique: IntensityTechnique,
  _phase: BBPhase,
): void {
  if (technique === 'none' || e.workSets.length === 0) return;
  const lastSet = e.workSets[e.workSets.length - 1];
  const baseWeight = lastSet.weight;
  const baseReps = lastSet.reps;

  switch (technique) {
    case 'rest_pause': {
      // 1×8+15s+1×3-4+15s+1×3-4 — добавляем 2 mini-сета
      e.workSets.push({ reps: 3, rir: lastSet.rir, weight: baseWeight, tempo: '2-0-1-0', restSeconds: 15 });
      e.workSets.push({ reps: 3, rir: lastSet.rir, weight: baseWeight, tempo: '2-0-1-0', restSeconds: 15 });
      if (!e.comment || !e.comment.includes('Rest-pause')) {
        e.comment = (e.comment || '') + (e.comment ? ' · ' : '') + '🎯 Rest-pause финальный сет';
      }
      break;
    }
    case 'drop_set': {
      // 1×10 → -20% → 1×6 → -20% → 1×4
      e.workSets.push({ reps: 6, rir: lastSet.rir, weight: Math.round(baseWeight * 0.8 * 10) / 10, tempo: '2-0-1-0', restSeconds: 30 });
      e.workSets.push({ reps: 4, rir: lastSet.rir, weight: Math.round(baseWeight * 0.64 * 10) / 10, tempo: '2-0-1-0', restSeconds: 30 });
      if (!e.comment || !e.comment.includes('Drop-set')) {
        e.comment = (e.comment || '') + (e.comment ? ' · ' : '') + '🎯 Drop-set (-20%×2)';
      }
      break;
    }
    case 'myo_reps': {
      // 1×12-15 (активация — последний set) + 4 mini-сета × 4 reps × 5с отдых
      const miniCount = 4;
      for (let i = 0; i < miniCount; i++) {
        e.workSets.push({ reps: 4, rir: lastSet.rir, weight: baseWeight, tempo: '1-0-1-0', restSeconds: 5 });
      }
      if (!e.comment || !e.comment.includes('Myo-reps')) {
        e.comment = (e.comment || '') + (e.comment ? ' · ' : '') + `🎯 Myo-reps (×${miniCount} mini)`;
      }
      break;
    }
    case 'pause_rep': {
      // Модифицируем tempo всех подходов: +2с в нижней точке (tempo[1])
      for (const ws of e.workSets) {
        const tParts = (ws.tempo || '2-1-1-0').split('-');
        if (tParts.length === 4) {
          tParts[1] = String(Math.max(1, parseInt(tParts[1] || '1') + 2));
          ws.tempo = tParts.join('-');
        }
      }
      if (!e.comment || !e.comment.includes('Pause-rep')) {
        e.comment = (e.comment || '') + (e.comment ? ' · ' : '') + '🎯 Pause-rep (пауза 2-3с в нижней точке)';
      }
      break;
    }
    case 'mechanical_drop': {
      // 2 сета с той же нагрузкой но сменой угла (пометка в комменте)
      e.workSets.push({ reps: Math.max(6, baseReps - 2), rir: lastSet.rir, weight: baseWeight, tempo: '2-0-1-0', restSeconds: 0 });
      e.workSets.push({ reps: Math.max(6, baseReps - 4), rir: lastSet.rir, weight: baseWeight, tempo: '2-0-1-0', restSeconds: 0 });
      if (!e.comment || !e.comment.includes('Mechanical drop')) {
        e.comment = (e.comment || '') + (e.comment ? ' · ' : '') + '🎯 Mechanical drop (смена угла)';
      }
      break;
    }
  }
}

/* ──────────── Feeder sets ──────────── */
export interface FeederSet {
  muscle: string;
  exercise: string;
  sets: number;
  reps: number;
  notes: string;
}

/**
 * Feeder-сеты для слабых групп — ежедневная низкообъёмная высокочастотная работа.
 */
export function suggestFeeders(weakPoints: string[], equipment: string[]): FeederSet[] {
  const feeders: FeederSet[] = [];
  for (const wp of weakPoints) {
    switch (wp) {
      case 'calves':
        feeders.push({ muscle: 'calves', exercise: 'Подъём на носки стоя', sets: 3, reps: 15, notes: 'Каждый день по 3×15. Разные углы стоп.' });
        break;
      case 'abs':
        feeders.push({ muscle: 'abs', exercise: 'Скручивания', sets: 3, reps: 15, notes: 'Ежедневно 3×15. Медленно, пиковое сокращение вверху. Прогрессия: +2 повт/нед.' });
        break;
      case 'arms':
      case 'biceps':
        feeders.push({ muscle: 'biceps', exercise: 'Сгибания рук с гантелью (лёгкий вес)', sets: 3, reps: 12, notes: 'Ежедневно 3×12, RIR 3, гантель 10-15 кг.' });
        break;
      case 'triceps':
        feeders.push({ muscle: 'triceps', exercise: 'Разгибания рук на блоке (лёгкий)', sets: 3, reps: 12, notes: 'Ежедневно 3×12, RIR 3, смена рукояти.' });
        break;
      case 'side_delts':
      case 'shoulders':
        feeders.push({ muscle: 'shoulders', exercise: 'Махи гантелями в стороны', sets: 3, reps: 15, notes: 'Ежедневно 3×15, RIR 3. Не заваливать корпус.' });
        break;
      case 'upper_chest':
      case 'chest':
        feeders.push({ muscle: 'chest', exercise: 'Разводка гантелями на наклонной', sets: 3, reps: 12, notes: 'Ежедневно 3×12, RIR 3. Акцент на растянутую позицию.' });
        break;
      case 'back':
        feeders.push({ muscle: 'back', exercise: 'Тяга резины/блока к лицу', sets: 3, reps: 15, notes: 'Ежедневно 3×15, RIR 3. Для задней дельты и вращательной манжеты.' });
        break;
    }
  }
  return feeders;
}

/* ──────────── Exercise type allocation per phase ──────────── */
export type ExerciseCategory = 'compound' | 'isolation' | 'machine_compound' | 'cable' | 'feeder';

/**
 * Распределение упражнений по категориям в зависимости от фазы.
 * Напр. accumulation: больше изоляции/кабелей (метаболический стресс),
 * intensification: больше compounds/машин (механическое натяжение).
 */
export function phaseExerciseMix(phase: string): { compoundPct: number; isolationPct: number; machinePct: number; cablePct: number; feederPct: number } {
  switch (phase) {
    case 'accumulation':
      return { compoundPct: 0.35, isolationPct: 0.30, machinePct: 0.15, cablePct: 0.15, feederPct: 0.05 };
    case 'intensification':
      return { compoundPct: 0.50, isolationPct: 0.15, machinePct: 0.20, cablePct: 0.10, feederPct: 0.05 };
    case 'deload':
      return { compoundPct: 0.15, isolationPct: 0.30, machinePct: 0.20, cablePct: 0.25, feederPct: 0.10 };
    case 'peaking':
      return { compoundPct: 0.55, isolationPct: 0.10, machinePct: 0.20, cablePct: 0.10, feederPct: 0.05 };
    default:
      return { compoundPct: 0.40, isolationPct: 0.25, machinePct: 0.20, cablePct: 0.10, feederPct: 0.05 };
  }
}

/* ──────────── Garbage volume detection ──────────── */
export interface GarbageVolume {
  exerciseName: string;
  muscle: string;
  sessionTag: string;
  reason: string;
}

/**
 * Определить «мусорный» объём: упражнения, где целевая мышца не совпадает
 * с тегом сессии, или упражнения, дублирующие механический паттерн.
 */
export function detectGarbageVolume(weeks: BBWeek[], weakPoints: string[]): GarbageVolume[] {
  const garbage: GarbageVolume[] = [];
  const seenPatterns: Set<string> = new Set();
  for (const w of weeks) {
    for (const s of w.sessions) {
      for (const e of s.exercises) {
        // Упражнение вне тега сессии (кроме рук и дельт — они работают во многих)
        const tagRelevant = s.sessionTag
          ? (() => {
              const tagLower = s.sessionTag.toLowerCase();
              if (tagLower.includes('push') && ['chest', 'shoulders', 'triceps'].includes(e.muscle)) return true;
              if (tagLower.includes('pull') && ['back', 'biceps'].includes(e.muscle)) return true;
              if (tagLower.includes('legs') && ['quads', 'hamstrings', 'glutes', 'calves'].includes(e.muscle)) return true;
              if (tagLower.includes('upper') && ['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(e.muscle)) return true;
              if (tagLower.includes('lower') && ['quads', 'hamstrings', 'glutes', 'calves', 'abs'].includes(e.muscle)) return true;
              return true; // default: разрешить
            })()
          : true;
        if (!tagRelevant) {
          garbage.push({ exerciseName: e.name, muscle: e.muscle, sessionTag: s.sessionTag || '', reason: `Мышца ${e.muscle} не входит в тег сессии ${s.sessionTag}` });
        }
        // Дублирование механического паттерна: два жима в одной сессии (кроме слабых групп)
        const catalogEx = EXERCISE_CATALOG.find(x => x.name === e.name);
        const pattern = catalogEx?.movementPattern;
        if (pattern && pattern !== 'other' as any) {
          const key = `${s.day}-${pattern}`;
          if (seenPatterns.has(key) && !weakPoints.includes(e.muscle)) {
            garbage.push({ exerciseName: e.name, muscle: e.muscle, sessionTag: s.sessionTag || '', reason: `Дублирование паттерна ${pattern} — одно движение на сессию` });
          }
          seenPatterns.add(key);
        }
      }
    }
  }
  return garbage;
}

/* ──────────── Progressive overload target ──────────── */
export interface OverloadTarget {
  exerciseName: string;
  currentSets: number;
  currentReps: number;
  currentWeight: number;
  nextTarget: string;
}

export function computeOverloadTargets(week: BBWeek, strategy: LoadStrategy, workMax: Record<string, number>, totalWeeks: number, phase: string = ''): OverloadTarget[] {
  const targets: OverloadTarget[] = [];
  for (const s of week.sessions) {
    for (const e of s.exercises) {
      const currentWeight = e.workSets[0]?.weight || defaultWorkMax(e.muscle);
      const currentReps = e.workSets[0]?.reps || 10;
      const currentRIR = e.rir;
      const maxW = workMax[e.muscle] || defaultWorkMax(e.muscle);
      const prescr = prescribeLoad(strategy, currentWeight, currentReps, currentRIR, maxW, week.week, totalWeeks, phase);
      targets.push({
        exerciseName: e.name,
        currentSets: e.sets,
        currentReps,
        currentWeight,
        nextTarget: prescr.label,
      });
    }
  }
  return targets;
}

/* ──────────── ЕДИНЫЙ ДВИЖОК ФАЗ (P1) ──────────── */

export interface PostPhaseInput {
  plan: BBPlan;
  totalWeeks: number;
  workMax: Record<string, number>;
  loadStrategy?: LoadStrategy;
  autoDeload?: boolean;
  deloadType?: DeloadType;
  acwrRatio?: number;
  autoRegResult?: {
    volumeMultiplier: number;
    topSetPctMultiplier: number;
    rirShift: number;
  };
  /** FIX-5: если true — НЕ перераспределять фазы повторно (buildBBPlan уже сделал это).
   *  Пост-обработка применяет только фазо-специфичные темп/повторы/отдых/делод/авто-рег,
   *  но НЕ пересчитывает distributePhases и НЕ перезаписывает prescribeLoad (buildBBPlan).
   */
  skipPhaseRedistribution?: boolean;
  /** P6: применять intensity technique к primary упражнениям (rest_pause, drop_set, etc.).
   *  Если не задано — берётся из DEFAULT_TECHNIQUE_BY_PHASE[phase] автоматически. */
  intensityTechnique?: IntensityTechnique;
  /** P8: слабые группы для auto-feeder (ежедневные добивки). */
  weakPoints?: string[];
}

/**
 * Единая пост-обработка BB-плана (фазы, темп, повторы, стратегия, авто-делод, autoReg).
 * Вызывается ПОСЛЕ buildBBPlan(). Заменяет дублирующую логику из BbAutoConstructor.
 * phase-periodization.ts — канонический источник RIR/объёма/темпа/повторов по фазам.
 *
 * Что делает поверх buildBBPlan():
 *  1. Фазо-специфичные диапазоны повторений (вместо характер-базированных charReps)
 *  2. Фазо-специфичный темп и отдых (вместо характер-базированных tempoFor/REST_BY_CHARACTER)
 *  3. RIR-дрейф внутри фазы (rirDrift — плавное снижение RIR)
 *  4. Стратегия прогрессии нагрузки (prescribeLoad: doubleProg/linear/wave/rpe)
 *  5. Структурированные делод-протоколы (pump/neural/full_rest) при ACWR>1.5 (P0-7: 1.3→caution, 1.5→enforce)
 *  6. Авто-регуляция (readiness → volumeMultiplier, weight, rirShift)
 */
export function applyPostPhaseProcessing(input: PostPhaseInput): BBPlan {
  const { plan, totalWeeks, workMax, loadStrategy, autoDeload, deloadType, acwrRatio, autoRegResult, skipPhaseRedistribution } = input;

  // P0-7 (audit 2026-07): enforce deload только при ACWR>1.5 (danger zone).
  // 1.3-1.5 = caution (display only, handled in buildBBPlan rationale).
  const needsDeload = !!autoDeload && acwrRatio != null && acwrRatio > 1.5;
  const deloadProtocol = needsDeload && deloadType ? DELOAD_PROTOCOLS[deloadType] : null;

  // FIX-5: если skipPhaseRedistribution — используем фазы из buildBBPlan (уже распределены).
  // Иначе — перестраиваем distributePhases заново (legacy-поведение).
  const phaseMap = new Map<number, BBPhase>();
  if (skipPhaseRedistribution) {
    // The source plan already owns phase labels. Never replace explicit
    // cycle/program phases with a guessed 60/40 map.
    for (const week of plan.weeks) {
      const raw = String((week as any).phase || '').toLowerCase();
      const phase: BBPhase = raw === 'deload' || (week as any).deload ? 'deload'
        : raw === 'peaking' || raw === 'peak' ? 'peaking'
          : raw === 'intensification' ? 'intensification' : 'accumulation';
      phaseMap.set(week.week, phase);
    }
    for (let wk = 1; wk <= totalWeeks; wk++) {
      if (!phaseMap.has(wk)) phaseMap.set(wk, 'accumulation');
    }
  } else {
    // B20: legacy path — перестраивает фазы заново. Предупредить, если кто-то вызовет без skipPhaseRedistribution.
    console.warn('[bb-autocoach] applyPostPhaseProcessing вызван БЕЗ skipPhaseRedistribution — фазы перестроены заново (legacy). Это может рассинхронизировать с buildBBPlan.');
    const phaseDist = distributePhases(totalWeeks, totalWeeks >= 6 ? 4 : 0, 'mass');
    for (const pd of phaseDist) {
      for (const w of pd.weeks) phaseMap.set(w, pd.phase as BBPhase);
    }
    for (let wk = 1; wk <= totalWeeks; wk++) {
      if (!phaseMap.has(wk)) phaseMap.set(wk, 'accumulation');
    }
  }

  // Счётчик недель в каждой фазе (для RIR-дрейфа)
  const phaseWeekTotals: Record<string, number> = {};
  for (let wk = 1; wk <= totalWeeks; wk++) {
    const ph = phaseMap.get(wk) || 'accumulation';
    phaseWeekTotals[ph] = (phaseWeekTotals[ph] || 0) + 1;
  }

  let lastPhase = '';
  let weeksInPhase = 0;

  const weeks = structuredClone(plan.weeks);

  /** Обновить комментарий упражнения после пост-обработки. */
  // P1: упрощено — не переписываем, только дополняем фазой (buildSession уже выставил всё).
  const rebuildComment = (e: BBExercise, phaseName: string) => {
    // Сохраняем оригинальный комментарий из buildSession, только добавляем метку фазы
    const oldComment = e.comment || '';
    const phaseTag = `[${phaseName}]`;
    if (!oldComment.includes(phaseTag)) {
      e.comment = oldComment ? `${oldComment} · ${phaseTag}` : phaseTag;
    }
  };

  for (const w of weeks) {
    const ph = phaseMap.get(w.week) || 'accumulation';
    const cfg = PHASE_CONFIGS[ph as keyof typeof PHASE_CONFIGS];
    if (!cfg) continue;

    if (ph !== lastPhase) { weeksInPhase = 1; lastPhase = ph; }
    else { weeksInPhase++; }

    const phaseWeeksTotal = phaseWeekTotals[ph] || 1;

    if (needsDeload && ph === 'deload' && deloadProtocol) {
      // Структурированный делод-протокол (если ACWR>1.3). Поверх делода фазы.
      // P1: НЕ перезаписывать reps/rir/tempo (buildSession уже выставил по фазе).
      // Только дополнительное снижение веса/сетов по протоколу.
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          const baseSets = Math.round(e.sets / Math.max(0.3, cfg.volumeMultiplier));
          e.sets = Math.max(1, Math.round(baseSets * deloadProtocol.volumeMultiplier));
          const template = e.workSets[e.workSets.length - 1] || {
            reps: e.repsRange[0], rir: e.rir, weight: 0,
          };
          e.workSets = e.workSets.slice(0, e.sets);
          while (e.workSets.length < e.sets) e.workSets.push({ ...template });
          for (const ws of e.workSets) {
            // Дополнительное снижение веса (если протокол требует интенсивность < фаза)
            const protocolMult = deloadProtocol.intensityMultiplier / cfg.intensityMultiplier;
            if (protocolMult < 1) {
              ws.weight = Math.round(ws.weight * protocolMult * 10) / 10;
            }
            // Сокращённый отдых по протоколу
            if (ws.restSeconds != null && deloadProtocol.restSeconds < ws.restSeconds) {
              ws.restSeconds = deloadProtocol.restSeconds;
            }
          }
          rebuildComment(e, cfg.label);
        }
      }
    } else if (loadStrategy) {
      // P1: стратегия прогрессии нагрузки (если выбрана) — модифицирует ВЕС относительно
      // базового из buildSession. reps/rir/tempo НЕ трогаем (они уже фазо-корректные).
      // P3: RPE-based стратегия теперь реально работает (targetRPE-корректировка).
      // P4: передаём exType + role в prescribeLoad для разделения linear-increment.
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          for (const ws of e.workSets) {
            if (ws.weight <= 0) continue;
            const maxW = workMax[e.muscle] || defaultWorkMax(e.muscle);
            const prescr = prescribeLoad(
              loadStrategy, ws.weight, ws.reps, e.rir, maxW, w.week, totalWeeks, ph,
              (e as any).exerciseType,
              e.role,
            );
            ws.weight = Math.round(prescr.nextWeight * 10) / 10;
          }
        }
      }
    }

    // Every source, including faithful programs, receives an explicit phase
    // marker even when no load strategy or intensity technique is selected.
    for (const session of w.sessions) {
      for (const exercise of session.exercises) rebuildComment(exercise, cfg.label);
    }

    // P6: intensity-techniques (применяется к primary упражнениям фазо-уместными техниками).
    // Если intensityTechnique задана явно — применяем ко всем primary; иначе — дефолт по фазе.
    const techniqueChoice = (input as any).intensityTechnique;
    const technique = techniqueChoice || DEFAULT_TECHNIQUE_BY_PHASE[ph] || 'none';
    if (technique !== 'none') {
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          // Только primary упражнения получают intensity-технику
          if (e.role !== 'primary') continue;
          // Проверка meta.phases — избегаем неуместных применений
          const meta = INTENSITY_TECHNIQUES[technique as IntensityTechnique];
          if (meta && !meta.phases.includes(ph)) continue;
          applyIntensityTechniqueToExercise(e, technique, ph);
        }
      }
    }
  }

  // P8: auto-feeder — для слабых групп добавляем «ежедневные добивки» в подходящую сессию недели.
  // Feeder = изоляция 15-20 reps, ~30% workMax, в конце основной тренировки (grease-the-groove).
  const weakPoints = (input as any).weakPoints as string[] | undefined;
  if (weakPoints && weakPoints.length > 0) {
    const feeders = suggestFeeders(weakPoints, []);
    for (const f of feeders) {
      // Найти хотя бы одну неделю/сессию, где тренируется эта мышца
      for (const w of weeks) {
        let added = false;
        for (const s of w.sessions) {
          if (added) break;
          // Сессия содержит нужную мышцу?
          const hasMuscle = s.exercises.some(e => {
            const m = (e.muscle || '').toLowerCase();
            const fm = f.muscle.toLowerCase();
            return m === fm || m.includes(fm) || fm.includes(m);
          });
          if (!hasMuscle) continue;
          // Добавить feeder как отдельное упражнение
          // BUG-B12: magic 30 → defaultWorkMax(f.muscle) — раньше forearms давали 9кг
          // (fallback 30×0.3), хотя DEFAULT_WORKMAX.forearms=45 → правильно 13.5кг.
          const fWeight = Math.max(5, Math.round((workMax[f.muscle] || defaultWorkMax(f.muscle)) * 0.3 * 10) / 10);
          s.exercises.push({
            muscle: f.muscle,
            name: f.exercise,
            role: 'accessory',
            character: 'памп' as any,
            sets: f.sets,
            repsRange: [Math.max(8, f.reps - 3), f.reps + 2] as [number, number],
            rir: 3,
            workSets: Array.from({ length: f.sets }, () => ({
              reps: f.reps, rir: 3, weight: fWeight, tempo: '2-0-1-0', restSeconds: 30,
            })),
            exerciseName: f.exercise,
            tempoSpec: '2-0-1-0',
            restSeconds: 30,
            comment: `🎯 Auto-feeder (${f.notes})`,
            warmupSets: [],
            rationale: 'P8: автоматическая ежедневная добивка для отстающей группы.',
          } as any);
          added = true;
        }
        if (added) break; // только в первую подходящую неделю
      }
    }
  }

  // Авто-регуляция (последний слой — поверх всего)
  if (autoRegResult) {
    const phaseLabels: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', deload: 'Разгрузка', peaking: 'Пик' };
    for (const w of weeks) {
      const ph = phaseMap.get(w.week) || 'accumulation';
        for (const s of w.sessions) {
          for (const e of s.exercises) {
            e.sets = Math.max(1, Math.round(e.sets * autoRegResult.volumeMultiplier));
            const template = e.workSets[e.workSets.length - 1] || {
              reps: e.repsRange[0], rir: e.rir, weight: 0,
            };
            e.workSets = e.workSets.slice(0, e.sets);
            while (e.workSets.length < e.sets) e.workSets.push({ ...template });
            for (const ws of e.workSets) {
            ws.weight = Math.round(ws.weight * autoRegResult.topSetPctMultiplier * 10) / 10;
          }
          e.rir = Math.min(5, e.rir + autoRegResult.rirShift);
          e.repsRange = [
            Math.max(1, e.repsRange[0] - autoRegResult.rirShift),
            Math.max(2, e.repsRange[1] - autoRegResult.rirShift),
          ];
          rebuildComment(e, phaseLabels[ph] || ph);
        }
      }
    }
  }

  return { ...plan, weeks };
}

/**
 * Taper protocol — постепенное снижение объёма за 2-3 нед до пика/соревнования.
 *
 * В отличие от deload (резкое −50% объём, −45% интенсивность за 1 нед),
 * taper снижает объём ПОСТЕПЕННО (−25%/нед) при СОХРАНЕНИИ интенсивности.
 * Цель: снизить утомление, сохранив адаптацию (Bosquet 2005 meta-analysis:
 * 2-3 нед taper → +2-3% производительность; объём −25%/нед, интенсивность 100%).
 *
 * Применяется к последним 2-3 неделям плана ПЕРЕД финальным deload (или вместо
 * deload если план заканчивается peaking без deload).
 */
export function applyTaperToFinalWeeks(plan: BBPlan, totalWeeks: number): BBPlan {
  if (!plan || plan.weeks.length < 4) return plan; // taper только для планов ≥4 нед

  // Найти последнюю deload-неделю (если есть) — taper применяется к неделям ДО неё.
  // Если deload нет — taper к последним 2-3 неделям.
  const weeks = plan.weeks;
  let lastDeloadIdx = -1;
  for (let i = weeks.length - 1; i >= 0; i--) {
    // Явная фаза имеет приоритет над эвристикой объёма: пользовательский или
    // импортированный deload может сохранять больше 60% сетов.
    if (weeks[i].deload === true || weeks[i].phase === 'deload') {
      lastDeloadIdx = i;
      break;
    }
    // Fallback для старых планов без phase/deload-флага.
    const totalSets = weeks[i].sessions.flatMap(s => s.exercises).reduce((sum, e) => sum + e.sets, 0);
    const prevSets = i > 0 ? weeks[i - 1].sessions.flatMap(s => s.exercises).reduce((sum, e) => sum + e.sets, 0) : totalSets;
    if (totalSets < prevSets * 0.6) { lastDeloadIdx = i; break; }
  }

  // Taper-недели: 2-3 нед перед deload (или перед концом плана)
  const taperEnd = lastDeloadIdx >= 0 ? lastDeloadIdx : weeks.length;
  const taperStart = Math.max(0, taperEnd - 3); // последние 3 нед перед deload/концом
  if (taperEnd - taperStart < 2) return plan; // недостаточно нед для taper

  const newWeeks = weeks.map((w, idx) => {
    if (idx < taperStart || idx >= taperEnd) return w; // не taper-неделя
    // P0-fix: пропускать недели, уже являющиеся deload (объём < 60% предыдущей).
    // Иначе taper×deload = двойное снижение (0.50×0.45 = 22.5% объёма = перетрен).
    const curSets = w.sessions.flatMap(s => s.exercises).reduce((sum, e) => sum + e.sets, 0);
    const prevSets = idx > 0 ? weeks[idx - 1].sessions.flatMap(s => s.exercises).reduce((sum, e) => sum + e.sets, 0) : curSets;
    if (w.deload === true || w.phase === 'deload' || curSets < prevSets * 0.6) return w; // уже deload-неделя — не taper
    // Taper-степень: неделя 1 (taperStart) = 100%, неделя 2 = 75%, неделя 3 = 50%.
    // Интенсивность (вес) сохраняется на 100% — снижается только объём (сеты).
    const taperWeek = idx - taperStart; // 0, 1, 2
      const volumeMult = taperWeek === 0 ? 1.0 : taperWeek === 1 ? 0.75 : 0.50;
      const intensityMult = 1.0; // вес сохраняется (Bosquet 2005)
      const newSessions = w.sessions.map(s => ({
        ...s,
        exercises: s.exercises.map(e => {
          const sets = Math.max(1, Math.round(e.sets * volumeMult));
          const source = e.workSets || [];
          const template = source[source.length - 1] || { reps: e.repsRange[0], rir: e.rir, weight: 0 };
          const workSets = Array.from({ length: sets }, (_, setIndex) => ({
            ...(source[setIndex] || template),
            weight: Math.round((source[setIndex]?.weight ?? template.weight) * intensityMult * 10) / 10,
          }));
          return {
            ...e,
            sets,
            workSets,
            comment: (e.comment || '') + ` | 📉 Taper: объём ×${volumeMult}, интенсивность сохранена (Bosquet 2005).`,
          };
        }),
      }));
    return { ...w, sessions: newSessions };
  });

  return { ...plan, weeks: newWeeks };
}

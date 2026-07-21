/**
 * bb-autocoach.engine.ts — PRO-ББ тренерские алгоритмы (загрузка стратегий, делод-протоколы,
 * RIR-drift, feeder-сеты, прогрессивная перегрузка, распределение упражнений по фазам).
 *
 * Вынесено из BbAutoConstructor.tsx для чистоты UI.
 */
import type { BBWeek, BBSession, BBExercise, BBSet, BBPlan } from './bb-builder.engine';
import { defaultWorkMax } from './bb-builder.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { PHASE_CONFIGS, distributePhases } from '../../ui/screens/TrainingScreen_parts/phase-periodization';
import { PCT_FOR_RIR } from '../rir-table';

/* ──────────── BB phase ──────────── */
export type BBPhase = 'accumulation' | 'intensification' | 'deload' | 'peaking';

/* ──────────── Load strategies ──────────── */
export type LoadStrategy = 'double_progression' | 'linear' | 'wave' | 'rpe_based';

export interface LoadStrategyPrescription {
  nextWeight: number;      // кг, цель на следующую сессию
  nextReps: number;        // цель по повторениям
  nextRIR: number;         // цель RIR
  label: string;           // что делать спортсмену
}

/**
 * Применить стратегию прогрессии к упражнению.
 * @param strategy — выбранная стратегия
 * @param currentWeight — текущий рабочий вес (кг)
 * @param currentReps — текущие повторения
 * @param currentRIR — текущий RIR
 * @param maxWeight — рабочий максимум для мышцы (кг)
 * @param week — неделя мезоцикла (1-based)
 * @param totalWeeks — всего недель
 * @param phase — текущая фаза
 * @param exType — тип упражнения ('compound' | 'isolation' | 'accessory' | 'machine' | 'cable')
 *                  для P4: linear-прогрессия масштабируется по типу.
 * @param role — роль в сессии ('primary' | 'accessory') — для P4-корректировки.
 */
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
): LoadStrategyPrescription {
  switch (strategy) {
    case 'double_progression': {
      // Спортсмен сначала добивает повторы до верхней границы, потом повышает вес на ~5%
      const repCap = phase === 'intensification' ? 8 : 12;
      if (currentReps < repCap) {
        return {
          nextWeight: currentWeight,
          nextReps: currentReps + 1,
          nextRIR: Math.max(0, currentRIR - 1),
          label: `Добейте ${currentReps + 1} повторов (цель ${repCap}) с тем же весом`,
        };
      }
      return {
        nextWeight: Math.round(currentWeight * 1.05),
        nextReps: Math.max(6, repCap - 4),
        nextRIR: Math.min(3, currentRIR + 1),
        label: `Повысьте вес до ${Math.round(currentWeight * 1.05)} кг, снизьте повторы до ${Math.max(6, repCap - 4)}`,
      };
    }
    case 'linear': {
      // P4: разделение increment по типу упражнения. Изоляция +1кг/нед = перетрен трицепса.
      // Compound +2.5кг, machine_compound +1.5кг, isolation +1кг, accessory +0.5кг.
      const phaseMult = week < totalWeeks * 0.75 ? 1.0 : 0.5; // ramp down в последней четверти
      const typeBase: Record<string, number> = {
        compound: 2.5,
        machine_compound: 1.5,
        cable: 1.25,
        machine: 1.0,
        isolation: 1.0,
        accessory: 0.5,
      };
      const baseIncr = typeBase[exType || 'compound'] ?? (role === 'accessory' ? 0.5 : 1.5);
      const increment = baseIncr * phaseMult;
      return {
        nextWeight: Math.round((currentWeight + increment) * 10) / 10,
        nextReps: currentReps,
        nextRIR: Math.max(0, currentRIR - 1),
        label: `Линейная ${exType || 'compound'}: +${increment.toFixed(1)} кг/нед (нед ${week}${phaseMult < 1 ? ' — ramp down' : ''})`,
      };
    }
    case 'wave': {
      // 3-нед микроцикл: тяж/сред/лёг
      const pos = (week - 1) % 3;
      const waveLabel = pos === 0 ? 'тяжёлая' : pos === 1 ? 'средняя' : 'лёгкая';
      const waveMult = pos === 0 ? 1.05 : pos === 1 ? 1.0 : 0.92;
      return {
        nextWeight: Math.round(currentWeight * waveMult * 10) / 10,
        nextReps: pos === 0 ? Math.max(4, currentReps - 2) : pos === 2 ? Math.min(15, currentReps + 3) : currentReps,
        nextRIR: pos === 0 ? 0 : pos === 2 ? 3 : currentRIR,
        label: `Волновая: ${waveLabel} неделя (×${waveMult})`,
      };
    }
    case 'rpe_based': {
      // P3: реальный RPE-алгоритм.
      // Target RPE нарастает от accumulation (7) к peaking (9.5): linear по фазе + неделя внутри фазы.
      // Если currentRIR (фактический RPE) отклоняется от targetRIR — корректируем вес.
      // RPE 10 = отказ (RIR 0), RPE 9 = RIR 1, ..., RPE 5 = RIR 5.
      // Целевой RIR по неделе: accumulation week 1 → RIR 3 (RPE 7), peaking last week → RIR 0 (RPE 10).
      const phaseStartRir: Record<string, [number, number]> = {
        accumulation: [3, 1],   // нед 1: RIR 3, нед N: RIR 1
        intensification: [2, 0], // нед 1: RIR 2, нед N: RIR 0
        peaking: [1, 0],
        deload: [4, 4],
      };
      const rirRange = phaseStartRir[phase] || [2, 0];
      const phaseProgress = totalWeeks > 1 ? (week - 1) / (totalWeeks - 1) : 0;
      const targetRir = Math.max(0, Math.round(rirRange[0] - phaseProgress * (rirRange[0] - rirRange[1])));
      // Корректировка: если фактический RIR > targetRIR (легче, чем нужно) → вес ↑,
      // если < targetRIR (тяжелее) → вес ↓.
      const rirDelta = currentRIR - targetRir;
      let weightMult = 1.0;
      let direction = '';
      if (rirDelta >= 1) {
        weightMult = 1.025;  // +2.5% — наращиваем нагрузку
        direction = `RIR ${currentRIR} > target ${targetRir}: +2.5% веса (наращивание)`;
      } else if (rirDelta <= -1) {
        weightMult = 0.97;   // -3% — снижаем, был перебор
        direction = `RIR ${currentRIR} < target ${targetRir}: -3% веса (восстановление)`;
      } else {
        direction = `RIR ${currentRIR} ≈ target ${targetRir}: удержание веса`;
      }
      return {
        nextWeight: Math.round(currentWeight * weightMult * 10) / 10,
        nextReps: currentReps,
        nextRIR: targetRir,
        label: `RPE-стратегия: ${direction}`,
      };
    }
    default:
      return { nextWeight: currentWeight, nextReps: currentReps, nextRIR: currentRIR, label: 'Продолжайте по плану' };
  }
}

/* ──────────── Deload protocols ──────────── */
export type DeloadType = 'pump' | 'neural' | 'full_rest' | 'mini';

export interface DeloadProtocol {
  type: DeloadType;
  volumeMultiplier: number;    // × объём
  intensityMultiplier: number; // × вес
  rirTarget: number;
  repRange: [number, number];
  restSeconds: number;
  /** Mini-делоад: сохранить исходные повторы (не переопределять repRange) — лёгкая разгрузка без смены схемы. */
  keepOriginalReps?: boolean;
  description: string;
  instructions: string;
}

export const DELOAD_PROTOCOLS: Record<DeloadType, DeloadProtocol> = {
  pump: {
    type: 'pump',
    volumeMultiplier: 0.5,
    intensityMultiplier: 0.55,
    rirTarget: 4,
    repRange: [15, 20],
    restSeconds: 45,
    description: 'Pump-разгрузка: лёгкие веса, высокие повторы, минимальный отдых. Кровоток + восстановление.',
    instructions: '50% объёма, 55% веса, короткий отдых (45с). Цель: пампинг без утомления ЦНС.',
  },
  neural: {
    type: 'neural',
    volumeMultiplier: 0.4,
    intensityMultiplier: 0.7,
    rirTarget: 3,
    repRange: [3, 5],
    restSeconds: 180,
    description: 'Нейральная разгрузка: низкий объём, умеренные веса, долгий отдых. Восстановление ЦНС.',
    instructions: '40% объёма, 70% веса, долгий отдых (3мин). Цель: движение без утомления.',
  },
  full_rest: {
    type: 'full_rest',
    volumeMultiplier: 0.2,
    intensityMultiplier: 0.4,
    rirTarget: 5,
    repRange: [10, 12],
    restSeconds: 60,
    description: 'Полный отдых: минимальная активность, сохранение движения. Только для перетренированности.',
    instructions: '20% объёма, 40% веса. Минимум упражнений (2-3 на сессию). Приоритет — сон и питание.',
  },
  mini: {
    type: 'mini',
    volumeMultiplier: 0.70,
    intensityMultiplier: 0.92,
    rirTarget: 3,
    repRange: [6, 12],
    restSeconds: 120,
    keepOriginalReps: true,
    description: 'Мини-делоад: −1-2 сета на compounds, вес почти тот же (×0.92), RIR +1-2. Без смены схемы. Лёгкая разгрузка без потери прогресса.',
    instructions: '70% объёма (−1-2 сета с базовых), 92% веса, RIR 3. Повторы и упражнения — те же. Микро-восстановление.',
  },
};

export function applyDeloadToWeek(week: BBWeek, protocol: DeloadProtocol): BBWeek {
  const w2 = JSON.parse(JSON.stringify(week)) as BBWeek;
  for (const s of w2.sessions) {
    for (const e of s.exercises) {
      e.sets = Math.max(1, Math.round(e.sets * protocol.volumeMultiplier));
      e.rir = protocol.rirTarget;
      if (!protocol.keepOriginalReps) e.repsRange = [protocol.repRange[0], protocol.repRange[1]];
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

/** Дефолтные техники по фазам (для primary упражнений) */
export const DEFAULT_TECHNIQUE_BY_PHASE: Record<BBPhase, IntensityTechnique> = {
  accumulation: 'pause_rep',
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
        feeders.push({ muscle: 'abs', exercise: 'Планка', sets: 4, reps: 30, notes: 'Ежедневно 4 подхода по 30с. Прогрессия: +5с/нед.' });
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
 *  5. Структурированные делод-протоколы (pump/neural/full_rest) при ACWR>1.3
 *  6. Авто-регуляция (readiness → volumeMultiplier, weight, rirShift)
 */
export function applyPostPhaseProcessing(input: PostPhaseInput): BBPlan {
  const { plan, totalWeeks, workMax, loadStrategy, autoDeload, deloadType, acwrRatio, autoRegResult, skipPhaseRedistribution } = input;

  const needsDeload = !!autoDeload && acwrRatio != null && acwrRatio > 1.3;
  const deloadProtocol = needsDeload && deloadType ? DELOAD_PROTOCOLS[deloadType] : null;

  // FIX-5: если skipPhaseRedistribution — используем фазы из buildBBPlan (уже распределены).
  // Иначе — перестраиваем distributePhases заново (legacy-поведение).
  const phaseMap = new Map<number, BBPhase>();
  if (skipPhaseRedistribution) {
    // Извлекаем фазы из плана: проверяем комментарии упражнений на маркеры фаз
    // или используем упрощённую карту: первые ~60% accumulation, остальное intensification,
    // последняя неделя — deload (если weeks >= 6).
    const deloadFreq = totalWeeks >= 6 ? 4 : 0;
    if (deloadFreq > 0) {
      for (let wk = 1; wk <= totalWeeks; wk++) {
        if (wk % deloadFreq === 0) phaseMap.set(wk, 'deload');
        else if (wk <= Math.ceil(totalWeeks * 0.6)) phaseMap.set(wk, 'accumulation');
        else phaseMap.set(wk, 'intensification');
      }
    } else {
      for (let wk = 1; wk <= totalWeeks; wk++) {
        phaseMap.set(wk, wk <= Math.ceil(totalWeeks * 0.6) ? 'accumulation' : 'intensification');
      }
    }
  } else {
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
          const fWeight = Math.max(5, Math.round((workMax[f.muscle] || 30) * 0.3 * 10) / 10);
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

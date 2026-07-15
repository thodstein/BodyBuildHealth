/**
 * bb-autocoach.engine.ts — PRO-ББ тренерские алгоритмы (загрузка стратегий, делод-протоколы,
 * RIR-drift, feeder-сеты, прогрессивная перегрузка, распределение упражнений по фазам).
 *
 * Вынесено из BbAutoConstructor.tsx для чистоты UI.
 */
import type { BBWeek, BBSession, BBExercise, BBSet, BBPlan } from './bb-builder.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { PHASE_CONFIGS, distributePhases } from '../../ui/screens/TrainingScreen_parts/TrainingConstructor/phase-periodization';
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
      // +2.5 кг для compounds, +1 кг для изоляции каждую неделю
      const increment = week < totalWeeks * 0.75 ? 2.5 : 1.25;
      return {
        nextWeight: Math.round((currentWeight + increment) * 10) / 10,
        nextReps: currentReps,
        nextRIR: Math.max(0, currentRIR - 1),
        label: `Добавьте +${increment} кг (линейная прогрессия, нед ${week})`,
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
      // RPE-базированная: спортсмен выбирает вес по ощущению
      return {
        nextWeight: currentWeight,
        nextReps: currentReps,
        nextRIR: currentRIR,
        label: `RPE-ориентир: подберите вес на RIR ${Math.max(0, currentRIR - 1)} (${week === totalWeeks ? 'пик' : 'прогрессия'})`,
      };
    }
    default:
      return { nextWeight: currentWeight, nextReps: currentReps, nextRIR: currentRIR, label: 'Продолжайте по плану' };
  }
}

/* ──────────── Deload protocols ──────────── */
export type DeloadType = 'pump' | 'neural' | 'full_rest';

export interface DeloadProtocol {
  type: DeloadType;
  volumeMultiplier: number;    // × объём
  intensityMultiplier: number; // × вес
  rirTarget: number;
  repRange: [number, number];
  restSeconds: number;
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
};

export function applyDeloadToWeek(week: BBWeek, protocol: DeloadProtocol): BBWeek {
  const w2 = JSON.parse(JSON.stringify(week)) as BBWeek;
  for (const s of w2.sessions) {
    for (const e of s.exercises) {
      e.sets = Math.max(1, Math.round(e.sets * protocol.volumeMultiplier));
      e.rir = protocol.rirTarget;
      e.repsRange = [protocol.repRange[0], protocol.repRange[1]];
      for (const ws of e.workSets) {
        ws.reps = Math.round((protocol.repRange[0] + protocol.repRange[1]) / 2);
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
      const currentWeight = e.workSets[0]?.weight || 80;
      const currentReps = e.workSets[0]?.reps || 10;
      const currentRIR = e.rir;
      const maxW = workMax[e.muscle] || 80;
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
  const { plan, totalWeeks, workMax, loadStrategy, autoDeload, deloadType, acwrRatio, autoRegResult } = input;

  const needsDeload = !!autoDeload && acwrRatio != null && acwrRatio > 1.3;
  const deloadProtocol = needsDeload && deloadType ? DELOAD_PROTOCOLS[deloadType] : null;

  // Фазовая карта из канонического источника
  const phaseDist = distributePhases(totalWeeks, totalWeeks >= 6 ? 4 : 0, 'mass');
  const phaseMap = new Map<number, BBPhase>();
  for (const pd of phaseDist) {
    for (const w of pd.weeks) phaseMap.set(w, pd.phase as BBPhase);
  }
  for (let wk = 1; wk <= totalWeeks; wk++) {
    if (!phaseMap.has(wk)) phaseMap.set(wk, 'accumulation');
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
  const rebuildComment = (e: BBExercise, phaseName: string) => {
    const parts: string[] = [];
    const label = e.role === 'primary' ? '🎯 Основное' : '📌 Добивочное';
    parts.push(`${label}: ${e.muscle}`);
    const charLabel = e.character === 'тяж' ? 'тяж' : e.character === 'памп' ? 'памп' : 'лёг';
    parts.push(`${phaseName}, RIR ${e.rir} (${charLabel})`);
    const reps = e.workSets[0]?.reps || 10;
    const weight = e.workSets[0]?.weight || 80;
    parts.push(`${e.sets}×${reps} @ ${weight} кг`);
    const tempo = e.workSets[0]?.tempo || '';
    const rest = e.workSets[0]?.restSeconds || 90;
    if (tempo) parts.push(`Темп ${tempo}, отдых ${rest}с`);
    e.comment = parts.join('. ');
  };

  for (const w of weeks) {
    const ph = phaseMap.get(w.week) || 'accumulation';
    const cfg = PHASE_CONFIGS[ph as keyof typeof PHASE_CONFIGS];
    if (!cfg) continue;

    if (ph !== lastPhase) { weeksInPhase = 1; lastPhase = ph; }
    else { weeksInPhase++; }

    const phaseWeeksTotal = phaseWeekTotals[ph] || 1;

    if (needsDeload && ph === 'deload' && deloadProtocol) {
      // Структурированный делод-протокол
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          const baseSets = Math.round(e.sets / Math.max(0.3, cfg.volumeMultiplier));
          e.sets = Math.max(1, Math.round(baseSets * deloadProtocol.volumeMultiplier));
          e.rir = deloadProtocol.rirTarget;
          e.repsRange = [deloadProtocol.repRange[0], deloadProtocol.repRange[1]];
          for (const ws of e.workSets) {
            const engineWeight = ws.weight > 0 ? ws.weight : 40;
            ws.reps = Math.round((deloadProtocol.repRange[0] + deloadProtocol.repRange[1]) / 2);
            ws.rir = deloadProtocol.rirTarget;
            ws.tempo = cfg.tempo;
            ws.weight = Math.round(engineWeight * deloadProtocol.intensityMultiplier * 10) / 10;
            ws.restSeconds = deloadProtocol.restSeconds;
          }
          rebuildComment(e, cfg.label);
        }
      }
    } else {
      // Фазо-специфичная полировка (повторы, RIR-дрейф, темп, отдых, стратегия)
      const driftedRir = rirDrift(cfg.rirRange, weeksInPhase, phaseWeeksTotal);

      for (const s of w.sessions) {
        for (const e of s.exercises) {
          const isPrimary = e.role === 'primary';
          const isCalvesAbs = ['calves', 'abs'].includes(e.muscle);

          // RIR: primary ближе к отказу, accessory легче
          e.rir = isPrimary ? driftedRir : Math.min(5, driftedRir + 1);

          // Фазо-специфичные повторы (точнее character-базированных charReps)
          if (isCalvesAbs) {
            e.repsRange = [15, 25];
          } else if (isPrimary) {
            e.repsRange = [cfg.repRange[0], cfg.repRange[1]];
          } else {
            e.repsRange = [cfg.repRange[0] + 2, cfg.repRange[1] + 5];
          }

          for (const ws of e.workSets) {
            const maxW = workMax[e.muscle] || 80;
            // Используем вес из движка (уже учитывает PRO_WORKMAX_RATIO), не пересчитываем заново.
            // Это сохраняет дифференциацию: жим штанги ≠ жим гантелей ≠ наклонный.
            const engineWeight = ws.weight > 0 ? ws.weight : Math.round(maxW * (PCT_FOR_RIR[Math.min(5, e.rir)] ?? 0.9) * 10) / 10;

            ws.reps = Math.round((e.repsRange[0] + e.repsRange[1]) / 2);
            ws.rir = e.rir;
            ws.tempo = cfg.tempo;
            ws.restSeconds = cfg.restBase;

            // Стратегия прогрессии нагрузки поверх движкового веса
            if (loadStrategy) {
              const prescr = prescribeLoad(loadStrategy, engineWeight, ws.reps, e.rir, maxW, w.week, totalWeeks, ph);
              ws.weight = Math.round(prescr.nextWeight * 10) / 10;
            } else {
              // Оставляем движковый вес без изменений
            }
          }
          rebuildComment(e, cfg.label);
        }
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

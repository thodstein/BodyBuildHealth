/**
 * annual-training-cardio.engine.ts — кардио-слой годового плана (engine-only).
 *
 * Годовой план отвечает за КАЛЕНДАРЬ; каждый блок года получает свой кардио-цикл
 * (CardioCycle), выровненный по неделям блока. UI не трогается — только чистые
 * функции: сопоставление фаз макро с целями кардио, раскладка спец (год → блок),
 * сборка циклов через buildCardioCycle из lms/cardio.engine.
 */
import type {
  CardioCycle,
  CardioCycleInput,
  CardioEquipment,
  CardioGoal,
  CardioLevel,
} from '../lms/cardio.engine';
import { buildCardioCycle } from '../lms/cardio.engine';
import { addDaysIso, todayLocalIso } from '../lms/cardio-date-utils.engine';
import type { AnnualBlockKind, AnnualTrainingPlan } from './annual-training.types';

/** Кардио-спека блока годового плана (производное от фазы макро + конфига блока). */
export interface AnnualCardioSpec {
  blockKey: string;
  blockIndex: number;
  kind: AnnualBlockKind;
  phase: string;
  description: string;
  /** Стартовая неделя блока в году (1-индекс). */
  startWeek: number;
  /** Длина блока (недель) — длина кардио-цикла. */
  weeks: number;
  goal: CardioGoal;
  /** Длина taper-окна перед стартом блока (0 = без taper). */
  taperWeeks: number;
  /** Пик-неделя на последней неделе блока (только BB-prep). */
  peakWeek: boolean;
  /** Неделя «соревнования» внутри блока (последняя при taper/peak), 1-индекс. */
  competitionWeek: number | null;
}

/**
 * Цель кардио по фазе макро-блока:
 *  - contest_prep → 'bb_prep' (дефицит + прогрессия, taper к старту);
 *  - peak → 'pl_prep' (умеренный Zone 2/MISS, без утомления ЦНС);
 *  - competition/transition → 'recovery' (лёгкая активность);
 *  - taper → 'bb_taper' (плавное снижение по BB_CARDIO_TAPER_CURVE);
 *  - hypertrophy/mass/strength/endurance и остальное → 'maintenance'.
 */
export function cardioGoalForAnnualPhase(phase: string, kind: AnnualBlockKind = 'BB'): CardioGoal {
  const p = String(phase || '').toLowerCase();
  switch (p) {
    case 'contest_prep':
    case 'prep':
      return 'bb_prep';
    case 'peak':
      return 'pl_prep';
    case 'competition':
    case 'transition':
      return 'recovery';
    case 'taper':
      return 'bb_taper';
    default:
      return 'maintenance';
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Раскладка кардио-циклов по блокам годового плана (чистая, без сборки). */
export function annualCardioSpecs(plan: AnnualTrainingPlan | null | undefined): AnnualCardioSpec[] {
  if (!plan) return [];
  return plan.blocks
    .filter(b => b.status !== 'error')
    .map(b => {
      const ref = b.ref;
      const cfg = b.config ?? {};
      const goal = cardioGoalForAnnualPhase(ref.phase, ref.kind);
      const wantsTaper = cfg.taper?.enabled === true || goal === 'bb_prep' || goal === 'pl_prep';
      const taperWeeks = wantsTaper ? clamp(Math.round(cfg.taper?.weeks ?? (goal === 'bb_prep' ? 3 : 2)), 1, 4) : 0;
      const peakWeek = goal === 'bb_prep' && cfg.peakWeek === true;
      const weeks = Math.max(1, Math.round(ref.weeks || 1));
      return {
        blockKey: ref.blockKey,
        blockIndex: ref.blockIndex,
        kind: ref.kind,
        phase: ref.phase,
        description: ref.description ?? ref.blockKey,
        startWeek: Math.max(1, Math.round(ref.startWeek || 1)),
        weeks,
        goal,
        taperWeeks,
        peakWeek,
        competitionWeek: taperWeeks > 0 ? weeks : null,
      };
    });
}

/** Опции сборки кардио-циклов годового плана (общие для всех блоков). */
export interface AnnualCardioBuildOptions {
  /** Неделя 1 года = referenceIso (по умолчанию — сегодня). */
  referenceIso?: string;
  level?: CardioLevel;
  equipment?: CardioEquipment[];
  lowImpact?: boolean;
  autoLowImpact?: boolean;
  jointIssues?: boolean;
  age?: number;
  restingHr?: number;
  sex?: 'male' | 'female';
  sleepHours?: number;
  stressLevel?: number;
  hrvMs?: number;
  enhanced?: boolean;
  daysAvailable?: number;
  recoveryLow?: boolean;
  legDays?: number[];
  bodyWeight?: number;
  bodyFatPct?: number;
}

export interface AnnualCardioBuildOutcome {
  /** Кардио-циклы по blockKey блока года. */
  cycles: Record<string, CardioCycle>;
  specs: AnnualCardioSpec[];
  warnings: string[];
}

/* addDaysIso / todayLocalIso — из cardio-date-utils.engine.ts */

/** Собрать кардио-цикл на каждый блок годового плана (engine-only, без UI).
 *  Цикл выровнен на недели блока: startDate = reference + (startWeek−1)×7,
 *  старт (taper/пик) — на последней неделе блока. */
export function buildAnnualCardioCycles(
  plan: AnnualTrainingPlan | null | undefined,
  opts: AnnualCardioBuildOptions = {},
): AnnualCardioBuildOutcome {
  const ref = opts.referenceIso ?? todayLocalIso();
  const specs = annualCardioSpecs(plan);
  const cycles: Record<string, CardioCycle> = {};
  const warnings: string[] = [];

  for (const s of specs) {
    const startDate = addDaysIso(ref, (s.startWeek - 1) * 7);
    const competitions = s.competitionWeek != null
      ? [{ id: `annual-cardio-${s.blockKey}`, name: `Старт: ${s.description}`, week: s.competitionWeek, priority: 'B' as const }]
      : undefined;
    const compWeek = s.competitionWeek != null ? Math.min(s.competitionWeek, s.weeks) : null;
    const safeComps = compWeek != null
      ? [{ id: `annual-cardio-${s.blockKey}`, name: `Старт: ${s.description}`, week: compWeek, priority: 'B' as const }]
      : undefined;
    const input: CardioCycleInput = {
      goal: s.goal,
      totalWeeks: s.weeks,
      startDate,
      taperWeeks: s.taperWeeks,
      taper: s.taperWeeks > 0,
      peakWeek: s.peakWeek,
      competitions: safeComps,
      bodyWeight: opts.bodyWeight,
      bodyFatPct: opts.bodyFatPct,
      daysAvailable: opts.daysAvailable,
      recoveryLow: opts.recoveryLow,
      level: opts.level,
      equipment: opts.equipment,
      lowImpact: opts.lowImpact,
      autoLowImpact: opts.autoLowImpact,
      jointIssues: opts.jointIssues,
      age: opts.age,
      restingHr: opts.restingHr,
      sex: opts.sex,
      sleepHours: opts.sleepHours,
      stressLevel: opts.stressLevel,
      hrvMs: opts.hrvMs,
      enhanced: opts.enhanced,
      legDays: opts.legDays,
      id: `annual-cardio-${s.blockKey}`,
      name: `Кардио · ${s.description}`,
      source: 'auto',
    };
    const cycle = buildCardioCycle(input);
    cycles[s.blockKey] = cycle;
  }

  if (specs.length === 0) warnings.push('В годовом плане нет блоков — кардио-циклы не собраны.');
  if (plan?.blocks.some(b => b.status === 'stale')) {
    warnings.push('Есть блоки со статусом stale — пересоберите их, кардио-раскладка может не совпадать с разметкой.');
  }
  return { cycles, specs, warnings };
}

/** Сводка кардио-слоя года (текст для rationale/печати). */
export function annualCardioText(specs: AnnualCardioSpec[], cycles: Record<string, CardioCycle>): string[] {
  return specs.map(s => {
    const c = cycles[s.blockKey];
    const taper = s.taperWeeks > 0 ? `, taper ${s.taperWeeks} нед${s.peakWeek ? ' + пик' : ''}` : '';
    const minutes = c ? `${Math.round(c.weeks.reduce((acc, w) => acc + w.totalMinutes, 0) / Math.max(1, c.weeks.length))} мин/нед` : 'не собран';
    return `Нед ${s.startWeek}-${s.startWeek + s.weeks - 1} [${s.description}]: ${s.goal}, ${minutes}${taper}.`;
  });
}

/**
 * Кардио-минуты недели года (кардио-слой heatmap макроцикла).
 * cycles — карта blockKey → CardioCycle (из he_annual_cardio_cycles).
 * Неделя w года: если блок имеет собранный кардио-цикл, возвращается totalMinutes
 * недели цикла, соответствующей позиции недели внутри блока; иначе 0.
 */
export function annualCardioWeekMinutes(
  plan: AnnualTrainingPlan | null | undefined,
  cycles: Record<string, CardioCycle>,
  week: number,
): number {
  if (!plan) return 0;
  const block = plan.blocks.find(b => {
    const s = Math.max(1, Math.round(b.ref.startWeek || 1));
    const len = Math.max(1, Math.round(b.ref.weeks || 1));
    return week >= s && week < s + len;
  });
  if (!block) return 0;
  const cycle = cycles[block.ref.blockKey];
  if (!cycle || !cycle.weeks.length) return 0;
  const k = week - Math.max(1, Math.round(block.ref.startWeek || 1)) + 1;
  const cw = cycle.weeks.find(x => x.week === clamp(k, 1, cycle.totalWeeks));
  return cw ? cw.totalMinutes : 0;
}

/** Максимум кардио-минут по неделям года (масштаб для heatmap). */
export function maxAnnualCardioMinutes(
  plan: AnnualTrainingPlan | null | undefined,
  cycles: Record<string, CardioCycle>,
): number {
  if (!plan) return 0;
  let m = 0;
  for (let w = 1; w <= Math.max(1, plan.totalWeeks); w++) {
    m = Math.max(m, annualCardioWeekMinutes(plan, cycles, w));
  }
  return m;
}

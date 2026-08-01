/**
 * lms-builder.engine.ts — генерация полного плана СРЦ из шаблона недели 1 + PM + прогрессии.
 * Этап A3/B. Связывает: lms-types (шаблон) + lms-progression (PM по неделям) + lms-metrics (веса/метрики).
 *
 * СРЦ = саморасчитывающийся: неделя 1 — раскладка (% от PM), недели 2..N = та же раскладка
 * с PM, растущим на correctionPct каждую неделю. Вес подхода = PM_нед × pct × mnosz.
 */

import type { SRCycleTemplate, SRDaySpec, SRExerciseSpec } from '../../data/lms-cycles/lms-types';
import { pmProgression, workWeight, progressionRationale, type ProgressionMode, type PMProgressionInput } from './lms-progression.engine';
import { calcSessionMetrics, type SRExercise, type SRSessionMetrics, type SRCycleMetrics } from './lms-metrics.engine';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../core/exercise-catalog';
import { type Exercise } from '../../core/types';
import { selectExercisesSmart } from '../exercise-selector.engine';
import { mesocyclePhaseForWeek, RIR_MATRIX, MesoPhaseConfigs, type MesocyclePhase } from '../rir-matrix.engine';
import { diagnoseWeakPoint, type Lift, type WeakPoint } from './weakpoint-pl';
import { diagnoseLift } from '../pro/lift-diagnostics.engine';

import { computeVolumeLandmarks, getVolumeLandmarks, getAllVolumeLandmarks } from '../volume-landmarks.engine';
import { adaptForPEDs, type PED } from '../bb/bb-ped-adaptation.engine';
import { trueMuscleOf } from '../movement-pattern';
import { norm } from '../norm';

export interface LMSBuildInput {
  template: SRCycleTemplate;
  pmMap: Record<string, number>;
  fallbackPm?: number;
  mode?: ProgressionMode;
  weeklyPercent?: number;
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
  weeksOverride?: number;
  /** ПРОФ-параметры */
  volumeGoal?: 'mev' | 'mav' | 'mrv';
  focusLift?: 'squat' | 'bench' | 'deadlift';
  currentReadiness?: number; // 0-100
  equipment?: string[];
  weakPoints?: string[];
  /** Слабые точки СРЦ-движений (профи-диагностика): какой лифт + какой участок амплитуды. */
  plWeakPoints?: { lift: Lift; weakPoint: WeakPoint }[];
  /** Пользовательский выбор дней для слабых групп мышц: {muscleId: [1-based dayIdx,...]}.
   *  Если не задано — авто-распределение: малые группы → 2 дня (heavy+pump), крупные → 1 день. */
  weakGroupDayMap?: Record<string, number[]>;
  /** Пользовательский выбор дней для слабых точек СРЦ-движений.
   *  Ключ формата `${lift}|${weakPointId}` → [1-based dayIdx,...]. Если не задано — авто. */
  plWeakPointDayMap?: Record<string, number[]>;
  /** ACWR-зона для авто-делода (если передана — применяется к объёму/RIR). */
  acwr?: { ratio: number; zone: 'undertrained' | 'optimal' | 'caution' | 'dangerous' };
  /** Авторегуляция: topSetPctMultiplier/volumeMultiplier/rirShift (если передана — применяется к весам). */
  autoReg?: { topSetPctMultiplier: number; volumeMultiplier: number; rirShift: number; deload: boolean };
  /** PED-адаптация (dose-aware): если передана — заменяет хардкод pedMrvMult. */
  peds?: PED[];
  pedDoses?: Record<string, number>;
  /** Recovery-метрики для recovery multiplier (Helms 2022, Plews 2022). */
  bodyFat?: number;       // % жира
  leanMass?: number;      // кг сухой массы
  hrvMs?: number;         // RMSSD в мс
  sleepHours?: number;    // часов сна/ночь
  stressLevel?: number;   // 1-10
}


export interface LMSWorkSet {
  pct: number;
  reps: number;
  sets: number;
  weight: number; // расчётный вес (кг)
  rir: number;    // repetitions in reserve для подхода (фаза мезоцикла)
}

export interface LMSPlanExercise {
  name: string;
  group: string;
  coef: number;
  mnosz: number;
  load?: string;
  pm: number;
  rir: number;    // базовый RIR упражнения (по фазе)
  workSets: LMSWorkSet[];
}

export interface LMSPlanDay {
  exercises: LMSPlanExercise[];
  metrics: SRSessionMetrics;
}

export interface LMSPlanWeek {
  week: number;
  pmRow: Record<string, number>; // PM по упражнениям на эту неделю
  days: LMSPlanDay[];
  /** Фаза годового макроцикла, если план собран из Macrocycle. */
  macroPhase?: string;
}

export interface LMSBuildOutput {
  template: SRCycleTemplate;
  progressionRationale: string;
  weeks: LMSPlanWeek[];
  cycleMetrics: SRCycleMetrics;
  /** Валидация объёма по группам мышц против MEV/MAV/MRV (volume-landmarks). */
  plVolumeLandmarks?: PLVolumeLandmark[];
}

export interface PLVolumeLandmark {
  group: string;       // английская группа (chest/back/legs/...)
  muscle: string;      // русское имя мышцы (из VOLUME_REFERENCES)
  peakWeek: number;    // неделя с пиковым объёмом
  sets: number;        // сетов/нед в пиковую неделю
  mev: number; mav: number; mrv: number;
  status: 'under' | 'optimal' | 'high' | 'over';
}

/** Уровень → ключ VolumeReference (enhanced → advanced). */
function vrLevelKey(level: string): 'beginner' | 'intermediate' | 'advanced' {
  switch (level) {
    case 'novice': return 'beginner';
    case 'intermediate': case 'II-KMS': return 'intermediate';
    case 'KMS-MS': case 'II-MS': case 'KMS-MSMK': case 'MS-MSMK': case 'enhanced': return 'advanced';
    default: return 'intermediate';
  }
}

const RU_TO_EN: Record<string, string> = { 'Грудь': 'chest', 'Спина': 'back', 'Ноги': 'legs', 'Плечи': 'shoulders', 'Руки': 'arms', 'Кор': 'core' };
const SENT_TO_RU: Record<string, string> = { 'ПР': 'Грудь', 'ЖМ': 'Ноги', 'ТГ': 'Спина', 'ЖИМ': 'Грудь', 'ТЯГА': 'Спина', 'ОФП': 'Кор', 'СФП': 'Кор' };
const EN_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
/** focusLift (английский ключ из UI) → русская подстрока для сопоставления с именем упражнения. */
const FOCUS_RU: Record<string, string> = { squat: 'присед', bench: 'жим', deadlift: 'тяга' };

/** Нормализовать группу упражнения (рус/сентимент) → английский ключ для volume-landmarks. */
function exEnGroup(g: string | undefined): string | undefined {
  if (!g) return undefined;
  if ((EN_GROUPS as readonly string[]).includes(g)) return g;
  const ru = SENT_TO_RU[g] || g;
  return RU_TO_EN[ru];
}

/** Группа (английский ключ) основного лифта — для MRV soft-cap внедряемого аксессуара.
 *  deadlift → 'hamstrings' (задняя цепь), не 'back' (становая не растит широчайшие).
 *  Иначе MRV-кап accessory считался по back, а не по hamstrings. */
function liftToEnGroup(lift: Lift): string {
  const m: Record<string, string> = { bench: 'chest', squat: 'legs', deadlift: 'hamstrings', ohp: 'shoulders', row: 'back', pulldown: 'back', incline_press: 'chest' };
  return m[lift] || 'back';
}

/** Извлечь уникальные имена упражнений из шаблона (все недели, если заданы явно). */
export function extractExercises(tpl: SRCycleTemplate): string[] {
  const set = new Set<string>();
  const source = tpl.weeks && tpl.weeks.length ? tpl.weeks.flat() : tpl.week1;
  for (const day of source) for (const ex of day.exercises) set.add(ex.name);
  return [...set];
}

function pmFor(exName: string, pmMap: Record<string, number>, fallback: number): number {
  if (pmMap[exName] != null) return pmMap[exName];
  // эвристика: жимовые/присед/тяга — попытка сопоставления по ключам (с нормализацией ё→е)
  const n = norm(exName);
  const keys = Object.keys(pmMap);
  for (const k of keys) {
    const nk = norm(k);
    if (n.includes(nk) || nk.includes(n)) {
      return pmMap[k];
    }
  }
  return fallback;
}

// Нормализация load (Тяжелая/Средняя/Легкая): в шаблонах поле load иногда содержало
// мусор (имя упражнения из-за бага парсера). Берём валидный тег дня, иначе 'Средняя'.
const VALID_LOAD = /^(Тяжелая|Средняя|Легкая)$/;
function dayLoadTag(exercises: { load?: string }[]): string {
  const valid = exercises.find(e => e.load && VALID_LOAD.test(e.load));
  return valid?.load || 'Средняя';
}
function cleanLoad(load: string | undefined, dayTag: string): string {
  return load && VALID_LOAD.test(load) ? load : dayTag;
}

/** Маппинг period цикла → ключ RIR_MATRIX. */
function rirGoalKey(period: string): keyof typeof RIR_MATRIX {
  switch (period) {
    case 'strength': case 'peak': return 'strength';
    case 'mass': return 'hypertrophy';
    case 'endurance': return 'maintenance';
    case 'mixed': return 'hypertrophy';
    default: return 'strength';
  }
}

/** Маппинг level цикла → ключ RIR_MATRIX. */
function rirLevelKey(level: string): keyof typeof RIR_MATRIX['strength'] {
  switch (level) {
    case 'novice': return 'beginner';
    case 'intermediate': case 'II-KMS': return 'intermediate';
    case 'KMS-MS': case 'II-MS': return 'advanced';
    case 'KMS-MSMK': case 'MS-MSMK': return 'enhanced';
    default: return 'intermediate';
  }
}

/** Найти упражнение в каталоге по метке коррекции (метка может быть более специфичной, чем имя в каталоге). */
function findCatalogExerciseByLabel(label: string): Exercise | null {
  const n = norm(label);
  let ex = EXERCISE_CATALOG.find(e => norm(e.name) === n);
  if (ex) return ex;
  ex = EXERCISE_CATALOG.find(e => {
    const en = norm(e.name);
    return en.length > 2 && (en.includes(n) || n.includes(en));
  });
  if (ex) return ex;
  // Fallback: извлечь ядро имени (до скобок, слэша, тире), убрать обёртки типа «(акцент ...)»
  const core = label.split(/[\(\/—–\:\;]/)[0]?.trim();
  if (core && core.length > 2 && core !== label) {
    const cn = norm(core);
    ex = EXERCISE_CATALOG.find(e => {
      const en = norm(e.name);
      return en.length > 2 && (en.includes(cn) || cn.includes(en));
    });
  }
  return ex || null;
}

/** Группа (английский ключ) упражнения по каталогу + фолбэк на тег шаблона.
 *  P0-fix: trueMuscleOf как канон — catalog .group содержит ошибки (close-grip=chest,
 *  face_pull=back, deadlift=back). Без trueMuscleOf MRV-подсчёт уходит не туда. */
function groupOfExercise(name: string, fallback: string): string {
  const ex = EXERCISE_CATALOG.find(e => norm(e.name) === norm(name));
  if (ex) return trueMuscleOf(ex) ?? (ex.group as string) ?? fallback;
  // fuzzy match
  const n = norm(name);
  const fx = EXERCISE_CATALOG.find(e => {
    const en = norm(e.name);
    return en.length > 2 && (en.includes(n) || n.includes(en));
  });
  if (fx) return trueMuscleOf(fx) ?? (fx.group as string) ?? fallback;
  return fallback;
}

function weeklyMuscleSets(days: LMSPlanDay[], group: string): number {
  return days.reduce((total, day) => total + day.exercises
    .filter(ex => groupOfExercise(ex.name, ex.group) === group)
    .reduce((dayTotal, ex) => dayTotal + ex.workSets.reduce((sets, workSet) => sets + workSet.sets, 0), 0), 0);
}

/**
 * Собрать список корректирующих упражнений для слабой точки.
 * Упражнения ВСЕГДА из diagnoseWeakPoint (проверенный каталог weakpoint-pl).
 * diagnoseLift используется только для intensityPct классических лифтов (bench/squat/deadlift).
 */
function collectPLCorrections(lift: Lift, weakPoint: WeakPoint): { name: string; pct: number }[] {
  const base = diagnoseWeakPoint(lift, weakPoint);
  if (!base.assistance.length) return [];
  const diag = diagnoseLift(lift, weakPoint);
  const pct = diag ? diag.assistanceIntensityPct : base.intensityPct;
  return base.assistance.map((a: string) => ({ name: a, pct }));
}

export interface PLWeakPointRecommendation {
  corrections: string[];
  rationale: string;
  group: string;
  pct: number;
}

/** Рекомендация для UI: упражнения из проверенного каталога weakpoint-pl, rationale из lift-diagnostics (где доступно). */
export function getPLWeakPointRecommendations(lift: Lift, weakPoint: WeakPoint): PLWeakPointRecommendation {
  const group = liftToEnGroup(lift);
  const base = diagnoseWeakPoint(lift, weakPoint);
  const diag = diagnoseLift(lift, weakPoint);
  const pct = diag ? diag.assistanceIntensityPct : base.intensityPct;
  const rationale = diag ? diag.biomechanicalReason : base.rationale;
  return { corrections: base.assistance, rationale, group, pct };
}

/**
 * Инъекция ассистентных упражнений по диагностике слабой точки СРЦ-движения.
 * Для каждого {lift, weakPoint} подбираем до MAX_CORRECTIONS упражнений из diagnoseWeakPoint
 * (проверенный каталог weakpoint-pl), которые ещё не присутствуют в дне,
 * и добавляем их (3 подхода на %ПМ) в день, содержащий основной лифт.
 * Не дублирует уже назначенные упражнения; соблюдает MRV soft-cap группы.
 */
function injectPLWeakPoints(
  days: LMSPlanDay[],
  weakPoints: { lift: Lift; weakPoint: WeakPoint }[],
  pmRow: Record<string, number>,
  rirBase: number,
  phaseVolMod: number,
  vrLevel: 'beginner' | 'intermediate' | 'advanced',
  mrvMult: number,
  plWeakPointDayMap?: Record<string, number[]>,
  fallbackPm: number = 80,
): void {
  const mainNameMap: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга', ohp: 'Жим стоя', row: 'Тяга', pulldown: 'Тяга', incline_press: 'Жим гантелей' };
  const MAX_CORRECTIONS = 2;
  for (const wp of weakPoints) {
    const mainName = mainNameMap[wp.lift] || 'Жим';
    // Найти дни с лифтом (rank по объёму: max-heavy + min-light)
    const dayRankByMain: { idx: number; mainSets: number }[] = [];
    for (let i = 0; i < days.length; i++) {
      const mainSets = days[i].exercises
        .filter(e => {
          const en = norm(e.name), mn = norm(mainName);
          return en === mn || en.includes(mn) || mn.includes(en);
        })
        .reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
      if (mainSets > 0) dayRankByMain.push({ idx: i, mainSets });
    }
    // Авто-распределение: heavy = max объём лифта, light = следующий по объёму (минимум)
    let heavyDayIdx = -1, lightDayIdx = -1;
    if (dayRankByMain.length > 0) {
      const sorted = [...dayRankByMain].sort((a, b) => b.mainSets - a.mainSets);
      heavyDayIdx = sorted[0].idx;
      if (sorted.length > 1) lightDayIdx = sorted[1].idx;
    } else {
      heavyDayIdx = 0;
    }
    // Override через пользовательский выбор
    const mapKey = `${wp.lift}|${wp.weakPoint}`;
    const userDays = plWeakPointDayMap?.[mapKey] || plWeakPointDayMap?.[wp.lift as string];
    if (userDays && userDays.length > 0) {
      heavyDayIdx = (userDays[0] - 1);
      if (userDays.length > 1) lightDayIdx = (userDays[1] - 1);
      else lightDayIdx = -1;
    }

    const liftGroup = liftToEnGroup(wp.lift);
    const corrections = collectPLCorrections(wp.lift, wp.weakPoint).slice(0, MAX_CORRECTIONS);
    if (corrections.length === 0) continue;

    // 1-й кандидат — в heavy-day (3×8 @ RIR 2, "Тяжёлая" добивка)
    // 2-й кандидат — в light-day (3×12 @ RIR 3, памп-вариант)
    const heavyDay = days[heavyDayIdx];
    if (heavyDay) {
      const c = corrections[0];
      const ex = findCatalogExerciseByLabel(c.name);
      const resolvedName = ex ? ex.name : c.name;
      const existing = new Set(heavyDay.exercises.map(e => norm(e.name)));
      if (!existing.has(norm(resolvedName)) && heavyDay.exercises.length < 8) {
        // P0-fix: trueMuscleOf как канонический резолвер группы. Catalog .group
        // содержит ошибки (bench_closegrip=chest, face_pull=back, deadlift=back),
        // которые приводят к MRV-капу по неправильной мышце.
        const exGroup = ex ? (trueMuscleOf(ex) ?? (ex.group as string)) : liftGroup;
        const sets = Math.max(2, Math.round(3 * phaseVolMod));
        const pm = pmRow[resolvedName] ?? pmRow[mainName] ?? Object.entries(pmRow).find(([k]) => norm(k) === norm(mainName) || norm(k).includes(norm(mainName)) || norm(mainName).includes(norm(k)))?.[1] ?? fallbackPm;
        const ref = getVolumeLandmarks(vrLevel, exGroup);
        if (ref) {
          const cur = weeklyMuscleSets(days, exGroup);
          if (cur + sets > Math.round(ref.mrv * mrvMult)) continue;
        }
        heavyDay.exercises.push({
          name: resolvedName, group: exGroup, coef: 0.7, mnosz: 1,
          load: 'Тяжелая', pm, rir: rirBase,
          workSets: [{ pct: c.pct, reps: 8, sets: Math.max(1, sets), weight: workWeight(pm, c.pct), rir: rirBase }],
        });
        existing.add(norm(resolvedName));
      }
    }

    // 2-й кандидат — в light-day (если есть второй candidate в heavyDayIdx)
    if (lightDayIdx >= 0 && corrections.length > 1) {
      const lightDay = days[lightDayIdx];
      if (lightDay) {
        const c = corrections[1];
        const ex = findCatalogExerciseByLabel(c.name);
        const resolvedName = ex ? ex.name : c.name;
        const existing = new Set(lightDay.exercises.map(e => norm(e.name)));
        if (!existing.has(norm(resolvedName)) && lightDay.exercises.length < 8) {
          const exGroup = ex ? (trueMuscleOf(ex) ?? (ex.group as string)) : liftGroup;
          const sets = Math.max(2, Math.round(3 * phaseVolMod));
          const pm = pmRow[resolvedName] ?? pmRow[mainName] ?? fallbackPm;
          const ref = getVolumeLandmarks(vrLevel, exGroup);
          if (ref) {
            const cur = weeklyMuscleSets(days, exGroup);
            if (cur + sets > Math.round(ref.mrv * mrvMult)) continue;
          }
          // Памп-протокол: 3×12 @ 60% 1PM, RIR 3
          const pumpPct = 0.60;
          lightDay.exercises.push({
            name: resolvedName, group: exGroup, coef: 0.65, mnosz: 1,
            load: 'Средняя', pm, rir: Math.max(3, rirBase + 1),
            workSets: [{ pct: pumpPct, reps: 12, sets: Math.max(1, sets), weight: workWeight(pm, pumpPct), rir: Math.max(3, rirBase + 1) }],
          });
          existing.add(norm(resolvedName));
        }
      }
    }
  }
}

export function buildLMSPlan(input: LMSBuildInput): LMSBuildOutput {
  const { template, pmMap, fallbackPm = 80 } = input;
  if (fallbackPm <= 0) throw new Error('buildLMSPlan: fallbackPm must be > 0');

  // Валидация шаблона
  if (!template.meta.weeks || template.meta.weeks <= 0) throw new Error('buildLMSPlan: template.meta.weeks must be > 0');
  if (!template.week1 || !Array.isArray(template.week1) || template.week1.length === 0) throw new Error('buildLMSPlan: template.week1 must be a non-empty array of days');
  if (typeof template.meta.correctionPct !== 'number' || isNaN(template.meta.correctionPct)) throw new Error('buildLMSPlan: template.meta.correctionPct must be a number');
  for (const day of template.week1) {
    for (const ex of day.exercises) {
      if (!ex.sets || !Array.isArray(ex.sets)) throw new Error(`buildLMSPlan: exercise "${ex.name}" has missing or invalid sets`);
      for (const s of ex.sets) {
        if (typeof s.pct !== 'number' || s.pct <= 0 || s.pct > 1) throw new Error(`buildLMSPlan: exercise "${ex.name}" has invalid pct (${s.pct}), expected 0..1`);
        if (typeof s.sets !== 'number' || s.sets <= 0) throw new Error(`buildLMSPlan: exercise "${ex.name}" has invalid sets count (${s.sets})`);
        if (typeof s.reps !== 'number' || s.reps <= 0) throw new Error(`buildLMSPlan: exercise "${ex.name}" has invalid reps (${s.reps})`);
      }
    }
  }
  if (template.weeks && !Array.isArray(template.weeks)) throw new Error('buildLMSPlan: template.weeks must be an array if provided');
  if (template.weeks) {
    for (let wi = 0; wi < template.weeks.length; wi++) {
      const w = template.weeks[wi];
      if (!Array.isArray(w) || w.length === 0) throw new Error(`buildLMSPlan: template.weeks[${wi}] must be a non-empty array of days`);
      for (const day of w) {
        if (!day || !Array.isArray(day.exercises)) throw new Error(`buildLMSPlan: template.weeks[${wi}] contains an invalid day`);
        for (const ex of day.exercises) {
          if (!ex.sets || !Array.isArray(ex.sets)) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid sets`);
          for (const s of ex.sets) {
            if (typeof s.pct !== 'number' || !Number.isFinite(s.pct) || s.pct <= 0 || s.pct > 1) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid pct (${s.pct})`);
            if (typeof s.sets !== 'number' || !Number.isFinite(s.sets) || s.sets <= 0) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid sets count (${s.sets})`);
            if (typeof s.reps !== 'number' || !Number.isFinite(s.reps) || s.reps <= 0) throw new Error(`buildLMSPlan: explicit week ${wi + 1} exercise "${ex.name}" has invalid reps (${s.reps})`);
          }
        }
      }
    }
  }

  const mode = input.mode ?? 'natural';
  if (input.weeksOverride != null && (!Number.isFinite(input.weeksOverride) || input.weeksOverride < 1)) {
    throw new Error('buildLMSPlan: weeksOverride must be a finite number >= 1');
  }
  if (input.weeklyPercent != null && (!Number.isFinite(input.weeklyPercent) || input.weeklyPercent <= -1)) {
    throw new Error('buildLMSPlan: weeklyPercent must be finite and greater than -100%');
  }
  if (template.meta.correctionPct <= -1) throw new Error('buildLMSPlan: correctionPct must be greater than -100%');
  const exercises = extractExercises(template);

  // Faithful multi-week: если задана явная раскладка ВСЕХ недель — используем её
  // дословно, БЕЗ авто-прогрессии (pct каждой недели уже отражает реальную нагрузку).
  const hasExplicitWeeks = !!(template.weeks && template.weeks.length);
  const totalWeeks = hasExplicitWeeks
    ? template.weeks!.length
    : Math.max(1, Math.round(input.weeksOverride ?? template.meta.weeks));

  const pm0Map: Record<string, number> = {};
  for (const name of exercises) {
    const pm = pmFor(name, pmMap, fallbackPm);
    if (!Number.isFinite(pm) || pm <= 0) throw new Error(`buildLMSPlan: PM for exercise "${name}" must be > 0`);
    pm0Map[name] = pm;
  }

  // прогрессия PM для каждого упражнения
  const progInput: PMProgressionInput = {
    pm0: 100, weeks: totalWeeks, mode,
    weeklyPercent: input.weeklyPercent, courseIntensity: input.courseIntensity,
  };
  const rationale = hasExplicitWeeks
    ? 'Программа задана дословно по источнику (явная раскладка всех недель, без авто-прогрессии PM).'
    : progressionRationale({ ...progInput, pm0: 100 });
  const weakNotes: string[] = [];

  const goalKey = rirGoalKey(template.meta.period);
  const levelKey = rirLevelKey(template.meta.level);
  const vrLevel = vrLevelKey(template.meta.level);
  // PED-адаптация: dose-aware через adaptForPEDs (если переданы PEDs), иначе fallback на хардкод.
  let pedMrvMult = 1;
  let pedRecMult = 1;
  if (input.peds && input.peds.length > 0) {
    const allLandmarks = getAllVolumeLandmarks(vrLevel);
    const baseMrv = Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv]));
    const pedAdapt = adaptForPEDs(input.peds, baseMrv, input.pedDoses, input.courseIntensity);
    pedMrvMult = pedAdapt.combinedMrvMultiplier || 1;
    pedRecMult = pedAdapt.combinedRecoveryMultiplier || 1;
  } else if (input.mode === 'on_course') {
    pedMrvMult = input.courseIntensity === 'heavy' ? 1.35 : input.courseIntensity === 'moderate' ? 1.25 : 1.15;
  }

  // Recovery multiplier из композиции тела + recovery-метрик (Helms 2022, Plews 2022, Watson 2022).
  // Модулирует MRV soft-cap (pedMrvMult × recoveryMult) — выше восстановление → больше объём.
  const recoveryMult = Math.max(0.6, Math.min(1.5, (() => {
    let r = 1.0;
    if (input.bodyFat != null) r *= input.bodyFat > 25 ? 0.9 : input.bodyFat > 20 ? 0.95 : 1.0;
    if (input.leanMass != null) r *= input.leanMass >= 90 ? 1.15 : input.leanMass >= 75 ? 1.05 : input.leanMass >= 60 ? 1.0 : 0.9;
    if (input.hrvMs != null) r *= input.hrvMs > 70 ? 1.1 : input.hrvMs >= 50 ? 1.0 : 0.85;
    if (input.sleepHours != null) r *= input.sleepHours >= 7 ? 1.05 : input.sleepHours >= 6 ? 1.0 : 0.85;
    if (input.stressLevel != null) r *= input.stressLevel < 3 ? 1.05 : input.stressLevel < 6 ? 1.0 : 0.85;
    return r;
  })()));
  // Итоговый MRV-множитель: PED × recovery (комбинированный soft-cap)
  const combinedMrvMult = pedMrvMult * recoveryMult;

  // ACWR-авто-делод: если передана ACWR-зона — корректируем объём/RIR для всех недель.
  const acwrZone = input.acwr?.zone;
  let acwrVolMod = 1, acwrRirShift = 0, acwrDeload = false;
  if (acwrZone === 'dangerous') { acwrVolMod = 0.65; acwrRirShift = 2; acwrDeload = true; }
  else if (acwrZone === 'caution') { acwrVolMod = 0.85; acwrRirShift = 1; }
  else if (acwrZone === 'undertrained') { acwrVolMod = 1.1; } // Растренированность: стимул +10% объёма без RIR-shift (восстановление через объём, не интенсивность).

  // Авторегуляция: если передана — применяется к весам (topSetPctMultiplier) и объёму/RIR.
  const ar = input.autoReg;
  const arTopMult = ar?.topSetPctMultiplier ?? 1;
  const arVolMult = ar?.volumeMultiplier ?? 1;
  const arRirShift = ar?.rirShift ?? 0;

  const weeks: LMSPlanWeek[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekNumber = w + 1;
    const phase: MesocyclePhase = mesocyclePhaseForWeek(weekNumber, totalWeeks);
    const rirBase = RIR_MATRIX[goalKey]?.[levelKey]?.[phase] ?? MesoPhaseConfigs[phase].rirBase;
    // Для auto-прогрессирующих циклов применяем объёмную модуляцию фазы (реальный пик/разгрузка).
    // Для faithful (явная раскладка всех недель) уважаем источник — модуляции нет.
    const phaseVolMod = hasExplicitWeeks ? 1.0 : MesoPhaseConfigs[phase].volumeMod;

    const pmRow: Record<string, number> = {};
    for (const name of exercises) {
      if (hasExplicitWeeks) {
        pmRow[name] = pm0Map[name]; // без прогрессии: реальный PM пользователя
      } else {
        const k = (input.weeklyPercent != null ? input.weeklyPercent
          : mode === 'on_course' ? (input.courseIntensity === 'mild' ? 0.015 : input.courseIntensity === 'heavy' ? 0.025 : 0.02)
          : mode === 'pct' ? -0.005 : template.meta.correctionPct);
        pmRow[name] = pm0Map[name] * Math.pow(1 + k, weekNumber - 1);
      }
    }
    const weekLayout: SRDaySpec[] = hasExplicitWeeks ? template.weeks![w] : template.week1;
    const days: LMSPlanDay[] = weekLayout.map((day: SRDaySpec) => {
      const dayTag = dayLoadTag(day.exercises as { load?: string }[]);

      // S-MRV: Бюджет утомления на сессию
      let dayFatigueBudget = 60 * ((input.currentReadiness || 80) / 100);

      const planEx: LMSPlanExercise[] = day.exercises.map((spec: SRExerciseSpec) => {
        const pm = pmRow[spec.name];
        const isMain = spec.load === 'Тяжелая';
        const workSets: LMSWorkSet[] = spec.sets.map(s => {
          let sets = s.sets;

          // Коррекция объёма по VolumeGoal + фазе мезоцикла (только для аксессуаров)
          if (!isMain) {
            const vMult = input.volumeGoal === 'mev' ? 0.8 : input.volumeGoal === 'mrv' ? 1.2 : 1.0;
            const focusRu = input.focusLift ? FOCUS_RU[input.focusLift] : undefined;
            const focusMult = (focusRu && norm(spec.name).includes(focusRu)) ? 1.2 : 1.0;
            const weakEn = exEnGroup(spec.group);
            const weakMult = (input.weakPoints && weakEn && input.weakPoints.includes(weakEn)) ? 1.2 : 1.0;
            const totalMult = vMult * phaseVolMod * focusMult * weakMult;
            sets = Math.round(sets * totalMult);
          }

          // S-MRV floor: аксессуары не ниже 2 подходов (иначе < MEV — бесполезный объём)
          sets = Math.max(isMain ? 1 : 2, sets);

          // ACWR-авто-делод: корректируем объём (все упражнения) и RIR
          sets = Math.max(1, Math.round(sets * acwrVolMod));
          // Авторегуляция: объём (все) — применяется поверх ACWR
          sets = Math.max(1, Math.round(sets * arVolMult));

          // Расчётный вес с авторегуляцией (topSetPctMultiplier)
          const baseWeight = workWeight(pm, s.pct);
          const adjWeight = Math.round(baseWeight * arTopMult * 10) / 10;

          // RIR с ACWR + авторегуляцией
          const adjRir = Math.max(0, rirBase + acwrRirShift + arRirShift);

          return {
            pct: s.pct, reps: s.reps, sets: Math.max(1, sets),
            weight: adjWeight,
            rir: adjRir,
          };
        });

        // Проверка S-MRV: срезаем аксессуары, чтобы влезть в бюджет утомления
        const totalWorkSets = workSets.reduce((sum, ws) => sum + ws.sets, 0);
        const fatigueCost = EXERCISE_CATALOG.find(e => e.name === spec.name)?.fatigueCost || 5;
        const exCost = fatigueCost * totalWorkSets;
        if (dayFatigueBudget < exCost && !isMain) {
          const fit = Math.max(2, Math.floor(dayFatigueBudget / fatigueCost));
          workSets.forEach(ws => { ws.sets = Math.min(ws.sets, fit); });
        }
        dayFatigueBudget -= fatigueCost * totalWorkSets;

        return { name: spec.name, group: spec.group, coef: spec.coef, mnosz: spec.mnosz, load: cleanLoad(spec.load, dayTag), pm, rir: rirBase, workSets };
      });

      const metricsEx: SRExercise[] = planEx.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      return { exercises: planEx, metrics: calcSessionMetrics(metricsEx) };
    });

    // Инъекция ассистентов по слабым точкам СРЦ-движений (все циклы, включая faithful с полными weeks[])
    if (input.plWeakPoints && input.plWeakPoints.length) {
      injectPLWeakPoints(days, input.plWeakPoints, pmRow, rirBase, phaseVolMod, vrLevel, combinedMrvMult, input.plWeakPointDayMap, input.fallbackPm ?? 80);
    }

    // Инъекция accessory-упражнений для слабых групп мышц — авто-распределение по 1-2 дням.
    // Тренерская логика:
    //  - Малые группы (biceps, triceps, forearms, calves, abs, delt_rear/delt_mid): 2×/нед → тяжёлый день (3×8 @RIR 2) + памп-день (3×12 @RIR 3)
    //  - Крупные группы (chest, back, quads, hamstrings, glutes, shoulders): 1×/нед → памп-добивка в synergist/антагонист-день (3×10 @RIR 3)
    //  - Уважается MRV soft-cap мышцы, day cap (упражнения ≤ 8 в день).
    //  - Пользовательский override: weakGroupDayMap[muscle] = [dayIdx,...] — 1-based. Если не задано — авто.
    if (input.weakPoints && input.weakPoints.length) {
      const SMALL_GROUPS_2X = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs', 'delt_rear', 'delt_mid']);
      const userDayMap = input.weakGroupDayMap;
      const allWeekNames = new Set(days.flatMap(d => d.exercises.map(e => norm(e.name))));
      const fallbackPm = input.fallbackPm ?? 80;

      for (const wg of input.weakPoints) {
        const candidates = getExercisesByGroup(wg)
          .filter((ex: Exercise) => !allWeekNames.has(norm(ex.name)));
        if (candidates.length === 0) continue;

        // Определить число дней для добивки
        const isSmall = SMALL_GROUPS_2X.has(wg);
        let targetDayCount = isSmall ? 2 : 1;
        // Пользовательский override выбора дней
        let targetDays: number[] = [];
        if (userDayMap && userDayMap[wg]) {
          targetDays = userDayMap[wg].slice(0, days.length).filter(d => d >= 1 && d <= days.length);
          targetDayCount = targetDays.length;
        }
        if (targetDays.length === 0) {
          // Авто-распределение: найти дни с минимальным объёмом целевой мышцы (для spread)
          const dayStats: { idx: number; cnt: number; isLegsDay: boolean; isUpperDay: boolean }[] = [];
          for (let di = 0; di < days.length; di++) {
            const cnt = days[di].exercises
              .filter(e => groupOfExercise(e.name, exEnGroup(e.group) || '') === wg)
              .reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
            const dayMuscleGroups = new Set(days[di].exercises.map(e => exEnGroup(e.group) || ''));
            const isLegsDay = dayMuscleGroups.has('quads') || dayMuscleGroups.has('hamstrings') || dayMuscleGroups.has('glutes');
            const isUpperDay = dayMuscleGroups.has('chest') || dayMuscleGroups.has('back') || dayMuscleGroups.has('shoulders');
            dayStats.push({ idx: di, cnt, isLegsDay, isUpperDay });
          }
          // Сортировать по возрастанию объёма мышцы (min volume = best для spread)
          dayStats.sort((a, b) => a.cnt - b.cnt);
          // Для тяжёлого группы ног → предпочесть не ноги день; uppper weak → предпочесть upper
          const isWpLegs = ['quads', 'hamstrings', 'glutes', 'calves'].includes(wg);
          const isWpUpper = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'].includes(wg);
          if (isWpLegs) {
            dayStats.sort((a, b) => (a.isLegsDay === b.isLegsDay ? a.cnt - b.cnt : a.isLegsDay ? 1 : -1));
          } else if (isWpUpper) {
            dayStats.sort((a, b) => (a.isUpperDay === b.isUpperDay ? a.cnt - b.cnt : a.isUpperDay ? -1 : 1));
          }
          // Взять top targetDayCount дней (разные дни — dequeueReusableCell)
          targetDays = dayStats.slice(0, targetDayCount).map(s => s.idx + 1);
        }

        // Для каждого выбранного дня — добавить accessory упражнения с разным протоколом
        const listedMuscleRef = getVolumeLandmarks(vrLevel, wg);
        const fakeMrvCap = listedMuscleRef ? Math.round(listedMuscleRef.mrv * combinedMrvMult) : 99;
        for (let ti = 0; ti < targetDays.length; ti++) {
          const dayIdx = targetDays[ti] - 1;
          if (dayIdx < 0 || dayIdx >= days.length) continue;
          const targetDay = days[dayIdx];
          // Протокол дня: 1-й = тяжёлый добив (3×8 RIR 2), 2-й = памп-добив (3×12 RIR 3)
          const isHeavyDay = ti === 0 && isSmall && targetDays.length > 1;
          // Выбрать упражнение: тяж-день → compound/isolation если есть; памп-день → изоляция
          const poolFiltered = candidates.filter(ex => !targetDay.exercises.some(e => norm(e.name) === norm(ex.name)));
          if (poolFiltered.length === 0) continue;
          const pick = (isHeavyDay
            ? (poolFiltered.find(e => e.type === 'compound' || e.movementType === 'compound') || poolFiltered[0])
            : (poolFiltered.find(e => e.type === 'isolation' || e.movementType === 'isolation') || poolFiltered[0])) as Exercise;

          // Выбор exercises сделан; tfПротокол
          const pct = isHeavyDay ? 0.68 : 0.55;
          const reps = isHeavyDay ? 8 : 12;
          let sets = 3;
          const rir = isHeavyDay ? 2 : 3;
          // MRV soft-cap: урезаем sets так, чтобы вписаться в fakeMrvCap
           const currentMuscleSets = weeklyMuscleSets(days, wg);
           if (currentMuscleSets + sets > fakeMrvCap) {
             const margin = Math.max(0, fakeMrvCap - currentMuscleSets);
            if (margin < 2) continue; // бюджета не хватает даже на минимум
            sets = margin; // урезаем подходы, чтобы вписаться в cap
          }
          // Day cap: упражнений ≤ 8
          if (targetDay.exercises.length >= 8) continue;

           const wPm = pmRow[pick.name] ?? fallbackPm;
          targetDay.exercises.push({
            name: pick.name,
            group: wg,
            coef: 0.5,
            mnosz: 1,
            load: isHeavyDay ? 'Тяжелая' : 'Средняя',
            pm: wPm,
            rir,
            workSets: [{ pct, reps, sets, weight: workWeight(wPm, pct), rir }],
          });
          allWeekNames.add(norm(pick.name));
          weakNotes.push(`🔥 Слабая группа ${wg} — добивка в день ${dayIdx + 1}: ${pick.name} ${sets}×${reps} @${Math.round(workWeight(wPm, pct))}кг RIR ${rir}${isHeavyDay ? ' (heavy)' : ' (pump)'}.`);
        }
      }
    }

    // Пересчёт метрик сессий (после возможной инъекции слабых точек)
    for (const d of days) {
      const metricsEx: SRExercise[] = d.exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      d.metrics = calcSessionMetrics(metricsEx);
    }

    weeks.push({ week: weekNumber, pmRow, days });
  }

  const allSessions = weeks.flatMap(wk => wk.days.map(d => d.exercises.map(pe => ({
    name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
    sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
  } as SRExercise))));
  const cycleMetrics = calcCycleMetricsAggregate(allSessions, totalWeeks);

  const proRationale = [
    rationale,
    input.volumeGoal ? `Объём аксессуаров: ${input.volumeGoal === 'mev' ? 'минимальный (MEV)' : input.volumeGoal === 'mrv' ? 'максимальный (MRV)' : 'оптимальный (MAV)'}.` : '',
    input.focusLift ? `Приоритет: акцент на ${input.focusLift === 'squat' ? 'присед' : input.focusLift === 'bench' ? 'жим' : 'тягу'} (+20% объёма).` : '',
    input.weakPoints?.length ? `Слабые группы: ${input.weakPoints.join(', ')} (+20% объёма для упражнений на эти группы).` : '',
    `S-MRV: объём сессий автоматически ограничен бюджетом утомления (Ready: ${input.currentReadiness || 80}%).`,
    input.peds?.length ? `💉 PED-адаптация (dose-aware): MRV ×${pedMrvMult.toFixed(2)}, восст ×${pedRecMult.toFixed(2)}.` : '',
    (input.bodyFat != null || input.hrvMs != null || input.sleepHours != null) ? `🔄 Recovery multiplier: ×${recoveryMult.toFixed(2)} (bodyFat/HRV/sleep/stress). Итог MRV ×${combinedMrvMult.toFixed(2)}.` : '',
    input.acwr ? `📊 ACWR ${input.acwr.ratio.toFixed(1)} (${acwrZone}): объём×${acwrVolMod}, RIR+${acwrRirShift}${acwrDeload ? ', deload' : ''}.` : '',
    input.autoReg ? `🧠 Авторегуляция: топ-сет×${arTopMult}, объём×${arVolMult}, RIR+${arRirShift}${input.autoReg.deload ? ', deload' : ''}.` : '',
    ...weakNotes,
  ].filter(Boolean).join(' ');

  // P1: Авто-taper к финальным 2 неделям (peaking phase) — снижение объёма, интенсивность сохранена.
  // Применяется только для auto-прогрессирующих циклов (не faithful) и при отсутствии ACWR-deload.
  const taperedWeeks = (!hasExplicitWeeks && totalWeeks >= 4 && !acwrDeload)
    ? applyPLTaper(weeks, totalWeeks)
    : weeks;

  const taperNote = taperedWeeks !== weeks ? ' 📉 Taper: финальные 2 нед — объём ×0.65/0.45, интенсивность сохранена (Bosquet 2005).' : '';

  return { template, progressionRationale: proRationale + taperNote, weeks: taperedWeeks, cycleMetrics, plVolumeLandmarks: getPLVolumeLandmarks(taperedWeeks, template.meta.level, combinedMrvMult) };
}

/**
 * PL Taper: снижение объёма (сетов) к финальным 2 неделям цикла (peaking phase).
 * Интенсивность (вес) сохраняется — снижается только объём (Bosquet 2005, Bosquet et al.).
 * Неделя N-1: объём ×0.65; неделя N: объём ×0.45. RIR растёт на 1-2.
 */
function applyPLTaper(weeks: LMSPlanWeek[], totalWeeks: number): LMSPlanWeek[] {
  if (weeks.length < 4) return weeks;
  const lastIdx = weeks.length - 1;
  const prevIdx = lastIdx - 1;
  if (prevIdx < 0) return weeks;

  const weekVolume = (wk: LMSPlanWeek): number => {
    let v = 0;
    for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
    return v;
  };
  const refVolume = prevIdx > 0 ? weekVolume(weeks[prevIdx - 1]) : 0;

  return weeks.map((wk, idx) => {
    if (idx !== prevIdx && idx !== lastIdx) return wk;
    // Guard: если неделя уже low-volume (< 60% от предыдущей) — не применять taper.
     if (mesocyclePhaseForWeek(wk.week, totalWeeks) === 'deload') return wk;
     if (refVolume > 0 && weekVolume(wk) < refVolume * 0.6) return wk;
    const volumeMult = idx === prevIdx ? 0.65 : 0.45;
    const rirAdd = idx === prevIdx ? 1 : 2;
    const newDays = wk.days.map(d => ({
      ...d,
      exercises: d.exercises.map(e => ({
        ...e,
        workSets: e.workSets.map(ws => ({
          ...ws,
          sets: Math.max(1, Math.round(ws.sets * volumeMult)),
          rir: ws.rir + rirAdd,
        })),
      })),
    }));
    for (const d of newDays) {
      const metricsEx: SRExercise[] = d.exercises.map(pe => ({
        name: pe.name, group: pe.group, coef: pe.coef, mnosz: pe.mnosz, pm: pe.pm,
        sets: pe.workSets.map(ws => ({ weight: ws.weight, reps: ws.reps, sets: ws.sets })),
      }));
      d.metrics = calcSessionMetrics(metricsEx);
    }
    return { ...wk, days: newDays };
  });
}


function calcCycleMetricsAggregate(sessions: SRExercise[][], weeksCount: number): SRCycleMetrics {
  const perSession = sessions.map(s => calcSessionMetrics(s));
  let tonnage = 0, kpsh = 0, relIntWeighted = 0, intFB = 0, uoiNum = 0;
  for (const s of perSession) {
    tonnage += s.tonnage; kpsh += s.kpsh;
    relIntWeighted += s.relIntensity * s.kpsh; intFB += s.intFB; uoiNum += s.uoi * s.kpsh;
  }
  return {
    tonnage, kpsh,
    avgWeight: kpsh > 0 ? tonnage / kpsh : 0,
    relIntensity: kpsh > 0 ? relIntWeighted / kpsh : 0,
    intFB,
    uoi: kpsh > 0 ? uoiNum / kpsh : 0,
    sessions: perSession.length,
    perSession,
  };
}

/**
 * Агрегация объёма PL-плана по группам мышц и сравнение с volume-landmarks (MEV/MAV/MRV).
 * Берётся пиковая по суммарному объёму неделя (наиболее нагруженная) — «худший случай».
 */
export function getPLVolumeLandmarks(weeks: LMSPlanWeek[], level: string, pedMrvMult = 1): PLVolumeLandmark[] {
  let peakIdx = 0, peakTotal = -1;
  const weekGroups: Record<number, Record<string, number>> = {};
  weeks.forEach((wk, i) => {
    const g: Record<string, number> = {};
    for (const day of wk.days) for (const ex of day.exercises) {
      const eg = exEnGroup(ex.group); if (!eg) continue;
      const sets = ex.workSets.reduce((s, ws) => s + ws.sets, 0);
      g[eg] = (g[eg] || 0) + sets;
    }
    weekGroups[i] = g;
    const total = Object.values(g).reduce((a, b) => a + b, 0);
    if (total > peakTotal) { peakTotal = total; peakIdx = i; }
  });
  const peak = weekGroups[peakIdx] || {};
  // Делегируем в канонический движок (единый источник MEV/MAV/MRV по EN-мышцам).
  const rows = computeVolumeLandmarks(peak, level, { labMult: pedMrvMult, peakWeek: peakIdx + 1 });
  return rows.map(r => {
    const status: PLVolumeLandmark['status'] =
      r.status === 'below_mev' ? 'under' :
      r.status === 'optimal' ? 'optimal' :
      r.status === 'approaching_mrv' ? 'high' : 'over';
    return { group: r.group, muscle: r.label, peakWeek: r.peakWeek ?? (peakIdx + 1), sets: r.sets, mev: r.mev, mav: r.mav, mrv: r.mrv, status };
  });
}
  // OHP варианты ('Жим стоя', 'Жим штанги стоя', 'Жим гантелей стоя') ловятся через norm('Жим') вхождением в любое 'Жим ... стоя'.

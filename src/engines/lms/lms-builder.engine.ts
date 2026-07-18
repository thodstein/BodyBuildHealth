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

import { computeVolumeLandmarks, getVolumeLandmarks } from '../volume-landmarks.engine';

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

/** Группа (английский ключ) основного лифта — для MRV soft-cap внедряемого аксессуара. */
function liftToEnGroup(lift: Lift): string {
  const m: Record<string, string> = { bench: 'chest', squat: 'legs', deadlift: 'back', ohp: 'shoulders', row: 'back', pulldown: 'back', incline_press: 'chest' };
  return m[lift] || 'back';
}

/** Извлечь уникальные имена упражнений из шаблона (все недели, если заданы явно). */
export function extractExercises(tpl: SRCycleTemplate): string[] {
  const set = new Set<string>();
  const source = tpl.weeks && tpl.weeks.length ? tpl.weeks.flat() : tpl.week1;
  for (const day of source) for (const ex of day.exercises) set.add(ex.name);
  return [...set];
}

function norm(s: string): string { return s.toLowerCase().replace(/ё/g, 'е'); }

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

/** Группа (английский ключ) упражнения по каталогу + фолбэк на тег шаблона. */
function groupOfExercise(name: string, fallback: string): string {
  const ex = EXERCISE_CATALOG.find(e => norm(e.name) === norm(name));
  if (ex?.group) return ex.group as string;
  // fuzzy match
  const n = norm(name);
  const fx = EXERCISE_CATALOG.find(e => {
    const en = norm(e.name);
    return en.length > 2 && (en.includes(n) || n.includes(en));
  });
  if (fx?.group) return fx.group as string;
  return fallback;
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
  return base.assistance.map(a => ({ name: a, pct }));
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
  pedMrvMult: number,
): void {
  const mainNameMap: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга', ohp: 'Жим стоя', row: 'Тяга', pulldown: 'Тяга', incline_press: 'Жим гантелей' };
  const MAX_CORRECTIONS = 2;
  for (const wp of weakPoints) {
    const mainName = mainNameMap[wp.lift] || 'Жим';
    let hostDayIdx = -1;
    let maxMainSets = -1;
    for (let i = 0; i < days.length; i++) {
      const mainSets = days[i].exercises
        .filter(e => norm(e.name) === norm(mainName))
        .reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
      if (mainSets > maxMainSets) { maxMainSets = mainSets; hostDayIdx = i; }
    }
    if (hostDayIdx < 0) hostDayIdx = 0;
    const hostDay = days[hostDayIdx];
    const existing = new Set(hostDay.exercises.map(e => norm(e.name)));
    const liftGroup = liftToEnGroup(wp.lift);
    const corrections = collectPLCorrections(wp.lift, wp.weakPoint).slice(0, MAX_CORRECTIONS);
    for (const c of corrections) {
      const ex = findCatalogExerciseByLabel(c.name);
      const resolvedName = ex ? ex.name : c.name;
      if (existing.has(norm(resolvedName))) continue;
      const exGroup = ex ? (ex.group as string) : liftGroup;
      const sets = Math.max(2, Math.round(3 * phaseVolMod));
      const pm = pmRow[resolvedName] ?? pmRow[mainName] ?? 80;
      // MRV soft-cap: считаем только упражнения, реально присутствующие в каталоге
      const ref = getVolumeLandmarks(vrLevel, exGroup);
      if (ref) {
        let cur = 0;
        for (const d of days) {
          for (const e of d.exercises) {
            const eg = groupOfExercise(e.name, '');
            if (eg === exGroup) {
              cur += e.workSets.reduce((x, ws) => x + ws.sets, 0);
            }
          }
        }
        if (cur + sets > Math.round(ref.mrv * pedMrvMult)) continue;
      }
      hostDay.exercises.push({
        name: resolvedName,
        group: exGroup,
        coef: 0.7,
        mnosz: 1,
        load: 'Средняя',
        pm,
        rir: rirBase,
        workSets: [{ pct: c.pct, reps: 8, sets: Math.max(1, sets), weight: workWeight(pm, c.pct), rir: rirBase }],
      });
      existing.add(norm(resolvedName));
    }
  }
}

export function buildLMSPlan(input: LMSBuildInput): LMSBuildOutput {
  const { template, pmMap, fallbackPm = 100 } = input;
  const mode = input.mode ?? 'natural';
  const exercises = extractExercises(template);

  // Faithful multi-week: если задана явная раскладка ВСЕХ недель — используем её
  // дословно, БЕЗ авто-прогрессии (pct каждой недели уже отражает реальную нагрузку).
  const hasExplicitWeeks = !!(template.weeks && template.weeks.length);
  const totalWeeks = hasExplicitWeeks
    ? template.weeks!.length
    : Math.max(1, Math.round(input.weeksOverride ?? template.meta.weeks));

  const pm0Map: Record<string, number> = {};
  for (const name of exercises) pm0Map[name] = pmFor(name, pmMap, fallbackPm);

  // прогрессия PM для каждого упражнения
  const progInput: PMProgressionInput = {
    pm0: 100, weeks: totalWeeks, mode,
    weeklyPercent: input.weeklyPercent, courseIntensity: input.courseIntensity,
  };
  const rationale = hasExplicitWeeks
    ? 'Программа задана дословно по источнику (явная раскладка всех недель, без авто-прогрессии PM).'
    : progressionRationale({ ...progInput, pm0: 100 });

  const goalKey = rirGoalKey(template.meta.period);
  const levelKey = rirLevelKey(template.meta.level);
  const vrLevel = vrLevelKey(template.meta.level);
  const pedMrvMult = input.mode === 'on_course'
    ? (input.courseIntensity === 'heavy' ? 1.35 : input.courseIntensity === 'moderate' ? 1.25 : 1.15)
    : 1;

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
        pmRow[name] = pm0Map[name] * Math.pow(1 + k, w);
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
            sets = Math.round(sets * vMult * phaseVolMod);
          }
          // Акцент по focusLift: +20% объёма для ВСЕХ упражнений целевого лифта (включая основной).
          // focusLift задан по-английски (UI) → маппим в RU-подстроку имени.
          const focusRu = input.focusLift ? FOCUS_RU[input.focusLift] : undefined;
          const focusMult = (focusRu && norm(spec.name).includes(focusRu)) ? 1.2 : 1.0;
          sets = Math.round(sets * focusMult);

          // Акцент по слабым группам мышц: +20% объёма для упражнений на отстающие группы.
          const weakEn = exEnGroup(spec.group);
          const weakMult = (input.weakPoints && weakEn && input.weakPoints.includes(weakEn)) ? 1.2 : 1.0;
          sets = Math.round(sets * weakMult);

          // S-MRV floor: аксессуары не ниже 2 подходов (иначе < MEV — бесполезный объём)
          sets = Math.max(isMain ? 1 : 2, sets);

          return {
            pct: s.pct, reps: s.reps, sets: Math.max(1, sets),
            weight: workWeight(pm, s.pct),
            rir: rirBase,
          };
        });

        // Проверка S-MRV: срезаем аксессуары, чтобы влезть в бюджет утомления
        const fatigueCost = EXERCISE_CATALOG.find(e => e.name === spec.name)?.fatigueCost || 5;
        const exCost = fatigueCost * (workSets[0]?.sets || 1);
        if (dayFatigueBudget < exCost && !isMain) {
          const fit = Math.max(2, Math.floor(dayFatigueBudget / fatigueCost));
          workSets.forEach(ws => { ws.sets = Math.min(ws.sets, fit); });
        }
        dayFatigueBudget -= fatigueCost * (workSets[0]?.sets || 1);

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
      injectPLWeakPoints(days, input.plWeakPoints, pmRow, rirBase, phaseVolMod, vrLevel, pedMrvMult);
    }

    // Инъекция изолирующих упражнений для слабых групп мышц (+1 упражнение на группу)
    if (input.weakPoints && input.weakPoints.length) {
      const allWeekNames = new Set(days.flatMap(d => d.exercises.map(e => norm(e.name))));
      for (const wg of input.weakPoints) {
        const candidates = getExercisesByGroup(wg)
          .filter((ex: Exercise) => !allWeekNames.has(norm(ex.name)));
        if (candidates.length === 0) continue;
        const pick = candidates[0];
        // найти день с наименьшим объёмом этой группы
        let bestDay = days[0];
        let bestCnt = Infinity;
        for (const d of days) {
          const cnt = d.exercises.filter(e => {
            const g = groupOfExercise(e.name, exEnGroup(e.group) || '');
            return g === wg;
          })
            .reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0);
          if (cnt < bestCnt) { bestCnt = cnt; bestDay = d; }
        }
        const wPm = pmRow[pick.name] ?? 80;
        bestDay.exercises.push({
          name: pick.name,
          group: wg,
          coef: 0.5,
          mnosz: 1,
          load: 'Средняя',
          pm: wPm,
          rir: rirBase,
          workSets: [{ pct: 0.65, reps: 12, sets: 3, weight: workWeight(wPm, 0.65), rir: rirBase }],
        });
        allWeekNames.add(norm(pick.name));
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
  ].filter(Boolean).join(' ');

  return { template, progressionRationale: proRationale, weeks, cycleMetrics, plVolumeLandmarks: getPLVolumeLandmarks(weeks, template.meta.level, pedMrvMult) };
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
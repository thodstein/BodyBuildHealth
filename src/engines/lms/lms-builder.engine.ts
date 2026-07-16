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
import { selectExercisesSmart } from '../exercise-selector.engine';
import { mesocyclePhaseForWeek, RIR_MATRIX, MesoPhaseConfigs, type MesocyclePhase } from '../rir-matrix.engine';
import { diagnoseWeakPoint, type Lift, type WeakPoint } from './weakpoint-pl';

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
const SENT_TO_RU: Record<string, string> = { 'ПР': 'Грудь', 'ЖМ': 'Ноги', 'ТГ': 'Спина' };
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

/**
 * Инъекция ассистентных упражнений по диагностике слабой точки СРЦ-движения.
 * Для каждого {lift, weakPoint} подбираем 1 ассистент из weakpoint-pl, который ещё не
 * присутствует в дне, и добавляем его (3 подхода на %ПМ из DIAGNOSIS) в день, содержащий
 * основной лифт этого движения. Не дублирует уже назначенные упражнения.
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
  for (const wp of weakPoints) {
    const diag = diagnoseWeakPoint(wp.lift, wp.weakPoint);
    if (!diag.assistance.length) continue;
    const target = diag.assistance[0];
    // найти день, содержащий основной лифт (Присед/Жим лежа/Становая тяга/Жим стоя/Тяга/Жим гантелей)
    const mainNameMap: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга', ohp: 'Жим стоя', row: 'Тяга', pulldown: 'Тяга', incline_press: 'Жим гантелей' };
    const mainName = mainNameMap[wp.lift] || 'Жим';
    let hostDay = days.find(d => d.exercises.some(e => norm(e.name).includes(norm(mainName)) || norm(mainName).includes(norm(e.name))));
    if (!hostDay) hostDay = days[0];
    // Предпочитаем ассистент, который реально есть в каталоге упражнений (корректный fatigueCost + лейбл в выполнении)
    const catalogNames = new Set(EXERCISE_CATALOG.map(e => e.name));
    const targetName = diag.assistance.find(n => catalogNames.has(n)) || target;
    if (!hostDay || hostDay.exercises.some(e => norm(e.name) === norm(targetName))) continue;
    const pm = pmRow[targetName] ?? pmRow[mainName] ?? 80;
    const sets = Math.max(2, Math.round(3 * phaseVolMod));
    const pct = diag.intensityPct;
    // MRV soft-cap: не превышаем восстанавливаемый объём группы (auto-циклы)
    const hostGroup = liftToEnGroup(wp.lift);
    if (hostGroup) {
      const ref = getVolumeLandmarks(vrLevel, hostGroup);
      if (ref) {
        const cur = days.reduce((s, d) => s + d.exercises
          .filter(e => exEnGroup(e.group) === hostGroup)
          .reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.sets, 0), 0), 0);
        if (cur + sets > Math.round(ref.mrv * pedMrvMult)) continue;
      }
    }
    const groupMap: Record<string, string> = { bench: 'ПР', squat: 'ЖМ', deadlift: 'ТГ', ohp: 'ПР', row: 'ТГ', pulldown: 'ТГ', incline_press: 'ПР' };
    hostDay.exercises.push({
      name: targetName,
      group: groupMap[wp.lift] || 'ТГ',
      coef: 0.7,
      mnosz: 1,
      load: 'Средняя',
      pm,
      rir: rirBase,
      workSets: [{ pct, reps: 8, sets: Math.max(1, sets), weight: workWeight(pm, pct), rir: rirBase }],
    });
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
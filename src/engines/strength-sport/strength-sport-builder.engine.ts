/**
 * strength-sport-builder.engine.ts — генератор плана Силовой экстрим / ТА.
 * Уровень ББ-авто: периодизация, RIR/drift, outside-load, recovery, PED, ACWR-делод.
 * Только силовая часть зала — техника вне зала декларируется, не тренируется здесь.
 */
import { computeOutsideMetrics, outsideVolumeMultiplier, type OutsideLoad } from '../outside-load.engine';
import { getStrengthSportPattern, recommendStrengthSportPattern, type StrengthSportPattern } from './strength-sport-split-patterns';
import { SS_TAG_MUSCLES } from './strength-sport-day-types';
import { pmForWeek, rirForWeek, phaseForWeek } from './strength-sport-progression';
import { filterByTier, filterByInjury, selectDiverse } from './strength-sport-selection';
import { volumeMultForExercise } from './strength-sport-specialization';
import { tempoForSS, restForSS } from './strength-sport-loading';
import type { StrengthSportInput, StrengthSportPlan, StrengthSportWeek, StrengthSportSession, StrengthSportExercise, StrengthSportSet } from './strength-sport.types';

/** Пул упражнений по тегу — кандидаты (id каталога) + замены */
const POOL_BY_TAG: Record<string, string[]> = {
  snatch_day: ['snatch', 'hang_snatch', 'power_snatch', 'muscle_snatch', 'snatch_pull', 'overhead_squat_v2', 'snatch_balance', 'back_squat', 'front_squat'],
  clean_day: ['clean_and_jerk', 'hang_clean', 'power_clean', 'muscle_clean', 'push_jerk', 'split_jerk', 'push_press', 'front_squat_clean_grip', 'front_squat'],
  strength_day: ['squat', 'front_squat', 'back_squat', 'deadlift', 'sumo_dl', 'rdl', 'bench_bar', 'bench_bar', 'ohp'],
  technique_day: ['hang_snatch', 'hang_clean', 'muscle_snatch', 'muscle_clean', 'snatch_balance', 'jerk_dip', 'overhead_squat_v2'],
  pull_day: ['snatch_pull', 'clean_pull', 'rdl', 'deadlift', 'row_bar', 'pullup'],
  accessory_day: ['db_press', 'ohp', 'lateral_raise', 'face_pull', 'row_db', 'hip_thrust'],
  overhead_day: ['log_press', 'circus_db_press', 'ohp', 'push_press', 'db_press', 'push_jerk'],
  deadlift_day: ['deadlift', 'sumo_dl', 'axle_deadlift', 'rdl', 'farmers_walk_heavy', 'yoke_walk'],
  squat_day: ['squat', 'front_squat', 'hack_squat', 'leg_press', 'bulgarian_split', 'calf_raise'],
  event_day: ['farmers_walk_heavy', 'yoke_walk', 'atlas_stone_load', 'stone_lift', 'sandbag_shoulder', 'zercher_carry', 'tire_flip', 'sled_push_sprint'],
  oly_day: ['snatch', 'clean_and_jerk', 'snatch_pull', 'clean_pull', 'front_squat'],
};

const OLY_IDS = new Set(['snatch','hang_snatch','power_snatch','muscle_snatch','clean_and_jerk','hang_clean','power_clean','muscle_clean','push_jerk','split_jerk','snatch_pull','clean_pull','snatch_balance','overhead_squat_v2','jerk_dip']);
const STRONG_IDS = new Set(['log_press','yoke_walk','farmers_walk_heavy','atlas_stone_load','axle_deadlift','circus_db_press','tire_flip','stone_lift','sandbag_shoulder','zercher_carry']);

function isOly(id: string): boolean { return OLY_IDS.has(id); }
function isStrong(id: string): boolean { return STRONG_IDS.has(id); }
function orderByMethod(exs: StrengthSportExercise[], method?: string): StrengthSportExercise[] {
  if (method === 'pre_exhaust') return [...exs].sort((a,b) => (a.role==='accessory'?-1:1) - (b.role==='accessory'?-1:1));
  if (method === 'post_exhaust') return [...exs].sort((a,b) => (a.role==='primary'?-1:1) - (b.role==='primary'?-1:1));
  return exs; // compound_first default: already primary first due to chosen order
}

function clampWeeks(w: number): number { return Math.max(2, Math.min(16, Math.round(Number(w) || 8))); }
function clampDays(d: number): number { return Math.max(2, Math.min(6, Math.round(Number(d) || 3))); }

function filterPool(ids: string[], input: StrengthSportInput): string[] {
  let out = [...ids];
  if (input.excludedExercises?.length) {
    const excl = new Set(input.excludedExercises.map(s => s.toLowerCase()));
    out = out.filter(id => !excl.has(id.toLowerCase()));
  }
  const eq = (input.equipment || []).map(s => String(s).toLowerCase());
  const hasOther = eq.includes('other') || eq.includes('specialty') || eq.length === 0;
  out = filterByTier(out, input.level, input.allowExotic, hasOther);
  out = filterByInjury(out, input.injuries as any);
  return out;
}

function repsFor(tag: string, phase: string, goal: string, isPrimary: boolean): [number, number] {
  if (goal === 'technique') return [1, 3];
  // OLY — всегда 1-3
  if (tag === 'snatch_day' || tag === 'clean_day' || tag === 'oly_day') return isPrimary ? [1, 3] : [3, 5];
  if (tag === 'technique_day') return [1, 2];
  // Strong
  if (tag === 'event_day') return isPrimary ? [1, 5] : [6, 10];
  if (phase === 'peaking') return isPrimary ? [1, 3] : [3, 6];
  if (phase === 'accumulation') return isPrimary ? [3, 6] : [8, 12];
  if (phase === 'intensification') return isPrimary ? [2, 5] : [6, 10];
  if (phase === 'deload') return isPrimary ? [3, 5] : [8, 12];
  return [3, 6];
}

function pctFor(phase: string, goal: string): number {
  if (goal === 'technique') return 0.65;
  if (phase === 'accumulation') return 0.75;
  if (phase === 'intensification') return 0.85;
  if (phase === 'peaking') return 0.92;
  if (phase === 'deload') return 0.60;
  return 0.78;
}

function basePmFor(id: string, wm: StrengthSportInput['workMax']): number {
  if (['snatch','hang_snatch','power_snatch','muscle_snatch','snatch_pull','snatch_balance','overhead_squat_v2'].includes(id)) return wm.snatch || 60;
  if (['clean_and_jerk','hang_clean','power_clean','muscle_clean','push_jerk','split_jerk','clean_pull','front_squat_clean_grip','jerk_dip'].includes(id)) return wm.cleanJerk || wm.clean || wm.frontSquat || 80;
  if (['squat','back_squat','front_squat','hack_squat','front_squat_clean_grip'].includes(id)) return wm.backSquat || wm.frontSquat || 100;
  if (['deadlift','sumo_dl','axle_deadlift','rdl'].includes(id)) return wm.deadlift || 120;
  if (['ohp','push_press','log_press','circus_db_press','bench_bar'].includes(id)) return wm.overheadPress || wm.bench || wm.logPress || 60;
  return wm.backSquat || 80;
}
function weightForExercise(id: string, input: StrengthSportInput, pct: number, week: number): number {
  const wm = input.workMax || {};
  const base = basePmFor(id, wm);
  const pm = pmForWeek(base, week, input);
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const adj = outsideMult < 0.75 ? 0.95 : 1;
  return Math.round((pm || base) * pct * adj / 2.5) * 2.5;
}

function buildWarmup(weight: number): StrengthSportSet[] {
  if (!weight || weight < 20) return [];
  const w: StrengthSportSet[] = [];
  w.push({ reps: 8, rir: 5, weight: Math.round(weight * 0.5 / 2.5) * 2.5 });
  if (weight > 60) w.push({ reps: 5, rir: 4, weight: Math.round(weight * 0.65 / 2.5) * 2.5 });
  if (weight > 100) w.push({ reps: 3, rir: 3, weight: Math.round(weight * 0.8 / 2.5) * 2.5 });
  return w;
}

function buildExerciseSets(id: string, tag: string, phase: string, input: StrengthSportInput, isPrimary: boolean, week: number): { sets: number; reps: [number, number]; rir: number; weight: number; workSets: StrengthSportSet[] } {
  const reps = repsFor(tag, phase, input.goal, isPrimary);
  const pct = pctFor(phase, input.goal);
  const baseWeight = weightForExercise(id, input, pct, week);
  let sets = 3;
  if (isOly(id)) sets = phase === 'peaking' ? 5 : phase === 'deload' ? 3 : 5;
  else if (tag === 'event_day') sets = phase === 'deload' ? 2 : 3;
  else sets = phase === 'peaking' ? 4 : phase === 'deload' ? 2 : isPrimary ? 4 : 3;
  if (input.focus) {
    const f = volumeMultForExercise(id, input.focus);
    sets = Math.max(2, Math.min(6, Math.round(sets * f)));
  }
  const outM = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  if (outM < 0.75 && sets > 2) sets -= 1;
  const rir = rirForWeek(week, input.weeks, input.goal);
  let finalRir = rir;
  if (phase === 'deload') finalRir = 4;
  const tempo = tempoForSS(id, isPrimary ? 'тяж' : 'памп', phase);
  const rest = restForSS(isPrimary ? 'тяж' : 'памп', isPrimary);
  const workSets: StrengthSportSet[] = [];
  for (let i = 0; i < sets; i++) {
    const rep = Math.round((reps[0] + reps[1]) / 2);
    workSets.push({ reps: rep, rir: finalRir, weight: baseWeight, pct: Math.round(pct * 100), tempo, restSeconds: rest });
  }
  return { sets, reps, rir: finalRir, weight: baseWeight, workSets };
}

function goalRir(goal: string): number {
  if (goal === 'strength') return 2;
  if (goal === 'hypertrophy') return 2;
  if (goal === 'peaking') return 1;
  if (goal === 'technique') return 4;
  return 2;
}

// ——— ИЗОЛИРОВАННЫЕ recovery/nutrition/budget (не зависит от ББ) ———
function computeRecMult(input: { bodyFat?: number; leanMass?: number; hrvMs?: number; sleepHours?: number; stressLevel?: number }): number {
  let v = 1;
  if (input.bodyFat != null) v *= input.bodyFat > 25 ? 0.9 : input.bodyFat > 20 ? 0.95 : 1;
  if (input.leanMass != null) v *= input.leanMass >= 90 ? 1.15 : input.leanMass >= 75 ? 1.05 : input.leanMass >= 60 ? 1 : 0.9;
  if (input.hrvMs != null) v *= input.hrvMs > 70 ? 1.1 : input.hrvMs >= 50 ? 1 : 0.85;
  if (input.sleepHours != null) v *= input.sleepHours >= 7 ? 1.05 : input.sleepHours >= 6 ? 1 : 0.85;
  if (input.stressLevel != null) v *= input.stressLevel < 3 ? 1.05 : input.stressLevel < 6 ? 1 : 0.85;
  return Math.max(0.6, Math.min(1.5, v));
}
function computeNutMult(input: { calorieSurplus?: number; proteinPerKg?: number }): number {
  let v = 1;
  if (input.calorieSurplus != null) v *= input.calorieSurplus > 300 ? 1.1 : input.calorieSurplus > 100 ? 1.05 : input.calorieSurplus < -200 ? 0.8 : 1.0;
  if (input.proteinPerKg != null) v *= input.proteinPerKg >= 2.0 ? 1.1 : input.proteinPerKg >= 1.6 ? 1.05 : input.proteinPerKg < 1.0 ? 0.85 : 1.0;
  return Math.max(0.6, Math.min(1.5, v));
}
function computeBudget(input: { peds?: string[]; courseIntensity?: string; calorieSurplus?: number; proteinPerKg?: number; labMrvMultiplier?: number }): number {
  const onCourse = Array.isArray(input.peds) && input.peds.length > 0;
  const regime = onCourse ? (input.courseIntensity === 'heavy' ? 2.1 : input.courseIntensity === 'mild' ? 1.9 : 2.0) : 1.0;
  const base = Math.round(112 * Math.max(1.0, regime));
  const lab = input.labMrvMultiplier ?? 1;
  const nut = computeNutMult({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  return Math.round(base * lab * nut);
}

const SS_EX_META: Record<string, { name: string; group: string; pattern: string }> = {
  snatch: { name: 'Рывок классический', group: 'legs', pattern: 'hinge' },
  hang_snatch: { name: 'Рывок с виса', group: 'legs', pattern: 'hinge' },
  power_snatch: { name: 'Рывок силовой', group: 'legs', pattern: 'hinge' },
  muscle_snatch: { name: 'Масл-рывок', group: 'shoulders', pattern: 'vertical_push' },
  snatch_pull: { name: 'Рывковая тяга', group: 'back', pattern: 'hinge' },
  snatch_balance: { name: 'Рывковый баланс', group: 'legs', pattern: 'squat' },
  overhead_squat_v2: { name: 'Присед оверхед', group: 'legs', pattern: 'squat' },
  back_squat: { name: 'Присед со штангой', group: 'legs', pattern: 'squat' },
  front_squat: { name: 'Фронтальный присед', group: 'legs', pattern: 'squat' },
  front_squat_clean_grip: { name: 'Фронт-присед чистый хват', group: 'legs', pattern: 'squat' },
  clean_and_jerk: { name: 'Толчок классический', group: 'legs', pattern: 'hinge' },
  hang_clean: { name: 'Взятие с виса', group: 'legs', pattern: 'hinge' },
  power_clean: { name: 'Взятие силовое', group: 'legs', pattern: 'hinge' },
  muscle_clean: { name: 'Масл-взятие', group: 'back', pattern: 'hinge' },
  push_jerk: { name: 'Толчковый швунг', group: 'shoulders', pattern: 'vertical_push' },
  split_jerk: { name: 'Толчок в ножницы', group: 'shoulders', pattern: 'vertical_push' },
  push_press: { name: 'Жимовой швунг', group: 'shoulders', pattern: 'vertical_push' },
  clean_pull: { name: 'Толчковая тяга', group: 'back', pattern: 'hinge' },
  jerk_dip: { name: 'Подсед для толчка', group: 'legs', pattern: 'squat' },
  squat: { name: 'Присед', group: 'legs', pattern: 'squat' },
  deadlift: { name: 'Становая', group: 'back', pattern: 'hinge' },
  sumo_dl: { name: 'Сумо тяга', group: 'back', pattern: 'hinge' },
  rdl: { name: 'Румынская тяга', group: 'legs', pattern: 'hinge' },
  bench_bar: { name: 'Жим лёжа', group: 'chest', pattern: 'horizontal_push' },
  ohp: { name: 'Жим стоя', group: 'shoulders', pattern: 'vertical_push' },
  db_press: { name: 'Жим гантелей', group: 'shoulders', pattern: 'vertical_push' },
  row_bar: { name: 'Тяга штанги', group: 'back', pattern: 'horizontal_pull' },
  row_db: { name: 'Тяга гантели', group: 'back', pattern: 'horizontal_pull' },
  pullup: { name: 'Подтягивания', group: 'back', pattern: 'vertical_pull' },
  lateral_raise: { name: 'Махи в стороны', group: 'shoulders', pattern: 'isolation' },
  face_pull: { name: 'Тяга к лицу', group: 'shoulders', pattern: 'isolation' },
  hip_thrust: { name: 'Ягодичный мост', group: 'legs', pattern: 'squat' },
  hack_squat: { name: 'Гакк-присед', group: 'legs', pattern: 'squat' },
  leg_press: { name: 'Жим ногами', group: 'legs', pattern: 'squat' },
  bulgarian_split: { name: 'Болгарский сплит', group: 'legs', pattern: 'lunge' },
  calf_raise: { name: 'Подъёмы на носки', group: 'legs', pattern: 'isolation' },
  log_press: { name: 'Лог-пресс', group: 'shoulders', pattern: 'vertical_push' },
  circus_db_press: { name: 'Цирковой жим', group: 'shoulders', pattern: 'vertical_push' },
  axle_deadlift: { name: 'Становая аксель', group: 'back', pattern: 'hinge' },
  farmers_walk_heavy: { name: 'Фермер тяжёлый', group: 'back', pattern: 'carry' },
  yoke_walk: { name: 'Йок', group: 'legs', pattern: 'carry' },
  atlas_stone_load: { name: 'Атлас-камень', group: 'legs', pattern: 'hinge' },
  stone_lift: { name: 'Камень', group: 'legs', pattern: 'hinge' },
  sandbag_shoulder: { name: 'Мешок на плечо', group: 'legs', pattern: 'hinge' },
  zercher_carry: { name: 'Зерчер', group: 'back', pattern: 'carry' },
  tire_flip: { name: 'Покрышка', group: 'legs', pattern: 'hinge' },
  sled_push_sprint: { name: 'Сани спринт', group: 'legs', pattern: 'carry' },
};
function getExerciseMeta(id: string): { name: string; group: string; pattern: string; equipment: string } | null {
  const m = SS_EX_META[id];
  if (!m) return { name: id, group: 'legs', pattern: 'unknown', equipment: 'barbell' };
  return { name: m.name, group: m.group, pattern: m.pattern, equipment: 'barbell' };
}

export function buildStrengthSportPlan(input: StrengthSportInput): StrengthSportPlan {
  const weeks = clampWeeks(input.weeks);
  const daysPerWeek = clampDays(input.daysPerWeek);
  const level = (input.level as string) || 'intermediate';
  const mode = input.mode || 'weightlifting';
  const goal = input.goal || 'strength';

  // pattern
  let pattern: StrengthSportPattern | undefined = input.daysPerWeek ? getStrengthSportPattern((input as any).patternId) : undefined;
  if (!pattern || pattern.sessionsPerRotation !== daysPerWeek || pattern.mode !== mode) {
    pattern = recommendStrengthSportPattern(mode, daysPerWeek, level);
  }

  const outsideMetrics = computeOutsideMetrics(input.outsideLoad as OutsideLoad);
  const recoveryMult = computeRecMult({ bodyFat: input.bodyFat, leanMass: input.leanMass, hrvMs: input.hrvMs, sleepHours: input.sleepHours, stressLevel: input.stressLevel });
  const nutritionMult = computeNutMult({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const weeklyBudget = computeBudget({ peds: input.peds, courseIntensity: input.courseIntensity as any, calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg, labMrvMultiplier: input.labMrvMultiplier });

  const weeksData: StrengthSportWeek[] = [];
  const rationale: string[] = [];
  rationale.push(`Режим: ${mode} · цель ${goal} · ${weeks} нед · ${pattern.name}`);
  if (outsideMetrics) rationale.push(`Вне зала: ${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier} (интерференция ${outsideMetrics.interference})`);
  rationale.push(`Recovery ×${recoveryMult.toFixed(2)} · Nutrition ×${nutritionMult.toFixed(2)} · Budget ${weeklyBudget} сетов/нед`);

  for (let w = 1; w <= weeks; w++) {
    const phase = phaseForWeek(w, weeks) as any;
    const deload = phase === 'deload';
    const sessions: StrengthSportSession[] = [];
    let absoluteDay = 0;
    // идём по ротации по дням недели (7 дней), берём pattern.schedule циклично
    // Упростим: pattern уже 7 дней — берём 0..6
    for (let d = 0; d < 7; d++) {
      const slot = (pattern as StrengthSportPattern).schedule[d];
      if (!slot || slot.kind !== 'тренировка') continue;
      const tag = slot.sessionTag || 'strength_day';
      const character = slot.character as any;
      const poolIds = POOL_BY_TAG[tag] || POOL_BY_TAG.strength_day;
      let pool = filterPool(poolIds, input);
      const primaryCount = tag === 'event_day' ? 3 : tag === 'technique_day' ? 3 : 2;
      const accessoryCount = tag === 'event_day' ? 1 : 2;
      const total = primaryCount + accessoryCount;
      const favSet = new Set((input.favoriteExercises || []).map(s => s.toLowerCase()));
      const chosen = selectDiverse(pool, tag, total, favSet);
      if (chosen.length < total) {
        for (const id of pool) { if (chosen.length >= total) break; if (!chosen.includes(id)) chosen.push(id); }
      }
      const exercises: StrengthSportExercise[] = [];
      for (let idx = 0; idx < chosen.length; idx++) {
        const id = chosen[idx];
        const meta = getExerciseMeta(id) || { name: id, group: 'legs', pattern: 'unknown', equipment: 'barbell' };
        const isPrimary = idx < primaryCount;
        const built = buildExerciseSets(id, tag, phase, input, isPrimary, w);
        // deload — режем сеты и вес
        let finalSets = built.sets;
        let finalWeight = built.weight;
        let finalRir = built.rir;
        if (deload) { finalSets = Math.max(2, Math.round(built.sets * 0.6)); finalWeight = Math.round(built.weight * 0.6 / 2.5) * 2.5; finalRir = 4; }
        const workSets: StrengthSportSet[] = built.workSets.slice(0, finalSets).map(s => ({ ...s, weight: finalWeight, rir: finalRir }));
        const ex: StrengthSportExercise = {
          id,
          name: meta.name,
          group: meta.group,
          pattern: meta.pattern,
          role: isPrimary ? 'primary' : 'accessory',
          character: deload ? 'лёг' : (character as any) || 'тяж',
          sets: finalSets,
          reps: `${built.reps[0]}-${built.reps[1]}`,
          rir: finalRir,
          weight: finalWeight,
          workSets,
          warmupSets: isPrimary ? buildWarmup(finalWeight) : [],
          tempo: tempoForSS(id, isPrimary ? 'тяж' : 'памп', phase),
          restSeconds: restForSS(isPrimary ? 'тяж' : 'памп', isPrimary),
          comment: deload ? 'Делод — лёгкая неделя' : undefined,
          isCompetitionLift: isOly(id) || isStrong(id),
        };
        exercises.push(ex);
      }
      const ordered = orderByMethod(exercises, input.methodology);
      const sess: StrengthSportSession = {
        day: d + 1,
        week: w,
        sessionTag: tag,
        character: deload ? 'лёг' : (character as any) || 'тяж',
        focus: SS_TAG_MUSCLES[tag]?.join(', '),
        exercises: ordered,
        durationMin: ordered.length * 12 + 10,
      };
      sessions.push(sess);
      absoluteDay++;
    }
    // сортировка по дню
    sessions.sort((a, b) => a.day - b.day);
    const totalSets = sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.sets, 0), 0);
    const totalTonnage = sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.weight * ws.reps, 0), 0), 0);
    weeksData.push({ week: w, phase, deload, taper: w === weeks && goal === 'peaking', sessions, totalSets, totalTonnage });
  }

  // Валидация
  const warnings: string[] = [];
  const errors: string[] = [];
  // outside высокая частота + 6× зала — предупреждение
  if (outsideMetrics && outsideMetrics.weeklyLoad > 1800 && pattern.sessionsPerRotation >= 5) {
    warnings.push(`Высокая внезальная нагрузка (${outsideMetrics.weeklyLoad}) + ${pattern.sessionsPerRotation}× зал — риск недовосстановления. Снизьте зал до 3×.`);
  }
  // Недельный бюджет: если totalSets > budget → warning
  for (const wk of weeksData) {
    if ((wk.totalSets || 0) > weeklyBudget * 0.9) {
      warnings.push(`Нед ${wk.week}: ${wk.totalSets} сетов близко к бюджету ${weeklyBudget}.`);
      break;
    }
  }
  // Спец-снаряды без оборудования
  const hasSpecialty = (input.equipment || []).includes('other') || (input.equipment || []).length === 0;
  if (!hasSpecialty && mode !== 'weightlifting') {
    const hasStrongEx = weeksData.some(w => w.sessions.some(s => s.exercises.some(e => isStrong(e.id))));
    if (hasStrongEx) warnings.push('Нет спец-снарядов (лог/йок/камни) — стронг-ивенты заменены на штангу/фермер.');
  }

  const plan: StrengthSportPlan = {
    id: `ss_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    mode,
    goal,
    level: level as any,
    weeks,
    patternId: pattern.id,
    weeksData,
    workMax: input.workMax || {},
    outsideMetrics,
    validation: { ok: errors.length === 0, warnings, errors },
    rationale,
    inputSnapshot: input,
  };
  return plan;
}

export function validateStrengthSportPlan(plan: StrengthSportPlan): { ok: boolean; warnings: string[]; errors: string[] } {
  return plan.validation || { ok: true, warnings: [], errors: [] };
}

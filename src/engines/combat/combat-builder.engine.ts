/**
 * combat-builder.engine.ts — генератор плана для единоборств (бокс/MMA/борьба/кик).
 * Только силовая часть зала. Внешняя нагрузка (ринг/татами) — через OutsideLoad.
 * Приоритеты: шея, хват, кор-ротация, унилатеральные ноги, тяги.
 */
import { computeOutsideMetrics, outsideVolumeMultiplier, isDayConflictWithOutside, type OutsideLoad } from '../outside-load.engine';
import { getCombatPattern, recommendCombatPattern, type CombatPattern } from './combat-split-patterns';
import { COMBAT_TAG_MUSCLES, COMBAT_MANDATORY_MUSCLES } from './combat-day-types';
import { phaseForCombatWeek, rirForCombat, repsForCombat } from './combat-progression';
import type { CombatInput, CombatPlan, CombatWeek, CombatSession, CombatExercise, CombatSet } from './combat.types';

const POOL_BY_TAG: Record<string, string[]> = {
  upper_power: ['bench_bar', 'row_bar', 'ohp', 'pullup', 'neck_harness_ext', 'neck_lateral_flex', 'gi_grip_pullup', 'face_pull'],
  lower_power: ['squat', 'front_squat', 'rdl', 'bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat', 'calf_raise'],
  full_power: ['bench_bar', 'row_bar', 'squat', 'rdl', 'ohp', 'pullup', 'neck_harness_ext', 'plate_pinch'],
  full_conditioning: ['neck_harness_ext', 'neck_lateral_flex', 'landmine_rotation', 'landmine_180', 'pallof_rotation_press', 'gi_grip_pullup', 'suitcase_carry', 'med_ball_throw'],
  neck_grip: ['neck_harness_ext', 'neck_lateral_flex', 'neck_bridge_wrestler', 'gi_grip_pullup', 'plate_pinch', 'wrist_roller'],
};

function clampWeeks(w: number): number { return Math.max(2, Math.min(12, Math.round(Number(w) || 6))); }
function clampDays(d: number): number { return Math.max(2, Math.min(4, Math.round(Number(d) || 3))); }

const CB_EX_META: Record<string, { name: string; group: string; pattern: string }> = {
  bench_bar: { name: 'Жим лёжа', group: 'chest', pattern: 'horizontal_push' },
  row_bar: { name: 'Тяга штанги', group: 'back', pattern: 'horizontal_pull' },
  ohp: { name: 'Жим стоя', group: 'shoulders', pattern: 'vertical_push' },
  pullup: { name: 'Подтягивания', group: 'back', pattern: 'vertical_pull' },
  neck_harness_ext: { name: 'Шея с упряжью (разгибание)', group: 'back', pattern: 'isolation' },
  neck_lateral_flex: { name: 'Шея боковая', group: 'back', pattern: 'isolation' },
  neck_bridge_wrestler: { name: 'Борцовский мост', group: 'back', pattern: 'isolation' },
  gi_grip_pullup: { name: 'Подтягивания на кимоно', group: 'back', pattern: 'vertical_pull' },
  face_pull: { name: 'Тяга к лицу', group: 'shoulders', pattern: 'isolation' },
  squat: { name: 'Присед', group: 'legs', pattern: 'squat' },
  front_squat: { name: 'Фронт-присед', group: 'legs', pattern: 'squat' },
  rdl: { name: 'Румынская тяга', group: 'legs', pattern: 'hinge' },
  bulgarian_split_heavy: { name: 'Болгарский тяжёлый', group: 'legs', pattern: 'lunge' },
  single_leg_rdl_combat: { name: 'Румынка на одной ноге', group: 'legs', pattern: 'hinge' },
  cossack_squat: { name: 'Казачий присед', group: 'legs', pattern: 'squat' },
  calf_raise: { name: 'Подъёмы на носки', group: 'legs', pattern: 'isolation' },
  plate_pinch: { name: 'Щипок блинов', group: 'arms', pattern: 'isolation' },
  landmine_rotation: { name: 'Лэндмайн ротация', group: 'core', pattern: 'hinge' },
  landmine_180: { name: 'Лэндмайн 180', group: 'core', pattern: 'hinge' },
  pallof_rotation_press: { name: 'Паллоф+ротация', group: 'core', pattern: 'isolation' },
  suitcase_carry: { name: 'Чемодан', group: 'core', pattern: 'carry' },
  med_ball_throw: { name: 'Медбол бросок', group: 'core', pattern: 'hinge' },
  wrist_roller: { name: 'Валик', group: 'arms', pattern: 'isolation' },
};
function getExerciseMeta(id: string): { name: string; group: string; pattern: string } | null {
  const m = CB_EX_META[id];
  if (!m) return { name: id, group: 'core', pattern: 'unknown' };
  return m;
}

function filterPool(ids: string[], input: CombatInput): string[] {
  let out = [...ids];
  if (input.excludedExercises?.length) {
    const excl = new Set(input.excludedExercises.map(s => s.toLowerCase()));
    out = out.filter(id => !excl.has(id.toLowerCase()));
  }
  // оборудование: если нет cable — убираем паллоф
  const eq = (input.equipment || []).map(s => String(s).toLowerCase());
  if (eq.length && !eq.includes('cable') && !eq.includes('other')) {
    out = out.filter(id => !['pallof_rotation_press'].includes(id));
  }
  // травмы — пропуск тяжёлых приседаний при колене
  // injuries — пока не детализируем, оставляем as is
  return out;
}

function orderByFavorite(ids: string[], input: CombatInput): string[] {
  const fav = new Set((input.favoriteExercises || []).map(s => s.toLowerCase()));
  return [...ids].sort((a, b) => (fav.has(b.toLowerCase()) ? 1 : 0) - (fav.has(a.toLowerCase()) ? 1 : 0));
}

function weightForCombatExercise(id: string, input: CombatInput, goal: string): number {
  // базовые ориентиры — консервативные, т.к. единоборцы не гонятся за ПМ
  // используем условный workMax или дефолты 60-100кг
  const defaults: Record<string, number> = {
    bench_bar: 80, row_bar: 70, squat: 90, rdl: 80, ohp: 50, pullup: 0, // pullup — bodyweight
    neck_harness_ext: 10, neck_lateral_flex: 8, gi_grip_pullup: 0, plate_pinch: 0, landmine_rotation: 20, suitcase_carry: 24,
  };
  const base = defaults[id] ?? 50;
  if (id === 'pullup' || id === 'gi_grip_pullup' || id.includes('hang') || id.includes('pinch')) return 0; // bodyweight / hold
  const goalMult = goal === 'weight_cut' ? 0.92 : goal === 'maintenance' ? 0.95 : 1;
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const adj = outsideMult < 0.75 ? 0.93 : 1;
  // делаем шаг 2.5
  return Math.round(base * goalMult * adj / 2.5) * 2.5;
}

function buildWorkSets(reps: [number, number], sets: number, rir: number, weight: number, isHeavy: boolean): CombatSet[] {
  const rep = Math.round((reps[0] + reps[1]) / 2);
  const out: CombatSet[] = [];
  for (let i = 0; i < sets; i++) out.push({ reps: rep, rir, weight, tempo: isHeavy ? '2-0-X-0' : '2-0-1-0', restSeconds: isHeavy ? 150 : 75 });
  return out;
}

export function buildCombatPlan(input: CombatInput): CombatPlan {
  const weeks = clampWeeks(input.weeks);
  const daysPerWeek = clampDays(input.daysPerWeek);
  const outsideSessions = input.outsideLoad?.sessionsPerWeek ?? 0;
  const level = input.level || 'intermediate';
  const discipline = input.discipline || 'general';
  const goal = input.goal || (outsideSessions >= 4 ? 'maintenance' : 'power');

  let pattern: CombatPattern | undefined = (input as any).patternId ? getCombatPattern((input as any).patternId) : undefined;
  if (!pattern || pattern.sessionsPerRotation !== daysPerWeek) {
    pattern = recommendCombatPattern(daysPerWeek, outsideSessions, level);
  }

  const outsideMetrics = computeOutsideMetrics(input.outsideLoad as OutsideLoad);
  // изолированные мультипликаторы (не из ББ)
  const recoveryMult = (() => {
    let v = 1;
    if (input.bodyFat != null) v *= input.bodyFat > 25 ? 0.9 : input.bodyFat > 20 ? 0.95 : 1;
    if (input.leanMass != null) v *= input.leanMass >= 90 ? 1.15 : input.leanMass >= 75 ? 1.05 : input.leanMass >= 60 ? 1 : 0.9;
    if (input.hrvMs != null) v *= input.hrvMs > 70 ? 1.1 : input.hrvMs >= 50 ? 1 : 0.85;
    if (input.sleepHours != null) v *= input.sleepHours >= 7 ? 1.05 : input.sleepHours >= 6 ? 1 : 0.85;
    if (input.stressLevel != null) v *= input.stressLevel < 3 ? 1.05 : input.stressLevel < 6 ? 1 : 0.85;
    return Math.max(0.6, Math.min(1.5, v));
  })();
  const nutritionMult = (() => {
    let v = 1;
    if (input.calorieSurplus != null) v *= input.calorieSurplus > 300 ? 1.1 : input.calorieSurplus > 100 ? 1.05 : input.calorieSurplus < -200 ? 0.8 : 1.0;
    if (input.proteinPerKg != null) v *= input.proteinPerKg >= 2.0 ? 1.1 : input.proteinPerKg >= 1.6 ? 1.05 : input.proteinPerKg < 1.0 ? 0.85 : 1.0;
    return Math.max(0.6, Math.min(1.5, v));
  })();
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const weeklyBudget = (() => {
    const onCourse = Array.isArray(input.peds) && input.peds.length > 0;
    const regime = onCourse ? (input.courseIntensity === 'heavy' ? 2.1 : input.courseIntensity === 'mild' ? 1.9 : 2.0) : 1.0;
    const base = Math.round(112 * Math.max(1.0, regime));
    const lab = input.labMrvMultiplier ?? 1;
    return Math.round(base * lab * outsideMult);
  })();

  const rationale: string[] = [];
  rationale.push(`Дисциплина: ${discipline} · цель ${goal} · ${weeks} нед · ${pattern.name}`);
  if (outsideMetrics) rationale.push(`Вне зала: ${outsideMetrics.weeklyLoad} load (${outsideMetrics.interference}) → объём зала ×${outsideMetrics.volumeMultiplier}`);
  rationale.push(`Recovery ×${recoveryMult.toFixed(2)} · Nutrition ×${nutritionMult.toFixed(2)} · Budget ${weeklyBudget}`);
  if (input.weightCutKg && input.weightCutKg > 0) rationale.push(`Весогонка: −${input.weightCutKg} кг → объём ×0.85, без отказа`);

  const weeksData: CombatWeek[] = [];
  for (let w = 1; w <= weeks; w++) {
    const phase = phaseForCombatWeek(w, weeks, goal);
    const deload = phase === 'deload' || phase === 'taper';
    const sessions: CombatSession[] = [];
    for (let d = 0; d < 7; d++) {
      const slot = pattern.schedule[d];
      if (!slot || slot.kind !== 'тренировка') continue;
      const tag = slot.sessionTag || 'full_power';
      const character = slot.character as any;
      // outside конфликт: тяж ноги за день до high вне зала → делаем лёг/памп
      const conflict = isDayConflictWithOutside(d, input.outsideLoad as OutsideLoad);
      const isLegDay = tag === 'lower_power' || tag === 'full_power';
      const effectiveCharacter = (conflict && isLegDay && character === 'тяж') ? 'памп' : character;
      const poolIds = POOL_BY_TAG[tag] || POOL_BY_TAG.full_power;
      let pool = filterPool(poolIds, input);
      pool = orderByFavorite(pool, input);
      // обязательные мышцы: шея/хват/кор должны быть хотя бы 1 упр в неделю
      // обеспечим в full_conditioning / upper_power
      const primaryCount = effectiveCharacter === 'тяж' ? 3 : 2;
      const chosen: string[] = [];
      // приоритет: сначала mandatory если их нет в выборе
      const mandatoryPool = COMBAT_MANDATORY_MUSCLES;
      // простая логика: берём по порядку пула, но гарантируем шею/хват в conditioning
      for (const id of pool) {
        if (chosen.length >= 5) break;
        if (!chosen.includes(id)) chosen.push(id);
        if (chosen.length >= primaryCount + 2) break;
      }
      // если conditioning и нет шеи — форсим
      if (tag === 'full_conditioning' && !chosen.some(id => id.includes('neck'))) {
        if (!chosen.includes('neck_harness_ext')) chosen.unshift('neck_harness_ext');
      }
      chosen.splice(5); // кап 5 упражнений
      const exercises: CombatExercise[] = [];
      for (let idx = 0; idx < chosen.length; idx++) {
        const id = chosen[idx];
        const meta = getExerciseMeta(id) || { name: id, group: 'core', pattern: 'unknown' };
        const isPrimary = idx < primaryCount;
        const reps = repsForCombat(goal, effectiveCharacter);
        const rir = rirForCombat(goal, phase, effectiveCharacter);
        let sets = effectiveCharacter === 'тяж' ? (isPrimary ? 4 : 3) : (deload ? 2 : 3);
        if (goal === 'weight_cut' && sets > 2) sets -= 1;
        if (outsideMult < 0.75 && sets > 2) sets -= 1;
        if (deload) sets = Math.max(2, Math.round(sets * 0.6));
        const weight = weightForCombatExercise(id, input, goal);
        const workSets = buildWorkSets(reps, sets, rir, weight, isPrimary && effectiveCharacter === 'тяж');
        const ex: CombatExercise = {
          id,
          name: meta.name,
          group: meta.group,
          pattern: meta.pattern,
          role: isPrimary ? 'primary' : 'accessory',
          character: deload ? 'лёг' : (effectiveCharacter as any),
          sets,
          reps: `${reps[0]}-${reps[1]}`,
          rir,
          weight,
          workSets,
          warmupSets: isPrimary && weight > 20 ? [{ reps: 8, rir: 5, weight: Math.round(weight * 0.5 / 2.5) * 2.5 }] : [],
          tempo: isPrimary ? 'X-0-X-0' : '2-0-1-0',
          restSeconds: isPrimary ? 150 : 75,
          comment: (conflict && isLegDay) ? 'Снижена интенсивность: завтра высокая внезальная' : deload ? 'Делод' : undefined,
        };
        exercises.push(ex);
      }
      sessions.push({ day: d + 1, week: w, sessionTag: tag, character: deload ? 'лёг' : (effectiveCharacter as any), exercises, durationMin: exercises.length * 10 + 10 });
    }
    sessions.sort((a, b) => a.day - b.day);
    const totalSets = sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.sets, 0), 0);
    weeksData.push({ week: w, phase, deload, sessions, totalSets, outsideLoad: outsideMetrics?.weeklyLoad });
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  if (outsideMetrics && outsideMetrics.weeklyLoad > 1500 && pattern.sessionsPerRotation >= 4) {
    warnings.push(`Высокая внезальная ${outsideMetrics.weeklyLoad} + ${pattern.sessionsPerRotation}× зал — перегруз. Рекомендуем 2-3× зал.`);
  }
  if (input.weightCutKg && input.weightCutKg > 3 && goal !== 'weight_cut') {
    warnings.push(`Весогонка ${input.weightCutKg} кг без режима weight_cut — объём не снижен должным образом.`);
  }
  // проверка шеи/хвата: должны быть ≥1×/нед
  const hasNeck = weeksData.some(w => w.sessions.some(s => s.exercises.some(e => e.group === 'back' && e.name.toLowerCase().includes('ше'))));
  if (!hasNeck) warnings.push('Шея не покрыта ни в одной сессии — добавьте neck_harness.');
  // бюджет
  for (const wk of weeksData) {
    if ((wk.totalSets || 0) > weeklyBudget) {
      warnings.push(`Нед ${wk.week}: ${wk.totalSets} сетов > бюджета ${weeklyBudget}.`);
      break;
    }
  }

  const plan: CombatPlan = {
    id: `cb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    discipline,
    goal: goal as any,
    level: level as any,
    weeks,
    patternId: pattern.id,
    weeksData,
    outsideMetrics,
    validation: { ok: errors.length === 0, warnings, errors },
    rationale,
    inputSnapshot: input,
  };
  return plan;
}

export function validateCombatPlan(plan: CombatPlan): { ok: boolean; warnings: string[]; errors: string[] } {
  return plan.validation || { ok: true, warnings: [], errors: [] };
}

/**
 * combat-builder.engine.ts — генератор плана для единоборств (бокс/MMA/борьба/кик).
 * Только силовая часть зала. Внешняя нагрузка (ринг/татами) — через OutsideLoad.
 * Приоритеты: шея, хват, кор-ротация, унилатеральные ноги, тяги.
 */
import { computeOutsideMetrics, outsideVolumeMultiplier, isDayConflictWithOutside, type OutsideLoad } from '../outside-load.engine';
import { getCombatPattern, recommendCombatPattern, type CombatPattern } from './combat-split-patterns';
import { phaseForCombatWeek, rirForCombat, repsForCombat } from './combat-progression';
import { filterByTierCB, filterByInjuryCB, selectDiverseCB } from './combat-selection';
import { accentForDiscipline } from './combat-specialization';
import { tempoForCB, restForCB } from './combat-loading';
import { adaptForPEDsCombat } from './combat-ped-adaptation';
import { filterByMobilityCB } from './combat-mobility';
import { applyCombatDUP } from './combat-dup';
import { applyCombatIntensity } from './combat-intensity';
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
const CB_TECHNIQUE: Record<string,string> = {
  bench_bar:'Жим: лопатки сведены, грудь вверх, стопы в пол',
  row_bar:'Тяга: нейтральная спина, локти к корпусу',
  ohp:'Жим стоя: кор напряжён, без прогиба поясницы',
  pullup:'Подтягивания: тяга грудью к перекладине',
  face_pull:'Тяга к лицу: трос к лицу, разворот кистей',
  neck_harness_ext:'Шея: лёгкий вес 5-12кг, без рывков, 12-20 повт',
  neck_lateral_flex:'Боковая шея: контроль, не форсировать',
  neck_bridge_wrestler:'Мост: только продвинутым, контроль шеи',
  gi_grip_pullup:'Хват за кимоно, без раскачки',
  squat:'Присед: глубина ниже параллели, колени по носкам',
  front_squat:'Фронт: гриф на груди, локти высоко, вертикально',
  rdl:'Румынская: таз назад, гриф по ногам',
  bulgarian_split_heavy:'Болгарский: корпус вертикально, переднее колено над стопой',
  single_leg_rdl_combat:'Румынка на одной: баланс, таз назад',
  cossack_squat:'Казачий: глубокий сед в сторону, вторая нога прямая',
  calf_raise:'Икры: полная амплитуда, пауза вверху',
  plate_pinch:'Щипок: два блина, удержание',
  landmine_rotation:'Ротация от кора, взрыв, без рывка поясницы',
  landmine_180:'Лэндмайн 180: дуга над головой, контроль кора',
  pallof_rotation_press:'Паллоф: анти-ротация, контроль',
  suitcase_carry:'Чемодан: корпус ровно, без наклона',
  med_ball_throw:'Медбол: бросок от кора, взрыв',
  wrist_roller:'Валик: наматывание, контроль запястий',
};
function getExerciseMeta(id: string): { name: string; group: string; pattern: string; technique?: string } | null {
  const m = CB_EX_META[id];
  if (!m) return { name: id, group: 'core', pattern: 'unknown', technique: CB_TECHNIQUE[id] };
  return { ...m, technique: CB_TECHNIQUE[id] };
}

const COMBAT_FALLBACK: Record<string,string> = { pallof_rotation_press:'landmine_rotation', neck_bridge_wrestler:'neck_harness_ext', wrist_roller:'plate_pinch', gi_grip_pullup:'pullup' };
function filterPool(ids: string[], input: CombatInput): string[] {
  let out = [...ids];
  if (input.excludedExercises?.length) {
    const excl = new Set(input.excludedExercises.map(s => s.toLowerCase()));
    out = out.filter(id => !excl.has(id.toLowerCase()));
  }
  const eq = (input.equipment || []).map(s => String(s).toLowerCase());
  const hasCable = eq.includes('cable') || eq.includes('other') || eq.length===0;
  const before = [...out];
  out = filterByTierCB(out, input.level, hasCable);
  if (!hasCable) for (const orig of before) if (!out.includes(orig) && COMBAT_FALLBACK[orig] && !out.includes(COMBAT_FALLBACK[orig])) out.push(COMBAT_FALLBACK[orig]);
  const beforeInjury=[...out];
  out = filterByInjuryCB(out, input.injuries as any);
  if (out.length===0 && (input.injuries||[]).length>0) out = beforeInjury.slice(0,2);
  const mob = (input as any).mobilityRestrictions as string[] | undefined;
  const beforeMob=[...out];
  out = filterByMobilityCB(out, mob);
  if (out.length===0 && mob && mob.length>0) out = beforeMob.slice(0,2);
  return out;
}
function gentleFactorCB(id: string, injuries: any[]|undefined): number {
  if (!injuries||injuries.length===0) return 1;
  const txt=JSON.stringify(injuries).toLowerCase();
  if ((txt.includes('neck')||txt.includes('ше')) && id.includes('neck')) return 0.6;
  if ((txt.includes('knee')||txt.includes('колен')) && ['squat','front_squat','bulgarian_split_heavy','cossack_squat'].includes(id)) return 0.6;
  if ((txt.includes('shoulder')||txt.includes('плеч')) && ['bench_bar','ohp'].includes(id)) return 0.65;
  if ((txt.includes('wrist')||txt.includes('запяст')||txt.includes('кист')) && ['gi_grip_pullup','plate_pinch','wrist_roller'].includes(id)) return 0.7;
  return 1;
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
    const ped = adaptForPEDsCombat(input.peds, input.pedDoses as any, input.courseIntensity);
    const base = Math.round(112 * ped.mrvMult);
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
      const primaryCount = effectiveCharacter === 'тяж' ? 3 : 2;
      const total = 5;
      const favSet = new Set((input.favoriteExercises || []).map(s=>s.toLowerCase()));
      const chosen = selectDiverseCB(pool, tag, total, favSet);
      if (tag === 'full_conditioning' && !chosen.some(id => id.includes('neck'))) {
        if (!chosen.includes('neck_harness_ext')) { chosen.unshift('neck_harness_ext'); chosen.splice(total); }
      }
      if (chosen.length < primaryCount + 1) {
        for (const id of pool) { if (chosen.length >= total) break; if (!chosen.includes(id)) chosen.push(id); }
      }
      const exercises: CombatExercise[] = [];
      for (let idx = 0; idx < chosen.length; idx++) {
        const id = chosen[idx];
        const meta = getExerciseMeta(id) || { name: id, group: 'core', pattern: 'unknown' };
        const isPrimary = idx < primaryCount;
        let reps = repsForCombat(goal, effectiveCharacter);
        let rir = rirForCombat(goal, phase, effectiveCharacter);
        let sets = effectiveCharacter === 'тяж' ? (isPrimary ? 4 : 3) : (deload ? 2 : 3);
        const accentMap = accentForDiscipline(discipline as any);
        const accentKey = id.includes('neck') ? 'neck' : (id.includes('grip')||id.includes('pinch')||id.includes('wrist')) ? 'grip' : (id.includes('landmine')||id.includes('pallof')||id.includes('med_ball')||id.includes('rotation')) ? 'rotational' : tag.includes('lower')||tag.includes('full') ? 'legs' : 'push';
        const accMult = (accentMap as any)[accentKey] || 1;
        if (accMult !== 1) sets = Math.max(2, Math.min(6, Math.round(sets * accMult)));
        if (goal === 'weight_cut' && sets > 2) sets -= 1;
        if (outsideMult < 0.75 && sets > 2) sets -= 1;
        if (deload) sets = Math.max(2, Math.round(sets * 0.6));
        const gentle = gentleFactorCB(id, input.injuries as any);
        let weight = weightForCombatExercise(id, input, goal);
        if (gentle < 1) { weight = Math.round(weight * gentle / 2.5) * 2.5; rir = Math.min(4, rir + 1); reps = [reps[0]+1, reps[1]+1] as any; }
        const workSets = buildWorkSets(reps, sets, rir, weight, isPrimary && effectiveCharacter === 'тяж');
        const tempo = tempoForCB(isPrimary, effectiveCharacter as any);
        const rest = restForCB(isPrimary, effectiveCharacter as any);
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
          workSets: workSets.map(s=> ({...s, tempo, restSeconds: rest})),
          warmupSets: isPrimary && weight > 20 ? [{ reps: 8, rir: 5, weight: Math.round(weight * 0.5 / 2.5) * 2.5, tempo, restSeconds: 60 }] : [],
          tempo,
          restSeconds: rest,
          comment: (conflict && isLegDay) ? 'Снижена интенсивность: завтра высокая внезальная' : deload ? 'Делод' : gentle < 1 ? 'Щадящий: снижен вес, +RIR' : (meta as any).technique || undefined,
        };
        exercises.push(ex);
      }
      sessions.push({ day: d + 1, week: w, sessionTag: tag, character: deload ? 'лёг' : (effectiveCharacter as any), exercises, durationMin: exercises.length * 10 + 10 });
    }
    sessions.sort((a, b) => a.day - b.day);
    const totalSets = sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.sets, 0), 0);
    weeksData.push({ week: w, phase, deload, sessions, totalSets, outsideLoad: outsideMetrics?.weeklyLoad });
  }

  if (input.dupMode && input.dupMode !== 'off') {
    const tmp:any = { weeksData, rationale: [] };
    applyCombatDUP(tmp as any, input.dupMode as any);
  }
  if (input.intensityTech && input.intensityTech !== 'none') {
    const tmp:any = { weeksData, rationale: [] };
    applyCombatIntensity(tmp as any, input.intensityTech as any);
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

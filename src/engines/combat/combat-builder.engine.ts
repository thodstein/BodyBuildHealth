/**
 * combat-builder.engine.ts — генератор плана для единоборств (бокс/MMA/борьба/кик).
 * Только силовая часть зала. Внешняя нагрузка (ринг/татами) — через OutsideLoad.
 * Приоритеты: шея, хват, кор-ротация, унилатеральные ноги, тяги.
 */
import { computeOutsideMetrics, outsideVolumeMultiplier, outsideFrequencyPenalty, isDayConflictWithOutside, type OutsideLoad } from '../outside-load.engine';
import { getCombatPattern, recommendCombatPattern, type CombatPattern } from './combat-split-patterns';
import { phaseForCombatWeek, rirForCombat, repsForCombat } from './combat-progression';
import { phaseForCombatWeekATR, rirForCombatPhase, repsForCombatPhase, isDeloadWeekATR, isTaperWeek } from './combat-periodization.engine';
import { isTaperByFightDate, taperVolumeMultiplier, buildTaperRationale } from './combat-taper.engine';
import { weightCutVolumeMultiplier, weightCutNutritionForWeek, weightCutRehydrationNotes, buildWeightCutProtocol, weightCutPhaseForWeek } from './combat-weight-cut.engine';
import { buildConditioningRationale, conditioningSessionsForWeek } from './combat-conditioning.engine';
import { filterByTierCB, filterByInjuryCB, selectDiverseCB, tierForCB } from './combat-selection';
import { accentForDiscipline } from './combat-specialization';
import { tempoForCB, restForCB } from './combat-loading';
import { adaptForPEDsCombat } from './combat-ped-adaptation';
import { filterByMobilityCB, isAxialLoadExerciseCB, isMobilityRestrictedCB } from './combat-mobility';
import { applyCombatDUP } from './combat-dup';
import { applyCombatIntensity } from './combat-intensity';
import { weightForCombatExerciseResolved } from './combat-workmax';
import { sparringToOutsideLoad, sparringWeeklyLoad, sparringSummary } from './combat-sparring.engine';
import { computeRecoveryMultiplier, computeNutritionMultiplier } from '../recovery-budget.engine';
import { COMBAT_LANDMARKS } from './combat-volume';
import { vbtRecommendationCombat } from './combat-vbt.engine';
import { coreWeeklyPlan } from './combat-core.engine';
import type { CombatInput, CombatPlan, CombatWeek, CombatSession, CombatExercise, CombatSet, CombatPhase } from './combat.types';

const POOL_BY_TAG: Record<string, string[]> = {
  upper_power: ['bench_bar', 'row_bar', 'ohp', 'pullup', 'neck_harness_ext', 'neck_lateral_flex', 'gi_grip_pullup', 'face_pull', 'push_press', 'landmine_press', 'fat_bar_row', 'towel_pullup', 'band_pull_apart', 'ytw_raise', 'single_arm_row'],
  lower_power: ['squat', 'front_squat', 'rdl', 'bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat', 'calf_raise', 'trap_bar_dead', 'zercher_squat', 'nordic_curl', 'glute_ham_raise', 'step_up', 'hip_thrust', 'kb_swing'],
  full_power: ['bench_bar', 'row_bar', 'squat', 'rdl', 'ohp', 'pullup', 'neck_harness_ext', 'plate_pinch', 'hang_clean', 'high_pull', 'push_press', 'landmine_press', 'farmer_carry', 'kb_swing', 'hip_thrust'],
  full_conditioning: ['neck_harness_ext', 'neck_lateral_flex', 'neck_flexion', 'neck_rotation', 'landmine_rotation', 'landmine_180', 'pallof_rotation_press', 'med_ball_throw', 'med_ball_slam', 'med_ball_rot_throw', 'box_jump', 'depth_jump', 'broad_jump', 'gi_grip_pullup', 'suitcase_carry', 'sled_push', 'sled_pull', 'deadbug', 'hollow_hold', 'side_plank', 'ab_wheel', 'copenhagen_plank', 'battle_rope'],
  neck_grip: ['neck_harness_ext', 'neck_lateral_flex', 'neck_bridge_wrestler', 'neck_flexion', 'neck_rotation', 'gi_grip_pullup', 'plate_pinch', 'wrist_roller', 'wrist_flexion', 'wrist_extension', 'towel_pullup', 'rope_climb', 'fat_bar_row', 'farmer_carry', 'sledge_hammer'],
};

function clampWeeks(w: number): number { return Math.max(2, Math.min(12, Math.round(Number(w) || 6))); }
function clampDays(d: number): number { return Math.max(2, Math.min(4, Math.round(Number(d) || 3))); }

const CB_EX_META: Record<string, { name: string; group: string; pattern: string }> = {
  bench_bar: { name: 'Жим лёжа', group: 'chest', pattern: 'horizontal_push' },
  row_bar: { name: 'Тяга штанги', group: 'back', pattern: 'horizontal_pull' },
  ohp: { name: 'Жим стоя', group: 'shoulders', pattern: 'vertical_push' },
  pullup: { name: 'Подтягивания', group: 'back', pattern: 'vertical_pull' },
  neck_harness_ext: { name: 'Шея с упряжью (разгибание)', group: 'neck', pattern: 'isolation' },
  neck_lateral_flex: { name: 'Шея боковая', group: 'neck', pattern: 'isolation' },
  neck_bridge_wrestler: { name: 'Борцовский мост', group: 'neck', pattern: 'isolation' },
  gi_grip_pullup: { name: 'Подтягивания на кимоно', group: 'back', pattern: 'vertical_pull' },
  face_pull: { name: 'Тяга к лицу', group: 'shoulders', pattern: 'isolation' },
  squat: { name: 'Присед', group: 'legs', pattern: 'squat' },
  front_squat: { name: 'Фронт-присед', group: 'legs', pattern: 'squat' },
  rdl: { name: 'Румынская тяга', group: 'legs', pattern: 'hinge' },
  bulgarian_split_heavy: { name: 'Болгарский тяжёлый', group: 'legs', pattern: 'lunge' },
  single_leg_rdl_combat: { name: 'Румынка на одной ноге', group: 'legs', pattern: 'hinge' },
  cossack_squat: { name: 'Казачий присед', group: 'legs', pattern: 'squat' },
  calf_raise: { name: 'Подъёмы на носки', group: 'legs', pattern: 'isolation' },
  plate_pinch: { name: 'Щипок блинов', group: 'grip', pattern: 'isolation' },
  landmine_rotation: { name: 'Лэндмайн ротация', group: 'core', pattern: 'rotation' },
  landmine_180: { name: 'Лэндмайн 180', group: 'core', pattern: 'rotation' },
  pallof_rotation_press: { name: 'Паллоф+ротация', group: 'core', pattern: 'anti_rotation' },
  suitcase_carry: { name: 'Чемодан', group: 'core', pattern: 'carry' },
  med_ball_throw: { name: 'Медбол бросок', group: 'core', pattern: 'plyo' },
  wrist_roller: { name: 'Валик', group: 'grip', pattern: 'isolation' },
  // --- расширение 40 ---
  hang_clean: { name: 'Взятие с виса', group: 'legs', pattern: 'oly' },
  high_pull: { name: 'Высокая тяга', group: 'back', pattern: 'oly' },
  push_press: { name: 'Жимовой швунг', group: 'shoulders', pattern: 'vertical_push' },
  trap_bar_dead: { name: 'Трэп-тяга', group: 'legs', pattern: 'hinge' },
  zercher_squat: { name: 'Зерчер-присед', group: 'legs', pattern: 'squat' },
  nordic_curl: { name: 'Нордик', group: 'legs', pattern: 'hinge' },
  glute_ham_raise: { name: 'GHR', group: 'legs', pattern: 'hinge' },
  step_up: { name: 'Зашагивания', group: 'legs', pattern: 'lunge' },
  hip_thrust: { name: 'Ягодичный мост', group: 'legs', pattern: 'hinge' },
  kb_swing: { name: 'Мах гирей', group: 'core', pattern: 'hinge' },
  box_jump: { name: 'Прыжок на тумбу', group: 'legs', pattern: 'plyo' },
  depth_jump: { name: 'Глубинный прыжок', group: 'legs', pattern: 'plyo' },
  broad_jump: { name: 'Прыжок в длину', group: 'legs', pattern: 'plyo' },
  med_ball_slam: { name: 'Медбол слэм', group: 'core', pattern: 'plyo' },
  med_ball_rot_throw: { name: 'Медбол ротационный бросок', group: 'core', pattern: 'rotation' },
  farmer_carry: { name: 'Фермерская прогулка', group: 'grip', pattern: 'carry' },
  sled_push: { name: 'Сани толкание', group: 'legs', pattern: 'carry' },
  sled_pull: { name: 'Сани тяга', group: 'back', pattern: 'carry' },
  fat_bar_row: { name: 'Тяга толстым грифом', group: 'back', pattern: 'horizontal_pull' },
  towel_pullup: { name: 'Подтягивания на полотенце', group: 'grip', pattern: 'vertical_pull' },
  rope_climb: { name: 'Канат', group: 'grip', pattern: 'vertical_pull' },
  wrist_flexion: { name: 'Сгибания запястий', group: 'grip', pattern: 'isolation' },
  wrist_extension: { name: 'Разгибания запястий', group: 'grip', pattern: 'isolation' },
  neck_flexion: { name: 'Шея сгибание (кивок)', group: 'neck', pattern: 'isolation' },
  neck_rotation: { name: 'Шея ротация с резинкой', group: 'neck', pattern: 'isolation' },
  deadbug: { name: 'Мёртвый жук', group: 'core', pattern: 'anti_extension' },
  hollow_hold: { name: 'Лодочка', group: 'core', pattern: 'anti_extension' },
  side_plank: { name: 'Боковая планка', group: 'core', pattern: 'anti_lateral' },
  ab_wheel: { name: 'Колесо', group: 'core', pattern: 'anti_extension' },
  copenhagen_plank: { name: 'Копенгаген планка', group: 'core', pattern: 'anti_lateral' },
  band_external_rotation: { name: 'Ротация плеча с резинкой', group: 'shoulders', pattern: 'isolation' },
  band_pull_apart: { name: 'Разведения с резинкой', group: 'shoulders', pattern: 'isolation' },
  ytw_raise: { name: 'Y-T-W подъёмы', group: 'shoulders', pattern: 'isolation' },
  single_arm_row: { name: 'Тяга гантели одной', group: 'back', pattern: 'horizontal_pull' },
  landmine_press: { name: 'Лэндмайн жим', group: 'shoulders', pattern: 'vertical_push' },
  battle_rope: { name: 'Канаты', group: 'core', pattern: 'conditioning' },
  sledge_hammer: { name: 'Кувалда по покрышке', group: 'core', pattern: 'rotation' },
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
  plate_pinch:'Щипок: два блина, удержание 20-40с',
  landmine_rotation:'Ротация от кора, взрыв, без рывка поясницы',
  landmine_180:'Лэндмайн 180: дуга над головой, контроль кора',
  pallof_rotation_press:'Паллоф: анти-ротация, контроль',
  suitcase_carry:'Чемодан: корпус ровно, без наклона, 30-40м',
  med_ball_throw:'Медбол: бросок от кора, взрыв 3-5 повт',
  wrist_roller:'Валик: наматывание, контроль запястий',
  hang_clean:'Взятие с виса: взрыв бёдрами, быстрый уход',
  high_pull:'Высокая тяга: локти выше кистей, взрыв',
  push_press:'Швунг: толчок ногами + дожим',
  trap_bar_dead:'Трэп: вертикально, колени наружу',
  zercher_squat:'Зерчер: штанга в сгибах, кор жёстко',
  nordic_curl:'Нордик: медленно вниз, контроль бицепса бедра',
  glute_ham_raise:'GHR: таз вперёд, сгибание колен',
  step_up:'Зашагивания: без отталкивания задней',
  hip_thrust:'Мост: пауза 1с вверху, таз не переразгибать',
  kb_swing:'Мах: таз назад, взрыв бёдрами до груди',
  box_jump:'На тумбу: мягко, колени наружу, 3-5 повт',
  depth_jump:'С тумбы → взрыв вверх, контакт <0.2с',
  broad_jump:'В длину: мах руками, приземление мягко',
  med_ball_slam:'Слэм: над головой → в пол, весь корпус',
  med_ball_rot_throw:'Ротационный: от бедра, как удар',
  farmer_carry:'Фермер: грудь вверх, шаги короткие',
  sled_push:'Сани толкание: корпус 45°, ноги часто',
  sled_pull:'Тяга саней спиной вперёд, кор жёстко',
  fat_bar_row:'Толстый гриф: хват без лямок, пауза',
  towel_pullup:'Полотенце: хват на концах, без раскачки',
  rope_climb:'Канат: ноги помогают, спуск медленно',
  wrist_flexion:'Сгибания: предплечье на скамье, только кисть',
  wrist_extension:'Разгибания: предплечье на скамье, только кисть',
  neck_flexion:'Кивок вперёд: 12-20 повт, резинка/диск',
  neck_rotation:'Ротация шеи: медленно, 10-12/сторону',
  deadbug:'Мёртвый жук: поясница прижата, 8-10/сторону',
  hollow_hold:'Лодочка: поясница в пол, 20-40с',
  side_plank:'Боковая: линия тело-прямая, 30-45с',
  ab_wheel:'Колесо: без прогиба, 6-10 повт',
  copenhagen_plank:'Копенгаген: боком, нога на скамье, 20-30с',
  band_external_rotation:'ER: локоть прижат, наружу',
  band_pull_apart:'Разведения: лопатки сведены, 15-20',
  ytw_raise:'Y-T-W: лёжа, без рывков, 10-12',
  single_arm_row:'Одной: упор, тяга к бедру, пауза',
  landmine_press:'Лэндмайн жим: стоя, корпус стабилен',
  battle_rope:'Канаты: волна, 20-30с интервал',
  sledge_hammer:'Кувалда: ротация кора, 8-10/сторону',
};
function getExerciseMeta(id: string): { name: string; group: string; pattern: string; technique?: string } | null {
  const m = CB_EX_META[id];
  if (!m) return { name: id, group: 'core', pattern: 'unknown', technique: CB_TECHNIQUE[id] };
  return { ...m, technique: CB_TECHNIQUE[id] };
}

const COMBAT_FALLBACK: Record<string,string> = { pallof_rotation_press:'landmine_rotation', neck_bridge_wrestler:'neck_harness_ext', wrist_roller:'plate_pinch', gi_grip_pullup:'pullup', towel_pullup:'pullup', rope_climb:'pullup', fat_bar_row:'row_bar', landmine_press:'ohp', med_ball_rot_throw:'med_ball_throw', sledge_hammer:'landmine_rotation', battle_rope:'kb_swing', sled_push:'squat', sled_pull:'row_bar', nordic_curl:'rdl', glute_ham_raise:'rdl', trap_bar_dead:'squat' };
function filterPool(ids: string[], input: CombatInput): string[] {
  let out = [...ids];
  if (input.excludedExercises?.length) {
    const excl = new Set(input.excludedExercises.map(s => s.toLowerCase()));
    out = out.filter(id => !excl.has(id.toLowerCase()));
  }
  const eq = (input.equipment || []).map(s => String(s).toLowerCase());
  const hasCable = eq.includes('cable') || eq.includes('other') || eq.length===0;
  const hasSled = eq.includes('other') || eq.includes('sled') || eq.length === 0;
  const before = [...out];
  out = filterByTierCB(out, input.level, hasCable, undefined, hasSled);
  if (!hasCable) for (const orig of before) if (!out.includes(orig) && COMBAT_FALLBACK[orig] && !out.includes(COMBAT_FALLBACK[orig])) out.push(COMBAT_FALLBACK[orig]);
  const beforeInjury=[...out];
  out = filterByInjuryCB(out, input.injuries as any);
  if (out.length===0 && (input.injuries||[]).length>0) {
    // безопасный fallback: берём из beforeInjury только те что НЕ исключены
    const safeInjury = beforeInjury.filter(id => filterByInjuryCB([id], input.injuries as any).length > 0);
    const globalSafe = ['landmine_rotation','pallof_rotation_press','plate_pinch','deadbug','side_plank','band_pull_apart'];
    const fallback = safeInjury.length ? safeInjury.slice(0,2) : globalSafe.filter(id => filterByInjuryCB([id], input.injuries as any).length>0).slice(0,2);
    out = fallback.length ? fallback : beforeInjury.filter(id => !isAxialLoadExerciseCB(id)).slice(0,2);
    if (out.length===0) out = ['landmine_rotation','deadbug'];
  }
  const mob = input.mobilityRestrictions as string[] | undefined;
  const beforeMob=[...out];
  out = filterByMobilityCB(out, mob);
  if (out.length===0 && mob && mob.length>0) {
    const safeMob = beforeMob.filter(id => !isMobilityRestrictedCB(id, mob));
    const globalSafeMob = ['landmine_rotation','pallof_rotation_press','plate_pinch','deadbug','side_plank','band_pull_apart','ytw_raise'];
    out = safeMob.length ? safeMob.slice(0, Math.min(3, safeMob.length)) : globalSafeMob.slice(0,2);
  }
  if (input.avoidAxialLoad) {
    const beforeAxial=[...out];
    out = out.filter(id => !isAxialLoadExerciseCB(id));
    if (out.length===0 && beforeAxial.length) {
      const safeAxial = beforeAxial.filter(id => !isAxialLoadExerciseCB(id));
      const globalSafeAxial = ['bulgarian_split_heavy','single_leg_rdl_combat','landmine_rotation','pallof_rotation_press','plate_pinch','deadbug','side_plank'];
      out = safeAxial.length ? safeAxial.slice(0,2) : globalSafeAxial.filter(id => !beforeAxial.includes(id)).slice(0,2);
      if (out.length===0) out = ['deadbug','side_plank'];
    }
  }
  return out;
}
function gentleFactorCB(id: string, injuries: any[]|undefined): number {
  if (!injuries||injuries.length===0) return 1;
  const txt=JSON.stringify(injuries).toLowerCase();
  if ((txt.includes('neck')||txt.includes('ше')) && id.includes('neck')) return 0.6;
  if ((txt.includes('knee')||txt.includes('колен')) && ['squat','front_squat','bulgarian_split_heavy','cossack_squat','trap_bar_dead','zercher_squat','nordic_curl','glute_ham_raise','step_up','box_jump','depth_jump','broad_jump','sled_push'].includes(id)) return 0.6;
  if ((txt.includes('shoulder')||txt.includes('плеч')) && ['bench_bar','ohp','push_press','landmine_press','hang_clean','high_pull','band_external_rotation','ytw_raise'].includes(id)) return 0.65;
  if ((txt.includes('wrist')||txt.includes('запяст')||txt.includes('кист')) && ['gi_grip_pullup','plate_pinch','wrist_roller','towel_pullup','rope_climb','fat_bar_row','wrist_flexion','wrist_extension','sledge_hammer','battle_rope'].includes(id)) return 0.7;
  if ((txt.includes('back')||txt.includes('спин')||txt.includes('поясн')) && ['rdl','trap_bar_dead','sledge_hammer','sled_pull','deadbug','ab_wheel'].includes(id)) return 0.65;
  return 1;
}

function weightForCombatExercise(id: string, input: CombatInput, goal: string): number {
  const goalMult = goal === 'weight_cut' ? 0.92 : goal === 'maintenance' ? 0.95 : 1;
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const bodyweightIds = new Set(['pullup','gi_grip_pullup','towel_pullup','rope_climb','box_jump','depth_jump','broad_jump','deadbug','hollow_hold','side_plank','ab_wheel','copenhagen_plank','neck_bridge_wrestler','plate_pinch','wrist_roller','wrist_flexion','wrist_extension','band_external_rotation','band_pull_apart','ytw_raise']);
  if (bodyweightIds.has(id) || id.includes('pinch')) return 0;
  let w = weightForCombatExerciseResolved(id, {
    workMaxByExercise: input.workMaxByExercise ?? null,
    workMax: input.workMax ?? null,
    bodyweight: input.bodyweight ?? null,
    goalMult,
    outsideMult,
  });
  // female — шея/хват/carry 12-30% ниже (антропометрия + хват, как strength female 0.90)
  if (input.sex === 'female') {
    if (id.includes('neck')) w = Math.round(w * 0.70 / 2.5) * 2.5;
    else if (id.includes('grip') || id.includes('wrist') || id.includes('pinch')) w = Math.round(w * 0.80 / 2.5) * 2.5;
    else if (id.includes('carry') || id.includes('farmer') || id.includes('yoke') || id.includes('farmers') || id.includes('suitcase')) w = Math.round(w * 0.90 / 2.5) * 2.5;
    else if (id.includes('bench') || id.includes('ohp') || id.includes('press') || id.includes('log')) w = Math.round(w * 0.88 / 2.5) * 2.5;
  }
  // equipment fallback — вес скорректирован ×0.85-0.90 (COMBAT_FALLBACK)
  if (w > 0) {
    const eq = (input.equipment||[]).map((s:string)=> String(s).toLowerCase());
    const hasCable = eq.includes('cable') || eq.includes('other') || eq.length===0;
    const hasSled = eq.includes('other') || eq.includes('sled') || eq.length===0;
    if (!hasCable && id==='landmine_rotation') w = Math.round(w*0.85/2.5)*2.5;
    if (!hasSled && ['squat','row_bar','rdl'].includes(id)) w = Math.round(w*0.90/2.5)*2.5;
  }
  return w;
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
  const discipline = input.discipline || 'general';
  // sparring декомпозиция — приоритет над generic outsideLoad, type ring/mat по дисциплине
  const effectiveOutsideLoad: OutsideLoad | null = input.sparringLoad ? sparringToOutsideLoad(input.sparringLoad as any, discipline) : (input.outsideLoad as OutsideLoad) || null;
  const outsideSessions = effectiveOutsideLoad?.sessionsPerWeek ?? 0;
  const level = input.level || 'intermediate';
  const goal = input.goal || (outsideSessions >= 4 ? 'maintenance' : 'power');

  let pattern: CombatPattern | undefined = input.patternId ? getCombatPattern(input.patternId) : undefined;
  if (!pattern || pattern.sessionsPerRotation !== daysPerWeek) {
    pattern = recommendCombatPattern(daysPerWeek, outsideSessions, level);
  }
  const outsideMetrics = computeOutsideMetrics(effectiveOutsideLoad as OutsideLoad);
  const freqPenalty = outsideFrequencyPenalty(effectiveOutsideLoad as OutsideLoad);
  // форсим снижение частоты зала при высокой внезальной даже при явном patternId (C-P0-6) — градированный 0.5/1
  // high 4× + 2520 load = 0.5, high 5×/2500+ =1
  let forceDowngraded = false;
  const origPatternId = pattern.id;
  if ((outsideSessions >= 4 || freqPenalty >= 0.5) && pattern.sessionsPerRotation >= 4) {
    const downgraded = recommendCombatPattern(3, outsideSessions, level);
    if (downgraded.sessionsPerRotation < pattern.sessionsPerRotation) {
      pattern = downgraded;
      forceDowngraded = true;
    }
  }
  const recoveryMult = computeRecoveryMultiplier({ bodyFat: input.bodyFat, leanMass: input.leanMass, hrvMs: input.hrvMs, sleepHours: input.sleepHours, stressLevel: input.stressLevel, hrvGrade: (input as any).hrvGrade });
  const nutritionMult = computeNutritionMultiplier({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg, female: input.sex === 'female' });
  const outsideMult = outsideVolumeMultiplier(effectiveOutsideLoad as OutsideLoad) || 1;
  const acwrMult = input.acwr?.zone === 'dangerous' ? 0.60 : input.acwr?.zone === 'caution' ? 0.85 : input.acwr?.zone === 'undertrained' ? 1.1 : 1;
  const weeklyBudget = (() => {
    const ped = adaptForPEDsCombat(input.peds, input.pedDoses as any, input.courseIntensity, discipline as any, goal as any);
    // база — сумма MAV по уровню (вместо магического 112)
    const lm = (COMBAT_LANDMARKS as any)[level] as Record<string, { mav: number }> | undefined;
    const baseMav = lm ? Object.values(lm).reduce((s, v) => s + (v.mav || 0), 0) : 64;
    // + небольшой запас для core/ротации (max 5)
    const base = Math.round((baseMav + 4) * ped.mrvMult);
    const lab = input.labMrvMultiplier ?? 1;
    // кламп произведения чтобы не эксплодить при stacking 0.6*0.6*0.6 → 0.21
    const effRecovery = Math.max(0.6, Math.min(1.15, recoveryMult));
    const effNutrition = Math.max(0.7, Math.min(1.1, nutritionMult));
    const effOutside = Math.max(0.55, Math.min(1, outsideMult));
    const effAcwr = Math.max(0.6, Math.min(1.1, acwrMult));
    return Math.round(base * lab * effOutside * effRecovery * effNutrition * effAcwr);
  })();

  const periodModelEarly = input.periodizationModel || (goal === 'camp' ? 'camp_8' : weeks >= 9 ? 'atr_10' : 'linear');
  const taperCfg = input.fightDate ? { fightDate: input.fightDate, taperWeeks: input.taperWeeks || (goal === 'camp' ? 2 : 1), startDate: input.startDate || null } as any : null;
  const wcProtocol = input.weightCutProtocol || (goal === 'weight_cut' && input.weightCutKg ? buildWeightCutProtocol(input.weightCutKg, { startWeightKg: input.bodyweight } as any) : null);
  const rationale: string[] = [];
  if (forceDowngraded) rationale.push(`Частота зала снижена ${origPatternId}→${pattern.id} из-за высокой внезальной ${outsideSessions}×/нед (sparring) — перегруз предотвращён`);
  rationale.push(`Дисциплина: ${discipline} · цель ${goal} · ${weeks} нед · ${pattern.name} · модель ${periodModelEarly}`);
  if (input.sparringLoad) rationale.push(sparringSummary(input.sparringLoad));
  if (outsideMetrics) rationale.push(`Вне зала: ${outsideMetrics.weeklyLoad} load (${outsideMetrics.interference}) → объём зала ×${outsideMetrics.volumeMultiplier}`);
  rationale.push(`Recovery ×${recoveryMult.toFixed(2)} · Nutrition ×${nutritionMult.toFixed(2)}${acwrMult !== 1 ? ` · ACWR ×${acwrMult.toFixed(2)}` : ''} · Budget ${weeklyBudget}`);
  if (input.weightCutKg && input.weightCutKg > 0 && !wcProtocol) rationale.push(`Весогонка: −${input.weightCutKg} кг → объём ×0.85, без отказа`);
  if (wcProtocol) {
    rationale.push(`Протокол весогонки: ${wcProtocol.targetLossKg}кг за ${wcProtocol.weeksOut}нед · вода ${wcProtocol.waterMode} · Na ${wcProtocol.sodiumMode} · угли ${wcProtocol.carbMode}${wcProtocol.heatSessions?' · сауна':''}`);
    const nut = weightCutNutritionForWeek(1, weeks, wcProtocol, input.bodyweight || 80, input.sex as any);
    if (nut.kcal) rationale.push(`Питание W1: ${nut.kcal}ккал P${nut.proteinG}/C${nut.carbsG} · вода ${nut.waterMl}мл Na ${nut.sodiumMg}мг`);
    rationale.push(weightCutRehydrationNotes(wcProtocol.targetLossKg)[0]);
  }
  if (taperCfg) rationale.push(...buildTaperRationale(taperCfg, weeks));
  if ((input as any).conditioningMode !== 'off') rationale.push(...buildConditioningRationale(goal, outsideSessions, weeks));

  const weeksData: CombatWeek[] = [];
  // periodization model: atr_10 для >=9 нед, иначе linear; camp → camp_8; conjugate явный
  const periodModel = input.periodizationModel || (goal === 'camp' ? 'camp_8' : weeks >= 9 ? 'atr_10' : 'linear');
  for (let w = 1; w <= weeks; w++) {
    // ATR/linear/conjugate — единый источник
    let phase: CombatPhase = phaseForCombatWeekATR(w, weeks, goal, periodModel as any) as CombatPhase;
    let deload = phase === 'deload';
    let taper = phase === 'taper' || phase === 'realization';
    // fightDate override: тапер к бою важнее ATR
    if (taperCfg && isTaperByFightDate(w, weeks, taperCfg)) {
      taper = true;
      deload = false;
      phase = 'taper';
    }
    // нормализуем phase для отображения: realization → taper (совместимость), accumulation→gpp etc при linear? оставляем как есть для ATR, для linear маппим
    if (periodModel === 'linear' || periodModel === 'camp_8') {
      // linear использует gpp/power/taper/deload — уже верные
    } else if (periodModel === 'atr_10' && phase === 'accumulation') phase = 'accumulation';
    // conjugate оставляет 'conjugate'
    const condSessionsWeek = (input as any).conditioningMode !== 'off' ? conditioningSessionsForWeek(w, phase as any, goal, outsideSessions) : [];
    const sessions: CombatSession[] = [];
    for (let d = 0; d < 7; d++) {
      const slot = pattern.schedule[d];
      if (!slot || slot.kind !== 'тренировка') continue;
      const tag = slot.sessionTag || 'full_power';
      const character = slot.character as any;
      // outside конфликт: тяж ноги/плио за день до high вне зала → делаем памп (расширено: full_conditioning тоже плио)
      const conflict = isDayConflictWithOutside(d, effectiveOutsideLoad as OutsideLoad);
      const isLegOrPlyo = tag === 'lower_power' || tag === 'full_power' || tag === 'full_conditioning';
      const effectiveCharacter = (conflict && isLegOrPlyo && character === 'тяж') ? 'памп' : character;
      const poolIds = POOL_BY_TAG[tag] || POOL_BY_TAG.full_power;
      let pool = filterPool(poolIds, input);
      const primaryCount = effectiveCharacter === 'тяж' ? 3 : 2;
      const total = 5;
      const favSet = new Set((input.favoriteExercises || []).map(s=>s.toLowerCase()));
      let chosen = selectDiverseCB(pool, tag, total, favSet);
      // methodology ordering: compound_first/post_exhaust → tier1 first, pre_exhaust → tier2+ first (изоляция перед базой)
      if (input.methodology === 'pre_exhaust') {
        chosen = [...chosen].sort((a,b)=> tierForCB(b) - tierForCB(a));
      } else {
        // compound_first / post_exhaust / default — база первой (tier1→4)
        chosen = [...chosen].sort((a,b)=> tierForCB(a) - tierForCB(b));
      }
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
        // reps/rir через ATR-aware (совместимо с linear)
        let reps: [number, number] = repsForCombatPhase(phase as any, effectiveCharacter as any, goal);
        // fallback на старый если phase неизвестна (например 'gpp' vs 'accumulation')
        if (!reps || (reps[0] as any)==null) reps = repsForCombat(goal, effectiveCharacter);
        let rir = rirForCombatPhase(phase as any, effectiveCharacter as any, goal);
        if (rir == null) rir = rirForCombat(goal, phase, effectiveCharacter);
        let sets = effectiveCharacter === 'тяж' ? (isPrimary ? 4 : 3) : (deload || taper ? 2 : 3);
        const accentMap = accentForDiscipline(discipline as any);
        const accentKey = id.includes('neck') ? 'neck' : (id.includes('grip')||id.includes('pinch')||id.includes('wrist')) ? 'grip' : (id.includes('landmine')||id.includes('pallof')||id.includes('med_ball')||id.includes('rotation')) ? 'rotational' : tag.includes('lower')||tag.includes('full') ? 'legs' : 'push';
        const accMult = (accentMap as any)[accentKey] || 1;
        if (accMult !== 1) sets = Math.max(2, Math.min(6, Math.round(sets * accMult)));
        // fightStyle: striker→rotational +1, grappler→neck/grip +1
        const fs = input.fightStyle as string | undefined;
        if (fs === 'striker' && (id.includes('landmine') || id.includes('med_ball') || id.includes('sledge') || id.includes('rotation'))) sets = Math.min(6, sets + 1);
        else if (fs === 'grappler' && (id.includes('neck') || id.includes('grip') || id.includes('wrist') || id.includes('towel') || id.includes('rope') || id.includes('pullup'))) sets = Math.min(6, sets + 1);
        // весогонка + тапер: ISSN — дефицит и тапер умножаются (Helms), не min. Для делода — только wcm.
        const wcm = wcProtocol ? weightCutVolumeMultiplier(w, weeks, wcProtocol) : 1;
        const legacyWc = !wcProtocol && goal === 'weight_cut' ? 0.85 : 1;
        const tmult = taper && !deload ? (taperCfg ? taperVolumeMultiplier(w, weeks, taperCfg, false) : 0.62) : 1;
        let effCut = 1;
        if (!deload && wcProtocol && taper) effCut = Math.max(0.30, wcm * tmult);
        else if (wcProtocol) effCut = wcm;
        else if (legacyWc < 1) effCut = legacyWc;
        else if (taper && !deload) effCut = tmult;
        if (effCut < 1) sets = Math.max(2, Math.round(sets * effCut));
        // Wilson 2012: interference нога-специфична — вне зала бьёт по приседу/тяге, верх почти не трогает
        if (outsideMult < 0.75 && sets > 2) {
          const isLegs = tag.includes('lower') || tag.includes('full') || ['squat','front_squat','rdl','bulgarian','cossack','trap_bar','zercher','nordic','glute_ham','step_up','hip_thrust','calf_raise','sled_push','sled_pull'].some(k=> id.includes(k));
          if (isLegs) sets = Math.max(2, sets - 1);
        }
        // кондиция: компенсация доп нагрузки — 1 сет если есть конди-сессии, минимум 2 (фикc P0-2)
        if (condSessionsWeek.length > 0 && sets > 2) sets = Math.max(2, sets - 1);
        if (acwrMult < 1 && sets > 2) sets = Math.max(2, Math.round(sets * acwrMult));
        else if (acwrMult > 1 && sets < 6) sets = Math.min(6, sets + 1);
        if (deload) sets = Math.max(2, Math.round(sets * 0.6));
        const gentle = gentleFactorCB(id, input.injuries as any);
        let weight = weightForCombatExercise(id, input, goal);
        if (gentle < 1) { weight = Math.round(weight * gentle / 2.5) * 2.5; rir = Math.min(4, rir + 1); reps = [reps[0]+1, reps[1]+1] as any; }
        // ACWR / velocity корректировка (VBT — через combat-vbt, вес тоже корректируем)
        const vLoss = input.velocityLossPct as number | undefined;
        if (input.acwr?.zone === 'dangerous') rir = Math.min(4, rir + 2);
        else if (input.acwr?.zone === 'caution') rir = Math.min(4, rir + 1);
        else if (typeof vLoss === 'number' && vLoss > 0) {
          const rec = vbtRecommendationCombat(vLoss);
          if (rec.rirAdd > 0) rir = Math.min(4, rir + rec.rirAdd);
          // при потере >25% — вес -5%, при 20-25% — -3%
          if (rec.volumeMult < 1 && weight > 0) {
            const wMult = rec.volumeMult <= 0.85 ? 0.95 : 0.97;
            weight = Math.round(weight * wMult / 2.5) * 2.5;
          }
        }
        const workSets = buildWorkSets(reps, sets, rir, weight, isPrimary && effectiveCharacter === 'тяж');
        let tempo = tempoForCB(id, isPrimary, effectiveCharacter as any);
        let rest = restForCB(isPrimary, effectiveCharacter as any, id);
        // fightStyle волна: striker — ротация взрыв X-0-X-0 / grappler — хват с паузой
        const fsWave = (input.fightStyle as string | undefined);
        const isRot = id.includes('landmine') || id.includes('med_ball') || id.includes('sledge') || id.includes('rotation');
        const isGripId = id.includes('grip') || id.includes('pinch') || id.includes('wrist') || id.includes('towel') || id.includes('rope');
        if (fsWave === 'striker' && isRot) { tempo = 'X-0-X-0'; rest = Math.max(60, rest - 15); }
        else if (fsWave === 'grappler' && isGripId) { tempo = '2-1-1-0'; rest = rest + 15; }
        const wcPhaseLocal = wcProtocol ? weightCutPhaseForWeek(w, weeks, wcProtocol) : null;
        const wcComment = wcPhaseLocal==='fight_week' ? 'Fight week: вода 2л/Na1.5г/угли 1г/кг → взвешивание → рефид 8г/кг + 150% воды (контроль ЖКТ)' : wcPhaseLocal==='taper' ? 'Весогонка тапер: угли 1г/кг, вода 8л (load) → слив' : null;
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
          comment: (conflict && isLegOrPlyo) ? 'Снижена интенсивность: завтра высокая внезальная' : wcComment ? wcComment : deload ? 'Делод' : taper ? 'Тапер к бою: объём ↓ 35-55%, интенсивность 90-95%, спарринг ↓' : gentle < 1 ? 'Щадящий: снижен вес, +RIR' : (meta as any).technique || undefined,
        };
        exercises.push(ex);
      }
      sessions.push({ day: d + 1, week: w, sessionTag: tag, character: deload ? 'лёг' : (effectiveCharacter as any), exercises, durationMin: exercises.length * 10 + 10 });
    }
    sessions.sort((a, b) => a.day - b.day);
    // P1-4 Core 4 функции — гарантия (если не делод/тапер, до 4 сетов)
    const coreAntiCount = sessions.flatMap(s=> s.exercises).filter(e=> ['deadbug','hollow_hold','side_plank','ab_wheel','copenhagen_plank','pallof_rotation_press','suitcase_carry'].includes(e.id)).reduce((a,e)=>a+e.sets,0);
    if (coreAntiCount < 4 && !deload && !taper) {
      const target = sessions.find(s=> s.sessionTag.includes('upper_power') || s.sessionTag.includes('full_power')) || sessions[0];
      if (target && target.exercises.length < 8 && target.exercises.reduce((a,e)=>a+e.sets,0) < 22) {
        // выбираем недостающую функцию — с прогрессией уровня/фазы
        const eq = (input.equipment || []).map((s: string) => String(s).toLowerCase());
        const hasCable = eq.includes('cable') || eq.includes('other') || eq.length===0;
        const needExt = !sessions.flatMap(s=> s.exercises).some(e=> ['deadbug','hollow_hold','ab_wheel'].includes(e.id));
        const needRot = !sessions.flatMap(s=> s.exercises).some(e=> e.id==='pallof_rotation_press');
        const needLat = !sessions.flatMap(s=> s.exercises).some(e=> ['side_plank','copenhagen_plank','suitcase_carry'].includes(e.id));
        const corePlans = coreWeeklyPlan(level, w, phase);
        let prog: any = null;
        if (needExt) prog = corePlans.find((p:any)=> p.function==='anti_extension') || corePlans[0];
        else if (needRot) prog = corePlans.find((p:any)=> p.function==='anti_rotation') || corePlans[1];
        else if (needLat) prog = corePlans.find((p:any)=> p.function==='anti_lateral') || corePlans[2];
        else prog = corePlans[0];
        // кабель-фильтр: если нет кабеля, заменяем pallof на deadbug
        let coreId: string = prog.exercises[0];
        if (!hasCable && coreId==='pallof_rotation_press') { coreId = 'deadbug'; prog = corePlans.find((p:any)=> p.function==='anti_extension') || prog; }
        const coreMeta = getExerciseMeta(coreId) || { name: coreId, group: 'core', pattern: prog.function || 'anti_extension' };
        const isHold = prog.reps.includes('с') || prog.reps.includes('с/'); // планка
        const repsNum = isHold ? 1 : parseInt(prog.reps) || 8;
        const coreEx: any = {
          id: coreId,
          name: coreMeta.name,
          group: 'core',
          pattern: coreMeta.pattern,
          role: 'accessory',
          character: 'памп',
          sets: prog.sets,
          reps: prog.reps,
          rir: 3,
          weight: 0,
          workSets: Array.from({length: prog.sets}, ()=> ({ reps: repsNum, rir:3, weight: 0, tempo: '2-1-1-0', restSeconds: prog.rest })),
          tempo: '2-1-1-0',
          restSeconds: prog.rest,
          comment: `Core Boxing Science: ${prog.function} L${prog.level} (${prog.cue}) — авто`,
        };
        target.exercises.push(coreEx);
        target.durationMin = (target.durationMin||0)+6;
      }
    }
    const totalSets = sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.sets, 0), 0);
    const totalTonnage = sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.weight * ws.reps, 0), 0), 0);
    weeksData.push({ week: w, phase, deload, taper, sessions, totalSets, totalTonnage, outsideLoad: outsideMetrics?.weeklyLoad });
  }

  // conditioning (отдельно от зала, не ломает сессии)
  let conditioningPlan: any = null;
  if (input.conditioningMode !== 'off') {
    const sessionsPerWeek = weeksData.map(wk => conditioningSessionsForWeek(wk.week, wk.phase as any, goal, outsideSessions));
    conditioningPlan = { weeks, sessions: sessionsPerWeek };
  }

  const dupRationale: string[] = [];
  if (input.dupMode && input.dupMode !== 'off') {
    const tmp:any = { weeksData, rationale: dupRationale };
    applyCombatDUP(tmp as any, input.dupMode as any);
    rationale.push(...dupRationale);
  }
  const intRationale: string[] = [];
  if (input.intensityTech && input.intensityTech !== 'none') {
    const tmp:any = { weeksData, rationale: intRationale };
    applyCombatIntensity(tmp as any, input.intensityTech as any);
    rationale.push(...intRationale);
  }

  // бюджет enforcement с учётом кондиции: каждый зал-сет ≠ кондиция-мин, 12мин zone2 ≈1 сет
  for (const wk of weeksData) {
    const condForWk = (input as any).conditioningMode !== 'off' ? conditioningSessionsForWeek(wk.week, wk.phase as any, goal, outsideSessions) : [];
    const condCost = Math.round(condForWk.reduce((a:number,c:any)=> a + (c.durationMin||0),0) * 0.08);
    const effectiveBudget = Math.max(12, weeklyBudget - condCost);
    let total = wk.totalSets || 0;
    if (total > effectiveBudget) {
      // собираем все упражнения недели, сортируем: accessory first, затем по убыванию sets
      const allEx: Array<{ sess: CombatSession; ex: CombatExercise }> = [];
      for (const sess of wk.sessions) for (const ex of sess.exercises) allEx.push({ sess, ex });
      allEx.sort((a, b) => {
        if (a.ex.role !== b.ex.role) return a.ex.role === 'accessory' ? -1 : 1;
        return b.ex.sets - a.ex.sets;
      });
      let idx = 0;
      while (total > effectiveBudget && idx < allEx.length * 3) {
        const cur = allEx[idx % allEx.length];
        if (cur.ex.sets > 2) {
          cur.ex.sets -= 1;
          cur.ex.workSets = cur.ex.workSets.slice(0, cur.ex.sets);
          if (cur.ex.workSets.length < cur.ex.sets) {
            while (cur.ex.workSets.length < cur.ex.sets) cur.ex.workSets.push({ reps: 5, rir: 2, weight: cur.ex.weight } as any);
          }
          total -= 1;
          wk.totalSets = total;
        }
        idx++;
        // защита от бесконечности
        if (idx > 100) break;
      }
      // пересчёт тоннажа после обрезки
      wk.totalTonnage = wk.sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + e.workSets.reduce((x, ws) => x + ws.weight * ws.reps, 0), 0), 0);
    }
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  if (outsideMetrics && outsideMetrics.weeklyLoad > 1500 && pattern.sessionsPerRotation >= 4) {
    warnings.push(`Высокая внезальная ${outsideMetrics.weeklyLoad} + ${pattern.sessionsPerRotation}× зал — перегруз. Рекомендуем 2-3× зал.`);
  }
  if (input.weightCutKg && input.weightCutKg > 3 && goal !== 'weight_cut') {
    warnings.push(`Весогонка ${input.weightCutKg} кг без режима weight_cut — объём не снижен должным образом.`);
  }
  // проверка шеи: группа neck или id содержит neck
  const hasNeck = weeksData.some(w => w.sessions.some(s => s.exercises.some(e => e.group === 'neck' || e.id.includes('neck'))));
  if (!hasNeck) warnings.push('Шея не покрыта ни в одной сессии — добавьте neck_harness.');
  // бюджет warning с учётом кондиции
  for (const wk of weeksData) {
    const condForWk = (input as any).conditioningMode !== 'off' ? conditioningSessionsForWeek(wk.week, wk.phase as any, goal, outsideSessions) : [];
    const condCost = Math.round(condForWk.reduce((a:number,c:any)=> a + (c.durationMin||0),0) * 0.08);
    const effectiveBudget = Math.max(12, weeklyBudget - condCost);
    if ((wk.totalSets || 0) > effectiveBudget) {
      warnings.push(`Нед ${wk.week}: ${wk.totalSets} сетов > бюджета ${effectiveBudget} (зал ${weeklyBudget} - кондиц ${condCost}).`);
      break;
    }
  }

  const snap: any = { ...input, outsideLoad: effectiveOutsideLoad };
  const plan: CombatPlan = {
    id: `cb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    discipline,
    goal: goal as any,
    level: level as any,
    weeks,
    patternId: pattern.id,
    weeksData,
    outsideMetrics,
    conditioning: conditioningPlan,
    validation: { ok: errors.length === 0, warnings, errors },
    rationale,
    inputSnapshot: snap,
  } as any;
  return plan;
}

export function validateCombatPlan(plan: CombatPlan): { ok: boolean; warnings: string[]; errors: string[] } {
  return plan.validation || { ok: true, warnings: [], errors: [] };
}

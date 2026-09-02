/**
 * strength-sport-builder.engine.ts — генератор плана Силовой экстрим / ТА.
 * Уровень ББ-авто: периодизация, RIR/drift, outside-load, recovery, PED, ACWR-делод.
 * Только силовая часть зала — техника вне зала декларируется, не тренируется здесь.
 */
import { computeOutsideMetrics, outsideVolumeMultiplier, outsideFrequencyPenalty, type OutsideLoad } from '../outside-load.engine';
import { getStrengthSportPattern, recommendStrengthSportPattern, type StrengthSportPattern } from './strength-sport-split-patterns';
import { SS_TAG_MUSCLES } from './strength-sport-day-types';
import { pmForWeek, rirForWeek, phaseForWeek, phaseForDate, buildPhaseDistribution } from './strength-sport-progression';
import { getExerciseById } from '../../core/exercise-catalog';
import { filterByTier, filterByInjury, selectDiverse } from './strength-sport-selection';
import { volumeMultForExercise } from './strength-sport-specialization';
import { tempoForSS, restForSS, pctForSS, repsForSS } from './strength-sport-loading';
import { WL_WEAKPOINT_CORRECTION } from './strength-sport-weakpoint';
import { SM_WEAKPOINT_CORRECTION } from './strength-sport-sm-biomechanics.engine';
import { adaptForPEDsSS } from './strength-sport-ped-adaptation';
import { filterByMobility, isAxialLoadExerciseSS } from './strength-sport-mobility';
import { lengthenedBonus } from './strength-sport-bonus';
import { warmupRampFor } from './strength-sport-warmup';
import { applyDUP } from './strength-sport-dup';
import { applyIntensity } from './strength-sport-intensity';
import { buildWeightCutProtocolSS, weightCutVolumeMultiplierSS, weightCutNutritionForWeekSS, weightCutRehydrationNotesSS, validateWeightCutProtocolSS } from './strength-sport-weight-cut.engine';
import { computeRecoveryMultiplier, computeNutritionMultiplier } from '../recovery-budget.engine';
import { EVENT_META, STRONG_FALLBACK_COEFF, isCarry as isCarryEvent } from './strength-sport-event-types';
import { buildMedleyPlan, buildStoneLadder } from './strength-sport-strongman-attempts.engine';
import { buildWLMeetPlan } from './strength-sport-attempts.engine';
import { TAPER_CESSATION_DAYS, WINWOOD_TAPER, taperForWeekFromEnd, buildTaperRationale } from './strength-sport-taper.engine';
import { buildConditioningRationale, conditioningForWeek } from './strength-sport-conditioning';
import { VBT_SS_THRESHOLDS } from './strength-sport-vbt.engine';
import type { StrengthSportInput, StrengthSportPlan, StrengthSportWeek, StrengthSportSession, StrengthSportExercise, StrengthSportSet } from './strength-sport.types';

/** Пул упражнений по тегу — кандидаты (id каталога) + замены — PRO: 35 ивентов */
const POOL_BY_TAG: Record<string, string[]> = {
  snatch_day: ['snatch', 'hang_snatch', 'power_snatch', 'muscle_snatch', 'high_hang_snatch', 'deficit_snatch', 'block_snatch', 'pause_snatch', 'snatch_pull', 'pause_pull', 'overhead_squat_v2', 'snatch_balance', 'back_squat', 'front_squat'],
  clean_day: ['clean_and_jerk', 'hang_clean', 'power_clean', 'muscle_clean', 'deficit_clean', 'block_clean', 'low_block_clean', 'pause_clean', 'push_jerk', 'split_jerk', 'pause_jerk', 'push_press', 'jerk_recovery', 'behind_neck_jerk', 'front_squat_clean_grip', 'front_squat'],
  strength_day: ['squat', 'front_squat', 'back_squat', 'pause_squat', 'tempo_squat', 'deadlift', 'sumo_dl', 'rdl', 'bench_bar', 'db_press', 'ohp', 'pin_press'],
  technique_day: ['hang_snatch', 'hang_clean', 'high_hang_snatch', 'muscle_snatch', 'muscle_clean', 'snatch_balance', 'jerk_dip', 'overhead_squat_v2', 'pause_snatch', 'pause_clean', 'pause_jerk'],
  pull_day: ['snatch_pull', 'clean_pull', 'pause_pull', 'deficit_pull', 'rdl', 'deadlift', 'row_bar', 'pullup'],
  accessory_day: ['db_press', 'ohp', 'lateral_raise', 'face_pull', 'row_db', 'hip_thrust', 'pause_squat', 'tempo_squat'],
  overhead_day: ['log_press', 'axle_press', 'circus_db_press', 'circus_db_medley', 'viking_press', 'ohp', 'push_press', 'db_press', 'push_jerk', 'pause_jerk', 'jerk_recovery', 'behind_neck_jerk', 'pin_press'],
  deadlift_day: ['deadlift', 'sumo_dl', 'axle_deadlift', 'car_deadlift_18', 'car_deadlift_side', 'deadlift_max', 'rdl', 'deficit_pull', 'farmers_walk_heavy', 'yoke_walk', 'frame_carry', 'conan_wheel'],
  squat_day: ['squat', 'front_squat', 'pause_squat', 'tempo_squat', 'hack_squat', 'leg_press', 'bulgarian_split', 'calf_raise', 'overhead_squat_v2', 'duck_walk'],
  event_day: ['farmers_walk_heavy', 'yoke_walk', 'frame_carry', 'husafell_carry', 'conan_wheel', 'shield_carry', 'duck_walk', 'atlas_stone_load', 'atlas_stone_over_bar', 'natural_stone_shoulder', 'sandbag_load', 'sandbag_over_bar', 'sandbag_shoulder', 'keg_toss', 'keg_over_bar', 'zercher_carry', 'tire_flip', 'sled_push_sprint', 'truck_pull', 'arm_over_arm', 'car_deadlift_18', 'car_deadlift_side', 'axle_press', 'viking_press', 'circus_db_medley'],
  oly_day: ['snatch', 'clean_and_jerk', 'high_hang_snatch', 'snatch_pull', 'clean_pull', 'front_squat', 'pause_snatch', 'pause_clean', 'pause_jerk'],
};

const OLY_IDS = new Set(['snatch','hang_snatch','power_snatch','high_hang_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','low_block_clean','pause_clean','push_jerk','split_jerk','pause_jerk','snatch_pull','clean_pull','pause_pull','deficit_pull','snatch_balance','overhead_squat_v2','jerk_dip','jerk_recovery','behind_neck_jerk','pause_squat','tempo_squat']);
const STRONG_IDS = new Set(['log_press','axle_press','viking_press','yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','conan_wheel','shield_carry','duck_walk','atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load','sandbag_over_bar','sandbag_shoulder','keg_toss','keg_over_bar','keg_load','axle_deadlift','car_deadlift_18','car_deadlift_side','deadlift_max','circus_db_press','circus_db_medley','tire_flip','stone_lift','zercher_carry','sled_push_sprint','sandbag_carry','truck_pull','arm_over_arm']);

function isOly(id: string): boolean { return OLY_IDS.has(id); }
function isStrong(id: string): boolean { return STRONG_IDS.has(id); }
function orderByMethod(exs: StrengthSportExercise[], method?: string): StrengthSportExercise[] {
  if (method === 'pre_exhaust') return [...exs].sort((a,b) => (a.role==='accessory'?-1:1) - (b.role==='accessory'?-1:1));
  if (method === 'post_exhaust') return [...exs].sort((a,b) => (a.role==='primary'?-1:1) - (b.role==='primary'?-1:1));
  return exs; // compound_first default: already primary first due to chosen order
}

function clampWeeks(w: number): number { return Math.max(2, Math.min(16, Math.round(Number(w) || 8))); }
function clampDays(d: number): number { return Math.max(2, Math.min(6, Math.round(Number(d) || 3))); }

const STRONG_FALLBACK: Record<string,string> = {
  log_press:'push_press', axle_press:'push_press', viking_press:'push_press', yoke_walk:'farmers_walk_heavy', frame_carry:'farmers_walk_heavy', husafell_carry:'sandbag_carry', conan_wheel:'sandbag_carry', shield_carry:'sandbag_carry', duck_walk:'farmers_walk_heavy', truck_pull:'sled_drag', arm_over_arm:'sled_drag', farmers_walk_heavy:'deadlift', atlas_stone_load:'sandbag_load', atlas_stone_over_bar:'sandbag_load', natural_stone_shoulder:'sandbag_shoulder', sandbag_load:'deadlift', sandbag_over_bar:'sandbag_load', sandbag_shoulder:'rdl', keg_toss:'sandbag_shoulder', keg_over_bar:'sandbag_shoulder', keg_load:'sandbag_shoulder', axle_deadlift:'deadlift', car_deadlift_18:'deadlift', car_deadlift_side:'deadlift', deadlift_max:'deadlift', circus_db_press:'db_press', circus_db_medley:'db_press', tire_flip:'deadlift', zercher_carry:'farmers_walk_heavy', sandbag_carry:'farmers_walk_heavy', sled_drag:'farmers_walk_heavy', sled_push:'farmers_walk_heavy'
};
function filterPool(ids: string[], input: StrengthSportInput): string[] {
  let out = [...ids];
  if (input.excludedExercises?.length) {
    const excl = new Set(input.excludedExercises.map(s => s.toLowerCase()));
    out = out.filter(id => !excl.has(id.toLowerCase()));
  }
  const eq = (input.equipment || []).map(s => String(s).toLowerCase());
  const hasOther = eq.includes('other') || eq.includes('specialty') || eq.length === 0;
  const beforeTier = [...out];
  out = filterByTier(out, input.level, input.allowExotic, hasOther);
  if (!hasOther) {
    // BFS по цепочке STRONG_FALLBACK — ищем первый не-стронг, но для carries сохраняем carry (farmers) как базовый без снаряда
    const strongSet = new Set(Object.keys(STRONG_FALLBACK));
    const isCarryOrig = (id:string) => ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','zercher_carry','sandbag_carry','sled_push_sprint','conan_wheel','shield_carry','duck_walk','truck_pull','arm_over_arm','sled_drag','sled_push'].includes(id);
    const resolveFallback = (id: string, visited = new Set<string>()): string | null => {
      // для carries без спец-снаряда — даём базовый фермер как замену, а не deadlift
      if (isCarryOrig(id)) return 'farmers_walk_heavy';
      let cur = STRONG_FALLBACK[id];
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        if (!strongSet.has(cur)) return cur;
        if (isCarryOrig(cur)) return 'farmers_walk_heavy';
        const nxt = STRONG_FALLBACK[cur];
        if (nxt && !visited.has(nxt)) cur = nxt; else return cur;
      }
      return cur || null;
    };
    // гарантируем хотя бы один carry без снаряда (farmers с гантелями/штанга) — базовый без exotic
    const hadCarryBefore = beforeTier.some(isCarryOrig);
    for (const orig of beforeTier) if (!out.includes(orig)) {
      const fb = resolveFallback(orig);
      if (fb && !out.includes(fb)) out.push(fb);
    }
    if (hadCarryBefore && !out.some(isCarryOrig)) {
      if (!out.includes('farmers_walk_heavy')) out.push('farmers_walk_heavy');
    }
    if (out.length===0) out = ['back_squat','deadlift','ohp'].slice(0,3);
  }
  const beforeInjury = [...out];
  out = filterByInjury(out, input.injuries as any);
  if (out.length===0 && (input.injuries||[]).length>0) out = beforeInjury.slice(0,2);
  // mobility
  const mob = (input as any).mobilityRestrictions as string[] | undefined;
  out = filterByMobility(out, mob);
  if (out.length===0 && mob && mob.length>0) out = beforeInjury.slice(0,2);
  // P0-7 axial — щадящий как в BB 1.4
  if ((input as any).avoidAxialLoad) {
    const beforeAxial = [...out];
    out = out.filter(id => !isAxialLoadExerciseSS(id));
    if (out.length === 0 && beforeAxial.length) out = beforeAxial.slice(0,2);
  }
  return out;
}
function gentleFactor(id: string, injuries: any[]|undefined): number {
  if (!injuries||injuries.length===0) return 1;
  const txt = JSON.stringify(injuries).toLowerCase();
  const knee = txt.includes('knee')||txt.includes('колен');
  const back = txt.includes('back')||txt.includes('спин')||txt.includes('поясн');
  const shoulder = txt.includes('shoulder')||txt.includes('плеч');
  const wrist = txt.includes('wrist')||txt.includes('запяст');
  if (knee && ['back_squat','front_squat','hack_squat','bulgarian_split','squat','overhead_squat_v2','snatch_balance','car_deadlift_18','car_deadlift_side','conan_wheel','shield_carry','duck_walk','truck_pull'].includes(id)) return 0.6;
  if (back && ['deadlift','sumo_dl','axle_deadlift','car_deadlift_18','car_deadlift_side','deadlift_max','yoke_walk','frame_carry','husafell_carry','conan_wheel','shield_carry','truck_pull','arm_over_arm','atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load','sandbag_over_bar','sandbag_shoulder','keg_toss','keg_over_bar','snatch_pull','clean_pull'].includes(id)) return 0.6;
  if (shoulder && ['snatch','log_press','axle_press','viking_press','push_jerk','split_jerk','overhead_squat_v2','ohp','push_press','circus_db_press','circus_db_medley','keg_toss','conan_wheel'].includes(id)) return 0.65;
  if (wrist && ['clean_and_jerk','front_squat_clean_grip','hang_clean','truck_pull','arm_over_arm'].includes(id)) return 0.7;
  return 1;
}

// P0-2: единый источник — делегируем в strength-sport-loading.ts (Prilepin зоны)
function repsFor(tag: string, phase: string, goal: string, isPrimary: boolean): [number, number] {
  return repsForSS(tag, phase, goal, isPrimary);
}
function pctFor(phase: string, goal: string, tag?: string): number {
  return pctForSS(phase, goal, tag);
}

function basePmFor(id: string, wm: StrengthSportInput['workMax']): number {
  // P0 fix: проверять pull-вариации ДО snatch/clean, иначе snatch_pull → snatch (занижение 2×)
  // pull-вариации относятся к тяговому ПМ (deadlift), не к рывковому
  if (['snatch_pull','pause_pull','deficit_pull','clean_pull'].includes(id)) return wm.deadlift || 120;
  if (id.includes('pull') && (id.includes('snatch') || id.includes('clean') || id.includes('deficit') || id.includes('pause'))) return wm.deadlift || 120;
  if (['snatch','hang_snatch','power_snatch','high_hang_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','snatch_balance','overhead_squat_v2'].includes(id) || id.includes('snatch')) return wm.snatch || 60;
  if (['clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','low_block_clean','pause_clean','push_jerk','split_jerk','pause_jerk','front_squat_clean_grip','jerk_dip','jerk_recovery','behind_neck_jerk'].includes(id) || id.includes('clean') || id.includes('jerk')) return wm.cleanJerk || wm.clean || wm.frontSquat || 80;
  if (['squat','back_squat','front_squat','hack_squat','front_squat_clean_grip','pause_squat','tempo_squat','overhead_squat_v2'].includes(id) || id.includes('squat')) return wm.backSquat || wm.frontSquat || 100;
  if (['deadlift','sumo_dl','axle_deadlift','rdl','deficit_pull','pause_pull'].includes(id) || id.includes('deadlift')) return wm.deadlift || 120;
  // Strongman event-specific max (PRO): отдельный ввод, не фоллбэк через deadlift
  if (id === 'yoke_walk') return (wm as any).yokeWalk || wm.deadlift || 180;
  if (id === 'farmers_walk_heavy' || id === 'zercher_carry' || id === 'frame_carry' || id === 'husafell_carry' || id === 'sandbag_carry' || id === 'conan_wheel' || id === 'shield_carry' || id === 'duck_walk') return (wm as any).farmersWalk || (wm as any).frameCarry || wm.deadlift || 140;
  if (id === 'atlas_stone_load' || id === 'atlas_stone_over_bar' || id === 'natural_stone_shoulder' || id === 'stone_lift' || id === 'sandbag_shoulder' || id === 'sandbag_load' || id === 'sandbag_over_bar' || id === 'keg_over_bar' || id === 'keg_load') return (wm as any).atlasStone || (wm as any).sandbagLoad || wm.deadlift || 100;
  if (id === 'axle_deadlift' || id === 'car_deadlift_18' || id === 'car_deadlift_side' || id === 'deadlift_max') return (wm as any).axleDeadlift || (wm as any).carDeadlift || wm.deadlift || 120;
  if (id === 'keg_toss' || id === 'sandbag_toss') return (wm as any).kegToss || (wm as any).atlasStone || 80;
  if (id === 'axle_press') return (wm as any).axlePress || wm.logPress || wm.overheadPress || 60;
  if (id === 'circus_db_press' || id === 'circus_db_medley') return (wm as any).circusDbPress || wm.logPress || wm.overheadPress || 60;
  if (id === 'viking_press') return (wm as any).axlePress || wm.logPress || wm.overheadPress || 60;
  if (id === 'truck_pull' || id === 'arm_over_arm') return wm.deadlift || 140;
  if (['ohp','push_press','log_press','circus_db_press','bench_bar','pin_press','jerk_recovery','behind_neck_jerk','pause_jerk'].includes(id) || id.includes('press') || id.includes('jerk')) return wm.overheadPress || wm.bench || wm.logPress || 60;
  return wm.backSquat || 80;
}
function weightForExercise(id: string, input: StrengthSportInput, pct: number, week: number): number {
  const wm = input.workMax || {};
  const base = basePmFor(id, wm);
  const pm = pmForWeek(base, week, input, id);
  // Коэфф замены без спец-снарядов — по таблице STRONG_FALLBACK_COEFF (йок 0.73, камень 0.66)
  const eq = (input.equipment || []).map((s: string) => String(s).toLowerCase());
  const hasOther = eq.includes('other') || eq.includes('specialty') || eq.length === 0;
  let w = Math.round((pm || base) * pct / 2.5) * 2.5;
  if (!hasOther && isStrong(id)) {
    const coeff = (STRONG_FALLBACK_COEFF as any)[id] ?? 0.85;
    w = Math.round(w * coeff / 2.5) * 2.5;
  }
  // female adjust: overhead 0.88, carry 0.90 (антропометрия + хват)
  if ((input as any).sex === 'female') {
    if (id.includes('press') || id.includes('ohp') || id.includes('log') || id === 'bench_bar') w = Math.round(w * 0.88 / 2.5) * 2.5;
    else if (isCarryEvent(id) || id.includes('farmers') || id.includes('yoke') || id.includes('carry') || id.includes('husafell') || id.includes('frame')) w = Math.round(w * 0.90 / 2.5) * 2.5;
  }
  return w;
}

function buildWarmup(weight: number, id?: string): StrengthSportSet[] {
  return warmupRampFor(weight, id).map(s => ({ reps: s.reps, rir: s.rir, weight: s.weight } as StrengthSportSet));
}

function buildExerciseSets(id: string, tag: string, phase: string, input: StrengthSportInput, isPrimary: boolean, week: number): { sets: number; reps: [number, number]; rir: number; weight: number; workSets: StrengthSportSet[] } {
  // D2: conjugate ротация — определяем заранее для reps/pct
  const preConjugate = (input as any).mode === 'strongman' && tag === 'event_day' && phase !== 'deload' ? (week % 3 === 1 ? 'max' : week % 3 === 2 ? 'dynamic' : 'rep') : 'none';
  let reps = repsFor(tag, phase, input.goal, isPrimary);
  let pct = pctFor(phase, input.goal, tag);
  if (preConjugate === 'max') {
    pct = Math.min(0.95, pct + 0.05);
    // reps оставляем низкие для max
  } else if (preConjugate === 'dynamic') {
    pct = Math.max(0.60, pct - 0.15);
    reps = [1, 2] as [number, number];
  } else if (preConjugate === 'rep') {
    pct = Math.max(0.60, pct - 0.05);
    reps = [reps[0]+1, reps[1]+2] as [number, number];
  }
  const baseWeight = weightForExercise(id, input, pct, week);
  let sets = 3;
  if (isOly(id)) sets = phase === 'peaking' ? 5 : phase === 'deload' ? 3 : 5;
  else if (tag === 'event_day') {
    if (phase === 'deload') {
      // D3: tire_flip AMRAP → 1×60% в делоде, остальные carries 2
      if (id === 'tire_flip') sets = 1;
      else sets = 2;
    } else sets = 3;
  }
  else sets = phase === 'peaking' ? 4 : phase === 'deload' ? 2 : isPrimary ? 4 : 3;
  if (input.focus) {
    const f = volumeMultForExercise(id, input.focus);
    sets = Math.max(2, Math.min(6, Math.round(sets * f)));
  }
  // PRO: weakPoints — спец-объём +1 на слабые лифты (WL + SM точечно)
  {
    const rawWeak: string[] = [
      ...((Array.isArray((input as any).weakPoints) ? (input as any).weakPoints : []) as string[]),
      ...((Array.isArray((input as any).smWeakPoints) ? (input as any).smWeakPoints : []) as string[]),
      ...((Array.isArray((input as any).weakPointsSM) ? (input as any).weakPointsSM : []) as string[]),
    ];
    if (rawWeak.length) {
      const wp = rawWeak.map((s: any) => String(s).toLowerCase());
      let weakMult = 1;
      const isSn = id.includes('snatch');
      const isCj = id.includes('clean') || id.includes('jerk');
      const isSq = id.includes('squat');
      const isOh = id.includes('press') || id.includes('ohp') || id.includes('log') || id === 'bench_bar' || id.includes('axle') || id.includes('viking') || id.includes('circus');
      const isDl = id.includes('deadlift') || id.includes('pull') || id === 'rdl' || id.includes('car_deadlift') || id.includes('axle_deadlift');
      const isCarry = id.includes('farmers') || id.includes('yoke') || id.includes('carry') || id.includes('sled') || id.includes('frame') || id.includes('husafell') || id.includes('conan') || id.includes('duck') || id.includes('truck') || id.includes('arm_over');
      const isStone = id.includes('stone') || id.includes('sandbag') || id.includes('tire') || id.includes('keg');
      const isGrip = id.includes('farmers') || id.includes('pinch') || id.includes('axle') || id.includes('grip');
      const isLogDip = wp.some(w => w === 'log_dip' || w.includes('log_dip')) && (id.includes('jerk_dip') || id.includes('front_squat') || id === 'pause_squat');
      const isWeakCorrectionWL = wp.some((w: string) => {
        const corr = (WL_WEAKPOINT_CORRECTION as any)[w];
        return Array.isArray(corr) && corr.includes(id);
      });
      const isWeakCorrectionSM = wp.some((w: string) => {
        const corr = (SM_WEAKPOINT_CORRECTION as any)[w];
        return Array.isArray(corr) && (corr.includes(id) || corr.some((c: string) => id.includes(c) || c.includes(id)));
      });
      // SM точные: log_dip→дип, yoke_*→carry, stone_*→stone
      const isSMLog = wp.some(w => ['log_dip','log_drive','log_lockout','log_clean'].includes(w)) && isOh;
      const isSMYoke = wp.some(w => ['yoke_pickup','yoke_walk','yoke_turn'].includes(w)) && isCarry;
      const isSMFarmers = wp.some(w => ['farmers_pickup','farmers_carry','farmers_grip'].includes(w)) && (isCarry || isGrip);
      const isSMStone = wp.some(w => ['stone_off_floor','stone_lap','stone_load'].includes(w)) && isStone;
      const isSMGrip = wp.some(w => ['grip_support','farmers_grip'].includes(w)) && isGrip;
      const isSMCore = wp.some(w => w === 'core_brace') && (isCarry || isStone || id.includes('plank') || id.includes('carry'));
      if (isWeakCorrectionWL || isWeakCorrectionSM || isLogDip) weakMult = 1.15;
      else if (isSMLog || isSMYoke || isSMFarmers || isSMStone || isSMGrip || isSMCore) weakMult = 1.15;
      else if (wp.some((w: string) => w.includes('snatch') && isSn)) weakMult = 1.15;
      else if (wp.some((w: string) => (w.includes('clean') || w.includes('jerk')) && isCj)) weakMult = 1.15;
      else if (wp.some((w: string) => w.includes('squat') && isSq)) weakMult = 1.15;
      else if (wp.some((w: string) => (w.includes('overhead') || w.includes('press') || w.includes('жим') || w.includes('log_dip') || w.includes('log_drive')) && isOh)) weakMult = 1.15;
      else if (wp.some((w: string) => (w.includes('deadlift') || w.includes('тяг') || w.includes('pull')) && isDl)) weakMult = 1.15;
      else if (wp.some((w: string) => (w.includes('yoke') || w.includes('farmers') || w.includes('carry')) && isCarry)) weakMult = 1.15;
      else if (wp.some((w: string) => (w.includes('stone') || w.includes('кам') || w.includes('lap')) && isStone)) weakMult = 1.15;
      if (weakMult !== 1) sets = Math.max(2, Math.min(6, Math.round(sets * weakMult)));
    }
  }
  // Полный объём: outside × ACWR × VBT — мультипликативно
  const outM = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const acwr = (input as any).acwr as { ratio:number; zone:string } | null | undefined;
  const vLoss = (input as any).velocityLossPct as number | undefined;
  if (outM < 1 && sets > 2) sets = Math.max(2, Math.round(sets * outM));
  if (acwr?.zone === 'dangerous' && sets > 2) sets = Math.max(2, Math.round(sets * 0.65));
  else if (acwr?.zone === 'caution' && sets > 2) sets = Math.max(2, Math.round(sets * 0.85));
  else if (acwr?.zone === 'undertrained') sets = Math.min(6, sets + 1);
  // PRO VBT пороги: TA power 10%, pull 15% (PLOS 2026), carry 15% (Hindle)
  const isCarryVBT = ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','conan_wheel','shield_carry','truck_pull','arm_over_arm','sandbag_carry','sled_push','sled_drag','duck_walk'].some(k=> id.includes(k.replace('_walk','')) || id===k);
  const isTAPull = id.includes('pull') || id.includes('squat');
  const isTA = id.includes('snatch') || id.includes('clean') || id.includes('jerk');
  const vbtThresh = isTAPull ? 15 : isTA ? 10 : isCarryVBT ? 15 : 20;
  if (typeof vLoss === 'number' && vLoss > vbtThresh && sets > 2) sets = Math.max(2, Math.round(sets * 0.90));
  // H1: VelocityHistory 3 точки → zone 20/30% (carry 15/25%)
  const vHist = (input as any).velocityHistory as Record<string, number[]> | undefined;
  let histLoss = 0;
  if (vHist) {
    const hist = vHist[id] || vHist[id.toLowerCase()] || (vHist as any)['all'];
    if (Array.isArray(hist) && hist.length >= 2) {
      const best = Math.max(...hist);
      const last = hist[hist.length - 1];
      if (best > 0) histLoss = (best - last) / best * 100;
    }
  }
  // дублируем пороги для TA/carry вне scope rir
  const histThreshLow = isTAPull ? 15 : isTA ? 10 : isCarryVBT ? 15 : 20;
  const histThreshHigh = isTAPull ? 25 : isTA ? 20 : isCarryVBT ? 25 : 30;
  if (histLoss > histThreshLow && sets > 2) sets = Math.max(2, Math.round(sets * (histLoss > histThreshHigh ? 0.80 : 0.90)));
  // P3 diary e1RM trend: -5% down → -15%, plateau <2% → +1 сет
  const trends: any[] = (input as any).diaryTrend || [];
  const myTrend = trends.find((t:any)=> t.lift===id || (id.includes('snatch')&&t.lift==='snatch') || (id.includes('clean')&&t.lift==='clean') || (id.includes('squat')&&t.lift==='squat') || (id.includes('deadlift')&&t.lift==='deadlift'));
  if (myTrend) {
    if (myTrend.changePct < -5 && sets > 2) sets = Math.max(2, Math.round(sets * 0.85));
    else if (myTrend.changePct < 2 && myTrend.changePct >= -5) sets = Math.min(6, sets + 1);
  }
  const rir = rirForWeek(week, input.weeks, input.goal, isOly(id));
  let finalRir = rir;
  if (phase === 'deload') finalRir = 4;
  else {
    if (acwr?.zone === 'dangerous') finalRir = Math.min(4, finalRir + 2);
    else if (acwr?.zone === 'caution') finalRir = Math.min(4, finalRir + 1);
    if (typeof vLoss === 'number' && vLoss > vbtThresh) finalRir = Math.min(4, finalRir + 1);
    if (histLoss > histThreshLow) finalRir = Math.min(4, finalRir + 1);
    if (histLoss > histThreshHigh) finalRir = Math.min(4, finalRir + 1);
    if (myTrend && myTrend.changePct < -5) finalRir = Math.min(4, finalRir + 1);
    if (outM < 0.75) finalRir = Math.min(4, finalRir + 1);
    // D2 conjugate RIR
    if (preConjugate === 'max') finalRir = Math.max(0, finalRir - 1);
    else if (preConjugate === 'dynamic') finalRir = Math.min(4, finalRir + 1);
  }
  const gentle = gentleFactor(id, input.injuries as any);
  let finalWeight = baseWeight;
  let finalReps = reps;
  if (gentle < 1) {
    finalWeight = Math.round(baseWeight * gentle / 2.5) * 2.5;
    finalRir = Math.min(4, finalRir + 1);
    // щадящий: +2 повтора, меньше отказ
    finalReps = [reps[0]+1, reps[1]+2] as [number, number];
  }
  let tempo = tempoForSS(id, isPrimary ? 'тяж' : 'памп', phase);
  if (preConjugate === 'dynamic') tempo = 'X-0-X-0';
  const rest = restForSS(isPrimary ? 'тяж' : 'памп', isPrimary, id, pct);
  // P0-6: для стронга 300-360с, для oly 180с — теперь rest уже учитывает id+pct
  const finalRest = gentle < 1 ? rest + 30 : rest;
  // Carry / loading — дистанция и timeCap из EVENT_META
  const evMeta = EVENT_META[id] as any;
  const workSets: StrengthSportSet[] = [];
  for (let i = 0; i < sets; i++) {
    const rep = Math.round((finalReps[0] + finalReps[1]) / 2);
    let wsTempo = tempo;
    if (histLoss > 20) wsTempo = tempo + ` VBT ${Math.round(histLoss)}%`;
    const ws: StrengthSportSet = { reps: rep, rir: finalRir, weight: finalWeight, pct: Math.round(pct * 100), tempo: wsTempo, restSeconds: finalRest } as StrengthSportSet;
    if (evMeta?.defaultDistanceM) (ws as any).distanceM = evMeta.defaultDistanceM;
    if (evMeta?.defaultTimeCapS) (ws as any).timeCapS = evMeta.defaultTimeCapS;
    if (isCarryEvent(id)) ws.reps = 1;
    workSets.push(ws);
  }
  // H1: если VBT loss >30% — дополнительный VBT маркер на первый сет
  return { sets, reps: finalReps, rir: finalRir, weight: finalWeight, workSets };
}

function goalRir(goal: string): number {
  if (goal === 'strength') return 2;
  if (goal === 'hypertrophy') return 2;
  if (goal === 'peaking') return 1;
  if (goal === 'technique') return 4;
  return 2;
}

// ——— ИЗОЛИРОВАННЫЕ recovery/nutrition/budget — делегируем в единый движок (P1-1) ———
function computeRecMult(input: { bodyFat?: number; leanMass?: number; hrvMs?: number; sleepHours?: number; stressLevel?: number }): number {
  return computeRecoveryMultiplier(input);
}
function computeNutMult(input: { calorieSurplus?: number; proteinPerKg?: number; female?: boolean }): number {
  return computeNutritionMultiplier(input as any);
}
// P1.1: бюджет per level с recovery (Helms) — parity BB (ped×lab×nut×recovery)
function computeBudget(input: { level?: string; peds?: string[]; pedDoses?: Record<string, number>; courseIntensity?: string; calorieSurplus?: number; proteinPerKg?: number; labMrvMultiplier?: number; isWeightCut?: boolean; recoveryMult?: number }): number {
  const levelBase: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  const baseSets = levelBase[(input.level as string) || 'intermediate'] ?? 85;
  const ped = adaptForPEDsSS(input.peds, input.pedDoses as any, input.courseIntensity, !!input.isWeightCut);
  const base = Math.round(baseSets * ped.mrvMult);
  const lab = input.labMrvMultiplier ?? 1;
  const nut = computeNutMult({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  const rec = input.recoveryMult ?? 1;
  return Math.round(base * lab * nut * rec);
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
  axle_press: { name: 'Аксель-пресс', group: 'shoulders', pattern: 'vertical_push' },
  viking_press: { name: 'Викинг-пресс', group: 'shoulders', pattern: 'vertical_push' },
  circus_db_press: { name: 'Цирковой жим', group: 'shoulders', pattern: 'vertical_push' },
  circus_db_medley: { name: 'Гантели-лестница', group: 'shoulders', pattern: 'vertical_push' },
  axle_deadlift: { name: 'Становая аксель', group: 'back', pattern: 'hinge' },
  car_deadlift_18: { name: 'Автодедлифт 18″', group: 'back', pattern: 'hinge' },
  car_deadlift_side: { name: 'Автодедлифт боковой', group: 'back', pattern: 'hinge' },
  deadlift_max: { name: 'Тяга макс', group: 'back', pattern: 'hinge' },
  farmers_walk_heavy: { name: 'Фермер тяжёлый', group: 'back', pattern: 'carry' },
  frame_carry: { name: 'Рама', group: 'back', pattern: 'carry' },
  husafell_carry: { name: 'Хусафелл', group: 'back', pattern: 'carry' },
  conan_wheel: { name: 'Колесо Конана', group: 'legs', pattern: 'carry' },
  shield_carry: { name: 'Щит', group: 'legs', pattern: 'carry' },
  duck_walk: { name: 'Утиная походка', group: 'legs', pattern: 'carry' },
  truck_pull: { name: 'Тяга грузовика', group: 'back', pattern: 'carry' },
  arm_over_arm: { name: 'Канат к себе', group: 'back', pattern: 'carry' },
  yoke_walk: { name: 'Йок', group: 'legs', pattern: 'carry' },
  atlas_stone_load: { name: 'Атлас-камень', group: 'legs', pattern: 'hinge' },
  atlas_stone_over_bar: { name: 'Камень через планку', group: 'legs', pattern: 'hinge' },
  natural_stone_shoulder: { name: 'Натуральный камень', group: 'legs', pattern: 'hinge' },
  stone_lift: { name: 'Камень', group: 'legs', pattern: 'hinge' },
  sandbag_shoulder: { name: 'Мешок на плечо', group: 'legs', pattern: 'hinge' },
  sandbag_load: { name: 'Загрузка мешка', group: 'legs', pattern: 'hinge' },
  sandbag_over_bar: { name: 'Мешок через планку', group: 'legs', pattern: 'hinge' },
  sandbag_carry: { name: 'Перенос мешка', group: 'back', pattern: 'carry' },
  keg_toss: { name: 'Бросок бочки', group: 'legs', pattern: 'hinge' },
  keg_over_bar: { name: 'Бочка через планку', group: 'legs', pattern: 'hinge' },
  keg_load: { name: 'Бочка на платформу', group: 'legs', pattern: 'hinge' },
  sandbag_toss: { name: 'Бросок мешка', group: 'legs', pattern: 'hinge' },
  zercher_carry: { name: 'Зерчер', group: 'back', pattern: 'carry' },
  tire_flip: { name: 'Покрышка', group: 'legs', pattern: 'hinge' },
  sled_push_sprint: { name: 'Сани спринт', group: 'legs', pattern: 'carry' },
  sled_drag: { name: 'Тяга саней', group: 'back', pattern: 'carry' },
  sled_push: { name: 'Толкание саней', group: 'legs', pattern: 'carry' },
  // P0-5: 15+ вариаций ТА для про-вариативности
  deficit_snatch: { name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge' },
  block_snatch: { name: 'Рывок с блоков', group: 'legs', pattern: 'hinge' },
  pause_snatch: { name: 'Рывок с паузой', group: 'legs', pattern: 'hinge' },
  high_hang_snatch: { name: 'Рывок с высокого виса', group: 'legs', pattern: 'hinge' },
  deficit_clean: { name: 'Взятие с дефицита', group: 'legs', pattern: 'hinge' },
  block_clean: { name: 'Взятие с блоков', group: 'legs', pattern: 'hinge' },
  low_block_clean: { name: 'Взятие с низких блоков', group: 'legs', pattern: 'hinge' },
  pause_clean: { name: 'Взятие с паузой', group: 'legs', pattern: 'hinge' },
  pause_squat: { name: 'Присед с паузой', group: 'legs', pattern: 'squat' },
  tempo_squat: { name: 'Присед темповый 3-0-1', group: 'legs', pattern: 'squat' },
  jerk_recovery: { name: 'Восстановление после толчка', group: 'legs', pattern: 'squat' },
  behind_neck_jerk: { name: 'Толчок из-за головы', group: 'shoulders', pattern: 'vertical_push' },
  pause_jerk: { name: 'Толчок с паузой', group: 'shoulders', pattern: 'vertical_push' },
  pause_pull: { name: 'Тяга с паузой', group: 'back', pattern: 'hinge' },
  deficit_pull: { name: 'Тяга с дефицита', group: 'back', pattern: 'hinge' },
  pin_press: { name: 'Жим с пинов', group: 'chest', pattern: 'horizontal_push' },
};
const SS_TECHNIQUE: Record<string,string> = {
  snatch:'Рывок: широкий хват, тяга + подрыв + уход в сед, фиксация над головой',
  hang_snatch:'С виса: контроль спины, взрыв бёдрами',
  power_snatch:'Без полного седа, скорость',
  muscle_snatch:'Силой без подседа, малый вес',
  snatch_pull:'Тяга до груди, без ухода, 90-110% рывка',
  snatch_balance:'Подсед + жим в сед, баланс',
  overhead_squat_v2:'Оверхед: штанга над головой, глубокий сед',
  back_squat:'Гриф на трапециях, глубина ниже параллели',
  front_squat:'Гриф на груди, вертикальный корпус',
  front_squat_clean_grip:'Фронт хватом чистого, локти высоко',
  clean_and_jerk:'Толчок: взятие + толчок в ножницы',
  hang_clean:'С виса, локти высоко',
  power_clean:'Силой, без полного седа',
  muscle_clean:'Силой без подседа, тяга',
  push_jerk:'Подсед + выталкивание, полуприсед',
  split_jerk:'Ножницы, фиксация',
  push_press:'Толчок ногами + жим',
  clean_pull:'Узкий хват, тяга до груди, 90-110% взятия',
  jerk_dip:'Подсед 8-12см, вертикально',
  hack_squat:'Спина прижата, колени по носкам',
  leg_press:'Стопы на ширине плеч, не блокировать колени',
  bulgarian_split:'Задняя нога на скамье, корпус вертикально',
  calf_raise:'Полная амплитуда, пауза вверху',
  log_press:'Бревно на груди, локти высоко, толчок',
  axle_press:'Аксель: толстый гриф 50мм, заброс + толчок, без вращения',
  viking_press:'Викинг: вертикальная машина/рама, жим от груди, кор напряжён',
  circus_db_press:'Толстая гантель, заброс + толчок одной',
  circus_db_medley:'Гантели-лестница: 3 веса по 2 повт, быстрый clean',
  axle_deadlift:'Толстый гриф, двойной хват без лямок',
  car_deadlift_18:'Автодедлифт 18″: рама-рычаг, квад-доминант, спина вертикально',
  car_deadlift_side:'Боковой автодедлифт: ручки сбоку, тяга вертикально',
  yoke_walk:'Кор напряжён, короткие шаги, не округлять. Brace 2с перед стартом',
  farmers_walk_heavy:'Хват без лямок, грудь вверх. 40м за 60с — темп',
  frame_carry:'Рама: как фермер тяжёлый, ручки сбоку, стабильность',
  husafell_carry:'Хусафелл на груди, обхват снизу, ходьба 40м, грудь к снаряду',
  conan_wheel:'Колесо Конана: обхват на груди, ход по кругу, дыхание',
  shield_carry:'Щит: прижать к груди, ход 20м, не ронять',
  duck_walk:'Утиная походка: низкий присед, гуськом 20м, кор напряжён',
  truck_pull:'Тяга грузовика: канат к себе/упряжь, ноги коротко, 20м/90с',
  arm_over_arm:'Канат: сидя, перехват к себе, ноги в упор',
  atlas_stone_load:'Обхват, через колени, мощное разгибание. Lap 2с',
  atlas_stone_over_bar:'Через планку 140см: lap + взрыв через высоту, подхват',
  natural_stone_shoulder:'Натуральный камень: неровный хват, на плечо, мощно',
  stone_lift:'Камень: обхват, подъём через колени',
  sandbag_shoulder:'Мешок: взрыв на плечо',
  sandbag_load:'Мешок: через колени на платформу 120-140см, взрыв разгибанием',
  sandbag_over_bar:'Мешок через планку: ниже чем камень, быстрый lap',
  sandbag_carry:'Мешок на груди, ходьба 30м, кор напряжён',
  keg_toss:'Бочка: взрыв бёдрами за спину через 3-4м планку',
  keg_over_bar:'Бочка через планку 140см: как sandbag_over_bar, легче',
  keg_load:'Бочка на платформу 100см: обхват, lap + нагрузка',
  zercher_carry:'Зерчер: штанга в сгибах локтей, кор напряжён',
  tire_flip:'Покрышка: присед + взрыв + толчок коленом. 60с AMRAP при тапере',
  sled_push_sprint:'Сани: лёгкий вес, спринт 25м, cap 30с',
  sled_drag:'Тяга саней: канат, спина прямая, короткие шаги',
  sled_push:'Толкание саней: упереться, толкать 20м',
  deficit_snatch:'С дефицита (2-4см): тяга длиннее, контроль спины',
  block_snatch:'С блоков: старт выше колен, акцент на подрыв',
  pause_snatch:'Пауза 2с у колен + взрыв, без потери позиции',
  high_hang_snatch:'Высокий вис 10см выше колен, короткий разгон, скорость',
  deficit_clean:'С дефицита: глубокая тяга, пятки прижаты',
  block_clean:'С блоков: мощный подрыв, быстрый уход',
  low_block_clean:'Низкие блоки 15см: старт с паузой, тяга длиннее',
  pause_clean:'Пауза у колен 2с, затем взятие',
  pause_squat:'Пауза 2-3с внизу, без отбива',
  tempo_squat:'Темп 3-0-1: медленно вниз, без паузы, мощно вверх',
  jerk_recovery:'Вставание из ножниц с весом над головой',
  behind_neck_jerk:'Из-за головы: вертикальный толчок, баланс',
  pause_jerk:'Пауза 2с в подседе перед толчком, синхрон',
  pause_pull:'Пауза 2с у колен, тяга до груди',
  deficit_pull:'С дефицита 3-5см, длинная амплитуда',
  pin_press:'Жим с пинов: старт с груди без импульса, сила',
  deadlift:'Нейтральная спина, гриф по ногам',
  sumo_dl:'Сумо: ноги широко, носки наружу',
  rdl:'Таз назад, гриф по ногам, растяжение бицепса бедра',
  squat:'Глубина, колени по носкам',
  bench_bar:'Лопатки сведены, грудь вверх',
  ohp:'Кор напряжён, без прогиба',
  db_press:'Гантели на уровне ушей, сведение вверху',
  row_bar:'Тяга к низу живота, сведение лопаток',
  row_db:'Упор, тяга к поясу, разворот',
  pullup:'Тяга грудью к перекладине, без раскачки',
  lateral_raise:'Махи до уровня плеч, мизинец вверх',
  face_pull:'Трос к лицу, разворот кистей',
  hip_thrust:'Таз вверх, пауза 2с, без переразгиба',
};
function getExerciseMeta(id: string): { name: string; group: string; pattern: string; equipment: string; technique?: string } | null {
  // P3: пробуем основной каталог 584 для обогащения (оборудование, техника)
  try{
    const main: any = (getExerciseById as any)(id);
    if (main) {
      return {
        name: main.name || SS_EX_META[id]?.name || id,
        group: main.group || SS_EX_META[id]?.group || 'legs',
        pattern: main.movementPattern || (main as any).pattern || SS_EX_META[id]?.pattern || 'unknown',
        equipment: main.equipment || 'barbell',
        technique: SS_TECHNIQUE[id] || main.technique,
      };
    }
  }catch{}
  const m = SS_EX_META[id];
  if (!m) return { name: id, group: 'legs', pattern: 'unknown', equipment: 'barbell', technique: SS_TECHNIQUE[id] };
  return { name: m.name, group: m.group, pattern: m.pattern, equipment: 'barbell', technique: SS_TECHNIQUE[id] };
}

export function buildStrengthSportPlan(input: StrengthSportInput): StrengthSportPlan {
  const weeks = clampWeeks(input.weeks);
  const daysPerWeek = clampDays(input.daysPerWeek);
  const level = (input.level as string) || 'intermediate';
  const mode = input.mode || 'weightlifting';
  const goal = input.goal || 'strength';

  // pattern — PRO: учитываем goal и equipment
  let pattern: StrengthSportPattern | undefined = input.patternId ? getStrengthSportPattern(input.patternId) : undefined;
  if (!pattern || pattern.sessionsPerRotation !== daysPerWeek || pattern.mode !== mode) {
    pattern = recommendStrengthSportPattern(mode, daysPerWeek, level, goal, input.equipment);
  }

  const outsideMetrics = computeOutsideMetrics(input.outsideLoad as OutsideLoad);
  const recoveryMult = computeRecMult({ bodyFat: input.bodyFat, leanMass: input.leanMass, hrvMs: input.hrvMs, sleepHours: input.sleepHours, stressLevel: input.stressLevel });
  const nutritionMult = computeNutMult({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  // P0-4 весогонка (лайт): строим протокол если передан weightCutKg / weightCutProtocolSS
  const wcProtoInput: any = (input as any).weightCutProtocolSS || (input as any).weightCutProtocol || null;
  const wcLossKg: number | null = typeof (input as any).weightCutKg === 'number' ? (input as any).weightCutKg : null;
  const wcProto: any = wcProtoInput || (wcLossKg ? buildWeightCutProtocolSS(wcLossKg, { startWeightKg: (input as any).bodyweight } as any) : null);
  const isWeightCut = !!wcProto;
  // P0 fix double count: weeklyBudget — базовый без ACWR/outside/VBT (сравниваем фактические сеты после редукции с базой)
  const acwrMult = input.acwr?.zone === 'dangerous' ? 0.60 : input.acwr?.zone === 'caution' ? 0.85 : input.acwr?.zone === 'undertrained' ? 1.10 : 1;
  const vbtMult = (input as any).velocityLossPct > 20 ? 0.90 : 1;
  const weeklyBudget = Math.round(computeBudget({ level, peds: input.peds, pedDoses: input.pedDoses as any, courseIntensity: input.courseIntensity as any, calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg, labMrvMultiplier: input.labMrvMultiplier, isWeightCut, recoveryMult }));
  // P0-5 frequencyPenalty — если outside high + 5× зал, форсим 3×
  let effectiveDaysPerWeek = daysPerWeek;
  if (outsideFrequencyPenalty(input.outsideLoad as OutsideLoad) === 1 && daysPerWeek >= 4) {
    effectiveDaysPerWeek = 3;
  }
  // если форсим дни — пересобираем pattern с учётом WL low
  if (effectiveDaysPerWeek !== daysPerWeek) {
    // PRO: для WL outside low не форсим 3× (WL интерференция низкая) — только high
    const isWLLow = mode === 'weightlifting' && outsideMetrics?.interference === 'low';
    if (!isWLLow) {
      const forced = recommendStrengthSportPattern(mode, effectiveDaysPerWeek, level, goal, input.equipment);
      if (forced.sessionsPerRotation === effectiveDaysPerWeek) pattern = forced;
    } else {
      effectiveDaysPerWeek = daysPerWeek;
    }
  }

  const weeksData: StrengthSportWeek[] = [];
  const rationale: string[] = [];
  rationale.push(`Режим: ${mode} · цель ${goal} · ${weeks} нед · ${pattern.name}`);
  if (outsideMetrics) rationale.push(`Вне зала: ${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier} (интерференция ${outsideMetrics.interference})`);
  rationale.push(`Recovery ×${recoveryMult.toFixed(2)} · Nutrition ×${nutritionMult.toFixed(2)} · Budget ${weeklyBudget} сетов/нед`);
  if (Array.isArray((input as any).weakPoints) && (input as any).weakPoints.length) rationale.push(`Слабые лифты: ${(input as any).weakPoints.join(', ')} → объём ×1.15 на целевые`);
  const contestAny: any = (input as any).contest;
  if (contestAny?.events?.length) {
    rationale.push(`Контест: ${contestAny.events.map((e:any)=> e.id).join(' + ')}${contestAny.name ? ` · ${contestAny.name}`:''}`);
    if (contestAny.events.some((e:any)=> e.ladderWeights)) rationale.push(`Лестница: веса по регламенту → прогрессия в плане`);
  }
  if (wcProto) {
    rationale.push(`Весогонка ТА: −${wcProto.targetLossKg}кг за ${wcProto.weeksOut}нед · вода ${wcProto.waterMode} · Na ${wcProto.sodiumMode} · угли ${wcProto.carbMode}`);
    const nutW1 = weightCutNutritionForWeekSS(1, weeks, wcProto, (input as any).bodyweight || 80, (input as any).sex || 'male');
    if (nutW1.kcal) rationale.push(`Питание W1: ${nutW1.kcal}ккал P${nutW1.proteinG}/C${nutW1.carbsG} · вода ${nutW1.waterMl}мл Na ${nutW1.sodiumMg}мг`);
    rationale.push(weightCutRehydrationNotesSS(wcProto.targetLossKg)[0]);
  }
  if (effectiveDaysPerWeek !== daysPerWeek) rationale.push(`Частота скорректирована: внезальная высокая → зал ${daysPerWeek}× → ${effectiveDaysPerWeek}× (frequencyPenalty)`);
  if (mode === 'strongman') {
    rationale.push(...buildTaperRationale(weeks, input.competitionDate));
    const cond0 = buildConditioningRationale(1, weeks, mode);
    if (cond0.length) rationale.push(`Кондиция: ${cond0.join(' | ')}`);
  }

  for (let w = 1; w <= weeks; w++) {
    const phase = (input.competitionDate && (input as any).startDate ? phaseForDate(w, weeks, goal, input.competitionDate, (input as any).startDate, mode) : phaseForWeek(w, weeks, goal, mode)) as any;
    const deload = phase === 'deload';
    const sessions: StrengthSportSession[] = [];
    let absoluteDay = 0;
    // PRO: поддержка rolling (rotationDays 4) → modulo, иначе 7
    for (let d = 0; d < 7; d++) {
      const slot = (pattern as StrengthSportPattern).schedule[d % (pattern as StrengthSportPattern).rotationDays];
      if (!slot || slot.kind !== 'тренировка') continue;
      const tag = slot.sessionTag || 'strength_day';
      const character = slot.character as any;
      const poolIds = POOL_BY_TAG[tag] || POOL_BY_TAG.strength_day;
      let pool = filterPool(poolIds, input);
      const primaryCount = tag === 'event_day' ? 3 : tag === 'technique_day' ? 3 : 2;
      const accessoryCount = tag === 'event_day' ? 1 : 2;
      const total = primaryCount + accessoryCount;
      const favSet = new Set((input.favoriteExercises || []).map(s => s.toLowerCase()));
      let chosen = selectDiverse(pool, tag, total, favSet);
      if (chosen.length < total) {
        for (const id of pool) { if (chosen.length >= total) break; if (!chosen.includes(id)) chosen.push(id); }
      }
      // C2: strongman event_day — гарантируем medley 2+1 (2 carries + 1 stone) как требует PRO
      // Contest Packet PRO: приоритизируем ивенты из заявленного контеста поверх generic
      const contest: any = (input as any).contest;
      if (tag === 'event_day' && mode === 'strongman' && Array.isArray(contest?.events) && contest.events.length) {
        const contestIds = contest.events.map((e:any)=> e.id).filter((id:string)=> typeof id === 'string');
        // вставляем контентовые carries приоритетно
        const isStoneContest = (id:string)=> ['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','stone_lift','sandbag_shoulder','sandbag_load','sandbag_over_bar','keg_toss','keg_over_bar','keg_load','circus_db_medley'].includes(id);
        const missingCarryContest = contestIds.filter((id:string)=> isCarryEvent(id) && !chosen.includes(id) && (pool.includes(id) || EVENT_META[id]));
        for (const cid of missingCarryContest.slice(0,2)) {
          // заменяем generic carry на contest carry если нужно
          const contestCarriesInChosen = chosen.filter(id=> contestIds.includes(id) && isCarryEvent(id)).length;
          if (contestCarriesInChosen >= 1 && missingCarryContest.length === 1) {
            // уже есть 1 contest carry, второй может быть generic — заменяем generic
            const genericCarryIdx = chosen.findIndex(id=> isCarryEvent(id) && !contestIds.includes(id));
            if (genericCarryIdx >=0) { chosen[genericCarryIdx]=cid; continue; }
            if (chosen.filter(isCarryEvent).length >=2) break;
          } else if (chosen.filter(isCarryEvent).length >=2) {
            const genericIdx2 = chosen.findIndex(id=> isCarryEvent(id) && !contestIds.includes(id));
            if (genericIdx2 >=0) { chosen[genericIdx2]=cid; continue; } else break;
          }
          const targetIdx = chosen.findIndex(id=> !isCarryEvent(id) && !isStoneContest(id));
          if (targetIdx >=0 && pool.includes(cid)) chosen[targetIdx]=cid;
          else if (!chosen.includes(cid) && chosen.length < total) chosen.push(cid);
          else if (!chosen.includes(cid)) {
            const genIdx = chosen.findIndex(id=> isCarryEvent(id) && !contestIds.includes(id));
            if (genIdx>=0) chosen[genIdx]=cid; else chosen[chosen.length-1]=cid;
          }
        }
        const missingStoneContest = contestIds.filter((id:string)=> isStoneContest(id) && !chosen.includes(id));
        for (const cid of missingStoneContest.slice(0,1)) {
          const hasContestStone = chosen.some(id=> contestIds.includes(id) && isStoneContest(id));
          if (hasContestStone) break;
          if (chosen.some(isStoneContest) && !contestIds.some((id:string)=> isStoneContest(id) && chosen.includes(id))) {
            const genericStoneIdx = chosen.findIndex(id=> isStoneContest(id) && !contestIds.includes(id));
            if (genericStoneIdx>=0) { chosen[genericStoneIdx]=cid; continue; }
          } else if (chosen.some(isStoneContest)) break;
          if (!chosen.includes(cid) && (pool.includes(cid) || EVENT_META[cid])) {
            const pushIdx = chosen.findIndex(id=> ['tire_flip','sled_push_sprint','car_deadlift_18','car_deadlift_side','axle_press','viking_press'].includes(id));
            if (pushIdx >=0) chosen[pushIdx]=cid;
            else if (chosen.length < total) chosen.push(cid);
            else {
              const gIdx = chosen.findIndex(id=> isStoneContest(id) && !contestIds.includes(id));
              if (gIdx>=0) chosen[gIdx]=cid; else chosen[chosen.length-1]=cid;
            }
          }
        }
        // если контест содержит специфичный overhead/drag — дублируем на event_day как частоту
        const overheadContest = contestIds.filter((id:string)=> ['log_press','axle_press','viking_press','circus_db_press','circus_db_medley'].includes(id) && !chosen.includes(id));
        if (overheadContest.length && chosen.length < total) {
          // оставляем как есть — overhead вынесется в overhead_day отдельно
        }
      }
      if (tag === 'event_day' && mode === 'strongman' && (!contest || !contest.events?.length)) {
        const isStoneId = (id:string)=> ['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load','sandbag_over_bar','stone_lift','sandbag_shoulder','keg_toss','keg_over_bar'].includes(id);
        const carriesInChosen = chosen.filter(id=> isCarryEvent(id));
        if (carriesInChosen.length < 2) {
          const carryPool = pool.filter(id=> isCarryEvent(id) && !chosen.includes(id));
          if (carryPool.length) {
            const replaceIdx = chosen.findIndex(id=> !isCarryEvent(id) && !isStoneId(id));
            if (replaceIdx >= 0) chosen[replaceIdx] = carryPool[0];
            else if (chosen.length < total) chosen.push(carryPool[0]);
            else chosen[chosen.length-1] = carryPool[0];
          }
        }
        const stonesInChosen = chosen.filter(id=> isStoneId(id));
        if (stonesInChosen.length === 0) {
          const stonePool = pool.filter(id=> isStoneId(id) && !chosen.includes(id));
          if (stonePool.length) {
            const pushIdx = chosen.findIndex(id=> ['tire_flip','sled_push_sprint','car_deadlift_18','car_deadlift_side','axle_press','viking_press'].includes(id));
            if (pushIdx >=0) chosen[pushIdx] = stonePool[0];
          }
        }
      }
      // overhead_day: инъекция контентового пресса
      if (tag === 'overhead_day' && mode === 'strongman' && Array.isArray(contest?.events)) {
        const pressContest = contest.events.map((e:any)=> e.id).filter((id:string)=> ['log_press','axle_press','viking_press','circus_db_press','circus_db_medley'].includes(id));
        for (const pid of pressContest) {
          if (!chosen.includes(pid) && pool.includes(pid)) {
            const repIdx = chosen.findIndex(id=> !['log_press','axle_press','viking_press','circus_db_press','circus_db_medley'].includes(id) && id !== pid);
            if (repIdx>=0) chosen[repIdx]=pid; else if (chosen.length<total) chosen.push(pid);
          }
        }
      }
      // deadlift_day: контестовый конэн/трак/дедлифт
      if (tag === 'deadlift_day' && mode === 'strongman' && Array.isArray(contest?.events)) {
        const dlContest = contest.events.map((e:any)=> e.id).filter((id:string)=> ['deadlift','deadlift_max','axle_deadlift','car_deadlift_18','car_deadlift_side','conan_wheel','truck_pull','shield_carry'].includes(id));
        for (const did of dlContest) {
          if (!chosen.includes(did) && (pool.includes(did) || EVENT_META[did])) {
            const repIdx = chosen.findIndex(id=> !['deadlift','sumo_dl','axle_deadlift','car_deadlift_18','car_deadlift_side','deadlift_max','rdl'].includes(id));
            if (repIdx>=0 && chosen.length>=total) chosen[repIdx]=did; else if (chosen.length<total) chosen.push(did);
          }
        }
      }
      const exercises: StrengthSportExercise[] = [];
      for (let idx = 0; idx < chosen.length; idx++) {
        const id = chosen[idx];
        const meta = getExerciseMeta(id) || { name: id, group: 'legs', pattern: 'unknown', equipment: 'barbell' };
        const isPrimary = idx < primaryCount;
        const taperWeeks = (input as any).taperWeeks ?? (goal === 'peaking' ? 1 : 0);
        const taper = taperWeeks > 0 && w > weeks - taperWeeks && (goal === 'peaking' || phase === 'peaking' || phase === 'deload');
        const built = buildExerciseSets(id, tag, phase, input, isPrimary, w);
        // P0-4 весогонка — режем объём в taper/fight_week
        if (wcProto) {
          const wcm = weightCutVolumeMultiplierSS(w, weeks, wcProto);
          if (wcm < 1) built.sets = Math.max(id === 'tire_flip' ? 1 : 2, Math.round(built.sets * wcm));
        }
        // P3 taper vs deload — taper Winwood precise, deload классика
        // Если контест указан — применяем per-event cessation: проверяем daysOut для этого ивента
        const compDateAny: string | undefined = (input as any).competitionDate;
        const startDateAny: string | undefined = (input as any).startDate;
        let finalSets = built.sets;
        let finalWeight = built.weight;
        let finalRir = built.rir;
        const minSets = id === 'tire_flip' ? 1 : 2;
        // Winwood precise: если контест + startDate известны, применяем daysOut логику для taper последней недели
        let winwoodTaper: any = null;
        if (compDateAny && startDateAny && mode === 'strongman') {
          try {
            const wkStart = new Date(startDateAny); wkStart.setDate(wkStart.getDate() + (w - 1) * 7);
            const daysOut = Math.round((new Date(compDateAny).getTime() - wkStart.getTime()) / 86400000);
            if (daysOut >= 0 && daysOut <= 14) {
              const need = (TAPER_CESSATION_DAYS as any)[id] ?? 5;
              if (daysOut < need && phase !== 'deload') {
                // событие уже cessated — режем объём сильнее, assistance none
                finalSets = Math.max(minSets, Math.round(built.sets * 0.45));
                finalWeight = Math.round(built.weight * 0.50 / 2.5) * 2.5;
                finalRir = 3;
              } else if (daysOut <= 9 && daysOut >= 0) {
                winwoodTaper = daysOut <= 3 ? WINWOOD_TAPER[1] : WINWOOD_TAPER[2];
              }
            }
          } catch {}
        }
        if (winwoodTaper) {
          finalSets = Math.max(minSets, Math.round(built.sets * winwoodTaper.volumeMult));
          finalWeight = Math.round(built.weight * winwoodTaper.intensityPctMult / 2.5) * 2.5;
          finalRir = winwoodTaper.assistance === 'none' ? 3 : winwoodTaper.assistance === 'reduced' ? 2 : built.rir;
        } else if (taper && !deload) { finalSets = Math.max(minSets, Math.round(built.sets * 0.55)); finalWeight = Math.round(built.weight * 0.92 / 2.5) * 2.5; finalRir = 1; }
        else if (taper && deload) { finalSets = Math.max(minSets, Math.round(built.sets * 0.45)); finalWeight = Math.round(built.weight * 0.90 / 2.5) * 2.5; finalRir = 1; }
        else if (deload) { finalSets = Math.max(minSets, Math.round(built.sets * 0.6)); finalWeight = Math.round(built.weight * 0.6 / 2.5) * 2.5; finalRir = 4; }
        // Contest weight progression: если контест задал вес для этого ивента — подгоняем прогрессию к нему
        if (contest?.events?.length) {
          const ce = contest.events.find((e:any)=> e.id === id);
          if (ce?.weight && ce.weight > 0) {
            const progress = weeks > 1 ? (w - 1) / (weeks - 1) : 1;
            const targetW = ce.weight;
            const startW = Math.round(targetW * 0.85 / 2.5) * 2.5;
            const contestW = Math.round((startW + (targetW - startW) * progress) / 2.5) * 2.5;
            // не опускаем ниже построенного, но не выше target
            if (!deload && !winwoodTaper) finalWeight = Math.min(contestW, Math.max(finalWeight, contestW * 0.85));
            if (winwoodTaper && winwoodTaper.weekFromEnd === 1) finalWeight = Math.min(finalWeight, targetW * 0.55);
          }
          if (ce?.distanceM && isCarryEvent(id)) {
            // дистанция контеста фиксирует workSets дистанцию
          }
          if (ce?.ladderWeights && ['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder'].includes(id)) {
            // ladder веса зададут attempt engine отдельно, тут не трогаем
          }
        }
        const workSets: StrengthSportSet[] = built.workSets.slice(0, finalSets).map(s => {
          const ns:any = { ...s, weight: finalWeight, rir: finalRir };
          // D3 deload: дистанция у carries ×0.5, камни ×0.7
          if (deload && isCarryEvent(id) && ns.distanceM) ns.distanceM = Math.max(10, Math.round(ns.distanceM * 0.5));
          if (deload && ['atlas_stone_load','atlas_stone_over_bar','sandbag_load','sandbag_over_bar','stone_lift','natural_stone_shoulder'].includes(id)) ns.reps = Math.max(1, Math.round(ns.reps * 0.7));
          // Winwood cessated — дистанция тоже срезана
          if (winwoodTaper && winwoodTaper.weekFromEnd === 1 && isCarryEvent(id) && ns.distanceM) ns.distanceM = Math.max(10, Math.round(ns.distanceM * 0.6));
          return ns;
        });
        const gentle = gentleFactor(id, input.injuries as any);
        let techniqueNote: string | undefined = (meta as any).technique || undefined;
        const eqFallback = (input.equipment || []).map((s: string)=> String(s).toLowerCase());
        const hasSpec = eqFallback.includes('other') || eqFallback.includes('specialty') || eqFallback.length === 0;
        if (!hasSpec && isStrong(id)) {
          const coeff = (STRONG_FALLBACK_COEFF as any)[id];
          if (coeff && coeff !== 1 && coeff < 0.86) {
            const fallbackNote = `(замена: вес ×${coeff} без снаряда)`;
            techniqueNote = techniqueNote ? `${techniqueNote} · ${fallbackNote}` : fallbackNote;
          }
        }
        // Strongman event distances: добавить в заметку дистанцию/время (и контестную если есть)
        if (isCarryEvent(id)) {
          const dm = (workSets[0] as any)?.distanceM;
          const tc = (workSets[0] as any)?.timeCapS;
          const ce2 = contest?.events?.find((e:any)=> e.id === id);
          const dmContest = ce2?.distanceM;
          const tcContest = ce2?.timeCapS;
          const dmFinal = dmContest ?? dm;
          const tcFinal = tcContest ?? tc;
          if (dmFinal) {
            const carryNote = `${dmFinal}м${tcFinal ? ` cap ${tcFinal}с` : ''}${dmContest ? ' (контест)' : ''}`;
            techniqueNote = techniqueNote ? `${techniqueNote} · ${carryNote}` : carryNote;
            // синхронизируем workSets с контестной дистанцией
            if (dmContest) workSets.forEach((ws:any)=> { ws.distanceM = dmContest; if (tcContest) ws.timeCapS = tcContest; });
          } else if (dm) {
            const carryNote = `${dm}м${tc ? ` cap ${tc}с` : ''}`;
            techniqueNote = techniqueNote ? `${techniqueNote} · ${carryNote}` : carryNote;
          }
        }
        // Платформа для stones + разворот
        if (['atlas_stone_load','atlas_stone_over_bar','sandbag_over_bar','keg_over_bar','natural_stone_shoulder','sandbag_load','keg_load'].includes(id)) {
          const ceStone = contest?.events?.find((e:any)=> e.id === id);
          if (ceStone?.heightCm) {
            const hNote = `платформа ${ceStone.heightCm}см`;
            techniqueNote = techniqueNote ? `${techniqueNote} · ${hNote}` : hNote;
          }
          if (ceStone?.turn) {
            const tNote = `разворот 180°`;
            techniqueNote = techniqueNote ? `${techniqueNote} · ${tNote}` : tNote;
          }
        }
        if (isCarryEvent(id)) {
          const ceCarry = contest?.events?.find((e:any)=> e.id === id);
          if (ceCarry?.turn) {
            const tNote = `разворот 180°`;
            if (!techniqueNote?.includes('разворот')) techniqueNote = techniqueNote ? `${techniqueNote} · ${tNote}` : tNote;
          }
        }
        // medley hint for event_day with multiple carries
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
          warmupSets: isPrimary ? buildWarmup(finalWeight, id) : [],
          tempo: tempoForSS(id, isPrimary ? 'тяж' : 'памп', phase),
          restSeconds: restForSS(isPrimary ? 'тяж' : 'памп', isPrimary, id, pctForSS(phase, goal)),
          comment: deload ? 'Делод — лёгкая неделя' : gentle < 1 ? 'Щадящий режим: снижен вес, +RIR' : techniqueNote,
          isCompetitionLift: isOly(id) || isStrong(id),
        };
        exercises.push(ex);
      }
      // C2 medley: strongman event_day с ≥2 carries → цепь 2+1 (90с переход cap 180с) PRO: contest medley variable 2-4
      if (tag === 'event_day' && mode === 'strongman') {
        // если контест задал medley implements — используем их
        const contestMedleyIds: string[] | null = (()=> {
          const ceMed = contest?.events?.find((e:any)=> e.format === 'medley_distance' && Array.isArray(e.implements) && e.implements.length>=2);
          if (ceMed) return ceMed.implements as string[];
          const medContest = contest?.events?.filter((e:any)=> ['medley_distance','medley_time'].includes(e.format) && e.implements)?.flatMap((e:any)=> e.implements) as string[] | undefined;
          if (medContest && medContest.length>=2) return medContest.slice(0,4);
          return null;
        })();
        const carries = exercises.filter(e => isCarryEvent(e.id));
        if (contestMedleyIds && contestMedleyIds.length>=2) {
          const medNames = contestMedleyIds.map(id=> exercises.find(e=> e.id===id)?.name || id).join(' → ');
          const firstMed = exercises.find(e=> e.id === contestMedleyIds[0]);
          if (firstMed) {
            const totalDistM = contestMedleyIds.reduce((a,id)=> a + ((exercises.find(e=> e.id===id)?.workSets[0] as any)?.distanceM || 20),0);
            const note = `Contest Medley: ${medNames} ${totalDistM}м (90с переход, cap 180с)`;
            firstMed.comment = firstMed.comment ? `${firstMed.comment} · ${note}` : note;
            contestMedleyIds.slice(0,2).forEach(id=> {
              const c = exercises.find(e=> e.id===id);
              if (c) { c.workSets.forEach((ws:any)=> { ws.timeCapS = 180; ws.restSeconds = 90; }); c.restSeconds = 90; }
            });
          }
        } else if (carries.length >= 2) {
          const medleyIds = carries.slice(0,2).map(c=> c.id);
          const medleyNames = carries.slice(0,2).map(c=> c.name).join(' → ');
          const totalDist = carries.slice(0,2).reduce((a,c)=> a + ((c.workSets[0] as any)?.distanceM||20),0);
          const note = `Medley: ${medleyNames} ${totalDist}м (90с переход, cap 180с)`;
          const first = carries[0];
          first.comment = first.comment ? `${first.comment} · ${note}` : note;
          carries.slice(0,2).forEach(c=> {
            c.workSets.forEach((ws:any)=> { ws.timeCapS = 180; ws.restSeconds = 90; });
            c.restSeconds = 90;
          });
          const stone = exercises.find(e=> ['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load','sandbag_over_bar','stone_lift','sandbag_shoulder','keg_toss','keg_over_bar'].includes(e.id));
          if (stone && carries.length===2) {
            stone.comment = stone.comment ? `${stone.comment} · Medley финишер` : 'Medley финишер';
            stone.workSets.forEach((ws:any)=> { ws.timeCapS = 60; });
          }
        }
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
    const taperWeeksOuter = (input as any).taperWeeks ?? (goal === 'peaking' ? 1 : 0);
    const isTaperWeek = taperWeeksOuter > 0 && w > weeks - taperWeeksOuter && (goal === 'peaking' || phase === 'peaking' || phase === 'deload');
    weeksData.push({ week: w, phase, deload, taper: isTaperWeek, sessions, totalSets, totalTonnage });
  }

  // DUP / intensity (изолированно, только зал)
  if (input.dupMode && input.dupMode !== 'off') {
    const tmp: any = { weeksData, level, rationale: [] };
    applyDUP(tmp as any, input.dupMode as any);
  }
  if (input.intensityTech && input.intensityTech !== 'none') {
    const tmp: any = { weeksData, level, rationale: [] };
    applyIntensity(tmp as any, input.intensityTech as any);
  }

  // Валидация
  const warnings: string[] = [];
  const errors: string[] = [];
  // outside высокая частота + 6× зала — предупреждение
  if (outsideMetrics && outsideMetrics.weeklyLoad > 1800 && pattern.sessionsPerRotation >= 5) {
    warnings.push(`Высокая внезальная нагрузка (${outsideMetrics.weeklyLoad}) + ${pattern.sessionsPerRotation}× зал — риск недовосстановления. Снизьте зал до 3×.`);
  }
  // Недельный бюджет: если totalSets > budget → warning + enforce до budget (режем accessory)
  for (const wk of weeksData) {
    if ((wk.totalSets || 0) > weeklyBudget * 0.9) {
      warnings.push(`Нед ${wk.week}: ${wk.totalSets} сетов близко к бюджету ${weeklyBudget}.`);
    }
    if ((wk.totalSets || 0) > weeklyBudget) {
      let cur = wk.totalSets || 0;
      // режем accessory сеты по 1 до входа в бюджет
      for (const sess of [...wk.sessions].sort((a,b)=> b.exercises.length - a.exercises.length)) {
        for (let i = sess.exercises.length-1; i>=0 && cur > weeklyBudget; i--) {
          const ex = sess.exercises[i];
          if ((ex as any).role === 'accessory' && ex.sets > 2) { ex.sets -=1; ex.workSets = ex.workSets.slice(0, ex.sets); cur -=1; }
        }
      }
      // если всё ещё > budget — режем любые с 3+ до 2
      for (const sess of wk.sessions) for (let i=sess.exercises.length-1; i>=0 && cur > weeklyBudget; i--) {
        const ex = sess.exercises[i];
        if (ex.sets > 2) { ex.sets -=1; ex.workSets = ex.workSets.slice(0, ex.sets); cur -=1; }
      }
      wk.totalSets = wk.sessions.reduce((a,s)=> a + s.exercises.reduce((x,e)=>x+e.sets,0),0);
    }
  }
  // Scoring gate: critical diagnostic → объём ×0.85 RIR+1 (PRO)
  if ((input as any).diagnosticLevel === 'critical') {
    for (const wk of weeksData) if (!wk.deload) {
      for (const sess of wk.sessions) for (const ex of sess.exercises) {
        if (ex.sets > 2) { const keep = Math.max(2, Math.round(ex.sets * 0.85)); if (keep < ex.sets) { ex.workSets = ex.workSets.slice(0, keep); ex.sets = keep; (ex.workSets as any[]).forEach((ws:any)=> ws.rir = Math.min(4, (ws.rir ?? 2) + 1)); } }
      }
      wk.totalSets = wk.sessions.reduce((a,s)=>a+s.exercises.reduce((x,e)=>x+e.sets,0),0);
    }
    warnings.push('CRITICAL diagnostic gate: объём ×0.85 RIR+1 (score≤49)');
  }

  // Спец-снаряды без оборудования
  const hasSpecialty = (input.equipment || []).includes('other') || (input.equipment || []).length === 0;
  if (!hasSpecialty && mode !== 'weightlifting') {
    const hasStrongEx = weeksData.some(w => w.sessions.some(s => s.exercises.some(e => isStrong(e.id))));
    if (hasStrongEx) warnings.push('Нет спец-снарядов (лог/йок/камни) — стронг-ивенты заменены на штангу/фермер.');
  }
  if (wcProto) {
    const errs = validateWeightCutProtocolSS(wcProto);
    for (const e of errs) warnings.push(e);
    if ((wcProto.targetLossKg || 0) > 5 && goal !== 'peaking') warnings.push(`Весогонка ${wcProto.targetLossKg}кг без цели peaking — объём снижен, но без тапера`);
  }

  const snap: any = { ...input };
  if (wcProto) snap.weightCutProtocolSS = wcProto;
  // S-1: WL attempts 6 — если есть ПМ рывка и толчка
  let wlMeetPlan: any = null;
  if (mode === 'weightlifting' && (input.workMax as any)?.snatch && (input.workMax as any)?.cleanJerk) {
    try { wlMeetPlan = buildWLMeetPlan((input.workMax as any).snatch, (input.workMax as any).cleanJerk, 'balanced', { bodyweight: input.bodyweight as any, sex: input.sex as any, age: input.age as any }); } catch {}
    if (wlMeetPlan) snap.wlMeetPlan = wlMeetPlan;
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
    inputSnapshot: snap,
    wlMeetPlan: wlMeetPlan as any,
  } as any;
  if (wcProto) (plan as any).weightCutProtocol = wcProto;
  return plan;
}

export function validateStrengthSportPlan(plan: StrengthSportPlan): { ok: boolean; warnings: string[]; errors: string[] } {
  return plan.validation || { ok: true, warnings: [], errors: [] };
}

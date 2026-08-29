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
import { adaptForPEDsSS } from './strength-sport-ped-adaptation';
import { filterByMobility, isAxialLoadExerciseSS } from './strength-sport-mobility';
import { lengthenedBonus } from './strength-sport-bonus';
import { warmupRampFor } from './strength-sport-warmup';
import { applyDUP } from './strength-sport-dup';
import { applyIntensity } from './strength-sport-intensity';
import { buildWeightCutProtocolSS, weightCutVolumeMultiplierSS, weightCutNutritionForWeekSS, weightCutRehydrationNotesSS, validateWeightCutProtocolSS } from './strength-sport-weight-cut.engine';
import { computeRecoveryMultiplier, computeNutritionMultiplier } from '../recovery-budget.engine';
import type { StrengthSportInput, StrengthSportPlan, StrengthSportWeek, StrengthSportSession, StrengthSportExercise, StrengthSportSet } from './strength-sport.types';

/** Пул упражнений по тегу — кандидаты (id каталога) + замены — P0-5: +15 вариаций ТА (high_hang/low_block/pause_jerk/tempo/pin) */
const POOL_BY_TAG: Record<string, string[]> = {
  snatch_day: ['snatch', 'hang_snatch', 'power_snatch', 'muscle_snatch', 'high_hang_snatch', 'deficit_snatch', 'block_snatch', 'pause_snatch', 'snatch_pull', 'pause_pull', 'overhead_squat_v2', 'snatch_balance', 'back_squat', 'front_squat'],
  clean_day: ['clean_and_jerk', 'hang_clean', 'power_clean', 'muscle_clean', 'deficit_clean', 'block_clean', 'low_block_clean', 'pause_clean', 'push_jerk', 'split_jerk', 'pause_jerk', 'push_press', 'jerk_recovery', 'behind_neck_jerk', 'front_squat_clean_grip', 'front_squat'],
  strength_day: ['squat', 'front_squat', 'back_squat', 'pause_squat', 'tempo_squat', 'deadlift', 'sumo_dl', 'rdl', 'bench_bar', 'db_press', 'ohp', 'pin_press'],
  technique_day: ['hang_snatch', 'hang_clean', 'high_hang_snatch', 'muscle_snatch', 'muscle_clean', 'snatch_balance', 'jerk_dip', 'overhead_squat_v2', 'pause_snatch', 'pause_clean', 'pause_jerk'],
  pull_day: ['snatch_pull', 'clean_pull', 'pause_pull', 'deficit_pull', 'rdl', 'deadlift', 'row_bar', 'pullup'],
  accessory_day: ['db_press', 'ohp', 'lateral_raise', 'face_pull', 'row_db', 'hip_thrust', 'pause_squat', 'tempo_squat'],
  overhead_day: ['log_press', 'circus_db_press', 'ohp', 'push_press', 'db_press', 'push_jerk', 'pause_jerk', 'jerk_recovery', 'behind_neck_jerk', 'pin_press'],
  deadlift_day: ['deadlift', 'sumo_dl', 'axle_deadlift', 'rdl', 'deficit_pull', 'farmers_walk_heavy', 'yoke_walk'],
  squat_day: ['squat', 'front_squat', 'pause_squat', 'tempo_squat', 'hack_squat', 'leg_press', 'bulgarian_split', 'calf_raise', 'overhead_squat_v2'],
  event_day: ['farmers_walk_heavy', 'yoke_walk', 'atlas_stone_load', 'stone_lift', 'sandbag_shoulder', 'zercher_carry', 'tire_flip', 'sled_push_sprint'],
  oly_day: ['snatch', 'clean_and_jerk', 'high_hang_snatch', 'snatch_pull', 'clean_pull', 'front_squat', 'pause_snatch', 'pause_clean', 'pause_jerk'],
};

const OLY_IDS = new Set(['snatch','hang_snatch','power_snatch','high_hang_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','low_block_clean','pause_clean','push_jerk','split_jerk','pause_jerk','snatch_pull','clean_pull','pause_pull','deficit_pull','snatch_balance','overhead_squat_v2','jerk_dip','jerk_recovery','behind_neck_jerk','pause_squat','tempo_squat']);
const STRONG_IDS = new Set(['log_press','yoke_walk','farmers_walk_heavy','atlas_stone_load','axle_deadlift','circus_db_press','tire_flip','stone_lift','sandbag_shoulder','zercher_carry','sled_push_sprint']);

function isOly(id: string): boolean { return OLY_IDS.has(id); }
function isStrong(id: string): boolean { return STRONG_IDS.has(id); }
function orderByMethod(exs: StrengthSportExercise[], method?: string): StrengthSportExercise[] {
  if (method === 'pre_exhaust') return [...exs].sort((a,b) => (a.role==='accessory'?-1:1) - (b.role==='accessory'?-1:1));
  if (method === 'post_exhaust') return [...exs].sort((a,b) => (a.role==='primary'?-1:1) - (b.role==='primary'?-1:1));
  return exs; // compound_first default: already primary first due to chosen order
}

function clampWeeks(w: number): number { return Math.max(2, Math.min(16, Math.round(Number(w) || 8))); }
function clampDays(d: number): number { return Math.max(2, Math.min(6, Math.round(Number(d) || 3))); }

const STRONG_FALLBACK: Record<string,string> = { log_press:'push_press', yoke_walk:'farmers_walk_heavy', farmers_walk_heavy:'deadlift', atlas_stone_load:'deadlift', axle_deadlift:'deadlift', circus_db_press:'db_press', tire_flip:'deadlift', stone_lift:'deadlift', sandbag_shoulder:'rdl', zercher_carry:'farmers_walk_heavy' };
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
    // P2-28: BFS по цепочке STRONG_FALLBACK (yoke→farmers→deadlift)
    const resolveFallback = (id: string, visited = new Set<string>()): string | null => {
      let cur = STRONG_FALLBACK[id];
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        // если кур доступен по hasOther? но мы без specialty — ищем первый доступный не-strong
        if (!['log_press','atlas_stone_load','yoke_walk','farmers_walk_heavy','circus_db_press','axle_deadlift','tire_flip','stone_lift'].includes(cur)) return cur;
        // иначе пробуем дальше
        const nxt = STRONG_FALLBACK[cur];
        if (nxt && !visited.has(nxt)) cur = nxt; else return cur;
      }
      return cur || null;
    };
    for (const orig of beforeTier) if (!out.includes(orig)) {
      const fb = resolveFallback(orig);
      if (fb && !out.includes(fb)) out.push(fb);
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
  if (knee && ['back_squat','front_squat','hack_squat','bulgarian_split','squat','overhead_squat_v2','snatch_balance'].includes(id)) return 0.6;
  if (back && ['deadlift','sumo_dl','axle_deadlift','yoke_walk','atlas_stone_load','snatch_pull','clean_pull'].includes(id)) return 0.6;
  if (shoulder && ['snatch','log_press','push_jerk','split_jerk','overhead_squat_v2','ohp','push_press'].includes(id)) return 0.65;
  if (wrist && ['clean_and_jerk','front_squat_clean_grip','hang_clean'].includes(id)) return 0.7;
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
  if (id === 'farmers_walk_heavy' || id === 'zercher_carry') return (wm as any).farmersWalk || wm.deadlift || 140;
  if (id === 'atlas_stone_load' || id === 'stone_lift' || id === 'sandbag_shoulder') return (wm as any).atlasStone || wm.deadlift || 100;
  if (id === 'axle_deadlift') return (wm as any).axleDeadlift || wm.deadlift || 120;
  if (id === 'circus_db_press') return (wm as any).circusDbPress || wm.logPress || wm.overheadPress || 60;
  if (['ohp','push_press','log_press','circus_db_press','bench_bar','pin_press','jerk_recovery','behind_neck_jerk','pause_jerk'].includes(id) || id.includes('press') || id.includes('jerk')) return wm.overheadPress || wm.bench || wm.logPress || 60;
  return wm.backSquat || 80;
}
function weightForExercise(id: string, input: StrengthSportInput, pct: number, week: number): number {
  const wm = input.workMax || {};
  const base = basePmFor(id, wm);
  const pm = pmForWeek(base, week, input, id);
  // P2-2: без спец-снарядов вес стронг-ивентов скорректирован ×0.85 (замена йока→фермер)
  const eq = (input.equipment || []).map((s: string) => String(s).toLowerCase());
  const hasOther = eq.includes('other') || eq.includes('specialty') || eq.length === 0;
  let w = Math.round((pm || base) * pct / 2.5) * 2.5;
  if (!hasOther && isStrong(id)) w = Math.round(w * 0.85 / 2.5) * 2.5;
  // P2-3: female overhead — 15% ниже из-за антропометрии (аналог BB femaleAdjust)
  if ((input as any).sex === 'female' && (id.includes('press') || id.includes('ohp') || id.includes('log') || id === 'bench_bar')) {
    w = Math.round(w * 0.88 / 2.5) * 2.5;
  }
  return w;
}

function buildWarmup(weight: number, id?: string): StrengthSportSet[] {
  return warmupRampFor(weight, id).map(s => ({ reps: s.reps, rir: s.rir, weight: s.weight } as StrengthSportSet));
}

function buildExerciseSets(id: string, tag: string, phase: string, input: StrengthSportInput, isPrimary: boolean, week: number): { sets: number; reps: [number, number]; rir: number; weight: number; workSets: StrengthSportSet[] } {
  const reps = repsFor(tag, phase, input.goal, isPrimary);
  const pct = pctFor(phase, input.goal, tag);
  const baseWeight = weightForExercise(id, input, pct, week);
  let sets = 3;
  if (isOly(id)) sets = phase === 'peaking' ? 5 : phase === 'deload' ? 3 : 5;
  else if (tag === 'event_day') sets = phase === 'deload' ? 2 : 3;
  else sets = phase === 'peaking' ? 4 : phase === 'deload' ? 2 : isPrimary ? 4 : 3;
  if (input.focus) {
    const f = volumeMultForExercise(id, input.focus);
    sets = Math.max(2, Math.min(6, Math.round(sets * f)));
  }
  // PRO: weakPoints — спец-объём +1 на слабые лифты (generic + WLWeakPoint точечно)
  if (Array.isArray((input as any).weakPoints) && (input as any).weakPoints.length) {
    const wp = (input as any).weakPoints.map((s: any) => String(s).toLowerCase());
    let weakMult = 1;
    const isSn = id.includes('snatch');
    const isCj = id.includes('clean') || id.includes('jerk');
    const isSq = id.includes('squat');
    const isOh = id.includes('press') || id.includes('ohp') || id.includes('log') || id === 'bench_bar';
    const isDl = id.includes('deadlift') || id.includes('pull') || id === 'rdl';
    const isCarry = id.includes('farmers') || id.includes('yoke') || id.includes('carry') || id.includes('sled');
    const isStone = id.includes('stone') || id.includes('sandbag') || id.includes('tire');
    // WLWeakPoint точечная коррекция: если id в списке коррекции для любого wp
    const isWeakCorrection = wp.some((w: string) => {
      const corr = (WL_WEAKPOINT_CORRECTION as any)[w];
      return Array.isArray(corr) && corr.includes(id);
    });
    if (isWeakCorrection) weakMult = 1.15;
    else if (wp.some((w: string) => w.includes('snatch') && isSn)) weakMult = 1.15;
    else if (wp.some((w: string) => (w.includes('clean') || w.includes('jerk')) && isCj)) weakMult = 1.15;
    else if (wp.some((w: string) => w.includes('squat') && isSq)) weakMult = 1.15;
    else if (wp.some((w: string) => (w.includes('overhead') || w.includes('press') || w.includes('жим')) && isOh)) weakMult = 1.15;
    else if (wp.some((w: string) => (w.includes('deadlift') || w.includes('тяг') || w.includes('pull')) && isDl)) weakMult = 1.15;
    else if (wp.some((w: string) => w.includes('carry') && isCarry)) weakMult = 1.15;
    else if (wp.some((w: string) => (w.includes('stone') || w.includes('кам')) && isStone)) weakMult = 1.15;
    if (weakMult !== 1) sets = Math.max(2, Math.min(6, Math.round(sets * weakMult)));
  }
  // Полный объём: outside × ACWR × VBT — мультипликативно
  const outM = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  const acwr = (input as any).acwr as { ratio:number; zone:string } | null | undefined;
  const vLoss = (input as any).velocityLossPct as number | undefined;
  if (outM < 1 && sets > 2) sets = Math.max(2, Math.round(sets * outM));
  if (acwr?.zone === 'dangerous' && sets > 2) sets = Math.max(2, Math.round(sets * 0.65));
  else if (acwr?.zone === 'caution' && sets > 2) sets = Math.max(2, Math.round(sets * 0.85));
  else if (acwr?.zone === 'undertrained') sets = Math.min(6, sets + 1);
  if (typeof vLoss === 'number' && vLoss > 20 && sets > 2) sets = Math.max(2, Math.round(sets * 0.90));
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
    if (typeof vLoss === 'number' && vLoss > 20) finalRir = Math.min(4, finalRir + 1);
    if (myTrend && myTrend.changePct < -5) finalRir = Math.min(4, finalRir + 1);
    if (outM < 0.75) finalRir = Math.min(4, finalRir + 1);
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
  const tempo = tempoForSS(id, isPrimary ? 'тяж' : 'памп', phase);
  const rest = restForSS(isPrimary ? 'тяж' : 'памп', isPrimary, id, pct);
  // P0-6: для стронга 300-360с, для oly 180с — теперь rest уже учитывает id+pct
  const finalRest = gentle < 1 ? rest + 30 : rest;
  const workSets: StrengthSportSet[] = [];
  for (let i = 0; i < sets; i++) {
    const rep = Math.round((finalReps[0] + finalReps[1]) / 2);
    workSets.push({ reps: rep, rir: finalRir, weight: finalWeight, pct: Math.round(pct * 100), tempo, restSeconds: finalRest });
  }
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
  circus_db_press:'Толстая гантель, заброс + толчок одной',
  axle_deadlift:'Толстый гриф, двойной хват без лямок',
  yoke_walk:'Кор напряжён, короткие шаги, не округлять',
  farmers_walk_heavy:'Хват без лямок, грудь вверх',
  atlas_stone_load:'Обхват, через колени, мощное разгибание',
  stone_lift:'Камень: обхват, подъём через колени',
  sandbag_shoulder:'Мешок: взрыв на плечо',
  zercher_carry:'Зерчер: штанга в сгибах локтей, кор напряжён',
  tire_flip:'Покрышка: присед + взрыв + толчок коленом',
  sled_push_sprint:'Сани: лёгкий вес, спринт 20-30м',
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
  if (wcProto) {
    rationale.push(`Весогонка ТА: −${wcProto.targetLossKg}кг за ${wcProto.weeksOut}нед · вода ${wcProto.waterMode} · Na ${wcProto.sodiumMode} · угли ${wcProto.carbMode}`);
    const nutW1 = weightCutNutritionForWeekSS(1, weeks, wcProto, (input as any).bodyweight || 80, (input as any).sex || 'male');
    if (nutW1.kcal) rationale.push(`Питание W1: ${nutW1.kcal}ккал P${nutW1.proteinG}/C${nutW1.carbsG} · вода ${nutW1.waterMl}мл Na ${nutW1.sodiumMg}мг`);
    rationale.push(weightCutRehydrationNotesSS(wcProto.targetLossKg)[0]);
  }
  if (effectiveDaysPerWeek !== daysPerWeek) rationale.push(`Частота скорректирована: внезальная высокая → зал ${daysPerWeek}× → ${effectiveDaysPerWeek}× (frequencyPenalty)`);

  for (let w = 1; w <= weeks; w++) {
    const phase = (input.competitionDate && (input as any).startDate ? phaseForDate(w, weeks, goal, input.competitionDate, (input as any).startDate) : phaseForWeek(w, weeks, goal)) as any;
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
        const taperWeeks = (input as any).taperWeeks ?? (goal === 'peaking' ? 1 : 0);
        const taper = taperWeeks > 0 && w > weeks - taperWeeks && (goal === 'peaking' || phase === 'peaking' || phase === 'deload');
        const built = buildExerciseSets(id, tag, phase, input, isPrimary, w);
        // P0-4 весогонка — режем объём в taper/fight_week
        if (wcProto) {
          const wcm = weightCutVolumeMultiplierSS(w, weeks, wcProto);
          if (wcm < 1) built.sets = Math.max(2, Math.round(built.sets * wcm));
        }
        // P3 taper vs deload — taper сохраняет интенсивность (Bosquet), deload снижает всё
        let finalSets = built.sets;
        let finalWeight = built.weight;
        let finalRir = built.rir;
        if (taper && !deload) { finalSets = Math.max(2, Math.round(built.sets * 0.55)); finalWeight = Math.round(built.weight * 0.92 / 2.5) * 2.5; finalRir = 1; }
        else if (taper && deload) { finalSets = Math.max(2, Math.round(built.sets * 0.45)); finalWeight = Math.round(built.weight * 0.90 / 2.5) * 2.5; finalRir = 1; }
        else if (deload) { finalSets = Math.max(2, Math.round(built.sets * 0.6)); finalWeight = Math.round(built.weight * 0.6 / 2.5) * 2.5; finalRir = 4; }
        const workSets: StrengthSportSet[] = built.workSets.slice(0, finalSets).map(s => ({ ...s, weight: finalWeight, rir: finalRir }));
        const gentle = gentleFactor(id, input.injuries as any);
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
          comment: deload ? 'Делод — лёгкая неделя' : gentle < 1 ? 'Щадящий режим: снижен вес, +RIR' : (meta as any).technique || undefined,
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
  if (wcProto) {
    const errs = validateWeightCutProtocolSS(wcProto);
    for (const e of errs) warnings.push(e);
    if ((wcProto.targetLossKg || 0) > 5 && goal !== 'peaking') warnings.push(`Весогонка ${wcProto.targetLossKg}кг без цели peaking — объём снижен, но без тапера`);
  }

  const snap: any = { ...input };
  if (wcProto) snap.weightCutProtocolSS = wcProto;
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
  } as any;
  if (wcProto) (plan as any).weightCutProtocol = wcProto;
  return plan;
}

export function validateStrengthSportPlan(plan: StrengthSportPlan): { ok: boolean; warnings: string[]; errors: string[] } {
  return plan.validation || { ok: true, warnings: [], errors: [] };
}

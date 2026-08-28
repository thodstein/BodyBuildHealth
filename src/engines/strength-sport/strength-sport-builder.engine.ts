/**
 * strength-sport-builder.engine.ts — генератор плана Силовой экстрим / ТА.
 * Уровень ББ-авто: периодизация, RIR/drift, outside-load, recovery, PED, ACWR-делод.
 * Только силовая часть зала — техника вне зала декларируется, не тренируется здесь.
 */
import { computeOutsideMetrics, outsideVolumeMultiplier, type OutsideLoad } from '../outside-load.engine';
import { getStrengthSportPattern, recommendStrengthSportPattern, type StrengthSportPattern } from './strength-sport-split-patterns';
import { SS_TAG_MUSCLES } from './strength-sport-day-types';
import { pmForWeek, rirForWeek, phaseForWeek, phaseForDate, buildPhaseDistribution } from './strength-sport-progression';
import { filterByTier, filterByInjury, selectDiverse } from './strength-sport-selection';
import { volumeMultForExercise } from './strength-sport-specialization';
import { tempoForSS, restForSS, pctForSS, repsForSS } from './strength-sport-loading';
import { adaptForPEDsSS } from './strength-sport-ped-adaptation';
import { filterByMobility } from './strength-sport-mobility';
import { lengthenedBonus } from './strength-sport-bonus';
import { warmupRampFor } from './strength-sport-warmup';
import { applyDUP } from './strength-sport-dup';
import { applyIntensity } from './strength-sport-intensity';
import type { StrengthSportInput, StrengthSportPlan, StrengthSportWeek, StrengthSportSession, StrengthSportExercise, StrengthSportSet } from './strength-sport.types';

/** Пул упражнений по тегу — кандидаты (id каталога) + замены — P0-5: +15 вариаций ТА */
const POOL_BY_TAG: Record<string, string[]> = {
  snatch_day: ['snatch', 'hang_snatch', 'power_snatch', 'muscle_snatch', 'deficit_snatch', 'block_snatch', 'pause_snatch', 'snatch_pull', 'pause_pull', 'overhead_squat_v2', 'snatch_balance', 'back_squat', 'front_squat'],
  clean_day: ['clean_and_jerk', 'hang_clean', 'power_clean', 'muscle_clean', 'deficit_clean', 'block_clean', 'pause_clean', 'push_jerk', 'split_jerk', 'push_press', 'jerk_recovery', 'behind_neck_jerk', 'front_squat_clean_grip', 'front_squat'],
  strength_day: ['squat', 'front_squat', 'back_squat', 'pause_squat', 'deadlift', 'sumo_dl', 'rdl', 'bench_bar', 'bench_bar', 'ohp'],
  technique_day: ['hang_snatch', 'hang_clean', 'muscle_snatch', 'muscle_clean', 'snatch_balance', 'jerk_dip', 'overhead_squat_v2', 'pause_snatch', 'pause_clean'],
  pull_day: ['snatch_pull', 'clean_pull', 'pause_pull', 'deficit_pull', 'rdl', 'deadlift', 'row_bar', 'pullup'],
  accessory_day: ['db_press', 'ohp', 'lateral_raise', 'face_pull', 'row_db', 'hip_thrust', 'pause_squat'],
  overhead_day: ['log_press', 'circus_db_press', 'ohp', 'push_press', 'db_press', 'push_jerk', 'jerk_recovery', 'behind_neck_jerk'],
  deadlift_day: ['deadlift', 'sumo_dl', 'axle_deadlift', 'rdl', 'deficit_pull', 'farmers_walk_heavy', 'yoke_walk'],
  squat_day: ['squat', 'front_squat', 'pause_squat', 'hack_squat', 'leg_press', 'bulgarian_split', 'calf_raise', 'overhead_squat_v2'],
  event_day: ['farmers_walk_heavy', 'yoke_walk', 'atlas_stone_load', 'stone_lift', 'sandbag_shoulder', 'zercher_carry', 'tire_flip', 'sled_push_sprint'],
  oly_day: ['snatch', 'clean_and_jerk', 'snatch_pull', 'clean_pull', 'front_squat', 'pause_snatch', 'pause_clean'],
};

const OLY_IDS = new Set(['snatch','hang_snatch','power_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','pause_clean','push_jerk','split_jerk','snatch_pull','clean_pull','pause_pull','deficit_pull','snatch_balance','overhead_squat_v2','jerk_dip','jerk_recovery','behind_neck_jerk','pause_squat']);
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
function pctFor(phase: string, goal: string): number {
  return pctForSS(phase, goal);
}

function basePmFor(id: string, wm: StrengthSportInput['workMax']): number {
  // точные + подстроковые для вариаций (deficit/block/pause)
  if (['snatch','hang_snatch','power_snatch','muscle_snatch','deficit_snatch','block_snatch','pause_snatch','snatch_pull','pause_pull','deficit_pull','snatch_balance','overhead_squat_v2'].includes(id) || id.includes('snatch')) return wm.snatch || 60;
  if (['clean_and_jerk','hang_clean','power_clean','muscle_clean','deficit_clean','block_clean','pause_clean','push_jerk','split_jerk','clean_pull','front_squat_clean_grip','jerk_dip','jerk_recovery','behind_neck_jerk'].includes(id) || id.includes('clean') || id.includes('jerk')) return wm.cleanJerk || wm.clean || wm.frontSquat || 80;
  if (['squat','back_squat','front_squat','hack_squat','front_squat_clean_grip','pause_squat','overhead_squat_v2'].includes(id) || id.includes('squat')) return wm.backSquat || wm.frontSquat || 100;
  if (['deadlift','sumo_dl','axle_deadlift','rdl','deficit_pull','pause_pull'].includes(id) || id.includes('deadlift') || id.includes('pull') && id.includes('deficit')) return wm.deadlift || 120;
  if (['ohp','push_press','log_press','circus_db_press','bench_bar','jerk_recovery','behind_neck_jerk'].includes(id) || id.includes('press') || id.includes('jerk')) return wm.overheadPress || wm.bench || wm.logPress || 60;
  return wm.backSquat || 80;
}
function weightForExercise(id: string, input: StrengthSportInput, pct: number, week: number): number {
  const wm = input.workMax || {};
  const base = basePmFor(id, wm);
  const pm = pmForWeek(base, week, input, id);
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  // P0-4: double-dip убран — outside уже режет сеты, вес не трогаем (как в BB fix 2)
  return Math.round((pm || base) * pct / 2.5) * 2.5;
}

function buildWarmup(weight: number, id?: string): StrengthSportSet[] {
  return warmupRampFor(weight, id).map(s => ({ reps: s.reps, rir: s.rir, weight: s.weight } as StrengthSportSet));
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
  // P0-7 ACWR: срезаем объём
  const acwr = (input as any).acwr as { ratio:number; zone:string } | null | undefined;
  if (acwr?.zone === 'dangerous' && sets > 2) sets = Math.max(2, Math.round(sets * 0.65));
  else if (acwr?.zone === 'caution' && sets > 2) sets = Math.max(2, Math.round(sets * 0.85));
  else if (acwr?.zone === 'undertrained') sets = Math.min(6, sets + 1);
  // P1 VBT: потеря скорости >20% — срезаем объём 10%
  const vLoss = (input as any).velocityLossPct as number | undefined;
  if (typeof vLoss === 'number' && vLoss > 20 && sets > 2) sets = Math.max(2, Math.round(sets * 0.90));
  const rir = rirForWeek(week, input.weeks, input.goal, isOly(id));
  let finalRir = rir;
  if (phase === 'deload') finalRir = 4;
  else if (acwr?.zone === 'dangerous') finalRir = Math.min(4, finalRir + 2);
  else if (acwr?.zone === 'caution') finalRir = Math.min(4, finalRir + 1);
  else if (typeof vLoss === 'number' && vLoss > 25) finalRir = Math.min(4, finalRir + 1);
  else if (typeof vLoss === 'number' && vLoss > 20) finalRir = Math.min(4, finalRir + 1);
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
  const rest = restForSS(isPrimary ? 'тяж' : 'памп', isOly(id) ? id : isStrong(id) ? id : undefined);
  // P0-6: для стронга 300-360с, для oly 180с — теперь rest уже учитывает id
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
// P0-4: бюджет per level (begin 60, inter 85, adv 110, enh 135) — вместо магии 112
function computeBudget(input: { level?: string; peds?: string[]; pedDoses?: Record<string, number>; courseIntensity?: string; calorieSurplus?: number; proteinPerKg?: number; labMrvMultiplier?: number }): number {
  const levelBase: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  const baseSets = levelBase[(input.level as string) || 'intermediate'] ?? 85;
  const ped = adaptForPEDsSS(input.peds, input.pedDoses as any, input.courseIntensity);
  const base = Math.round(baseSets * ped.mrvMult);
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
  // P0-5: 15 вариаций ТА для про-вариативности
  deficit_snatch: { name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge' },
  block_snatch: { name: 'Рывок с блоков', group: 'legs', pattern: 'hinge' },
  pause_snatch: { name: 'Рывок с паузой', group: 'legs', pattern: 'hinge' },
  deficit_clean: { name: 'Взятие с дефицита', group: 'legs', pattern: 'hinge' },
  block_clean: { name: 'Взятие с блоков', group: 'legs', pattern: 'hinge' },
  pause_clean: { name: 'Взятие с паузой', group: 'legs', pattern: 'hinge' },
  pause_squat: { name: 'Присед с паузой', group: 'legs', pattern: 'squat' },
  jerk_recovery: { name: 'Восстановление после толчка', group: 'legs', pattern: 'squat' },
  behind_neck_jerk: { name: 'Толчок из-за головы', group: 'shoulders', pattern: 'vertical_push' },
  pause_pull: { name: 'Тяга с паузой', group: 'back', pattern: 'hinge' },
  deficit_pull: { name: 'Тяга с дефицита', group: 'back', pattern: 'hinge' },
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
  deficit_clean:'С дефицита: глубокая тяга, пятки прижаты',
  block_clean:'С блоков: мощный подрыв, быстрый уход',
  pause_clean:'Пауза у колен 2с, затем взятие',
  pause_squat:'Пауза 2-3с внизу, без отбива',
  jerk_recovery:'Вставание из ножниц с весом над головой',
  behind_neck_jerk:'Из-за головы: вертикальный толчок, баланс',
  pause_pull:'Пауза 2с у колен, тяга до груди',
  deficit_pull:'С дефицита 3-5см, длинная амплитуда',
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

  // pattern
  let pattern: StrengthSportPattern | undefined = input.daysPerWeek ? getStrengthSportPattern((input as any).patternId) : undefined;
  if (!pattern || pattern.sessionsPerRotation !== daysPerWeek || pattern.mode !== mode) {
    pattern = recommendStrengthSportPattern(mode, daysPerWeek, level);
  }

  const outsideMetrics = computeOutsideMetrics(input.outsideLoad as OutsideLoad);
  const recoveryMult = computeRecMult({ bodyFat: input.bodyFat, leanMass: input.leanMass, hrvMs: input.hrvMs, sleepHours: input.sleepHours, stressLevel: input.stressLevel });
  const nutritionMult = computeNutMult({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  const outsideMult = outsideVolumeMultiplier(input.outsideLoad as OutsideLoad) || 1;
  // P0-7 ACWR: dangerous 0.60, caution 0.85, undertrained 1.10 — как в lms-builder
  const acwrMult = input.acwr?.zone === 'dangerous' ? 0.60 : input.acwr?.zone === 'caution' ? 0.85 : input.acwr?.zone === 'undertrained' ? 1.1 : 1;
  const weeklyBudget = Math.round(computeBudget({ level, peds: input.peds, pedDoses: input.pedDoses as any, courseIntensity: input.courseIntensity as any, calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg, labMrvMultiplier: input.labMrvMultiplier }) * acwrMult);

  const weeksData: StrengthSportWeek[] = [];
  const rationale: string[] = [];
  rationale.push(`Режим: ${mode} · цель ${goal} · ${weeks} нед · ${pattern.name}`);
  if (outsideMetrics) rationale.push(`Вне зала: ${outsideMetrics.weeklyLoad} load → объём ×${outsideMetrics.volumeMultiplier} (интерференция ${outsideMetrics.interference})`);
  rationale.push(`Recovery ×${recoveryMult.toFixed(2)} · Nutrition ×${nutritionMult.toFixed(2)} · Budget ${weeklyBudget} сетов/нед`);

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
        const built = buildExerciseSets(id, tag, phase, input, isPrimary, w);
        // deload — режем сеты и вес
        let finalSets = built.sets;
        let finalWeight = built.weight;
        let finalRir = built.rir;
        if (deload) { finalSets = Math.max(2, Math.round(built.sets * 0.6)); finalWeight = Math.round(built.weight * 0.6 / 2.5) * 2.5; finalRir = 4; }
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
          restSeconds: restForSS(isPrimary ? 'тяж' : 'памп', id),
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
    weeksData.push({ week: w, phase, deload, taper: w === weeks && goal === 'peaking', sessions, totalSets, totalTonnage });
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

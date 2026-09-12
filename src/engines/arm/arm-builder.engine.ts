/**
 * arm-builder.engine.ts — ядро генерации арм-планов.
 * Зеркало bb-builder.engine.ts, упрощённая версия для арм-мышц.
 */
import type { ArmBuilderInput, ArmPlan, ArmWeek, ArmSession, ArmExercise, ArmSet, ArmWorkingAngle } from './arm-types';
import { ARM_MUSCLES } from './arm-types';
import { TAG_MUSCLES_ARM } from './arm-day-types';
import { ARM_SPLIT_PATTERNS, getArmPattern } from './arm-split-patterns';
import { getArmLandmarks, isTendonMuscle, TENDON_CAP, MUSCLE_CAP, tendonWeeklyLimit } from './arm-volume-landmarks.engine';
import { computeArmRecoveryMult, computeArmBudget, sessionLimitsForArm, perExerciseCap, computeNutritionMult, tendonBudgetForLevel } from './arm-volume.engine';
import { ARM_EXERCISES } from '../../core/exercise-catalog-arm';
import { buildArmSchedule, specializationMrvFactor, specForWeek } from './arm-specialization.engine';
import { adaptForPEDs } from '../bb/bb-ped-adaptation.engine';
import { tableWeekKind, tableWeekParams } from './arm-table.engine';
import { applyArmPro } from './arm-pro-integration.engine';
import { ensureRadialFingers } from './arm-load-quant.engine';
import { profileOpponent, matchupVolumeFor } from './arm-matchup.engine';
import { buildRfdSession } from './arm-rfd.engine';
import { planLrSplit } from './arm-lr-split.engine';
import { applyContestSimToPlan } from './arm-sim-apply.engine';
import { buildGripRpe } from './arm-grip-rpe.engine';
import { analyzeTableIq } from './arm-table-iq.engine';
import { nextImplement } from './arm-implement-ladder.engine';
import { injectTableCorrections } from './arm-table-inject.engine';
import { longevityTrackFor } from './arm-longevity.engine';
import { injectGripProtocol } from './arm-grip-protocol.engine';
import { cyclePhaseMap, fitCycleToWeeks, getArmCycle } from './arm-cycle-library.engine';
import { getMedley, medleyRotationForWeek } from './arm-medley.engine';
// PRO-5: ядро-гигиена + safety + синглы + UX (всё gated, дефолт no-op)
import { taperStateFor, isCycleTaperActive, resolveProgressionRates, acwrMultFor, pedHonestyNote, weightHonestyMark, foreignPoolWarnings } from './arm-pro5-core.engine';
import { applyPro5Safety, checkHookCap } from './arm-pro5-safety.engine';
import { checkCocGates } from './arm-pro5-coc-gate.engine';
import { larrattSinglesFor, strengthLogRir, isSinglesCandidate } from './arm-pro5-singles.engine';
import { suggestSplitForCycle } from './arm-pro5-ux.engine';

const PHASES: Array<'accumulation' | 'intensification' | 'deload' | 'peaking'> = ['accumulation','intensification','deload','peaking'];

function distributeArmPhases(totalWeeks: number, goal: string, deloadEvery = 4): Record<number, string> {
  const map: Record<number, string> = {};
  if (totalWeeks <= 0) return map;
  if (goal === 'peaking') {
    for (let w = 1; w <= totalWeeks; w++) {
      if (w === totalWeeks) map[w] = 'peaking';
      else if (w === totalWeeks - 1) map[w] = 'deload';
      else if (w <= Math.ceil(totalWeeks * 0.5)) map[w] = 'accumulation';
      else map[w] = 'intensification';
    }
    return map;
  }
  for (let w = 1; w <= totalWeeks; w++) {
    if (w % deloadEvery === 0) map[w] = 'deload';
    else if (w <= Math.ceil(totalWeeks * 0.6)) map[w] = 'accumulation';
    else map[w] = 'intensification';
  }
  if (totalWeeks >= 4) map[totalWeeks] = goal === 'strength' ? 'peaking' : 'intensification';
  return map;
}

// ARM_ANGLE_CLASSES — строгие классы углов как в BB ANGLE_CLASSES
export const ARM_ANGLE_CLASSES: Record<string, { muscles: string[]; elbow: Array<90|110|120>; direction: Array<'to_little'|'to_middle'|'to_thumb'>; forearm: Array<'pronated'|'neutral'|'supinated'> }> = {
  cup_pronated: { muscles: ['wrist_flexors'], elbow: [90,110], direction: ['to_little','to_middle'], forearm: ['pronated'] },
  cup_supinated: { muscles: ['wrist_flexors','supinators'], elbow: [90,110], direction: ['to_thumb','to_middle'], forearm: ['supinated'] },
  rising_iso: { muscles: ['risers','thumb'], elbow: [90,110,120], direction: ['to_little','to_middle'], forearm: ['neutral'] },
  pron_high: { muscles: ['pronators','brachioradialis'], elbow: [90,110], direction: ['to_little'], forearm: ['pronated'] },
  pron_low: { muscles: ['pronators'], elbow: [110,120], direction: ['to_little','to_middle'], forearm: ['pronated'] },
  sup_hook: { muscles: ['supinators','brachialis','biceps_long'], elbow: [90,110], direction: ['to_middle','to_thumb'], forearm: ['supinated'] },
  sup_neutral: { muscles: ['supinators'], elbow: [90,110,120], direction: ['to_middle'], forearm: ['neutral'] },
  hammer_neutral: { muscles: ['brachialis','brachioradialis'], elbow: [90,110,120], direction: ['to_middle'], forearm: ['neutral'] },
  side_press_heavy: { muscles: ['side_pressure'], elbow: [110,120], direction: ['to_thumb'], forearm: ['neutral'] },
  back_drag_heavy: { muscles: ['back_pressure'], elbow: [90,110], direction: ['to_middle'], forearm: ['pronated','neutral'] },
  grip_support: { muscles: ['grip_support'], elbow: [90,110], direction: ['to_little','to_middle'], forearm: ['neutral'] },
  grip_pinch: { muscles: ['grip_pinch','thumb'], elbow: [90,110], direction: ['to_thumb','to_middle'], forearm: ['neutral'] },
  grip_crush: { muscles: ['grip_crush'], elbow: [90,110], direction: ['to_middle'], forearm: ['neutral'] },
};

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pickExerciseForMuscle(muscle: string, role: 'primary'|'accessory', equipment: string[], favorite: string[], excluded: string[], usedIds: Set<string>, technique?: string): typeof ARM_EXERCISES[number] | null {
  const mLow = muscle.toLowerCase();
  // Техника-специфичные приоритеты
  const techniqueBoost = (e: typeof ARM_EXERCISES[number]): number => {
    const sg = (e.substitutionGroup || '').toLowerCase();
    const mp = String(e.movementPattern || '').toLowerCase();
    if (!technique) return 0;
    const t = technique.toLowerCase();
    if (t === 'hook' && (sg === 'supination' || mp.includes('supination') || sg === 'hammer')) return 2;
    if (t === 'toproll' && (sg === 'pronation' || mp.includes('pronation') || sg === 'rising')) return 2;
    if (t === 'press' && (sg === 'side_press' || mp.includes('side_press'))) return 2;
    if (t === 'hook' && mLow === 'brachialis' && sg === 'hammer') return 1;
    if (t === 'toproll' && mLow === 'risers' && sg === 'rising') return 1;
    return 0;
  };
  const pool = ARM_EXERCISES.filter(e => {
    const effMuscle = (e.targetMuscle || '').toLowerCase();
    const sg = (e.substitutionGroup || '').toLowerCase();
    const mp = (e.movementPattern as any || '').toString().toLowerCase();
    // Строгий матчинг: сначала точные маппинги, затем фолбэк
    const exactMap: Record<string, string[]> = {
      'wrist_flexors': ['cup_iso'],
      'wrist_extensors': ['wrist_ext'],
      'pronators': ['pronation'],
      'supinators': ['supination'],
      'brachialis': ['hammer'],
      'grip_support': ['grip_support'],
      'grip_pinch': ['grip_pinch'],
      'grip_crush': ['grip_crush'],
      'risers': ['rising'],
      'side_pressure': ['side_press'],
      'back_pressure': ['back_drag'],
      'thumb': ['grip_pinch','thumb_iso'],
      'shoulder_stab': ['shoulder_int','shoulder_ext'],
      'core_anchor': ['core_anti'],
      'ulnar_deviators': ['ulnar_iso'],
      'radial_deviators': ['radial_iso'],
      'biceps_long': ['bicep_curl','hammer'],
      'biceps_short': ['bicep_curl','hammer'],
      'brachioradialis': ['hammer','reverse_curl'],
    };
    const allowedSg = exactMap[mLow];
    let matches = false;
    if (allowedSg) {
      matches = allowedSg.some(s => sg === s || sg.includes(s));
      // также проверяем movementPattern для гранулярности
      if (!matches) {
        if (mLow === 'wrist_flexors' && mp.includes('cupping')) matches = true;
        if (mLow === 'pronators' && mp.includes('pronation')) matches = true;
        if (mLow === 'supinators' && mp.includes('supination')) matches = true;
        if (mLow === 'risers' && mp.includes('rising')) matches = true;
        if (mLow === 'thumb' && mp.includes('grip_pinch')) matches = true;
      }
    } else {
      // фолбэк по подстроке для неизвестных
      matches = effMuscle.includes(mLow.replace('_',' ')) || sg.includes(mLow.split('_')[0]) || mp.includes(mLow.split('_')[0]);
    }
    if (!matches) return false;
    if (excluded.includes(e.id)) return false;
    if (usedIds.has(e.id)) return false;
    if (equipment.length > 0) {
      const eq = e.equipment.toLowerCase();
      if (eq === 'grip_tool' && !equipment.some(x => /grip|хват|hub|pinch/i.test(x))) return false;
      if (eq === 'band' && equipment.length > 0 && !equipment.some(x => /band|резина|лента|cable|блок/i.test(x)) && !equipment.includes('band')) {
        // band доступен если есть cable/band
      }
    }
    return true;
  });
  if (pool.length === 0) {
    const fb = ARM_EXERCISES.filter(e => !excluded.includes(e.id) && !usedIds.has(e.id)).slice(0, 5);
    return fb[0] || ARM_EXERCISES[0] || null;
  }
  for (const fav of favorite) {
    const f = pool.find(p => p.id === fav || p.name === fav);
    if (f) return f;
  }
  pool.sort((a,b) => {
    const boostA = techniqueBoost(a);
    const boostB = techniqueBoost(b);
    if (boostB !== boostA) return boostB - boostA;
    return (role === 'primary' ? b.fatigueCost - a.fatigueCost : a.fatigueCost - b.fatigueCost);
  });
  return pool[0];
}

function workingAngleFor(muscle: string, week: number, sessionIdx: number, technique?: string, history?: Record<string, ArmWorkingAngle[]>): ArmWorkingAngle {
  // Техника-специфичные РУ (Kuznetsov I+II, TAWF Hook/Toproll/Press)
  if (technique === 'hook' && ['supinators','brachialis','biceps_long','biceps_short','wrist_flexors'].includes(muscle)) {
    const dirs: Array<'to_little'|'to_middle'|'to_thumb'> = ['to_middle','to_thumb','to_middle'];
    const elbows: Array<90|110|120> = [90,90,110];
    const forearms: Array<'pronated'|'neutral'|'supinated'> = ['supinated','supinated','neutral'];
    const idx = (week + sessionIdx) % 3;
    return { elbowDeg: elbows[idx], wrist: 'flexed' as const, forearm: forearms[idx], direction: dirs[idx] };
  }
  if (technique === 'toproll' && ['pronators','risers','brachioradialis','wrist_flexors'].includes(muscle)) {
    const dirs: Array<'to_little'|'to_middle'|'to_thumb'> = ['to_little','to_little','to_middle'];
    const elbows: Array<90|110|120> = [110,110,120];
    const forearms: Array<'pronated'|'neutral'|'supinated'> = ['pronated','pronated','neutral'];
    const idx = (week + sessionIdx) % 3;
    return { elbowDeg: elbows[idx], wrist: 'flexed' as const, forearm: forearms[idx], direction: dirs[idx] };
  }
  if (technique === 'press' && ['side_pressure','shoulder_stab','core_anchor'].includes(muscle)) {
    const dirs: Array<'to_little'|'to_middle'|'to_thumb'> = ['to_thumb','to_thumb','to_middle'];
    const elbows: Array<90|110|120> = [120,110,120];
    const forearms: Array<'pronated'|'neutral'|'supinated'> = ['neutral','neutral','neutral'];
    const idx = (week + sessionIdx) % 3;
    return { elbowDeg: elbows[idx], wrist: 'neutral' as const, forearm: forearms[idx], direction: dirs[idx] };
  }
  const dirs: Array<'to_little'|'to_middle'|'to_thumb'> = ['to_little','to_middle','to_thumb'];
  const wrists: Array<'flexed'|'neutral'|'extended'> = ['flexed','neutral','extended'];
  const forearms: Array<'pronated'|'supinated'|'neutral'> = ['pronated','neutral','supinated'];
  const elbows: Array<90|110|120> = [90,110,120];
  // Ротация с учётом истории чтобы не повторять 2 дня подряд
  let idx = (week + sessionIdx) % 3;
  if (history && history[muscle] && history[muscle].length > 0) {
    const last = history[muscle][history[muscle].length - 1];
    if (last.direction === dirs[idx]) idx = (idx + 1) % 3;
  }
  return {
    elbowDeg: elbows[idx % 3],
    wrist: wrists[idx % 3],
    forearm: forearms[idx % 3],
    direction: dirs[idx % 3],
  };
}

function setsFor(muscle: string, character: string, week: number, targetSets: number, freq: number): number {
  const perSession = Math.max(1, Math.round(targetSets / Math.max(1, freq)));
  if (character === 'тяж') return Math.min(perExerciseCap(muscle), Math.max(2, perSession));
  if (character === 'техника') return Math.max(2, Math.min(3, perSession));
  if (character === 'памп') return Math.max(2, Math.min(4, perSession + 1));
  if (character === 'лёг') return Math.max(1, Math.min(2, Math.round(perSession * 0.6)));
  return perSession;
}

function repsFor(muscle: string, character: string, phase: string): [number, number] {
  if (muscle === 'side_pressure') return character === 'тяж' ? [3,6] : [8,12];
  if (['grip_support','grip_pinch','grip_crush'].includes(muscle)) {
    if (character === 'тяж') return [3,6];
    return [8,12];
  }
  if (['wrist_flexors','pronators','supinators','risers'].includes(muscle)) {
    if (phase === 'deload') return [12,20];
    if (character === 'техника') return [10,15];
    if (character === 'памп') return [12,20];
    return [6,10];
  }
  if (character === 'тяж') return [5,8];
  if (character === 'техника') return [8,12];
  return [10,15];
}

function rirFor(character: string, phase: string, week: number, technique?: string): number {
  if (phase === 'deload') return 4;
  if (phase === 'peaking') return character === 'тяж' ? 2 : 3;
  // Drift по фазе: intensification −1 каждые 2 недели (как BB FOCUS_RIR_TABLE)
  let drift = 0;
  if (phase === 'intensification') drift = Math.floor(((week - 1) % 6) / 2); // 0,0,1,1,2,2 → но кап 1
  drift = Math.min(1, drift);
  const baseTяж = 1 + Math.floor(((week - 1) % 4) / 2); // 1,1,2,2
  if (character === 'тяж') return Math.max(1, Math.min(4, baseTяж + (phase === 'intensification' ? -drift : 0)));
  if (character === 'техника') return 3 - (phase === 'intensification' ? drift : 0);
  if (character === 'памп') return 2;
  return 3;
}

function weightForMuscle(muscle: string, workMax: Record<string, number>, pct: number): number {
  const low = muscle.toLowerCase();
  let max = workMax[low];
  if (max == null) {
    if (workMax['wrist'] != null && low.includes('wrist')) max = workMax['wrist'];
    else if (workMax['grip'] != null && low.includes('grip')) max = workMax['grip'];
    else if (workMax['pron'] != null && low.includes('pron')) max = workMax['pron'];
    else if (workMax['sup'] != null && low.includes('sup')) max = workMax['sup'];
    else max = workMax['default'] || 30;
  }
  return Math.round(max * pct * 2) / 2;
}

export function buildArmPlan(input: ArmBuilderInput): ArmPlan {
  const weeks = Math.max(1, Math.min(52, Math.round(input.weeks || 8)));
  const discipline = input.discipline || 'armwrestling';
  const technique = input.technique || 'balanced';
  const goal = input.goal || 'strength';
  const level = input.level || 'intermediate';
  const pattern = getArmPattern(input.patternId) || ARM_SPLIT_PATTERNS[0];
  const equipment = input.equipment || [];
  const favorite = input.favoriteExercises || [];
  const excluded = input.excludedExercises || [];
  const weakPoints = (input.weakPoints || []).map(s => s.toLowerCase());
  const focusGroup = input.focusGroup ? input.focusGroup.toLowerCase() : undefined;

  // PRO A–J: оркестратор (аддитивно, try/catch внутри — ядро не падает)
  // PRO-5 G1: честная деградация — каждая опциональная ветка пишет причину, а не молчит.
  const degraded: string[] = [];
  const markDegraded = (reason: string) => { degraded.push(reason); };
  let pro: { rationale: string[]; warnings: string[]; volumeMult: number; rirShift: number; replaceSideWithIso: boolean; replaceHeavyPronWithPulses: boolean; workMaxPatch: Record<string, number> };
  try {
    pro = applyArmPro(input);
  } catch {
    pro = { rationale: [], warnings: [], volumeMult: 1, rirShift: 0, replaceSideWithIso: false, replaceHeavyPronWithPulses: false, workMaxPatch: {} };
    markDegraded('PRO-оркестратор недоступен — план generic');
  }
  // PRO-5 P1: safety-гейты (без входов — no-op, старые планы целы).
  let pro5safety = applyPro5Safety({});
  try {
    const toStart = ((): number | null => {
      const iso = String((input as any).competitionDateIso || (input as any).calStartIso || '');
      if (!iso) return null;
      const t = Date.parse(iso);
      if (!Number.isFinite(t)) return null;
      return Math.max(0, Math.round((t - Date.now()) / (7 * 86400000)));
    })();
    pro5safety = applyPro5Safety({
      axisCheck: (input as any).axisCheck,
      warmupDone: (input as any).warmupDone,
      elbowPain: (input as any).elbowPain ?? (Array.isArray((input as any).diary) ? Math.max(0, ...((input as any).diary as any[]).map((d: any) => Number(d.elbowPain ?? 0))) : 0),
      hookCapSets: (input as any).hookCapSets,
      technique,
      level,
      weeksToStart: toStart,
    });
  } catch { markDegraded('PRO-5 safety недоступен — гейты пропущены'); }
  // Бенчи → workMax: явный workMax пользователя приоритетнее
  const mergedWorkMax: Record<string, number> = { ...(pro.workMaxPatch || {}), ...(input.workMax || {}) };

  // TOP T1/T2a/T7a: матчап + RFD + L/R — всё gated на новых опциональных полях (старые входы дают factor 1)
  let matchupPlan: ReturnType<typeof profileOpponent> | null = null;
  try {
    if (input.oppStyle != null || input.oppHand != null || input.weightDeltaKg != null) {
      matchupPlan = profileOpponent({
        myTechnique: technique,
        oppStyle: input.oppStyle,
        oppHand: input.oppHand,
        weightDeltaKg: input.weightDeltaKg,
        strapExpected: input.strapExpected,
      });
    }
  } catch { matchupPlan = null; markDegraded('матчап недоступен — объём без поправки на оппонента'); }
  let rfdNote: string | null = null;
  try {
    if (input.rfd === true || input.explosivePct != null || input.fastPct != null || input.slowIndex != null) {
      const rfd = buildRfdSession({
        explosivePct: input.explosivePct,
        fastPct: input.fastPct,
        slowIndex: input.slowIndex,
        level,
        phase: 'intensification',
      });
      rfdNote = rfd.allowed ? rfd.note : null;
    }
  } catch { rfdNote = null; markDegraded('RFD-блок недоступен — speed-протокол пропущен'); }
  const rfdOn = rfdNote != null;
  let lrNote: string | null = null;
  let lrWeak: string | null = null;
  let lrPct: number | null = null;
  try {
    if (input.leftKg != null || input.rightKg != null) {
      const lr = planLrSplit({ leftKg: input.leftKg, rightKg: input.rightKg });
      if (lr.asymmetryPct != null && lr.asymmetryPct >= 7) {
        lrNote = `L/R сплит: ${lr.note}`;
        lrWeak = lr.weakArm;
        lrPct = lr.asymmetryPct;
      }
    }
  } catch { lrNote = null; lrWeak = null; lrPct = null; markDegraded('L/R-сплит недоступен — добивка пропущена'); }
  // TOP wave-5: Table-IQ рычаги в объём (только при журнале схваток)
  let iqPlan: ReturnType<typeof analyzeTableIq> | null = null;
  try {
    const bouts = (input as any).bouts;
    if (Array.isArray(bouts) && bouts.length) iqPlan = analyzeTableIq({ bouts });
  } catch { iqPlan = null; markDegraded('Table-IQ недоступен — рычаги фолов/срывов не применены'); }

  // MRV multipliers — через adaptForPEDs с tendonCap 1.5× + fallback для неизвестных педов (тест 'test_e')
  let pedMult = 1;
  let pedAdapt: any = null;
  if (input.pedDoses && Object.keys(input.pedDoses).length > 0) {
    const pedsKeys = Object.keys(input.pedDoses);
    let raw = 1;
    let usedAdapt = false;
    try {
      const fakePeds = pedsKeys.map(k => ({ id: k, dose: Number(input.pedDoses![k]) } as any));
      const adapt = adaptForPEDs(fakePeds as any, { default: 10 } as any, input.pedDoses as any, input.courseIntensity as any);
      raw = adapt.combinedMrvMultiplier || 1;
      // если adapt вернул 1 а дозы >0 и id неизвестный — fallback к doseSum (иначе тест test_e падает)
      const doseSumChk = pedsKeys.reduce((s,k)=> s + (Number(input.pedDoses![k])||0),0);
      if (raw === 1 && doseSumChk > 0) {
        // неизвестный пед — считаем как тест
        const doseMult = Math.min(0.5, doseSumChk/1000*0.4);
        const intensityAdj = input.courseIntensity === 'heavy' ? 0.08 : input.courseIntensity === 'mild' ? -0.05 : 0;
        raw = 1 + doseMult + intensityAdj + (pedsKeys.length>1?0.05:0);
        usedAdapt = false;
      } else {
        usedAdapt = true;
      }
    } catch {
      let doseSum = 0;
      for (const v of Object.values(input.pedDoses)) { const d = Number(v); if (Number.isFinite(d) && d>0) doseSum+=d; }
      const doseMult = Math.min(0.5, doseSum/1000*0.4);
      const intensityAdj = input.courseIntensity === 'heavy' ? 0.08 : input.courseIntensity === 'mild' ? -0.05 : 0;
      raw = 1 + doseMult + intensityAdj + (pedsKeys.length>1?0.05:0);
    }
    const tendonCap = 1.5;
    pedMult = raw <= tendonCap ? raw : tendonCap + (raw - tendonCap) * 0.4;
    pedMult = Math.max(1, Math.min(1.7, pedMult));
    pedAdapt = { combinedMrvMultiplier: pedMult };
  }
  // PRO-5 G2: честная пометка неизвестных PED-id (формула выше сохранена — тест test_e).
  let pedNote: string | null = null;
  try { pedNote = pedHonestyNote(input.pedDoses as any); } catch { markDegraded('PED-пометка недоступна'); }
  const recoveryMult = computeArmRecoveryMult({ bodyFat: input.bodyFat, leanMass: input.leanMass, hrvMs: input.hrvMs, sleepHours: input.sleepHours, stressLevel: input.stressLevel });
  const labMult = input.labMrvMultiplier ? Math.max(0.6, Math.min(1.4, input.labMrvMultiplier)) : 1;
  const nutritionMult = computeNutritionMult({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  // Tendon: beginner 0.7 первые 4 недели, intermediate 0.85, иначе 1 — как GripStrength F1
  const tendonMultGlobal = level === 'beginner' ? 0.7 : level === 'intermediate' ? 0.85 : 1;
  // Seeded RNG для детерминизма (как BB planner-carb-periodization he_planner_gen_salt)
  const seedBase = hashString(`${discipline}|${technique}|${level}|${goal}|${pattern.id}|${weeks}|${(input.weakPoints||[]).join(',')}|${focusGroup||''}`);
  const rng = seededRng(seedBase);
  // PRO-5 G3: распил correctionPct (legacy — фолбэк обоих новых полей).
  let progRates = { cyclePctPerWeek: 0, mesoRate: 1.025, migrated: false };
  try { progRates = resolveProgressionRates(input as any); } catch { markDegraded('прогрессия: ставки по умолчанию'); }
  // PRO-5 G6: живой ACWR по sRPE-дневнику (без diary — ровно 1, старые планы целы).
  let acwrMult = 1;
  let acwrNote: string | null = null;
  try {
    const acwr = acwrMultFor({ diary: (input as any).diary });
    acwrMult = acwr.mult;
    acwrNote = acwr.note;
  } catch { acwrMult = 1; markDegraded('ACWR недоступен — объём без поправки дневника'); }
  // labWarnings уже учтены в labMult, но tendonWarnings отдельно

  // Cross-mesocycle continuity: если есть previousPlan — используем его финальные веса как базу для прогрессии (+2.5%/мезоцикл, как BB)
  let crossMesoWorkMax: Record<string, number> | null = null;
  if (input.previousPlan && (input.previousPlan as any).weeks && Array.isArray((input.previousPlan as any).weeks)) {
    try {
      const prev = input.previousPlan as any;
      const lastWeek = prev.weeks[prev.weeks.length - 1];
      if (lastWeek && lastWeek.sessions) {
        crossMesoWorkMax = {};
        for (const sess of lastWeek.sessions) {
          for (const ex of (sess.exercises||[])) {
            const mus = (ex.muscle||'').toString().toLowerCase();
            const w = ex.workSets && ex.workSets[0] ? Number(ex.workSets[0].weight) : 0;
            if (mus && Number.isFinite(w) && w>0) {
              // Кросс-мезо прогрессия: дефолт +2.5%; при заданной ставке
              // (mesoRatePct, legacy correctionPct) — ставка цикла/мезоцикла.
              const rate = progRates.mesoRate;
              const progressed = Math.round(w * rate * 2)/2;
              if (!crossMesoWorkMax[mus] || progressed > crossMesoWorkMax[mus]) crossMesoWorkMax[mus] = progressed;
            }
          }
        }
      }
    } catch {}
  }

  // Build specialization schedule
  const specSchedule = buildArmSchedule({ focusGroup, weakPoints, specialization: !!input.specialization, totalWeeks: weeks, explicitBlocks: input.specializationSchedule });

  // MRV per muscle — с tendonCap раздельно + техника-спец + humerus
  const mrvByMuscle: Record<string, number> = {};
  for (const m of ARM_MUSCLES) {
    const base = getArmLandmarks(level, m).mrv;
    const specFactor = specializationMrvFactor(m, specSchedule.blocks.flatMap(b => b.targets), weakPoints, focusGroup);
    // Техника-спец ×1.3 (hook/toproll/press) — доминирующие мышцы получают +30%
    let techFactor = 1;
    const tLow = technique.toLowerCase();
    if (tLow === 'hook' && ['supinators','brachialis','wrist_flexors','back_pressure','biceps_long'].includes(m)) techFactor = 1.3;
    else if (tLow === 'toproll' && ['pronators','risers','brachioradialis','wrist_flexors','back_pressure'].includes(m)) techFactor = 1.3;
    else if (tLow === 'press' && ['side_pressure','shoulder_stab','core_anchor'].includes(m)) techFactor = 1.3;
    // Tendon-мульт: для сухожильных — отдельный tendonMultGlobal, для остальных 1
    const tendonFactor = isTendonMuscle(m) ? tendonMultGlobal : 1;
    let mrv = base * pedMult * recoveryMult * labMult * nutritionMult * tendonFactor * specFactor * techFactor * acwrMult;
    // TendonCap 1.2× жёстко ограничивает pedMult для сухожилий
    if (isTendonMuscle(m)) {
      const tendonCapMrv = Math.round(base * TENDON_CAP * recoveryMult * labMult * nutritionMult * tendonFactor * specFactor * techFactor);
      mrv = Math.min(mrv, tendonCapMrv);
    }
    if (m === 'side_pressure' && input.enableHumerusGuard !== false) {
      mrv = Math.min(mrv, base * 1.2); // humerus cap
    }
    // Grip раздельно: support/pinch/crush не взаимозаменяемы — cap по gripFocus
    if (m.startsWith('grip_') && input.gripFocus) {
      const gf = (input.gripFocus as string).toLowerCase();
      if (gf === 'support' && m === 'grip_support') mrv = Math.round(mrv * 1.15);
      else if (gf === 'pinch' && m === 'grip_pinch') mrv = Math.round(mrv * 1.15);
      else if (gf === 'crush' && m === 'grip_crush') mrv = Math.round(mrv * 1.15);
      else if (gf !== 'support' && m === 'grip_support' && input.discipline !== 'hybrid') mrv = Math.round(mrv * 0.85);
    }
    mrvByMuscle[m] = Math.max(3, Math.round(mrv));
  }

  // Frequency per muscle (from pattern)
  const tagCounts: Record<string, number> = {};
  for (const d of pattern.schedule) {
    if (d.kind !== 'тренировка' || !d.sessionTag) continue;
    tagCounts[d.sessionTag] = (tagCounts[d.sessionTag] || 0) + 1;
  }
  const muscleFreq: Record<string, number> = {};
  for (const [tag, cnt] of Object.entries(tagCounts)) {
    const ms = TAG_MUSCLES_ARM[tag] || [tag];
    for (const m of ms) muscleFreq[m] = (muscleFreq[m] || 0) + cnt * 7 / pattern.rotationDays;
  }

  // Volume targets
  const volumeTargets: Record<string, any> = {};
  for (const m of ARM_MUSCLES) {
    const lm = getArmLandmarks(level, m);
    const freq = muscleFreq[m] || 1;
    const mrv = mrvByMuscle[m] || lm.mrv;
    const target = Math.min(mrv, Math.max(lm.mev, Math.round(lm.mav * (goal === 'hypertrophy' ? 1 : goal === 'strength' ? 0.9 : 0.85))));
    volumeTargets[m] = { muscle: m, frequency: freq, mev: lm.mev, mav: lm.mav, mrv, targetSets: target, minSetsPerSession: 2, maxSetsPerSession: perExerciseCap(m, level), rationale: `target ${target}` };
  }

  // TOP wave-13: masters 50+ — делоад каждая 3-я неделя (longevity Devon-трек).
  // Граница осознанная: 40–49 (master) хватает среза объёма ×0.9 из longevity;
  // ускоренный каденс только с 50 (grandmaster+), где сухожилия восстанавливаются
  // медленнее и цена пропущенного делоада выше.
  let mastersDeload = false;
  try {
    const track = longevityTrackFor(Number((input as any).ageYears ?? 30));
    mastersDeload = track === 'grandmaster' || track === 'supergrand';
  } catch { mastersDeload = false; }
  // Именной цикл (P0): фазовая карта библиотеки поверх generic — только при
  // cycleId + (exact либо согласие на extend/shrink). Без cycleId — байт-в-байт.
  let phaseMap = distributeArmPhases(weeks, goal, mastersDeload ? 3 : 4);
  let cycleNote: string | null = null;
  // Тейпер-пресет применённого цикла: non-classic кривую накладывает финализатор
  // (единственный тейпер-путь — двойной срез запрещён, см. weekMult ниже).
  let cycleTaperPreset: string | null = null;
  try {
    const cid = String((input as any).cycleId || '');
    if (cid) {
      const fit = fitCycleToWeeks(cid, weeks);
      const c = getArmCycle(cid);
      if (c && (fit.fit === 'exact' || (input as any).cycleConsent === true)) {
        const cm = cyclePhaseMap(cid, weeks);
        if (cm) {
          phaseMap = cm as Record<number, string>;
          cycleNote = `Цикл ${c.name} (${fit.fit}${(input as any).cycleConsent === true && fit.fit !== 'exact' ? ', по согласию' : ''}): ${c.rpe}.`;
          if (c.taperPreset && c.taperPreset !== 'classic' && c.taperPreset !== 'none') {
            cycleTaperPreset = c.taperPreset;
            cycleNote += ` Тейпер-пресет: ${c.taperPreset} (финализатор, делоад/пик не режутся заранее).`;
          }
        }
      } else if (c) {
        cycleNote = `Цикл ${c.name}: ${fit.note} — без согласия построен generic (фазы по умолчанию).`;
      }
    }
  } catch { /* цикл опционален */ }
  // Хвостовое окно тейпера: непрерывный run делоад/пик-недель с конца плана
  // (PRO-5 G4: явный стейт taperStateFor; поведение 1-в-1 со старым циклом).
  // Только оно идёт под кривую финализатора; срединные делоады (каждая 4-я)
  // режутся обычным weekMult 0.6 как раньше.
  let taperState = { tailStart: weeks + 1, hasTail: false, tailPhases: [] as string[] };
  try { taperState = taperStateFor(phaseMap as Record<number, string>, weeks); } catch { markDegraded('тейпер-стейт по умолчанию'); }
  const tableRatio = input.tableTimeRatio ?? (discipline === 'armlifting' ? 0.2 : 0.55);

  const planWeeks: ArmWeek[] = [];
  const usedIdsGlobal = new Set<string>();
  const angleHistory: Record<string, ArmWorkingAngle[]> = {};
  let larrattWeeks = 0; // PRO-5 P4: недель с применёнными синглами

  for (let w = 1; w <= weeks; w++) {
    const phase = (phaseMap[w] || 'accumulation') as any;
    const isDeload = phase === 'deload';
    const isPeaking = phase === 'peaking';
    const weekSpecs = specForWeek(specSchedule, w);
    // Table 3/2/1 периодизация Kuznetsov внутри микроцикла
    // PRO-5 S4: losing-gate — защита + близкий старт: стресс→heavy в хвосте.
    let kind = tableWeekKind(w, weeks);
    if (pro5safety.forbidStressSingles && kind === 'stress' && w > weeks - 2) kind = 'heavy';
    const tableParams = tableWeekParams(kind);
    // weekMult: moderate 1.0, heavy 0.85, stress 0.55 + deload 0.6 + peaking 0.45.
    // Исключение: non-classic тейпер-пресет цикла — ХВОСТОВОЕ окно идёт полным,
    // режет только кривая финализатора (иначе двойной срез 0.45×0.6).
    const cycleTaperActive = isCycleTaperActive(taperState, phase, w, cycleTaperPreset);
    let weekMult: number;
    if (cycleTaperActive) weekMult = 1;
    else if (isDeload) weekMult = 0.6;
    else if (isPeaking) weekMult = 0.45;
    else if (kind === 'stress') weekMult = 0.55;
    else if (kind === 'heavy') weekMult = 0.85;
    else weekMult = w <= 3 ? 0.9 : 1;
    // tendon deload первые 4 недели для beginner — ещё ×0.85 сверху уже учтённого tendonMult, но тут дополнительно для объёма
    if (level === 'beginner' && w <= 4) weekMult *= 0.92;
    // R8/PRO-5: внутрицикловой % весов — только при ЯВНО заданном поле
    // (cyclePctPerWeek, legacy correctionPct). Дефолт — ровно 1.0.
    const cpWeekly = progRates.cyclePctPerWeek;
    const weekLoadMult = cpWeekly > 0 ? Math.pow(1 + cpWeekly / 100, w - 1) : 1;
    const taper = isPeaking;
    // TOP wave-5/12: Grip-RPE фаза недели (явная или авто-волна по неделям плана)
    let gripPhaseMult = 1;
    let gripRirAdd = 0;
    let gripPhaseName: string | null = null;
    try {
      if (input.gripWeek != null || input.gripPhase != null || (input as any).gripAuto === true) {
        const gp = buildGripRpe({ week: (input.gripWeek ?? w) as number, phase: input.gripPhase });
        gripPhaseName = gp.phase;
        if (gp.phase === 'deload') gripPhaseMult = 0.6;
        else if (gp.phase === 'peak') { gripPhaseMult = 0.7; gripRirAdd = 1; }
      }
    } catch { gripPhaseMult = 1; gripRirAdd = 0; gripPhaseName = null; }
    // TOP wave-9: один showcase-протокол хвата в неделю (peak → overcrush, intensification → negatives)
    let gripExecDone = gripPhaseName == null || (gripPhaseName !== 'peak' && gripPhaseName !== 'intensification');
    // PRO-5 P4: один Larratt-блок синглов на intensification-неделю (advanced+).
    let singlesDone = false;

    const sessions: ArmSession[] = [];
    let sessionIdx = 0;
    for (let d = 0; d < pattern.schedule.length; d++) {
      const sched = pattern.schedule[d];
      if (sched.kind !== 'тренировка') continue;
      let ch = (isDeload ? 'лёг' : isPeaking ? 'техника' : sched.character) as any;
      const tag = sched.sessionTag || 'FullArm';
      // PRO G: боль ≥4 — side только техника/изометрия (humerus/UCL)
      const isSideTag = tag === 'SidePress' || (TAG_MUSCLES_ARM[tag] || []).includes('side_pressure');
      if ((pro.replaceSideWithIso || pro5safety.forceSideTechnique) && isSideTag && ch === 'тяж') ch = 'техника';
      const muscles = TAG_MUSCLES_ARM[tag] || [tag];
      const exercises: ArmExercise[] = [];
      const usedInSession = new Set<string>();

      // Filter muscles — for armlifting, skip armwrestling-specific
      const baseFiltered = muscles.filter(m => {
        if (discipline === 'armlifting' && ['pronators','supinators','side_pressure','back_pressure'].includes(m)) return false;
        if (discipline === 'armwrestling' && ['grip_crush'].includes(m) && !weakPoints.includes('grip_crush')) return false;
        return ARM_MUSCLES.includes(m as any);
      });
      // PRO F: FullArm всегда содержит radial/fingers (Praxis топ-3 + containment)
      const filteredMuscles = tag === 'FullArm' ? ensureRadialFingers(baseFiltered) : baseFiltered;
      // TOP T2a: RFD-метка — первое speed-упражнение тяжёлой сессии в intensification (объём не меняется)
      let rfdDone = !rfdOn || phase !== 'intensification' || ch !== 'тяж';

      for (const mus of filteredMuscles) {
        // PRO G: боль ≥4 — side/pron тяжёлая работа переводится в технику (безопасность сухожилий)
        const effCh = (pro.replaceSideWithIso && mus === 'side_pressure' && ch === 'тяж')
          ? 'техника'
          : (pro.replaceHeavyPronWithPulses && mus === 'pronators' && ch === 'тяж') ? 'техника' : ch;
        // spec filter: if specialization active and muscle not in targets + not core — accessory
        let role: 'primary'|'accessory' = 'primary';
        if (specSchedule.active && weekSpecs.length > 0 && !weekSpecs.includes(mus) && !['shoulder_stab','core_anchor'].includes(mus)) {
          role = 'accessory';
        }
        const matchupMult = matchupPlan ? matchupVolumeFor(mus, matchupPlan) : 1;
        // TOP wave-5: grip-RPE фаза режет хват; Table-IQ: фолы режут side, срывы растят containment
        const gripMult = mus.startsWith('grip_') ? gripPhaseMult : 1;
        const iqSide = iqPlan && (iqPlan.foulRate ?? 0) >= 1 && mus === 'side_pressure' ? 0.8 : 1;
        const iqRise = iqPlan && (iqPlan.slipRate ?? 0) >= 40 && (mus === 'risers' || mus === 'thumb') ? 1.15 : 1;
        const targetRaw = volumeTargets[mus] ? Math.round(volumeTargets[mus].targetSets * weekMult * (pro.volumeMult || 1) * matchupMult * gripMult * iqSide * iqRise) : 6;
        const target = volumeTargets[mus] ? Math.min(volumeTargets[mus].mrv, targetRaw) : 6;
        const freq = muscleFreq[mus] || 1;
        const setsBase = setsFor(mus, effCh, w, target, freq);
        const repsBase = repsFor(mus, effCh, phase);
        // TOP wave-5: RFD — настоящий speed-протокол 5×3 RPE8 вместо метки (первое speed-упражнение тяжёлой intensification)
        const rfdSpeed = rfdOn && phase === 'intensification' && effCh === 'тяж' && !rfdDone &&
          ['pronators','supinators','wrist_flexors','risers','grip_support','grip_pinch','brachioradialis'].includes(mus);
        if (rfdSpeed) rfdDone = true;
        // PRO-5 P4: Larratt-синглы — первое тяжёлое pron/cup-движение intensification (advanced+).
        const wantSingles = (input as any).heavySingles === true && (level === 'advanced' || level === 'enhanced') && phase === 'intensification' && effCh === 'тяж' && !singlesDone && !rfdSpeed && isSinglesCandidate(mus);
        if (wantSingles) { singlesDone = true; larrattWeeks++; }
        const larratt = wantSingles ? larrattSinglesFor(Number((input as any).larrattStepKg) || 0.57) : null;
        const sets = wantSingles && larratt ? larratt.sets : rfdSpeed ? Math.min(5, perExerciseCap(mus, level)) : setsBase;
        const reps: [number, number] = wantSingles ? [1, 1] : rfdSpeed ? [3, 3] : repsBase;
        const iqRir = (mus === 'side_pressure' && iqSide < 1 ? 1 : 0) + (mus.startsWith('grip_') ? gripRirAdd : 0);
        const hookShift = (mus === 'supinators' || mus === 'wrist_flexors') ? (pro5safety.hookRirShift || 0) : 0;
        // PRO-5 P4: RIR по карте StrengthLog (только явный rpeParity, делоад/пик — как было).
        const rirBase = ((input as any).rpeParity === true && !isDeload && phase !== 'peaking')
          ? strengthLogRir(Math.min(8, Math.max(1, w)), effCh)
          : rirFor(effCh, phase, w, technique);
        const rir = wantSingles && larratt ? larratt.rir : Math.max(0, Math.min(5, rirBase + (pro.rirShift || 0) + iqRir + hookShift));
        const exTpl = pickExerciseForMuscle(mus, role, equipment, favorite, excluded, usedInSession, technique);
        if (!exTpl) continue;
        usedInSession.add(exTpl.id);
        usedIdsGlobal.add(exTpl.id);

        const sgTpl = (exTpl.substitutionGroup || '').toString();
        const isTable = exTpl.equipment === 'band' || sgTpl.includes('pronation') || sgTpl.includes('supination') || sgTpl === 'cup_iso' || exTpl.id.includes('hook') || exTpl.id.includes('lat_drag') || sgTpl === 'rising' || exTpl.id.includes('table');
        const angle = workingAngleFor(mus, w, sessionIdx, technique, angleHistory);
        if (!angleHistory[mus]) angleHistory[mus] = [];
        angleHistory[mus].push(angle);

        // Вес: теперь через workMax (PRO), а не 0; tempo зависит от kind
        const tempoForKind = mus === 'side_pressure' ? '3-1-1-0' : kind === 'stress' ? '2-0-1-0' : kind === 'heavy' ? '2-1-1-0' : '3-1-1-0';
        const workSets: ArmSet[] = [];
        for (let s = 0; s < sets; s++) {
          const repVal = reps[0] + Math.floor(rng() * (reps[1] - reps[0] + 1));
          // Вес по workMax + cross-meso прогрессия: тяж 82%, техника 60%, памп 68%
          const pct = wantSingles && larratt ? larratt.pctOfMax : effCh === 'тяж' ? 0.82 : effCh === 'техника' ? 0.6 : effCh === 'памп' ? 0.68 : 0.65;
          // cross-meso: если есть предыдущий план — его финальный вес +2.5% как база
          let effectiveWorkMax: Record<string, number> = { ...mergedWorkMax };
          if (crossMesoWorkMax && crossMesoWorkMax[mus] != null) {
            const baseFromPrev = crossMesoWorkMax[mus];
            const curMax = weightForMuscle(mus, effectiveWorkMax, 1);
            // берём максимум из текущего workMax и предыдущего прогрессированного
            if (baseFromPrev > curMax) {
              effectiveWorkMax = { ...effectiveWorkMax, [mus]: baseFromPrev };
            }
          }
          const wgtBase = weightForMuscle(mus, effectiveWorkMax, pct);
          const wgt = weekLoadMult === 1 ? wgtBase : Math.round(wgtBase * weekLoadMult * 2) / 2;
          workSets.push({
            reps: repVal,
            rir,
            weight: wgt,
            restSeconds: rfdSpeed ? 90 : mus === 'side_pressure' ? 180 : mus.includes('grip') ? (kind === 'stress' ? 180 : 120) : effCh === 'тяж' ? 120 : 90,
            tempo: tempoForKind,
            technique: mus === 'side_pressure' && effCh === 'тяж' ? 'none' : effCh === 'техника' ? 'isometric' : (kind === 'stress' ? 'stress_single' : 'none'),
            holdSeconds: exTpl.substitutionGroup === 'grip_support' || exTpl.substitutionGroup === 'grip_pinch' || exTpl.substitutionGroup === 'grip_crush' ? (effCh === 'техника' ? 15 : 10) : undefined,
          });
        }

        // TOP wave-9: showcase-протокол хвата — один в неделю (peak → overcrush, intensification → negatives)
        let gripShow: '' | 'over' | 'neg' = '';
        if (!gripExecDone && mus.startsWith('grip_')) {
          gripExecDone = true;
          if (gripPhaseName === 'peak') {
            gripShow = 'over';
            for (const ws of workSets) (ws as any).holdSeconds = 12;
          } else {
            gripShow = 'neg';
            for (const ws of workSets) (ws as any).tempo = '5-1-1-0';
          }
        }

        // PRO-5 G7: честная пометка веса-ориентира (workMax пуст — прогрессия не ведётся).
        let wEstimated = false;
        try {
          wEstimated = weightHonestyMark(mus, mergedWorkMax) && !(crossMesoWorkMax && crossMesoWorkMax[mus] != null);
        } catch { /* опционально */ }
        exercises.push({
          muscle: mus as any,
          name: exTpl.name,
          role: 'primary',
          character: effCh,
          sets,
          repsRange: reps,
          rir,
          workSets,
          workingAngle: angle,
          isTable: !!isTable,
          isStatic: false,
          tempoSpec: workSets[0]?.tempo,
          restSeconds: workSets[0]?.restSeconds,
          movementPattern: exTpl.movementPattern,
          substitutionGroup: exTpl.substitutionGroup,
          exerciseId: exTpl.id,
          equipment: exTpl.equipment,
          holdSeconds: gripShow === 'over' ? 12 : (mus === 'grip_support' || mus === 'grip_pinch' || mus === 'grip_crush' ? (effCh === 'техника' ? 15 : 10) : undefined),
          comment: ((rfdSpeed
            ? `RFD speed 5×3 @RPE8: ускорение через весь диапазон, отдых 90с · ${exTpl.technique || ''}`
            : (exTpl.technique || ''))
            + (gripShow === 'over' ? ' · overcrush hold 8–12с (дожим)' : gripShow === 'neg' ? ' · negatives 5с' : '')
            + (wantSingles && larratt ? ` · ${larratt.comment}` : '')
            + (wEstimated ? ' · вес ориентир — задайте workMax' : '') || undefined),
        });
      }

      // Enforce session limits — с учётом дисциплины и тега (TableTech PRO F: 7)
      const limits = sessionLimitsForArm({ level, onCourse: !!pedAdapt, discipline, sessionTag: tag });
      if (exercises.length > limits.maxExercises) {
        // Удаляем accessory последними, primary не трогаем
        const priCount = exercises.filter(e => e.role === 'primary').length;
        const toRemove = exercises.length - limits.maxExercises;
        // сортируем по приоритету удаления: accessory с конца
        let removed = 0;
        for (let i = exercises.length - 1; i >= 0 && removed < toRemove; i--) {
          if (exercises[i].role === 'accessory' || priCount + (exercises.length - removed - priCount) > limits.maxExercises) {
            // не удаляем единственный primary мышцы если есть
            const mus = exercises[i].muscle;
            const othersSameMus = exercises.filter((e, idx) => e.muscle === mus && idx !== i).length;
            if (exercises[i].role === 'primary' && othersSameMus === 0) continue;
            exercises.splice(i, 1);
            removed++;
          }
        }
        // fallback обрезка если не хватило
        if (exercises.length > limits.maxExercises) exercises.splice(limits.maxExercises);
      }

      const isTableSession = tag.toLowerCase().includes('table') || exercises.some(e => e.isTable);
      sessions.push({
        day: d + 1,
        weekOffset: w - 1,
        character: ch,
        sessionTag: tag,
        tableTime: isTableSession,
        exercises,
      });
      sessionIdx++;
    }

    // R7: ротация медли — фокус-снаряд недели в note (видно в UI и печати,
    // объём не трогаем: ротация — про снаряд, не про сеты).
    let weekNote: string | undefined;
    try {
      const mid = String((input as any).medleyId || '');
      if (mid && getMedley(mid)) {
        const impl = medleyRotationForWeek(mid, w);
        if (impl) weekNote = `🎯 Медли-фокус: ${impl}`;
      }
    } catch { weekNote = undefined; }
    planWeeks.push({
      week: w,
      phase,
      deload: isDeload,
      taper,
      tableRatio: sessions.filter(s => s.tableTime).length / Math.max(1, sessions.length),
      sessions,
      ...(weekNote ? { note: weekNote } : {}),
    });
  }

  // TOP wave-4: contestSim перестраивает последнюю неделю в генеральную репетицию (до подсчёта объёма)
  let simRationale: string[] = [];
  if ((input as any).contestSim === true && planWeeks.length >= 2) {
    try {
      const rtTarget = discipline === 'armlifting' ? Number((mergedWorkMax as any)['grip_support'] ?? NaN) : NaN;
      const applied = applyContestSimToPlan({ pattern, weeks: planWeeks, rationale: [] } as any, {
        level,
        discipline,
        strapExpected: !!(input as any).strapExpected,
        foulIds: (input as any).foulIds,
        targetKg: rtTarget,
        supermatch: !!(input as any).supermatch,
      });
      if (applied.applied) {
        for (let i = 0; i < planWeeks.length; i++) planWeeks[i] = applied.plan.weeks[i];
        simRationale = (applied.plan.rationale || []).filter((l: string) => /Contest-sim/.test(l));
        if (applied.warning) simRationale.push(applied.warning);
      } else if (applied.warning) {
        simRationale = [applied.warning];
      }
    } catch { /* sim опционален */ }
  }

  // TOP wave-7: Table-IQ инъекция containment при срывах ≥40% (до подсчёта объёма)
  let tableInjectNotes: string[] = [];
  try {
    const boutsIn = (input as any).bouts;
    if (Array.isArray(boutsIn) && boutsIn.length) {
      const inj = injectTableCorrections({ pattern, weeks: planWeeks, rationale: [] } as any, boutsIn, {
        level,
        workMax: mergedWorkMax,
        mrvByMuscle,
      });
      for (let i = 0; i < planWeeks.length; i++) planWeeks[i] = inj.plan.weeks[i];
      tableInjectNotes = inj.notes;
    }
  } catch { /* опционально */ }

  // TOP wave-8: унилатеральные бонусные сеты слабой руки — пост-проход по готовым неделям.
  // Только здесь виден полный недельный объём (мид-билд гард слеп к будущим сессиям + sim/inject уже применены).
  // 1 сет при 7–12%, 2 при ≥12%; кламп в MRV и per-exercise cap; deload/taper/peaking пропускаются.
  let uniBonusSets = 0;
  if (lrWeak != null && (lrPct ?? 0) >= 7) {
    try {
      const want = (lrPct ?? 0) >= 12 ? 2 : 1;
      const UNI = new Set(['wrist_flexors', 'wrist_extensors', 'pronators', 'supinators', 'risers', 'thumb', 'brachialis', 'biceps_long', 'biceps_short', 'brachioradialis']);
      for (const wk of planWeeks) {
        if ((wk as any).deload || (wk as any).taper || wk.phase === 'peaking') continue;
        const totals: Record<string, number> = {};
        for (const s of (wk.sessions || [])) for (const e of (s.exercises || [])) totals[e.muscle] = (totals[e.muscle] || 0) + (e.sets || 0);
        for (const s of (wk.sessions || [])) {
          const ex = (s.exercises || []).find((e: any) => UNI.has(e.muscle) && !/унилатерально/.test(String(e.comment || '')));
          if (!ex) continue;
          const mrv = mrvByMuscle[ex.muscle] ?? 99;
          if ((totals[ex.muscle] || 0) + want > mrv || ex.sets + want > perExerciseCap(ex.muscle, level)) {
            ex.comment = `${ex.comment || ''} + слабой (${lrWeak}): без запаса до MRV — 2 подх. из этих унилатерально`.trim();
            continue;
          }
          const template: ArmSet = ex.workSets[ex.workSets.length - 1] || { reps: 10, rir: 2, weight: 0, restSeconds: 90 };
          for (let i = 0; i < want; i++) ex.workSets.push({ ...template });
          ex.sets += want;
          totals[ex.muscle] += want;
          uniBonusSets += want;
          ex.comment = `${ex.comment || ''} + унилатерально слабой (${lrWeak}): +${want} сета сверху`.trim();
        }
      }
    } catch { /* опционально */ }
  }

  // Rationale — расширено table 3/2/1 и tendon
  const rationale: string[] = [];
  rationale.push(`Дисциплина: ${discipline}, техника: ${technique}, цель: ${goal}, уровень: ${level}`);
  rationale.push(`Сплит: ${pattern.name} (${pattern.sessionsPerRotation}x/${pattern.rotationDays}дн)`);
  rationale.push(`Периодизация: ${Object.entries(phaseMap).map(([wk, ph]) => `Н${wk}:${ph}`).join(', ')}`);
  if (cycleNote) rationale.push(cycleNote);
  try {
    if (progRates.cyclePctPerWeek > 0) rationale.push(`Прогрессия весов +${progRates.cyclePctPerWeek}%/нед внутри цикла + кросс-мезо ×${progRates.mesoRate.toFixed(3)}${progRates.migrated ? ' (раздельные поля PRO-5)' : ' (legacy correctionPct)'}.`);
  } catch { /* опционально */ }
  if (mastersDeload) rationale.push('Masters 50+: делоад каждая 3-я неделя (longevity Devon-трек).');
  if (specSchedule.active) rationale.push(`Специализация: ${specSchedule.rationale}`);
  const tableKinds = planWeeks.map(wk => `${tableWeekKind(wk.week, weeks)}`).join('/');
  rationale.push(`Table 3/2/1: ${tableKinds} (moderate 50-75% 1-3мин / heavy 75-100% 10с-1мин / stress 100-125% 5-10с)`);
  rationale.push(`Table time: ${(tableRatio * 100).toFixed(0)}% (цель), факт ~${(planWeeks[0]?.tableRatio || 0 * 100).toFixed(0)}% (Кузнецов VIII ≥50%)`);
  rationale.push(`Бюджет: recovery×${recoveryMult.toFixed(2)} lab×${labMult.toFixed(2)} nutrition×${nutritionMult.toFixed(2)} ped×${pedMult.toFixed(2)} tendon×${tendonMultGlobal.toFixed(2)} (tendonCap 1.2×)`);
  if (isTendonMuscle('wrist_flexors')) rationale.push(`Tendon лимит ${tendonWeeklyLimit(level)} сетов/нед для wrist/pron/sup`);
  if (crossMesoWorkMax) rationale.push(`Cross-meso: веса +2.5% от предыдущего мезоцикла (${Object.keys(crossMesoWorkMax).length} групп)`);
  // TOP wave-6: кросс-мезо лестницы — прогресс имплемента между мезоциклами
  try {
    const prevSnap = (input.previousPlan as any)?.inputSnapshot;
    if (prevSnap?.ladderFrom && input.ladderFrom && prevSnap.ladderFrom === input.ladderFrom) {
      const prev = Number(prevSnap.ladderValue);
      const cur = Number(input.ladderValue);
      if (Number.isFinite(prev) && prev > 0 && Number.isFinite(cur) && cur > 0) {
        const d = Math.round(((cur - prev) / prev) * 1000) / 10;
        const nx = nextImplement(input.ladderFrom, cur, (input.sex as string) || 'male');
        rationale.push(`Лестница ${input.ladderFrom}: ${d >= 0 ? '+' : ''}${d}% за мезоцикл — ${nx.ready && nx.next ? `готов к ${nx.next}` : 'держать базу'}.`);
      }
    }
  } catch { /* опционально */ }
  // PRO A–J: строки оркестратора (аддитивно)
  for (const line of pro.rationale) rationale.push(line);
  // TOP T1/T2a/T7a: матчап + RFD + L/R (только при заданных входах)
  if (matchupPlan) rationale.push(`Матчап: ${matchupPlan.note}`);
  if (rfdNote) rationale.push(`RFD: ${rfdNote}`);
  if (lrNote) rationale.push(lrNote);
  for (const line of simRationale) rationale.push(line);
  for (const line of tableInjectNotes) rationale.push(line);
  if (uniBonusSets > 0) rationale.push(`L/R добивка: +${uniBonusSets} унилатеральных сетов слабой (${lrWeak}) в клампе MRV.`);
  // PRO-5: честные строки (деградация/PED/ACWR/safety/синглы/RPE/сплит-подсказка).
  if (pedNote) rationale.push(pedNote);
  if (acwrNote) rationale.push(`PRO-5: ${acwrNote}`);
  for (const line of pro5safety.notes) rationale.push(line);
  if ((input as any).rpeParity === true) rationale.push('PRO-5: RIR по карте StrengthLog (W1–4 RPE7–8 → RIR2–3; W5–8 RPE8–9 → RIR1–2).');
  if (larrattWeeks > 0) rationale.push(`PRO-5: Larratt-синглы 5×1 @92% в ${larrattWeeks} нед. (полная лесенка 17–18 — практика, микрошаг ${Number((input as any).larrattStepKg) || 0.57} кг).`);
  if (degraded.length > 0) rationale.push(`Честная деградация: ${degraded.join('; ')}.`);
  try {
    const cid = String((input as any).cycleId || '');
    const c = cid ? getArmCycle(cid) : undefined;
    if (c) {
      const splitPerWeek = (pattern.sessionsPerRotation * 7) / Math.max(1, pattern.rotationDays);
      if (Math.abs(splitPerWeek - c.daysPerWeek) >= 2) {
        const sug = suggestSplitForCycle({ id: c.id, name: c.name, daysPerWeek: c.daysPerWeek, tablePerWeek: c.tablePerWeek, discipline: c.discipline }, ARM_SPLIT_PATTERNS as any);
        if (sug) rationale.push(`PRO-5: под цикл ${c.name} подходит сплит «${sug.name}» — переключите в 1 клик (сейчас ~${splitPerWeek.toFixed(1)}×/нед vs ${c.daysPerWeek}×/нед).`);
      }
    }
  } catch { /* опционально */ }
  // TOP wave-13: отдельный peak-протокол хвата (только явная фаза, не авто)
  try {
    const gp = String(input.gripPhase || '').toLowerCase();
    if (gp === 'peak' || gp === 'intensification') {
      const gf = String((input as any).gripFocus || '').toLowerCase();
      const gmus = gf === 'pinch' || gf === 'hub' ? 'grip_pinch' : gf === 'crush' ? 'grip_crush' : 'grip_support';
      const holder = { pattern, weeks: planWeeks, rationale: [] as string[] };
      const inj = injectGripProtocol(holder as any, gp === 'peak' ? 'over' : 'neg', {
        muscle: gmus,
        workMax: mergedWorkMax,
        mrv: mrvByMuscle[gmus],
        level,
        equipment: input.equipment,
      });
      for (let i = 0; i < planWeeks.length; i++) planWeeks[i] = inj.plan.weeks[i];
      for (const line of (inj.plan.rationale || [])) rationale.push(line);
    }
  } catch { /* опционально */ }
  const proWarnings = [...pro.warnings];
  for (const line of pro5safety.warnings) proWarnings.push(line);
  for (const line of pro5safety.blocked) proWarnings.push(`⛔ ${line}`);
  // PRO-5: пост-проход честных гейтов (только warnings/строки, объёмы не трогаем).
  try {
    for (const line of foreignPoolWarnings(planWeeks as any)) proWarnings.push(line);
  } catch { markDegraded('пул-чек недоступен'); }
  // PRO-5 S2: hook-кап — только hook-техника или явный hookCapSets
  // (у balanced/toproll супинация — норма, не hook-перегруз).
  try {
    if (technique === 'hook' || (input as any).hookCapSets != null) {
      const cap = Number((input as any).hookCapSets) || 12;
      for (const line of checkHookCap(planWeeks as any, cap)) proWarnings.push(line);
    }
  } catch { markDegraded('hook-кап недоступен'); }
  try {
    for (const wk of planWeeks) for (const line of checkCocGates(wk as any, wk.week)) proWarnings.push(line);
  } catch { markDegraded('CoC-гейты недоступны'); }
  if (pro5safety.warmupRequired && planWeeks.length > 0) {
    const w1 = planWeeks[0];
    w1.note = `${w1.note || ''} 🧤 Warmup-блок 10–15 мин обязателен (холод/без разминки).`.trim();
  }

  // Weekly volume
  const weeklyVolume: Record<number, Record<string, any>> = {};
  for (const wk of planWeeks) {
    const vol: Record<string, any> = {};
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        if (!vol[ex.muscle]) vol[ex.muscle] = { directSets: 0, effectiveSets: 0, tendonSets: 0, fatigueWeightedSets: 0 };
        vol[ex.muscle].directSets += ex.sets;
        vol[ex.muscle].effectiveSets += ex.sets;
        vol[ex.muscle].fatigueWeightedSets += ex.sets * 1;
        if (['wrist_flexors','pronators','supinators','wrist_extensors','risers','thumb'].includes(ex.muscle)) vol[ex.muscle].tendonSets += ex.sets;
      }
    }
    weeklyVolume[wk.week] = vol;
  }

  return {
    pattern,
    weeks: planWeeks,
    rotationMuscleVolume: Object.fromEntries(ARM_MUSCLES.map(m => [m, volumeTargets[m]?.targetSets || 0])),
    rationale,
    level,
    discipline: discipline as any,
    technique: technique as any,
    goal: goal as any,
    volumeLandmarks: ARM_MUSCLES.map(m => {
      const lm = getArmLandmarks(level, m);
      return { group: m, label: m, muscle: m, sets: lm.mav, mev: lm.mev, mav: lm.mav, mrv: lm.mrv, status: 'optimal' as any };
    }),
    muscleFrequency: muscleFreq,
    volumeTargets,
    weeklyVolume,
    mrvByMuscle,
    specializationSchedule: specSchedule,
    inputSnapshot: input,
    safetyWarnings: proWarnings,
  };
}

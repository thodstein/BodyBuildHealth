/**
 * arm-builder.engine.ts — ядро генерации арм-планов.
 * Зеркало bb-builder.engine.ts, упрощённая версия для арм-мышц.
 */
import type { ArmBuilderInput, ArmPlan, ArmWeek, ArmSession, ArmExercise, ArmSet, ArmWorkingAngle } from './arm-types';
import { ARM_MUSCLES } from './arm-types';
import { TAG_MUSCLES_ARM } from './arm-day-types';
import { ARM_SPLIT_PATTERNS, getArmPattern } from './arm-split-patterns';
import { getArmLandmarks } from './arm-volume-landmarks.engine';
import { computeArmRecoveryMult, computeArmBudget, sessionLimitsForArm, perExerciseCap, computeNutritionMult } from './arm-volume.engine';
import { ARM_EXERCISES } from '../../core/exercise-catalog-arm';
import { buildArmSchedule, specializationMrvFactor, specForWeek } from './arm-specialization.engine';
import { adaptForPEDs } from '../bb/bb-ped-adaptation.engine';

const PHASES: Array<'accumulation' | 'intensification' | 'deload' | 'peaking'> = ['accumulation','intensification','deload','peaking'];

function distributeArmPhases(totalWeeks: number, goal: string): Record<number, string> {
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
  const deloadEvery = 4;
  for (let w = 1; w <= totalWeeks; w++) {
    if (w % deloadEvery === 0) map[w] = 'deload';
    else if (w <= Math.ceil(totalWeeks * 0.6)) map[w] = 'accumulation';
    else map[w] = 'intensification';
  }
  if (totalWeeks >= 4) map[totalWeeks] = goal === 'strength' ? 'peaking' : 'intensification';
  return map;
}

function pickExerciseForMuscle(muscle: string, role: 'primary'|'accessory', equipment: string[], favorite: string[], excluded: string[], usedIds: Set<string>): typeof ARM_EXERCISES[number] | null {
  const pool = ARM_EXERCISES.filter(e => {
    const effMuscle = (e.targetMuscle || '').toLowerCase();
    const sg = (e.substitutionGroup || '').toLowerCase();
    const mp = (e.movementPattern as any || '').toString().toLowerCase();
    const mLow = muscle.toLowerCase();
    // Матчим по substitutionGroup или targetMuscle или movementPattern
    const matches =
      effMuscle.includes(mLow.replace('_',' ')) ||
      sg.includes(mLow.split('_')[0]) ||
      mp.includes(mLow.split('_')[0]) ||
      // Прямые маппинги
      (mLow === 'wrist_flexors' && sg === 'cup_iso') ||
      (mLow === 'pronators' && sg === 'pronation') ||
      (mLow === 'supinators' && sg === 'supination') ||
      (mLow === 'brachialis' && sg === 'hammer') ||
      (mLow === 'grip_support' && sg === 'grip_support') ||
      (mLow === 'grip_pinch' && sg === 'grip_pinch') ||
      (mLow === 'grip_crush' && sg === 'grip_crush') ||
      (mLow === 'risers' && sg === 'rising') ||
      (mLow === 'side_pressure' && sg === 'side_press') ||
      (mLow === 'back_pressure' && sg === 'back_drag') ||
      (mLow === 'thumb' && sg === 'grip_pinch') ||
      (mLow === 'shoulder_stab' && sg.startsWith('shoulder')) ||
      (mLow === 'core_anchor' && sg === 'core_anti') ||
      (mLow === 'wrist_extensors' && sg === 'wrist_ext');
    if (!matches) return false;
    if (excluded.includes(e.id)) return false;
    if (usedIds.has(e.id)) return false;
    if (equipment.length > 0) {
      const eq = e.equipment.toLowerCase();
      // grip_tool требует наличия grip_tool или cable
      if (eq === 'grip_tool' && !equipment.some(x => /grip|хват/i.test(x))) return false;
    }
    if (role === 'primary' && e.type !== 'compound' && !['wrist_curl_belt','pronation_cable','supination_cable','hammer_curl_thick','side_press_cable','rolling_thunder','apollon_axle'].includes(e.id)) {
      // Допускаем isolation как primary для арм-мышц (специфика)
    }
    return true;
  });
  if (pool.length === 0) {
    // fallback — любой из группы arms
    const fb = ARM_EXERCISES.filter(e => !excluded.includes(e.id) && !usedIds.has(e.id)).slice(0, 5);
    return fb[0] || ARM_EXERCISES[0] || null;
  }
  // favorite first
  for (const fav of favorite) {
    const f = pool.find(p => p.id === fav || p.name === fav);
    if (f) return f;
  }
  // sort by fatigueCost (lower for accessory)
  pool.sort((a,b) => (role === 'primary' ? b.fatigueCost - a.fatigueCost : a.fatigueCost - b.fatigueCost));
  return pool[0];
}

function workingAngleFor(muscle: string, week: number, sessionIdx: number): ArmWorkingAngle {
  const dirs: Array<'to_little'|'to_middle'|'to_thumb'> = ['to_little','to_middle','to_thumb'];
  const wrists: Array<'flexed'|'neutral'|'extended'> = ['flexed','neutral','extended'];
  const forearms: Array<'pronated'|'supinated'|'neutral'> = ['pronated','neutral','supinated'];
  const elbows: Array<90|110|120> = [90,110,120];
  const idx = (week + sessionIdx) % 3;
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

function rirFor(character: string, phase: string, week: number): number {
  if (phase === 'deload') return 4;
  if (phase === 'peaking') return character === 'тяж' ? 2 : 3;
  if (character === 'тяж') return 1 + Math.floor(((week - 1) % 4) / 2); // 1,1,2,2
  if (character === 'техника') return 3;
  if (character === 'памп') return 2;
  return 3;
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

  // MRV multipliers — упрощённый PED-множитель (tendonCap 1.5×, без дозы-кривых BB)
  let pedMult = 1;
  let pedAdapt: any = null;
  if (input.pedDoses && Object.keys(input.pedDoses).length > 0) {
    const cnt = Object.keys(input.pedDoses).length;
    pedMult = Math.min(1.5, 1.15 + cnt * 0.1 + (input.courseIntensity === 'heavy' ? 0.1 : input.courseIntensity === 'mild' ? -0.05 : 0));
    pedAdapt = { combinedMrvMultiplier: pedMult };
  }
  const recoveryMult = computeArmRecoveryMult({ bodyFat: input.bodyFat, leanMass: input.leanMass, hrvMs: input.hrvMs, sleepHours: input.sleepHours, stressLevel: input.stressLevel });
  const labMult = input.labMrvMultiplier ? Math.max(0.6, Math.min(1.4, input.labMrvMultiplier)) : 1;
  const nutritionMult = computeNutritionMult({ calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg });
  const tendonMult = level === 'beginner' ? 0.7 : 1;

  // Build specialization schedule
  const specSchedule = buildArmSchedule({ focusGroup, weakPoints, specialization: !!input.specialization, totalWeeks: weeks, explicitBlocks: input.specializationSchedule });

  // MRV per muscle
  const mrvByMuscle: Record<string, number> = {};
  for (const m of ARM_MUSCLES) {
    const base = getArmLandmarks(level, m).mrv;
    const specFactor = specializationMrvFactor(m, specSchedule.blocks.flatMap(b => b.targets), weakPoints, focusGroup);
    let mrv = base * pedMult * recoveryMult * labMult * nutritionMult * tendonMult * specFactor;
    if (m === 'side_pressure' && input.enableHumerusGuard !== false) {
      mrv = Math.min(mrv, base * 1.2); // humerus cap
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

  const phaseMap = distributeArmPhases(weeks, goal);
  const tableRatio = input.tableTimeRatio ?? (discipline === 'armlifting' ? 0.2 : 0.55);

  const planWeeks: ArmWeek[] = [];
  const usedIdsGlobal = new Set<string>();
  const angleHistory: Record<string, ArmWorkingAngle[]> = {};

  for (let w = 1; w <= weeks; w++) {
    const phase = (phaseMap[w] || 'accumulation') as any;
    const isDeload = phase === 'deload';
    const isPeaking = phase === 'peaking';
    const weekSpecs = specForWeek(specSchedule, w);
    const weekMult = isDeload ? 0.6 : isPeaking ? 0.45 : w <= 3 ? 0.9 : 1;
    const taper = isPeaking;

    const sessions: ArmSession[] = [];
    let sessionIdx = 0;
    for (let d = 0; d < pattern.schedule.length; d++) {
      const sched = pattern.schedule[d];
      if (sched.kind !== 'тренировка') continue;
      const ch = (isDeload ? 'лёг' : isPeaking ? 'техника' : sched.character) as any;
      const tag = sched.sessionTag || 'FullArm';
      const muscles = TAG_MUSCLES_ARM[tag] || [tag];
      const exercises: ArmExercise[] = [];
      const usedInSession = new Set<string>();

      // Filter muscles — for armlifting, skip armwrestling-specific
      const filteredMuscles = muscles.filter(m => {
        if (discipline === 'armlifting' && ['pronators','supinators','side_pressure','back_pressure'].includes(m)) return false;
        if (discipline === 'armwrestling' && ['grip_crush'].includes(m) && !weakPoints.includes('grip_crush')) return false;
        return ARM_MUSCLES.includes(m as any);
      });

      for (const mus of filteredMuscles) {
        // spec filter: if specialization active and muscle not in targets + not core — reduce
        if (specSchedule.active && weekSpecs.length > 0 && !weekSpecs.includes(mus) && !['shoulder_stab','core_anchor'].includes(mus)) {
          // still include but accessory
        }
        const target = volumeTargets[mus] ? Math.round(volumeTargets[mus].targetSets * weekMult) : 6;
        const freq = muscleFreq[mus] || 1;
        const sets = setsFor(mus, ch, w, target, freq);
        const reps = repsFor(mus, ch, phase);
        const rir = rirFor(ch, phase, w);
        const exTpl = pickExerciseForMuscle(mus, 'primary', equipment, favorite, excluded, usedInSession);
        if (!exTpl) continue;
        usedInSession.add(exTpl.id);
        usedIdsGlobal.add(exTpl.id);

        const sgTpl = (exTpl.substitutionGroup || '').toString();
        const isTable = exTpl.equipment === 'band' || sgTpl.includes('pronation') || sgTpl.includes('supination') || sgTpl === 'cup_iso' || exTpl.id.includes('hook') || exTpl.id.includes('lat_drag');
        const angle = workingAngleFor(mus, w, sessionIdx);
        if (!angleHistory[mus]) angleHistory[mus] = [];
        angleHistory[mus].push(angle);

        const workSets: ArmSet[] = [];
        for (let s = 0; s < sets; s++) {
          workSets.push({
            reps: reps[0] + Math.floor(Math.random() * (reps[1] - reps[0] + 1)),
            rir,
            weight: 0, // заполняется progression
            restSeconds: mus === 'side_pressure' ? 180 : mus.includes('grip') ? 120 : ch === 'тяж' ? 120 : 90,
            tempo: mus === 'side_pressure' ? '3-1-1-0' : '2-0-1-0',
            technique: mus === 'side_pressure' && ch === 'тяж' ? 'none' : ch === 'техника' ? 'isometric' : 'none',
            holdSeconds: exTpl.substitutionGroup === 'grip_support' || exTpl.substitutionGroup === 'grip_pinch' ? 10 : undefined,
          });
        }

        exercises.push({
          muscle: mus as any,
          name: exTpl.name,
          role: 'primary',
          character: ch,
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
          comment: exTpl.technique,
        });
      }

      // Enforce session limits
      const limits = sessionLimitsForArm({ level, onCourse: !!pedAdapt });
      if (exercises.length > limits.maxExercises) {
        exercises.splice(limits.maxExercises);
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

    planWeeks.push({
      week: w,
      phase,
      deload: isDeload,
      taper,
      tableRatio: sessions.filter(s => s.tableTime).length / Math.max(1, sessions.length),
      sessions,
    });
  }

  // Rationale
  const rationale: string[] = [];
  rationale.push(`Дисциплина: ${discipline}, техника: ${technique}, цель: ${goal}, уровень: ${level}`);
  rationale.push(`Сплит: ${pattern.name} (${pattern.sessionsPerRotation}x/${pattern.rotationDays}дн)`);
  rationale.push(`Периодизация: ${Object.entries(phaseMap).map(([wk, ph]) => `Н${wk}:${ph}`).join(', ')}`);
  if (specSchedule.active) rationale.push(`Специализация: ${specSchedule.rationale}`);
  rationale.push(`Table time: ${(tableRatio * 100).toFixed(0)}% (цель), факт ~${(planWeeks[0]?.tableRatio || 0 * 100).toFixed(0)}%`);
  rationale.push(`Бюджет: recovery×${recoveryMult.toFixed(2)} lab×${labMult.toFixed(2)} nutrition×${nutritionMult.toFixed(2)} ped×${pedMult.toFixed(2)}`);

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
    safetyWarnings: [],
  };
}

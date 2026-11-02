/**
 * bb-plan-exercise-audit.engine.ts — аудит портфеля упражнений ББ-плана.
 * reuse: bb-exercise-effect, bb-sfr-db, bb-exercise-selection, bb-volume, bb-balance, ExerciseLabShared SUBREGION_DEFS
 */
import { calcExerciseEffect, type BBExerciseEffect } from './bb-exercise-effect.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { ANGLE_CLASSES, STRICT_EXERCISE_GROUPS } from './bb-exercise-selection.engine';
import { SUBREGION_DEFS } from '../../ui/screens/TrainingScreen_parts/ExerciseLabShared';
import { granularZoneOf, canonicalOfZone, type GranularZone } from './bb-granular-zone.engine';

export interface PlanMuscleBucket {
  exercises: BBExerciseEffect[];
  avgSfr: number | null;
  lengthened: number;
  mid: number;
  shortened: number;
  angleCoverage: { total: number; covered: number; missing: string[] };
  strictCoverage: { total: number; covered: number; missing: string[] };
  regionalCoverage: { total: number; covered: number; missing: string[] };
  unilateral: number;
  totalSets: number;
  fatigueDensity: number;
  /**
   * AUDIT 2026-11 (BB-D-28): сколько сетов выполнено с заданным темпом/паузой.
   * Раньше движок вообще не смотрел на темп, а причина «темп» в weak-cause
   * была захардкожена `false` — она не могла появиться никогда.
   */
  tempoSets: number;
}

export interface PlanExerciseAudit {
  totalExercises: number;
  totalSets: number;
  avgSfr: number | null;
  lengthenedRatio: number; // 0-1
  unilateralRatio: number; // 0-1
  fatigueDensity: number; // fatigueWeighted / effective
  byMuscle: Record<string, PlanMuscleBucket>;
  /**
   * AUDIT 2026-11: тот же аудит, но разложенный по ГОЛОВКАМ
   * (chest_upper / back_width / delt_mid …). Раньше хаб искал зону в byMuscle
   * и всегда получал undefined — lengthened/углы/SFR зоны выглядели «в норме».
   * Отсутствующий ключ зоны = «в плане нет сетов на эту головку» (это диагноз, а не пустота).
   */
  byZone: Partial<Record<GranularZone, PlanMuscleBucket>>;
  global: {
    angleCoverage: Record<string, { total: number; covered: number }>;
    strictCoverage: Record<string, { total: number; covered: number }>;
    regionalCoverage: Record<string, { total: number; covered: number }>;
  };
  flags: string[]; // глобальные флаги
}

/** Найти запись каталога по id/имени (BBPlan пишет и id, и display-name). */
function catalogOf(ex: any): any {
  const keys = [ex?.exerciseName, ex?.id, ex?.name]
    .map((v) => String(v || '').toLowerCase().trim())
    .filter(Boolean);
  if (!keys.length) return null;
  return EXERCISE_CATALOG.find((c: any) =>
    keys.includes(String(c.id || '').toLowerCase()) || keys.includes(String(c.name || '').toLowerCase())) || null;
}

function groupOf(ex: any): string {
  const cat = catalogOf(ex);
  return String(ex.muscle || cat?.group || 'other').toLowerCase();
}

function emptyBucket(): PlanMuscleBucket {
  return {
    exercises: [],
    avgSfr: null,
    lengthened: 0, mid: 0, shortened: 0,
    angleCoverage: { total: 0, covered: 0, missing: [] },
    strictCoverage: { total: 0, covered: 0, missing: [] },
    regionalCoverage: { total: 0, covered: 0, missing: [] },
    unilateral: 0,
    totalSets: 0,
    fatigueDensity: 0,
    tempoSets: 0,
  };
}

function ensureBucket(map: Record<string, PlanMuscleBucket>, key: string): PlanMuscleBucket {
  if (!map[key]) map[key] = emptyBucket();
  return map[key];
}

function accumulate(bucket: PlanMuscleBucket, eff: BBExerciseEffect, sets: number, hasTempo = false): void {
  bucket.exercises.push(eff);
  bucket.totalSets += sets;
  if (hasTempo) bucket.tempoSets += sets;
  if (eff.profile === 'lengthened') bucket.lengthened += sets;
  else if (eff.profile === 'short') bucket.shortened += sets;
  else bucket.mid += sets;
  if (eff.unilateral) bucket.unilateral += sets;
}

/** Задан ли темп/пауза упражнения (строка темпа по 4 фазам или pauseSeconds>0). */
function hasTempoSpec(ex: any): boolean {
  const raw = String(ex?.tempo ?? ex?.tempoCode ?? '').trim();
  if (raw) {
    const parts = raw.split(/[-x×/,\s]+/).map(Number).filter((n) => Number.isFinite(n));
    if (parts.length >= 2) return true; // темп вообще задан (даже без паузы)
  }
  const pause = Number(ex?.pauseSeconds ?? ex?.pauseSec ?? 0);
  return Number.isFinite(pause) && pause > 0;
}

/** Покрытие углов/строгих/субрегионов + avgSfr/fatigueDensity для бакета. */
function finalizeBucket(muscle: string, bm: PlanMuscleBucket): void {
  const angleClasses = (ANGLE_CLASSES as any)[muscle] as Array<{ name: string }> | undefined;
  if (angleClasses) {
    const covered = new Set<string>();
    for (const e of bm.exercises) if (e.angleClass) covered.add(e.angleClass);
    const missing = angleClasses.map(c => c.name).filter(n => !covered.has(n));
    bm.angleCoverage = { total: angleClasses.length, covered: covered.size, missing };
  } else {
    bm.angleCoverage = { total: 0, covered: 0, missing: [] };
  }
  const strictGroups = (STRICT_EXERCISE_GROUPS as any)[muscle] as Array<{ key: string }> | undefined;
  if (strictGroups) {
    const covered = new Set<string>();
    for (const e of bm.exercises) if (e.strictGroup) covered.add(e.strictGroup.key);
    const missing = strictGroups.map(g => g.key).filter(k => !covered.has(k));
    bm.strictCoverage = { total: strictGroups.length, covered: covered.size, missing };
  } else {
    bm.strictCoverage = { total: 0, covered: 0, missing: [] };
  }
  const subDefs = (SUBREGION_DEFS as any)[muscle] as Array<{ id: string; keywords: string[] }> | undefined;
  if (subDefs) {
    const covered = new Set<string>();
    for (const e of bm.exercises) {
      const nm = (e.name || '').toLowerCase();
      for (const r of subDefs) if (r.keywords.some(kw => nm.includes(kw.toLowerCase()))) covered.add(r.id);
    }
    const missing = subDefs.map(r => r.id).filter(id => !covered.has(id));
    bm.regionalCoverage = { total: subDefs.length, covered: covered.size, missing };
  } else {
    bm.regionalCoverage = { total: 0, covered: 0, missing: [] };
  }
  let sSum = 0, sCnt = 0;
  for (const e of bm.exercises) if (e.sfr != null) { sSum += e.sfr * e.directSets; sCnt += e.directSets; }
  bm.avgSfr = sCnt ? Math.round((sSum / sCnt) * 10) / 10 : null;
  bm.fatigueDensity = bm.totalSets ? Math.round((bm.exercises.reduce((a, e) => a + e.fatigueWeighted, 0) / bm.totalSets) * 100) / 100 : 0;
}

export function auditPlanExercises(plan: any): PlanExerciseAudit | null {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return null;
  const sessions = (plan.weeks as any[]).flatMap(w => (w.sessions || []));
  const allEff: BBExerciseEffect[] = [];
  const byMuscle: PlanExerciseAudit['byMuscle'] = {};
  const byZone: PlanExerciseAudit['byZone'] = {};
  let totalSets = 0;
  let totalFatigueWeighted = 0;
  let lengthened = 0;
  let unilateralSets = 0;
  let sfrSum = 0;
  let sfrCnt = 0;

  for (const s of sessions) {
    for (const ex of (s.exercises || [])) {
      const muscle = groupOf(ex);
      const sets = Number(ex.sets ?? ex.workSets?.length ?? 3);
      const tempoKnown = hasTempoSpec(ex);
      const eff = calcExerciseEffect({ id: ex.exerciseName || ex.id, name: ex.name, muscle, sets, rir: ex.rir ?? 2, fatigueCost: (ex as any).fatigueCost }, { muscle });
      // переопределим sets точнее
      (eff as any).directSets = sets;
      allEff.push(eff);
      totalSets += sets;
      totalFatigueWeighted += eff.fatigueWeighted;
      if (eff.profile === 'lengthened') lengthened += sets;
      if (eff.unilateral) unilateralSets += sets;
      if (eff.sfr != null) { sfrSum += eff.sfr * sets; sfrCnt += sets; }
      accumulate(ensureBucket(byMuscle, muscle), eff, sets, tempoKnown);
      // Головка мышцы (chest_upper/back_width/delt_mid…). null — сет остаётся
      // только в канонической мышце: выдумывать головку нельзя.
      const cat = catalogOf(ex);
      const zone = granularZoneOf({
        id: (ex as any).exerciseName || (ex as any).id,
        name: ex.name,
        exerciseName: (ex as any).exerciseName,
        targetMuscle: cat?.targetMuscle,
        substitutionGroup: cat?.substitutionGroup,
        muscle,
      }, muscle);
      if (zone) accumulate(ensureBucket(byZone as Record<string, PlanMuscleBucket>, zone), eff, sets, tempoKnown);
    }
  }

  // покрытие углов/строгих/регионов per muscle
  for (const [muscle, bm] of Object.entries(byMuscle)) finalizeBucket(muscle, bm);
  // …и per head: углы/строгие/субрегионы берём из канонической мышцы
  // (иначе для зоны покрытие было бы «0 из 0»), а сет-факты — свои.
  for (const [zone, bm] of Object.entries(byZone)) {
    if (bm) finalizeBucket(String(canonicalOfZone(zone)), bm);
  }

  // покрытие углов/строгих/регионов per muscle
  for (const [muscle, bm] of Object.entries(byMuscle)) finalizeBucket(muscle, bm);

  const avgSfr = sfrCnt ? Math.round((sfrSum / sfrCnt) * 10) / 10 : null;
  const lengthenedRatio = totalSets ? Math.round((lengthened / totalSets) * 100) / 100 : 0;
  const unilateralRatio = totalSets ? Math.round((unilateralSets / totalSets) * 100) / 100 : 0;
  const fatigueDensity = totalSets ? Math.round((totalFatigueWeighted / totalSets) * 100) / 100 : 0;

  const flags: string[] = [];
  if (avgSfr != null && avgSfr < 3.5) flags.push('lowSFR');
  if (avgSfr != null && avgSfr < 4.0) flags.push('midSFR');
  if (lengthenedRatio < 0.3) flags.push('missingLengthened');
  if (unilateralRatio < 0.08) flags.push('lowUnilateral');
  if (fatigueDensity > 1.35) flags.push('highFatigue');
  // глобальные покрытия
  const globalAngle: Record<string, { total: number; covered: number }> = {};
  const globalStrict: Record<string, { total: number; covered: number }> = {};
  const globalRegional: Record<string, { total: number; covered: number }> = {};
  for (const [m, bm] of Object.entries(byMuscle)) {
    if (bm.angleCoverage.total) globalAngle[m] = { total: bm.angleCoverage.total, covered: bm.angleCoverage.covered };
    if (bm.strictCoverage.total) globalStrict[m] = { total: bm.strictCoverage.total, covered: bm.strictCoverage.covered };
    if (bm.regionalCoverage.total) globalRegional[m] = { total: bm.regionalCoverage.total, covered: bm.regionalCoverage.covered };
  }

  // singleAngle flag: мышца с 1 углом при ≥6 сетов
  for (const [m, bm] of Object.entries(byMuscle)) if (bm.angleCoverage.total > 1 && bm.angleCoverage.covered === 1 && bm.totalSets >= 6) flags.push(`singleAngle:${m}`);
  // missingShortened flag («сечка»): мышца с объёмом ≥6 сетов без пиковой работы —
  // детализация/сепарация без короткой позиции не строится (зеркало lengthenedRatio<0.3)
  for (const [m, bm] of Object.entries(byMuscle)) if (bm.totalSets >= 6 && bm.shortened === 0) flags.push(`missingShortened:${m}`);
  // BB-D-28: объём есть, а темп не задан ни в одном сете — причина «темп» перестаёт быть мёртвой
  for (const [m, bm] of Object.entries(byMuscle)) if (bm.totalSets >= 6 && bm.tempoSets === 0) flags.push(`noTempo:${m}`);

  return {
    totalExercises: allEff.length,
    totalSets,
    avgSfr,
    lengthenedRatio,
    unilateralRatio,
    fatigueDensity,
    byMuscle,
    byZone,
    global: { angleCoverage: globalAngle, strictCoverage: globalStrict, regionalCoverage: globalRegional },
    flags,
  };
}

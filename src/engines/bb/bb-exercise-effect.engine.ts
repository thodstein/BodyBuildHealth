/**
 * bb-exercise-effect.engine.ts — единый расчёт эффекта упражнения для ББ-плана.
 * Reuse SFR_DB + EXERCISE_CATALOG + ANGLE_CLASSES + STRICT_GROUPS + JOINT_STRESS.
 * Чистая функция, без мутаций плана.
 */
import { sfrOf, resistanceProfileOf, isUnilateralExercise, type ResistanceProfile } from './bb-sfr-db';
import { ANGLE_CLASSES, STRICT_EXERCISE_GROUPS, strictGroupForExercise, type StrictExerciseGroup } from './bb-exercise-selection.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getJointStress } from '../movement-engines';

export interface BBExerciseEffectCtx {
  phase?: string;
  level?: string;
  goal?: string; // hypertrophy | strength | endurance
  muscle?: string; // каноническая мышца если известна
}

export interface BBExerciseEffect {
  id: string | null;
  name: string;
  muscle: string | null;
  sfr: number | null; // 1-5
  profile: ResistanceProfile | null;
  unilateral: boolean;
  angleClass: string | null; // имя ANGLE_CLASSES класса или null
  strictGroup: StrictExerciseGroup | null;
  jointStress: 'low' | 'med' | 'high' | null;
  fatigueCost: number | null; // 1-10 из каталога
  cnsDemand: number | null; // 1-5 из biomechanics db
  directSets: number;
  effectiveSets: number; // с indirect коэффициентом если compound
  fatigueWeighted: number;
  balanceTag: string | null; // push/pull/legs tag
  note: string | null; // exerciseQualityNote
}

function findCatalog(ex: { id?: string; name?: string }) {
  if (ex.id) {
    const f = EXERCISE_CATALOG.find(c => c.id === ex.id);
    if (f) return f;
  }
  if (ex.name) {
    const low = ex.name.toLowerCase();
    const f = EXERCISE_CATALOG.find(c => c.name.toLowerCase() === low || c.id.toLowerCase() === low);
    if (f) return f;
  }
  return null;
}

function fatigueFor(ex: any): number | null {
  if (Number.isFinite(ex.fatigueCost)) return ex.fatigueCost;
  const cat = findCatalog(ex);
  if (cat && Number.isFinite(cat.fatigueCost)) return cat.fatigueCost;
  return null;
}

function jointFor(ex: any): 'low' | 'med' | 'high' | null {
  if (ex.jointStress === 'low' || ex.jointStress === 'med' || ex.jointStress === 'high') return ex.jointStress;
  const cat = findCatalog(ex);
  if (cat && (cat.jointStress === 'low' || cat.jointStress === 'med' || cat.jointStress === 'high')) return cat.jointStress as any;
  // fallback из movement-engines по id
  try {
    const id = ex.id || cat?.id;
    if (id) {
      const js = getJointStress(id);
      // выводим worst level среди joints
      const levels = [js.knee.level, js.hip.level, js.spine.level, js.shoulder.level, js.elbow.level, js.ankle.level];
      if (levels.includes('high')) return 'high';
      if (levels.includes('medium') as any || levels.includes('med' as any)) return 'med';
      return 'low';
    }
  } catch {}
  return null;
}

function cnsFor(ex: any): number | null {
  const cat = findCatalog(ex);
  if (!cat) return null;
  try {
    const bio = (cat as any).__bio; // not
  } catch {}
  // берём из biomechanics db если есть — через getExerciseBio внутри? упростим: fatigueCost прокси
  return null;
}

function angleClassFor(ex: { id?: string; name?: string }, muscle?: string | null): string | null {
  const m = (muscle || findCatalog(ex)?.group || '').toLowerCase();
  const classes = (ANGLE_CLASSES as any)[m] as Array<{ name: string; match: (e: any) => boolean }> | undefined;
  if (!classes) return null;
  for (const ac of classes) {
    try {
      if (ac.match(ex as any)) return ac.name;
    } catch {}
  }
  // fallback по имени каталога
  const cat = findCatalog(ex);
  if (cat) {
    for (const ac of classes) {
      try {
        if (ac.match(cat as any)) return ac.name;
      } catch {}
    }
  }
  return null;
}

export function calcExerciseEffect(
  ex: { id?: string; name?: string; muscle?: string; group?: string; sets?: number; rir?: number; jointStress?: string; fatigueCost?: number; type?: string },
  ctx: BBExerciseEffectCtx = {},
): BBExerciseEffect {
  const cat = findCatalog(ex);
  const id = (ex.id || cat?.id || null) as string | null;
  const name = ex.name || cat?.name || id || '—';
  const muscle = (ex.muscle || ctx.muscle || cat?.group || null) as string | null;
  const sfr = sfrOf({ id: id || undefined, name } as any);
  const profile = resistanceProfileOf({ id: id || undefined, name } as any);
  const unilateral = isUnilateralExercise({ id: id || undefined, name } as any);
  const strictGroup = strictGroupForExercise({ id: id || undefined, name } as any, muscle ? String(muscle).toLowerCase() : undefined) || null;
  const angleClass = angleClassFor({ id: id || undefined, name } as any, muscle);
  const jointStress = jointFor(ex as any);
  const fatigueCost = fatigueFor(ex as any);
  const directSets = Number.isFinite(ex.sets as any) ? Number(ex.sets) : 3;
  // effective: для compound добавляем 0.4 indirect прокси (как в bb-volume indirectMuscleContributions)
  // для MVP — directSets, effectiveSets = directSets (тонкий, без перебора indirect по каждой вторичной)
  const effectiveSets = directSets;
  const rir = Number.isFinite(ex.rir as any) ? Number(ex.rir) : 2;
  const fatigueWeighted = directSets * (1 + Math.max(0, 2 - rir) * 0.2) * (fatigueCost ? fatigueCost / 5 : 1);
  let balanceTag: string | null = null;
  const low = name.toLowerCase();
  if (/жим|press|bench|push|отжим/i.test(low) && !/тяга|row|pull/i.test(low)) balanceTag = 'push';
  else if (/тяга|row|pull|подтяг/i.test(low)) balanceTag = 'pull';
  else if (/присед|squat|выпад|lunge|жим.*ног|leg.?press|rdl|румын|hip.?thrust/i.test(low)) balanceTag = 'legs';

  // note: exerciseQualityNote логика короткая
  let note: string | null = null;
  if (sfr != null) note = `SFR ${sfr}/5`;
  if (profile === 'lengthened') note = note ? `${note} · растянутая` : 'растянутая';
  else if (profile === 'short') note = note ? `${note} · пиковая` : 'пиковая';
  if (unilateral) note = note ? `${note} · unilateral` : 'unilateral';

  return {
    id,
    name,
    muscle,
    sfr,
    profile,
    unilateral,
    angleClass,
    strictGroup,
    jointStress,
    fatigueCost,
    cnsDemand: null,
    directSets,
    effectiveSets,
    fatigueWeighted: Math.round(fatigueWeighted * 10) / 10,
    balanceTag,
    note,
  };
}

export function exerciseEffectScore(eff: BBExerciseEffect): number {
  // 0-100 прокси: SFR 0-40 + lengthened 0-20 + low fatigue 0-20 + unilateral бонус 10 + angle 10
  let s = 50;
  if (eff.sfr != null) s += (eff.sfr - 3) * 10; // 3→50, 5→70
  if (eff.profile === 'lengthened') s += 12;
  else if (eff.profile === 'short') s -= 4;
  if (eff.fatigueCost != null) {
    if (eff.fatigueCost <= 3) s += 8;
    else if (eff.fatigueCost >= 8) s -= 8;
  }
  if (eff.jointStress === 'high') s -= 6;
  if (eff.unilateral) s += 4;
  if (eff.angleClass) s += 4;
  return Math.max(0, Math.min(100, Math.round(s)));
}

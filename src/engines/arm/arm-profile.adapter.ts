import type { InjuryRecord, UserProfile } from '../../core/types';
import type { ArmBuilderInput, ArmInjury, ArmLevel } from './arm-types';

export interface ArmProfileSnapshot {
  ageYears?: number;
  bodyWeightKg?: number;
  bodyFat?: number;
  leanMass?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  level?: ArmLevel;
  workMax: Record<string, number>;
  equipment: string[];
  injuries: ArmInjury[];
  mobilityRestrictions: string[];
  favoriteExercises?: string[];
  excludedExercises?: string[];
}

function section(profile: any, key: string): any {
  const settings = profile?.settings && typeof profile.settings === 'object' ? profile.settings : {};
  return settings[key] && typeof settings[key] === 'object' ? settings[key] : (profile?.[key] && typeof profile[key] === 'object' ? profile[key] : {});
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function stringArray(...values: unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const text = String(item ?? '').trim();
      if (text && !out.includes(text)) out.push(text);
    }
  }
  return out;
}

function injuryMuscle(record: Partial<InjuryRecord>): string | null {
  const location = String(record.location || '').toLowerCase();
  if (/forearm|pron|sup|пронац|супинац|предплеч/.test(location)) return 'forearm';
  if (/shoulder|plech|плеч/.test(location)) return 'shoulder';
  if (/elbow|локт/.test(location)) return 'elbow';
  if (/wrist|кист|запяст|carpal/.test(location)) return 'wrist';
  if (/grip|хват|пальц|finger|thumb/.test(location)) return 'grip_support';
  if (/shoulder_stab/.test(location)) return 'shoulder_stab';
  return null;
}

function injuryToArm(record: Partial<InjuryRecord>): ArmInjury | null {
  const muscle = injuryMuscle(record);
  if (!muscle) return null;
  const pain = numberValue(record.painLevel) || 0;
  const restriction = record.movementLimit === 'full_restriction';
  const exclude = restriction || pain >= 8;
  const volumePct = exclude ? 0 : pain >= 7 ? 25 : pain >= 4 ? 50 : 75;
  const weightPct = exclude ? 0 : pain >= 7 ? 50 : pain >= 4 ? 75 : 90;
  const repsCap = exclude ? undefined : pain >= 7 ? 6 : pain >= 4 ? 10 : undefined;
  return {
    muscle,
    ...(typeof record.date === 'string' ? { from: record.date } : {}),
    exclude,
    volumePct,
    weightPct,
    ...(repsCap != null ? { repsCap } : {}),
  };
}

function profileInjuries(profile: any): InjuryRecord[] {
  const health = section(profile, 'health');
  const flat = profile?.injuries;
  const values = Array.isArray(health.injuries) ? health.injuries : [];
  if (values.length > 0 || !Array.isArray(flat)) return values;
  return flat;
}

export function armProfileSnapshot(profile: UserProfile | null | undefined): ArmProfileSnapshot {
  const p: any = profile || {};
  const personal = section(p, 'personal');
  const training = section(p, 'training');
  const lifestyle = section(p, 'lifestyle');
  const health = section(p, 'health');
  const injuries = profileInjuries(p).map(injuryToArm).filter((item): item is ArmInjury => !!item);
  const workMaxRaw = training.workMax && typeof training.workMax === 'object' ? training.workMax : {};
  const workMaxByExercise = training.workMaxByExercise && typeof training.workMaxByExercise === 'object' ? training.workMaxByExercise : {};
  const workMax: Record<string, number> = {};
  for (const source of [workMaxByExercise, workMaxRaw, p.workMaxByExercise, p.workMax]) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      const n = Number(value);
      if (key && Number.isFinite(n) && n > 0) workMax[key] = n;
    }
  }
  const rawLevel = String(training.level || p.trainingLevel || '').toLowerCase();
  const level = ['beginner', 'intermediate', 'advanced', 'enhanced'].includes(rawLevel) ? rawLevel as ArmLevel : undefined;
  const mobilityRestrictions = stringArray(health.mobilityRestrictions, training.mobilityRestrictions, p.mobilityRestrictions);
  return {
    ageYears: numberValue(personal.age, p.age),
    bodyWeightKg: numberValue(personal.weight, p.weight),
    bodyFat: numberValue(personal.bodyFat, p.bodyFat),
    leanMass: numberValue(personal.leanMass, p.leanMass),
    hrvMs: numberValue(lifestyle.morningHRV, lifestyle.hrvMs, p.hrvMs),
    sleepHours: numberValue(lifestyle.sleepHours, p.sleepHours),
    stressLevel: numberValue(lifestyle.stressLevel, p.stressLevel),
    level,
    workMax,
    equipment: stringArray(training.equipment, p.equipment),
    injuries,
    mobilityRestrictions,
    favoriteExercises: stringArray(training.favoriteExercises, p.favoriteExercises),
    excludedExercises: stringArray(training.excludedExercises, p.excludedExercises),
  };
}

export function armBuilderProfilePatch(snapshot: ArmProfileSnapshot): Pick<ArmBuilderInput, 'equipment' | 'injuries' | 'mobilityRestrictions' | 'favoriteExercises' | 'excludedExercises'> {
  return {
    equipment: snapshot.equipment,
    injuries: snapshot.injuries,
    mobilityRestrictions: snapshot.mobilityRestrictions,
    ...(snapshot.favoriteExercises?.length ? { favoriteExercises: snapshot.favoriteExercises } : {}),
    ...(snapshot.excludedExercises?.length ? { excludedExercises: snapshot.excludedExercises } : {}),
  };
}

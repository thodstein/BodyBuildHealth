/**
 * bb-gym-profiles.engine.ts — Профили залов («Зал / Дом / Командировка») и
 * точечная адаптация недели под командировочный инвентарь без пересборки всего плана.
 */
import type { BBPlan } from './bb-builder.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { isCandidateAllowed } from './bb-exercise-levels.engine';
import { trueMuscleOf } from '../movement-pattern';
import { refreshBBPlanSnapshots } from './bb-plan-snapshot.engine';
import type { PlatePreset } from './bb-plates.engine';

export const GYM_PROFILES_STORAGE_KEY = 'he_bb_gym_profiles_v1';

export interface GymProfile {
  id: string;
  name: string;
  icon?: string;
  equipment: string[];
  platePreset?: PlatePreset['id'];
  maxSessionMinutes?: number;
  builtin?: boolean;
}

export const DEFAULT_GYM_PROFILES: GymProfile[] = [
  {
    id: 'gym_full',
    name: 'Полный зал',
    icon: '🏋️',
    equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
    platePreset: 'standard',
    maxSessionMinutes: 0,
    builtin: true,
  },
  {
    id: 'home_db_bench',
    name: 'Дом (гантели + турник)',
    icon: '🏠',
    equipment: ['dumbbell', 'bodyweight', 'bands'],
    platePreset: 'home_light',
    maxSessionMinutes: 60,
    builtin: true,
  },
  {
    id: 'travel_minimal',
    name: 'Командировка (минимум)',
    icon: '✈️',
    equipment: ['bodyweight', 'bands'],
    platePreset: 'home_light',
    maxSessionMinutes: 45,
    builtin: true,
  },
];

function eqMatchesCatalog(allowedEq: string[], exEquipment: unknown): boolean {
  if (!allowedEq || allowedEq.length === 0) return true;
  const exEq = String(exEquipment || 'bodyweight').toLowerCase();
  const map: Record<string, string[]> = {
    barbell: ['barbell', 'штанга', 'ez'],
    dumbbell: ['dumbbell', 'гантел'],
    cable: ['cable', 'блок', 'кроссов'],
    machine: ['machine', 'тренаж'],
    kettlebell: ['kettlebell', 'гиря', 'гир'],
    bodyweight: ['bodyweight', 'свой вес', 'турник', 'брусь'],
    bands: ['bands', 'резин'],
  };
  return allowedEq.some(key => {
    const k = key.toLowerCase();
    const tokens = map[k] || [k];
    return tokens.some(t => exEq.includes(t));
  });
}

function isBodyweightCatalogItem(ex: any): boolean {
  const eq = String(ex?.equipment || '').toLowerCase();
  const nm = String(ex?.name || '').toLowerCase();
  return /bodyweight|свой вес|резин|bands/.test(eq)
    || /^(отжимания|подтягивания|планка|скручивания|подъём ног в висе|подъем ног|гиперэкстензия|берпи)/i.test(nm);
}

/** Загрузить профили залов (дефолты + пользовательские из localStorage). */
export function loadGymProfiles(): GymProfile[] {
  let custom: GymProfile[] = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(GYM_PROFILES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) custom = parsed.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string');
      }
    }
  } catch {
    custom = [];
  }
  const byId = new Map<string, GymProfile>();
  for (const d of DEFAULT_GYM_PROFILES) byId.set(d.id, d);
  for (const c of custom) byId.set(c.id, c);
  return [...byId.values()];
}

/** Сохранить или обновить профиль зала. Возвращает актуальный список. */
export function saveGymProfile(profile: GymProfile): GymProfile[] {
  const existing = loadGymProfiles().filter(p => !p.builtin || p.id === profile.id);
  const customOnly = existing.filter(p => !p.builtin);
  const idx = customOnly.findIndex(p => p.id === profile.id);
  const saved = { ...profile, builtin: DEFAULT_GYM_PROFILES.some(d => d.id === profile.id) ? profile.builtin : false };
  if (idx >= 0) customOnly[idx] = saved;
  else customOnly.push(saved);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GYM_PROFILES_STORAGE_KEY, JSON.stringify(customOnly));
    }
  } catch { /* quota */ }
  return loadGymProfiles();
}

/** Удалить пользовательский профиль зала. Встроенные профили не удаляются. */
export function deleteGymProfile(id: string): GymProfile[] {
  if (DEFAULT_GYM_PROFILES.some(d => d.id === id)) return loadGymProfiles();
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(GYM_PROFILES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const next = parsed.filter((p: any) => p?.id !== id);
        localStorage.setItem(GYM_PROFILES_STORAGE_KEY, JSON.stringify(next));
      }
    }
  } catch { /* noop */ }
  return loadGymProfiles();
}

/**
 * Адаптация одной недели плана под ограниченный инвентарь (командировка/дом):
 * заменяет несовместимые упражнения недели weekNumber на доступные из каталога
 * с сохранением целевой мышцы, сетов/повторов и обнулением веса для bodyweight.
 */
export function adaptWeekForTravel(
  plan: BBPlan,
  weekNumber: number,
  equipment: string[],
): { plan: BBPlan; replaced: number; rationale: string } {
  const cloned: BBPlan = structuredClone(plan);
  const weekObj = cloned.weeks.find(w => w.week === weekNumber);
  if (!weekObj || !equipment || equipment.length === 0) {
    return { plan: cloned, replaced: 0, rationale: 'Адаптация недели не потребовалась.' };
  }
  const level = (cloned.level || cloned.inputSnapshot?.level || 'intermediate') as any;
  const allowExotic = level === 'advanced' || level === 'enhanced';
  const exclIds = (cloned.inputSnapshot?.excludedExercises || []) as string[];
  const mob = (cloned.inputSnapshot?.mobilityRestrictions || []) as string[];
  const avAxial = !!cloned.inputSnapshot?.avoidAxialLoad;

  let replaced = 0;
  for (const session of weekObj.sessions) {
    const usedNames = new Set(session.exercises.map(e => (e.name || e.exerciseName || '').toLowerCase()));
    for (const ex of session.exercises) {
      const curCat = (EXERCISE_CATALOG as any[]).find(c =>
        c.id === ex.exerciseName || c.name === ex.name || c.name === ex.exerciseName,
      );
      if (curCat && eqMatchesCatalog(equipment, curCat.equipment)) continue;
      if (!curCat && eqMatchesCatalog(equipment, /штанга|гриф|barbell/i.test(ex.name || '') ? 'barbell' : /гантел/i.test(ex.name || '') ? 'dumbbell' : /блок|кросс|тяга верх/i.test(ex.name || '') ? 'cable' : 'bodyweight')) {
        continue;
      }

      const targetMuscle = ex.muscle;
      const candidates = (EXERCISE_CATALOG as any[]).filter(c => {
        if (!eqMatchesCatalog(equipment, c.equipment)) return false;
        const tm = trueMuscleOf(c);
        const matchesMuscle = tm === targetMuscle || String(c.group || '').toLowerCase() === targetMuscle;
        if (!matchesMuscle) return false;
        return isCandidateAllowed(c, {
          level,
          strictLevel: false,
          equipment,
          excludedExercises: exclIds,
          avoidAxialLoad: avAxial,
          mobilityRestrictions: mob,
          maxTier: allowExotic ? 3 : 2,
        });
      });

      const pick = candidates.find(c => !usedNames.has(String(c.name || '').toLowerCase())) || candidates[0];
      if (!pick) continue;

      usedNames.add(String(pick.name || '').toLowerCase());
      const prevName = ex.name || ex.exerciseName;
      ex.name = pick.name;
      ex.exerciseName = pick.id || pick.name;
      if (pick.type) ex.exerciseType = pick.type;
      const bwZero = isBodyweightCatalogItem(pick);
      if (bwZero) {
        for (const ws of ex.workSets || []) ws.weight = 0;
        if (ex.warmupSets) ex.warmupSets = [];
      } else {
        for (const ws of ex.workSets || []) {
          if (ws.weight > 0) ws.weight = Math.max(2, Math.round(ws.weight * 0.7 * 2) / 2);
        }
      }
      const note = `✈️ Замена под инвентарь недели ${weekNumber} (вместо «${prevName}»)`;
      ex.comment = ex.comment ? `${note} · ${ex.comment}` : note;
      ex.rationale = note;
      replaced++;
    }
  }

  const eqLabel = equipment.join(', ');
  const rationale = replaced > 0
    ? `✈️ Неделя ${weekNumber} адаптирована под инвентарь [${eqLabel}]: заменено ${replaced} упр.`
    : `✈️ Неделя ${weekNumber} уже совместима с инвентарём [${eqLabel}].`;
  if (!Array.isArray(cloned.rationale)) cloned.rationale = [];
  if (replaced > 0 && !cloned.rationale.includes(rationale)) cloned.rationale.push(rationale);

  try {
    refreshBBPlanSnapshots(cloned, {
      validationOptions: {
        level,
        equipment,
        excludedExercises: exclIds,
        checkOrder: true,
        methodology: cloned.inputSnapshot?.methodology,
        onCourse: (cloned as any).onCourse,
        maxWorkingSets: cloned.maxWorkingSets,
        maxExercises: cloned.maxExercises,
      },
      refreshFrequency: true,
      refreshValidationRationale: true,
    });
  } catch { /* best effort snapshot refresh */ }

  return { plan: cloned, replaced, rationale };
}

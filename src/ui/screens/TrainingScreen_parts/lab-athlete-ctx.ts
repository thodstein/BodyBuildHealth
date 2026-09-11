/**
 * lab-athlete-ctx.ts — контекст атлета для Лаборатории (Epic F, shared).
 *
 * Читает те же ключи, что живые экраны (без новых форматов):
 *  - `he_bb_diagnostics_hub_v1` — weakZones/asym из ББ-хаба (оборонительно: снапшот = state);
 *  - `he_profile_v2` — training.equipment / mobilityRestrictions / level / goal;
 *  - `he_training_profile` (legacy) — injuries / equipment / mobilityRestrictions fallback.
 * Пусто = честные дефолты, никогда throw.
 */
import { auditLabPlan, loadLabPlanFromStorage, type LabPlanAudit } from '../../../engines/lab-plan-exercise-audit.engine';

export interface LabAthleteCtx {
  goal: string;
  level: string;
  sex?: string;
  weakZones: string[];
  weakMusclesCanonical: string[];
  asymPct: number | null;
  equipment: string[];
  mobilityRestrictions: string[];
  injuries: Array<string | { muscle?: string }>;
}

function readJson(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

/** Контекст атлета для диагноза/коррекции (дефолты при отсутствии данных). */
export function readLabAthleteCtx(): LabAthleteCtx {
  const hub = readJson('he_bb_diagnostics_hub_v1') || {};
  const v2 = readJson('he_profile_v2') || {};
  const legacy = readJson('he_training_profile') || {};
  const settings = (v2.settings || {}) as Record<string, unknown>;
  const training = (settings.training || {}) as Record<string, unknown>;
  const health = (settings.health || {}) as Record<string, unknown>;

  const weakZones = strArr(
    hub.weakPoints ?? hub.weakZones ?? hub.weakZonesGranular ?? [],
  );
  const weakMusclesCanonical = strArr(hub.weakMusclesCanonical ?? []);
  const asymRaw = hub.asymPct ?? hub.symmetryAsymPct ?? (hub.symmetry as Record<string, unknown> | undefined)?.asymPct;
  const asymPct = Number.isFinite(Number(asymRaw)) ? Number(asymRaw) : null;

  const equipment = strArr(training.equipment ?? legacy.equipment ?? []);
  const mobilityRestrictions = strArr(
    (health as Record<string, unknown>).mobilityRestrictions
      ?? training.mobilityRestrictions
      ?? legacy.mobilityRestrictions
      ?? [],
  );
  const legacyInj = Array.isArray(legacy.injuries) ? legacy.injuries : [];
  const v2Inj = Array.isArray((health as Record<string, unknown>).injuries)
    ? (health as Record<string, unknown>).injuries as unknown[]
    : [];
  const injuries = [...legacyInj, ...v2Inj].filter(
    (x) => typeof x === 'string' || (x && typeof (x as { muscle?: unknown }).muscle === 'string'),
  ) as Array<string | { muscle?: string }>;

  return {
    goal: String(training.primaryGoal ?? settings.primaryGoal ?? 'hypertrophy'),
    level: String(settings.trainingLevel ?? training.level ?? 'intermediate'),
    sex: typeof settings.sex === 'string' ? (settings.sex as string) : undefined,
    weakZones,
    weakMusclesCanonical,
    asymPct,
    equipment,
    mobilityRestrictions,
    injuries,
  };
}

export interface LabPlanExCtx {
  inPlan: boolean;
  sets: number | null;
  rir: number | null;
  tempo: string | null;
  pauseSeconds: number | null;
  muscle: string | null;
  singleAngleMuscle: string | null;
  uncoveredSubregions: string[];
  strictMissing: string[];
}

interface LabPlanRawEx {
  exerciseName?: unknown;
  id?: unknown;
  name?: unknown;
  sets?: unknown;
  workSets?: unknown;
  rir?: unknown;
  tempo?: unknown;
  pauseSeconds?: unknown;
  muscle?: unknown;
}

/**
 * План-контекст одного упражнения (п.1 добивки): факт из плана (сеты/RIR/темп/пауза)
 * + missing-списки из аудита (singleAngle/uncovered/strict). Мимо плана — пусто.
 */
export function planCtxForExercise(
  audit: LabPlanAudit | null,
  plan: unknown,
  exId: string,
): LabPlanExCtx {
  const empty: LabPlanExCtx = {
    inPlan: false, sets: null, rir: null, tempo: null, pauseSeconds: null, muscle: null,
    singleAngleMuscle: null, uncoveredSubregions: [], strictMissing: [],
  };
  if (!audit || !plan || !exId) return empty;
  try {
    const needle = String(exId).toLowerCase();
    let found: LabPlanRawEx | null = null;
    const weeks = (plan as { weeks?: Array<{ sessions?: Array<{ exercises?: LabPlanRawEx[] }> }> }).weeks || [];
    outer: for (const w of weeks) {
      for (const s of w.sessions || []) {
        for (const raw of s.exercises || []) {
          const id = String(raw.exerciseName || raw.id || raw.name || '').toLowerCase();
          if (id && (id === needle || String(raw.name || '').toLowerCase() === needle)) {
            found = raw;
            break outer;
          }
        }
      }
    }
    if (!found) return empty;
    const muscle = String(found.muscle || '').toLowerCase() || null;
    const sets = Array.isArray(found.workSets)
      ? found.workSets.length
      : Number.isFinite(Number(found.sets)) ? Number(found.sets) : null;
    const byMuscle = muscle ? audit.audit.byMuscle[muscle] : undefined;
    return {
      inPlan: true,
      sets,
      rir: Number.isFinite(Number(found.rir)) ? Number(found.rir) : null,
      tempo: typeof found.tempo === 'string' && found.tempo ? found.tempo : null,
      pauseSeconds: Number.isFinite(Number(found.pauseSeconds)) ? Number(found.pauseSeconds) : null,
      muscle,
      singleAngleMuscle:
        byMuscle && byMuscle.angleCoverage.covered === 1 && byMuscle.totalSets >= 6 && muscle
          ? muscle
          : null,
      uncoveredSubregions: byMuscle ? [...byMuscle.regionalCoverage.missing] : [],
      strictMissing: byMuscle ? [...byMuscle.strictCoverage.missing] : [],
    };
  } catch {
    return empty;
  }
}

/** План + аудит + score для ленты (null без плана — вызыватель показывает пустой стейт). */
export function readLabPlanAudit(ctx?: Pick<LabAthleteCtx, 'injuries'>): LabPlanAudit | null {
  const plan = loadLabPlanFromStorage();
  if (!plan) return null;
  const injuries = (ctx?.injuries || []).map((x) => (typeof x === 'string' ? x : String(x?.muscle || '')).toLowerCase()).filter(Boolean);
  return auditLabPlan(plan, { injuries });
}

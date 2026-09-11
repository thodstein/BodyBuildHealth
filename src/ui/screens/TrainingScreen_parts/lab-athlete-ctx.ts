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

/** План + аудит + score для ленты (null без плана — вызыватель показывает пустой стейт). */
export function readLabPlanAudit(ctx?: Pick<LabAthleteCtx, 'injuries'>): LabPlanAudit | null {
  const plan = loadLabPlanFromStorage();
  if (!plan) return null;
  const injuries = (ctx?.injuries || []).map((x) => (typeof x === 'string' ? x : String(x?.muscle || '')).toLowerCase()).filter(Boolean);
  return auditLabPlan(plan, { injuries });
}

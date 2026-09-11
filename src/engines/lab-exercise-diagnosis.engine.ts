/**
 * lab-exercise-diagnosis.engine.ts — диагноз упражнения для Лаборатории (Epic C).
 *
 * Тонкий адаптер БЕЗ дублей: вся флаг-логика живёт в `diagnoseExercise`
 * (`bb-exercise-diagnosis.engine.ts`, 14+7 флагов). Добавленная ценность лабы:
 *  - сборка DiagnosisCtx из лабораторного контекста атлета (профиль/план/хаб);
 *  - явные `mobilityRestrictions` (чисто, без чтения профиля внутри);
 *  - травмы: совпадение травмы с мышцей упражнения → `jointRisk`
 *    («только щадящий режим/замена»), чего базовый движок не делает.
 *
 * Возвращает тот же `ExerciseDiagnosis` — совместим с мостом `labDiagnosis`
 * (BBDiagnosticsHub/BbAutoConstructor принимают `{flags, issues, score}`).
 */
import {
  diagnoseExercise,
  type ExerciseDiagnosis,
  type DiagnosisCtx,
} from './bb/bb-exercise-diagnosis.engine';
import { isMobilityRestricted } from './bb/bb-mobility.engine';
import { getJointStress } from './movement-engines';

/** Алиасы суставов для матчинга травмы с high-нагрузкой сустава (RU/EN). */
const JOINT_ALIASES: Record<string, string[]> = {
  shoulder: ['shoulder', 'плеч', 'плечо', 'плечи', 'дельт'],
  elbow: ['elbow', 'локоть', 'локт'],
  knee: ['knee', 'колен', 'колено'],
  hip: ['hip', 'таз', 'бедр'],
  spine: ['spine', 'поясниц', 'спина', 'позвоноч'],
  ankle: ['ankle', 'голеностоп', 'щиколот'],
};

export interface LabDiagnosisInput {
  goal?: string;
  level?: string;
  /** Слабые зоны из ББ-хаба (`he_bb_diagnostics_hub_v1`). */
  weakZones?: string[];
  weakMusclesCanonical?: string[];
  /** Асимметрия % (unilateralGap при ≥7). */
  asymPct?: number | null;
  /** Каноническая мышца упражнения (chest/back/quads/…). */
  muscle?: string;
  /** Ограничения мобильности из профиля (`he_profile_v2`). */
  mobilityRestrictions?: string[];
  /** Травмы: строки мышц/зон или записи `{muscle}`. */
  injuries?: Array<string | { muscle?: string }>;
  /** Оборудование атлета — прокидывается дальше в коррекцию (не в диагноз). */
  equipment?: string[];
  planTempo?: string | null;
  planPauseSeconds?: number | null;
  planReps?: number | null;
  planRir?: number | null;
  singleAngleMuscle?: string | null;
  uncoveredSubregions?: string[];
  strictMissing?: string[];
}

/** Совпадение травмы с мышцей/названием упражнения (переиспользуется коррекцией). */
export function labInjuryMatches(
  injuries: LabDiagnosisInput['injuries'],
  muscle: string,
  exName: string,
  exId?: string,
): string | null {
  if (!injuries || injuries.length === 0 || !muscle) return null;
  const m = muscle.toLowerCase();
  const nm = exName.toLowerCase();
  for (const inj of injuries) {
    const zone = String(typeof inj === 'string' ? inj : inj?.muscle || '').toLowerCase();
    if (!zone) continue;
    // Травма бьёт в упражнение: зона совпала с мышцей или с названием.
    if (m.includes(zone) || zone.includes(m) || nm.includes(zone)) return zone;
    // Суставной уровень: травма сустава + high-нагрузка этого сустава у упражнения.
    if (exId) {
      try {
        const js = getJointStress(exId) as unknown as Record<string, { level?: string }>;
        for (const [joint, aliases] of Object.entries(JOINT_ALIASES)) {
          const stress = js[joint];
          if (stress && stress.level === 'high'
            && aliases.some((al) => zone.includes(al) || al.includes(zone))) {
            return zone;
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

/** Диагноз одного упражнения на материале атлета (план не мутирует). */
export function diagnoseLabExercise(
  ex: { id?: string; name: string; muscle?: string; group?: string; tempo?: string; pauseSeconds?: number },
  ctx: LabDiagnosisInput = {},
): ExerciseDiagnosis {
  const muscle = String(ctx.muscle || ex.muscle || (ex as { group?: string }).group || '').toLowerCase();
  const restrictions = Array.isArray(ctx.mobilityRestrictions) ? ctx.mobilityRestrictions : [];
  const restricted = restrictions.length > 0
    && isMobilityRestricted({ name: ex.name }, restrictions);
  const base: DiagnosisCtx = {
    goal: ctx.goal,
    level: ctx.level,
    weakZones: ctx.weakZones,
    weakMusclesCanonical: ctx.weakMusclesCanonical,
    muscle: muscle || undefined,
    // mobilityFails: релевантныйRestriction под это упражнение (1) + явные OHS-флаги нет — честно 0/1.
    mobilityFails: restricted ? 1 : 0,
    asymPct: ctx.asymPct,
    planTempo: ctx.planTempo,
    planPauseSeconds: ctx.planPauseSeconds,
    planReps: ctx.planReps,
    planRir: ctx.planRir,
    singleAngleMuscle: ctx.singleAngleMuscle,
    uncoveredSubregions: ctx.uncoveredSubregions,
    strictMissing: ctx.strictMissing,
  };
  const d = diagnoseExercise(ex, base);
  // Травмы — лабораторный слой: базовый движок их не знает.
  const hit = labInjuryMatches(ctx.injuries, muscle, ex.name, ex.id);
  if (hit && !d.flags.includes('jointRisk')) {
    d.flags.push('jointRisk');
    d.issues.unshift(`Травма ${hit} — только щадящий режим или замена`);
    d.score = Math.max(0, d.score - 12);
  }
  return d;
}

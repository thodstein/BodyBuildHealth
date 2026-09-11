/**
 * lab-plan-exercise-audit.engine.ts — аудит портфеля упражнений плана для Лаборатории (Epic D).
 *
 * Тонкий слой БЕЗ дублей: агрегаты считает `auditPlanExercises`
 * (`bb-plan-exercise-audit.engine.ts`). Добавленная ценность лабы:
 *  - `labScore 0–100` — средний диагноз портфеля (НЕ RSS; формула ниже, детерминирована);
 *  - `labSafetyFlags` — `assessSafety` с РЕАЛЬНЫМИ травмами атлета (хаб раньше всегда
 *    вызывал его с `[]`, пугая пустотой);
 *  - `loadLabPlanFromStorage` — чтение `he_bb_plan_saved` (+fallback `he_bb_plans`)
 *    тем же паттерном, что `BBDiagnosticsHub` (без нового формата хранения).
 *
 * Чистые функции (кроме чтения storage), план не мутируют.
 */
import {
  auditPlanExercises,
  type PlanExerciseAudit,
} from './bb/bb-plan-exercise-audit.engine';
import { assessSafety } from './movement-engines';

export interface LabSafetyFlag {
  id: string | null;
  name: string;
  level: 'safe' | 'moderate' | 'risky';
  /** Травма из анамнеза пересекается с противопоказаниями движка. */
  blocked: boolean;
  notes: string[];
}

export interface LabPlanAudit {
  audit: PlanExerciseAudit;
  /** 0–100: средний диагноз портфеля (штрафы только за измеренное, без плана — null у вызывателя). */
  labScore: number;
  safetyFlags: LabSafetyFlag[];
  totalExercises: number;
  totalSets: number;
}

/** Безопасность портфеля с реальными травмами (пустой список = как было, тишина). */
export function labSafetyFlags(
  exercises: Array<{ id?: string; name: string }>,
  injuries: string[],
): LabSafetyFlag[] {
  const inj = (injuries || []).map((s) => String(s || '').toLowerCase()).filter(Boolean);
  return (exercises || []).map((ex) => {
    let level: LabSafetyFlag['level'] = 'safe';
    let blocked = false;
    const notes: string[] = [];
    try {
      const s = assessSafety(String(ex.id || ''), inj, 0.8);
      level = s.level;
      blocked = s.precautions.some((p) => p.startsWith('Травма в анамнезе'));
      if (s.contraindications.length > 0) {
        notes.push(`Противопоказания: ${s.contraindications.slice(0, 2).join('; ')}`);
      }
      if (blocked) notes.push('Травма из анамнеза пересекается — только щадящий режим/замена');
    } catch {
      /* неизвестное упражнение — safe по умолчанию, не throw */
    }
    return { id: ex.id ?? null, name: ex.name, level, blocked, notes };
  });
}

/**
 * labScore 0–100. Штрафы только за измеренное:
 *  avgSFR нет → −10 («нет данных»); avgSFR<3.5 → −(3.5−avg)×10;
 *  lengthened<0.4 → −10; fatigueDensity>1.2 → −8; непокрытые подрегионы → −min(10, n×2).
 */
export function calcLabScore(audit: PlanExerciseAudit): number {
  let score = 100;
  if (audit.avgSfr == null) score -= 10;
  else if (audit.avgSfr < 3.5) score -= Math.round((3.5 - audit.avgSfr) * 10);
  if (audit.lengthenedRatio < 0.4) score -= 10;
  if (audit.fatigueDensity > 1.2) score -= 8;
  const uncovered = Object.values(audit.byMuscle).reduce(
    (n, m) => n + (m.regionalCoverage?.missing?.length ?? 0),
    0,
  );
  score -= Math.min(10, uncovered * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Полный аудит портфеля + score + safety. Без плана — null (вызыватель показывает пустой стейт). */
export function auditLabPlan(
  plan: unknown,
  opts: { injuries?: string[] } = {},
): LabPlanAudit | null {
  const audit = auditPlanExercises(plan);
  if (!audit) return null;
  const exercises: Array<{ id?: string; name: string }> = [];
  try {
    for (const w of (plan as { weeks: Array<{ sessions: Array<{ exercises: unknown[] }> }> }).weeks || []) {
      for (const s of w.sessions || []) {
        for (const ex of (s.exercises || []) as Array<{ exerciseName?: string; id?: string; name?: string }>) {
          exercises.push({ id: ex.exerciseName || ex.id, name: String(ex.name || ex.exerciseName || ex.id || '?') });
        }
      }
    }
  } catch {
    /* noop */
  }
  return {
    audit,
    labScore: calcLabScore(audit),
    safetyFlags: labSafetyFlags(exercises, opts.injuries || []),
    totalExercises: audit.totalExercises,
    totalSets: audit.totalSets,
  };
}

/** Чтение плана тем же паттерном, что BBDiagnosticsHub (plan_saved → plans). */
export function loadLabPlanFromStorage(): unknown | null {
  try {
    for (const key of ['he_bb_plan_saved', 'he_bb_plans']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const j = JSON.parse(raw);
      if (j?.plan?.weeks) return j.plan;
      if (Array.isArray(j?.weeks)) return j;
    }
  } catch {
    /* битый стор → null */
  }
  return null;
}

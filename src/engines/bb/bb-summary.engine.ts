/**
 * bb-summary.engine.ts — расширенная недельная сводка сетов по каждой мышце.
 *
 * Пример формата для спины:
 *   Спина — 2 тренировки/нед
 *     тренировка 1: 30 рабочих сетов, 12 разминочных
 *     тренировка 2: 25 рабочих сетов, 10 разминочных
 *     паттерн vertical_pull — 12, horizontal_pull — 10, isolation — 8
 *     широчайшие (direct) — 20, косвенная нагрузка — 8
 *
 * Считает direct/indirect объём, рабочие vs разминочные сеты, паттерны.
 */
import type { BBPlan } from './bb-builder.engine';
import { exerciseVolumeContributions } from './bb-volume.engine';

export interface BBMuscleSummary {
  muscle: string;
  sessionsPerWeek: number;
  workingSets: number;
  warmupSets: number;
  directSets: number;
  indirectSets: number;
  byPattern: Record<string, number>;
  bySession: Array<{ day: number; working: number; warmup: number }>;
  byExercise: Record<string, number>;
  subGroups?: Record<string, { workingSets: number; byPattern: Record<string, number>; byExercise: Record<string, number> }>;
}

export interface BBExpandedSummary {
  byMuscle: Record<string, BBMuscleSummary>;
  totalWorkingSets: number;
}

export function buildBBExpandedSummary(plan: BBPlan): BBExpandedSummary {
  const byMuscle: Record<string, BBMuscleSummary> = {};
  let totalWorkingSets = 0;

  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      const seenMuscles = new Set<string>();
      for (const ex of session.exercises) {
        const isWarmup = !!(ex as any).warmupActivator;
        const muscle = ex.muscle;
        if (!muscle) continue;
        if (!byMuscle[muscle]) byMuscle[muscle] = { muscle, sessionsPerWeek: 0, workingSets: 0, warmupSets: 0, directSets: 0, indirectSets: 0, byPattern: {}, bySession: [], byExercise: {} };
        const m = byMuscle[muscle];
        if (isWarmup) {
          m.warmupSets += ex.sets || 0;
          continue;
        }
        // Косвенный вклад (secondary мышцы compound) — отдельно.
        const contributions = exerciseVolumeContributions(ex as any);
        let hasDirect = false;
        for (const c of contributions) {
          if (c.muscle === muscle) { if (c.source === 'direct') { m.directSets += c.directSets; hasDirect = true; } else m.indirectSets += c.effectiveSets; }
          else if (c.source === 'indirect' && c.muscle === muscle) m.indirectSets += c.effectiveSets;
        }
        if (!hasDirect && contributions.every(c => c.muscle !== muscle)) m.directSets += ex.sets || 0;
        m.workingSets += ex.sets || 0;
        totalWorkingSets += ex.sets || 0;
        const pattern = ex.movementPattern || 'other';
        m.byPattern[pattern] = (m.byPattern[pattern] || 0) + (ex.sets || 0);
        const exName = ex.exerciseName || ex.name || 'unknown';
        m.byExercise[exName] = (m.byExercise[exName] || 0) + (ex.sets || 0);
        // Подгруппы спины: широчайшие vs толщина (ромб/трапеции) и т.д.
        if (muscle === 'back') {
          const sub = (ex as any).backSubgroup || (pattern.includes('vertical') ? 'back_width' : pattern.includes('horizontal') ? 'back_thickness' : 'other');
          if (!m.subGroups) m.subGroups = {};
          if (!m.subGroups[sub]) m.subGroups[sub] = { workingSets: 0, byPattern: {}, byExercise: {} };
          const sg = m.subGroups[sub];
          sg.workingSets += ex.sets || 0;
          sg.byPattern[pattern] = (sg.byPattern[pattern] || 0) + (ex.sets || 0);
          sg.byExercise[exName] = (sg.byExercise[exName] || 0) + (ex.sets || 0);
        }
        if (!seenMuscles.has(muscle)) { seenMuscles.add(muscle); m.sessionsPerWeek += 1; }
      }
    }
  }

  // bySession: накопим по дням (порядок).
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      const perSession: Record<string, { working: number; warmup: number }> = {};
      for (const ex of session.exercises) {
        const isWarmup = !!(ex as any).warmupActivator;
        if (!ex.muscle) continue;
        if (!perSession[ex.muscle]) perSession[ex.muscle] = { working: 0, warmup: 0 };
        if (isWarmup) perSession[ex.muscle].warmup += ex.sets || 0;
        else perSession[ex.muscle].working += ex.sets || 0;
      }
      for (const [muscle, v] of Object.entries(perSession)) {
        if (!byMuscle[muscle]) continue;
        byMuscle[muscle].bySession.push({ day: session.day, working: v.working, warmup: v.warmup });
      }
    }
  }

  return { byMuscle, totalWorkingSets };
}

/** Текстовое представление сводки (для отчёта/расширенного вывода). */
export function formatBBExpandedSummary(plan: BBPlan): string {
  const s = buildBBExpandedSummary(plan);
  const lines: string[] = [];
  for (const [muscle, m] of Object.entries(s.byMuscle)) {
    lines.push(`${muscle} — ${m.sessionsPerWeek} тренировок/нед, ${m.workingSets} рабочих, ${m.warmupSets} разминочных`);
    for (const sess of m.bySession) {
      lines.push(`  тренировка: ${sess.working} рабочих, ${sess.warmup} разминочных`);
    }
    const patterns = Object.entries(m.byPattern).map(([p, v]) => `${p}: ${v}`).join(', ');
    if (patterns) lines.push(`  паттерн: ${patterns}`);
    lines.push(`  direct: ${m.directSets}, косвенная: ${Math.round(m.indirectSets)}`);
  }
  lines.push(`Итого рабочих сетов/нед: ${s.totalWorkingSets}`);
  return lines.join('\n');
}

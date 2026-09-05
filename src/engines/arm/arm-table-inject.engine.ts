/**
 * arm-table-inject.engine.ts — TOP wave-7: инъекция Table-IQ коррекций в план.
 *
 * Честная механика поверх analyzeTableIq:
 * - срывы хвата ≥40% → containment (finger_containment_band, risers 3×15-20 RIR2)
 *   в первую технику-сессию первой не-делод недели;
 * - фолы ≥1/схватку → БЕЗ лифта (процедура чинится contest-sim/foul_freeze,
 *   а не штангой; side уже порезан ×0.8 в билдере) — только честная note.
 * Гарды как в arm-diagnostics-injection: dedup, session-cap 8, tendon hard-cap 26,
 * MRV risers. Возвращает новый план (вход не мутируется).
 */
import { getArmExercises } from '../../core/exercise-catalog-arm';
import { analyzeTableIq } from './arm-table-iq.engine';

export interface TableInjectOpts {
  level?: string;
  workMax?: Record<string, number>;
  mrvByMuscle?: Record<string, number>;
}

export interface TableInjectResult {
  plan: any;
  injected: number;
  notes: string[];
}

const CONTAIN_ID = 'finger_containment_band';
const TENDON_HARD_CAP = 26;
const SESSION_CAP = 8;

function tendonSetsOf(week: any): number {
  let n = 0;
  for (const sess of week.sessions || [])
    for (const ex of sess.exercises || [])
      if (['wrist_flexors', 'wrist_extensors', 'pronators', 'supinators', 'risers', 'thumb', 'ulnar_deviators', 'radial_deviators'].includes(ex.muscle)) n += ex.sets || 0;
  return n;
}

function risersSetsOf(week: any): number {
  let n = 0;
  for (const sess of week.sessions || [])
    for (const ex of sess.exercises || [])
      if (ex.muscle === 'risers' || ex.muscle === 'thumb') n += ex.sets || 0;
  return n;
}

export function injectTableCorrections(plan: any, bouts: unknown, opts: TableInjectOpts = {}): TableInjectResult {
  const notes: string[] = [];
  if (!plan || !Array.isArray(plan.weeks)) return { plan, injected: 0, notes };
  const list = Array.isArray(bouts) ? (bouts as any[]) : [];
  if (!list.length) return { plan, injected: 0, notes };
  let iq;
  try {
    iq = analyzeTableIq({ bouts: list });
  } catch {
    return { plan, injected: 0, notes };
  }
  const copy = JSON.parse(JSON.stringify(plan));
  // Фолы — процедурой, не лифтом (честно, без фейкового упражнения)
  if ((iq.foulRate ?? 0) >= 1) {
    notes.push(`Table-IQ: фолы ${iq.foulRate}/схватку — чинится процедурой (contest-sim/foul_freeze), лифт не добавлен; side уже ×0.8.`);
  }
  if ((iq.slipRate ?? 0) < 40) return { plan: copy, injected: 0, notes };
  // Срывы — containment в первую не-делод неделю
  const week = (copy.weeks || []).find((w: any) => !w.deload);
  if (!week) {
    notes.push('Table-IQ: все недели делод — containment пропущен.');
    return { plan: copy, injected: 0, notes };
  }
  const catalogEx = getArmExercises().find((e) => e.id === CONTAIN_ID);
  if (!catalogEx) {
    notes.push('Table-IQ: containment нет в каталоге — пропуск.');
    return { plan: copy, injected: 0, notes };
  }
  if (week.sessions.some((s: any) => (s.exercises || []).some((e: any) => e.exerciseId === CONTAIN_ID))) {
    notes.push('Table-IQ: containment уже в неделе — дубль пропущен.');
    return { plan: copy, injected: 0, notes };
  }
  const target = week.sessions.find((s: any) => s.character === 'техника' && s.exercises.length < SESSION_CAP)
    || week.sessions.find((s: any) => s.exercises.length < SESSION_CAP);
  if (!target) {
    notes.push('Table-IQ: сессии переполнены (8) — containment пропущен.');
    return { plan: copy, injected: 0, notes };
  }
  const mrv = Number(opts.mrvByMuscle?.['risers'] ?? 99);
  if (risersSetsOf(week) + 3 > mrv) {
    notes.push(`Table-IQ: risers ${risersSetsOf(week)} + 3 превысит MRV ${mrv} — пропуск.`);
    return { plan: copy, injected: 0, notes };
  }
  if (tendonSetsOf(week) + 3 > TENDON_HARD_CAP) {
    notes.push(`Table-IQ: tendon ${tendonSetsOf(week)} + 3 превысит hard-cap 26 — пропуск.`);
    return { plan: copy, injected: 0, notes };
  }
  const wm = opts.workMax || {};
  const weight = Math.round(((wm as any)['risers'] || (wm as any)['default'] || 30) * 0.6 * 2) / 2;
  target.exercises.push({
    muscle: 'risers',
    name: (catalogEx as any).name,
    role: 'accessory',
    character: 'техника',
    sets: 3,
    repsRange: [15, 20],
    rir: 2,
    workSets: [0, 1, 2].map(() => ({ reps: 15, rir: 2, weight, restSeconds: 90, tempo: '2-1-1-0', technique: 'isometric' as any })),
    isTable: false,
    isStatic: true,
    holdSeconds: 10,
    movementPattern: 'rising',
    substitutionGroup: 'rising',
    exerciseId: CONTAIN_ID,
    equipment: (catalogEx as any).equipment,
    comment: `Table-IQ: срывы ${iq.slipRate}% — containment пальцев, не распахивать.`,
  });
  notes.push(`Table-IQ: containment 3×15-20 в ${target.sessionTag} (нед ${week.week}) — срывы ${iq.slipRate}%.`);
  if (!Array.isArray(copy.rationale)) copy.rationale = [];
  return { plan: copy, injected: 1, notes };
}

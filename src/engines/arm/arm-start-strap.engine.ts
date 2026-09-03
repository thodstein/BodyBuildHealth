/**
 * arm-start-strap.engine.ts — Ready-Go старт и ремень (эпик D PRO-плана).
 *
 * Старт решает до половины матча: реакция на команду рефери, отсутствие
 * фальстарта, удержание хвата. Ремень (судейский при срыве) — отдельная
 * техника: вектор как в борьбе, containment, изометрия.
 */

export interface StartDrill {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  cue: string;
}

export const START_DRILLS: StartDrill[] = [
  { id: 'reaction_go', name: 'Реакция на Ready-Go', sets: 5, reps: '3 старта', restSec: 60, cue: 'Старт по команде, без фальстарта. Партнёр даёт Ready…Go с паузой 1-3с.' },
  { id: 'referee_grip_drill', name: 'Рефери-хват (set grip)', sets: 3, reps: '5 удержаний × 5с', restSec: 60, cue: 'Ладонь закрыта, большой виден, запястье прямо. Держать set-позицию.' },
  { id: 'strap_start', name: 'Старт в ремне', sets: 4, reps: '4×10с изометрия', restSec: 90, cue: 'Ремень туго, вектор к себе-вбок как в борьбе. Не рвать — давить.' },
  { id: 'foul_freeze', name: 'Стоп по фолу (замирание)', sets: 3, reps: '3× замирание', restSec: 60, cue: 'По свистку — мгновенная остановка. Локоть не отрывать, плечо не ронять.' },
];

export interface StrapSession {
  exercises: Array<{ id: string; name: string; sets: number; holdSec: number; intensityPct: number }>;
  totalHolds: number;
  note: string;
}

/** Ремень-сессия: 3 упражнения, удержания 10-15с, 85-95%. */
export function buildStrapSession(level: string): StrapSession {
  const lvl = (level || '').toLowerCase();
  const mult = lvl === 'beginner' ? 0.7 : lvl === 'intermediate' ? 0.85 : 1;
  const exercises = [
    { id: 'strap_start', name: 'Старт в ремне (изометрия)', sets: 4, holdSec: 10, intensityPct: 0.9 * mult },
    { id: 'side_belt_table', name: 'Боковое ремнём на столе', sets: 3, holdSec: 12, intensityPct: 0.85 * mult },
    { id: 'pron_high_strap', name: 'Пронация high-torque ремнём', sets: 3, holdSec: 10, intensityPct: 0.9 * mult },
  ];
  return {
    exercises,
    totalHolds: exercises.reduce((s, e) => s + e.sets, 0),
    note: 'Ремень: вектор как в борьбе, containment, без рывка. Humerus-guard действует.',
  };
}

/** Допуск старта: реакция < 350мс и 0 фальстартов за сессию. */
export function startReadiness(input: { reactionMs?: number; falseStarts?: number }): { ready: boolean; note: string } {
  const r = Number(input.reactionMs);
  const f = Number(input.falseStarts ?? 0);
  if (!Number.isFinite(r)) return { ready: false, note: 'Нет замера реакции — проведите 5 стартов по команде.' };
  if (f > 0) return { ready: false, note: `Фальстарты: ${f} — отрабатывать замирание (foul_freeze).` };
  if (r <= 350) return { ready: true, note: `Реакция ${r}мс — готов к старту.` };
  return { ready: false, note: `Реакция ${r}мс >350мс — добавить reaction_go 2×/нед.` };
}

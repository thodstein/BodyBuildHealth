/**
 * arm-rfd.engine.ts — TOP T2a: скорость / RFD-блок (rate of force development).
 *
 * Источники: Bezkorovainyi ARM1 (F100/F500, explosivePct/fastPct, тактика),
 * Coletta (первые 100–200мс взрывные), GripStrength (speed closes 5×3 @RPE8,
 * 90с отдых — грайнд это не строит), StrengthLog (rise/pron техника).
 *
 * Чистый модуль. Билдер добавляет 1 RFD-день/нед в intensification,
 * в deload/peak — запрет (CNS-цена).
 */

export type RfdStartType = 'fast' | 'tempo' | 'grind';

export interface RfdInput {
  explosivePct?: number; // F100/Fmax % (Bezkorovainyi)
  fastPct?: number; // F500/Fmax %
  slowIndex?: number; // медленная сила кг/с после 500мс
  level?: string;
  phase?: string; // accumulation/intensification/deload/peaking
}

export interface RfdSession {
  startType: RfdStartType;
  speedCloses: { sets: number; reps: string; restSec: number; rpe: number };
  explosivePron: { sets: number; reps: string; restSec: number };
  cue: string;
  allowed: boolean; // false в deload/peaking (не ставить RFD)
  note: string;
}

/** Тип старта по скоростным метрикам (пороги Bezkorovainyi + Coletta). */
export function rfdStartTypeFor(input: RfdInput = {}): RfdStartType {
  const expl = Number(input.explosivePct ?? NaN);
  const slow = Number(input.slowIndex ?? NaN);
  if (Number.isFinite(expl) && expl >= 38) return 'fast';
  if (Number.isFinite(slow) && slow >= 20) return 'grind';
  const fast = Number(input.fastPct ?? NaN);
  if (Number.isFinite(fast) && fast >= 65) return 'tempo';
  if (Number.isFinite(expl) && expl <= 22) return 'grind';
  return 'tempo';
}

/** Дозировка speed closes по уровню (GripStrength: 5×3, RPE8, 90с). */
export function speedClosesFor(level: string): { sets: number; reps: string; restSec: number; rpe: number } {
  const lvl = String(level || 'intermediate').toLowerCase();
  if (lvl === 'beginner') return { sets: 3, reps: '3 взрывных сингла', restSec: 90, rpe: 7 };
  if (lvl === 'advanced' || lvl === 'enhanced') return { sets: 5, reps: '3 взрывных сингла', restSec: 90, rpe: 8 };
  return { sets: 4, reps: '3 взрывных сингла', restSec: 90, rpe: 8 };
}

/** Полная RFD-сессия (1 день/нед, только intensification/accumulation). */
export function buildRfdSession(input: RfdInput = {}): RfdSession {
  const phase = String(input.phase || 'intensification').toLowerCase();
  const allowed = phase !== 'deload' && phase !== 'peaking';
  const startType = rfdStartTypeFor(input);
  const speedCloses = speedClosesFor(input.level || 'intermediate');
  const explosivePron =
    startType === 'fast'
      ? { sets: 3, reps: '5 быстрых пронаций', restSec: 90 }
      : startType === 'grind'
        ? { sets: 2, reps: '6-сек удержание в слабом углу', restSec: 120 }
        : { sets: 3, reps: '8 пронаций в темпе', restSec: 90 };
  const cue =
    startType === 'fast'
      ? 'Ускорение через весь диапазон максимально быстро — грайнд скорость не строит.'
      : startType === 'grind'
        ? 'Медленная сила: удержания + статика в позиции срыва (Mithril), не рвать.'
        : 'Темп: ускорение без потери позиции кисти, 90с отдых между speed-подходами.';
  return {
    startType,
    speedCloses,
    explosivePron,
    cue,
    allowed,
    note: allowed
      ? `RFD (${startType}): speed ${speedCloses.sets}×3 RPE${speedCloses.rpe} + пронация ${explosivePron.sets}×${explosivePron.reps}.`
      : 'RFD запрещён в deload/peaking (CNS-цена) — только техника+изометрия.',
  };
}

/**
 * tempo-canon.engine.ts — единый канон темпа повторений (TEMPO-REP PRO, эпик A).
 *
 * Проблема: 4 движка (`rep-tempo.engine`, `rep-tempo-engine`, `tempo.engine`,
 * `bb/bb-tempo-rest`) дают расходящиеся цифры для одних и тех же целей
 * (strength: 2-1-1-0 vs 2-0-1-0 vs 2-0-X-0). Старые файлы НЕ тронуты (читаются
 * десятками потребителей) — канон аддитивен, миграция идёт точечно.
 *
 * Наука (см. docs/TEMPO-REP-PRO-PLAN.md §2): рабочий диапазон 2–8с/повт
 * (Schoenfeld 2015); >8с — контроль/реабилитация, не «+рост». `X` в концентрике —
 * взрывное намерение (intent), а не «0с пауза».
 *
 * @module tempo-canon
 */

export interface CanonTempo {
  ecc: number;
  bot: number;
  conc: number;
  top: number;
  /** true — концентрика взрывная (нотация X), в TUT считается как 1с */
  explosive: boolean;
  /** каноническая нотация, напр. "3-1-1-0" или "2-0-X-0" */
  notation: string;
}

export interface CanonPreset {
  id: string;
  nameRu: string;
  goal: 'strength' | 'hypertrophy' | 'power' | 'technique' | 'conditioning';
  tempo: CanonTempo;
  /** false — темп для контроля/реабилитации, гипертрофийного преимущества нет (S1) */
  growth: boolean;
  description: string;
}

function make(ecc: number, bot: number, conc: number, top: number, explosive = false): CanonTempo {
  const concStr = explosive ? 'X' : String(conc);
  return { ecc, bot, conc: explosive ? 1 : conc, top, explosive, notation: `${ecc}-${bot}-${concStr}-${top}` };
}

/** Канон: один источник цифр. Все дефолты роста — внутри 2–8с/повт (S1-инвариант). */
export const TEMPO_CANON: Record<string, CanonTempo> = {
  strength: make(2, 0, 1, 0, true), // '2-0-X-0' — контроль входа, взрывное намерение
  hypertrophy_compound: make(3, 1, 1, 0), // '3-1-1-0'
  hypertrophy_isolation: make(3, 2, 1, 0), // '3-2-1-0' — пауза в растянутой
  hypertrophy: make(3, 1, 1, 0), // алиас compound
  power: make(1, 0, 1, 0, true), // '1-0-X-0' — CAT, схлопывает дубль speed/power
  technique: make(4, 2, 2, 1), // '4-2-2-1' — обучение, НЕ рост (9с)
  rehab: make(5, 2, 2, 1), // '5-2-2-1' — реабилитация, НЕ рост (10с)
  conditioning: make(1, 0, 1, 0), // '1-0-1-0'
};

/** Единый список для UI. Схлопывает прежний дубль speed/power из TempoTab. */
export const TEMPO_PRESET_LIST: CanonPreset[] = [
  { id: 'strength', nameRu: 'Силовой', goal: 'strength', tempo: TEMPO_CANON.strength, growth: true, description: 'Контроль эксцентрики, пауза снимает инерцию, концентрика — максимально быстро.' },
  { id: 'hypertrophy_compound', nameRu: 'Гипертрофия (база)', goal: 'hypertrophy', tempo: TEMPO_CANON.hypertrophy_compound, growth: true, description: 'Медленный негатив 3с + пауза в растяжении 1с — микротравмы и stretch-стимул.' },
  { id: 'hypertrophy_isolation', nameRu: 'Гипертрофия (изоляция)', goal: 'hypertrophy', tempo: TEMPO_CANON.hypertrophy_isolation, growth: true, description: 'Удлинённая пауза 2с в растянутой позиции для lengthened-стимула.' },
  { id: 'power', nameRu: 'Скоростно-силовой', goal: 'power', tempo: TEMPO_CANON.power, growth: true, description: 'Компенсаторное ускорение (CAT). Максимальное намерение ускорить снаряд.' },
  { id: 'conditioning', nameRu: 'Кондиционный', goal: 'conditioning', tempo: TEMPO_CANON.conditioning, growth: true, description: 'Быстрый темп, высокий пульс. Для круговых и ОФП.' },
  { id: 'technique', nameRu: 'Техничный / обучающий', goal: 'technique', tempo: TEMPO_CANON.technique, growth: false, description: 'Медленно во всех фазах. Для обучения движению — не даёт +роста сверх обычного.' },
  { id: 'rehab', nameRu: 'Реабилитационный', goal: 'technique', tempo: TEMPO_CANON.rehab, growth: false, description: 'Максимальный контроль. Пост-травматическое восстановление — не гипертрофийный протокол.' },
];

/** Длительность повтора в секундах. Взрывная концентрика (X) считается как 1с. */
export function repSecsOf(t: CanonTempo): number {
  return t.ecc + t.bot + t.conc + t.top;
}

/**
 * Единый парсер темпа. Понимает `X` (взрывная концентрика) в любой позиции,
 * в отличие от `rep-tempo.engine parseTempo` (NaN → null на X).
 * Мусор (не 4 части, отрицательные, >60) → null.
 */
export function parseTempoCanon(input: string): CanonTempo | null {
  if (typeof input !== 'string') return null;
  const parts = input.trim().split('-');
  if (parts.length !== 4) return null;
  let explosive = false;
  const nums: number[] = [];
  for (const p of parts) {
    const s = p.trim();
    if (s === 'X' || s === 'x') {
      explosive = true;
      nums.push(1);
      continue;
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const v = Number(s);
    if (!Number.isFinite(v) || v < 0 || v > 60) return null;
    nums.push(v);
  }
  const concStr = explosive && nums[2] === 1 ? 'X' : String(nums[2]);
  return {
    ecc: nums[0],
    bot: nums[1],
    conc: nums[2],
    top: nums[3],
    explosive,
    notation: `${nums[0]}-${nums[1]}-${concStr}-${nums[3]}`,
  };
}

/** Быстрая валидация нотации (для гейта моста). */
export function isValidTempoCanon(input: string): boolean {
  return parseTempoCanon(input) !== null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Эпик B — TUT-доза + per-exercise назначение
// ═══════════════════════════════════════════════════════════════════════════

export interface TutCalc {
  perRep: number;
  perSet: number;
  total: number;
  /** true — в темпе есть взрывная фаза (intent), TUT частично условен */
  intent: boolean;
}

/**
 * TUT-доза: (ecc+bot+conc+top) × повторы [× сеты].
 * Имя намеренно отлично от `bb-tempo-rest tutForSet(reps, character)` —
 * тот считает по характеру дня, этот — по явному темпу. Не смешивать.
 */
export function tutSecsForTempo(tempo: string | CanonTempo, reps: number, sets = 1): TutCalc | null {
  const t = typeof tempo === 'string' ? parseTempoCanon(tempo) : tempo;
  if (!t) return null;
  if (!Number.isFinite(reps) || reps <= 0 || reps > 1000) return null;
  if (!Number.isFinite(sets) || sets <= 0 || sets > 100) return null;
  const perRep = repSecsOf(t);
  const perSet = +(perRep * reps).toFixed(1);
  return { perRep, perSet, total: +(perSet * sets).toFixed(1), intent: t.explosive };
}

export type TutZone = 'strength' | 'work' | 'endurance';

export interface TutZoneInfo {
  zone: TutZone;
  label: string;
  /** предупреждение при сверхмедленном повторе (S1: >8с — вес упадёт) */
  warn: string | null;
}

/**
 * Зона TUT сета — ОРИЕНТИР дозы, не прогноз роста (S1/S4: рост решают объём +
 * близость к отказу). Границы честно широкие.
 */
export function tutZoneForSecs(tutSetSec: number, perRepSec?: number): TutZoneInfo {
  const warn =
    perRepSec !== undefined && perRepSec > 8
      ? 'Повтор >8с: рабочий вес упадёт, вероятно хуже для гипертрофии (Schoenfeld 2015). Темп для контроля, не для роста.'
      : null;
  if (tutSetSec < 20) return { zone: 'strength', label: 'Силовая доза (<20с): мощность/техника', warn };
  if (tutSetSec <= 70) return { zone: 'work', label: 'Рабочая доза (20–70с): сила + гипертрофия', warn };
  return { zone: 'endurance', label: 'Объёмная доза (>70с): выносливость/метаболика', warn };
}

/**
 * Per-exercise overrides — ДАННЫЕ из `bb/bb-tempo-rest EXERCISE_TEMPO_OVERRIDES`
 * (источник: TempoTab + ББ-сборка). Канон только читает как данные; сигнатура
 * `tempoFor` в bb-файле не меняется. Ключи — подстроки нижнего регистра.
 */
const EXERCISE_TEMPO_KEYS: Array<[string, string]> = [
  ['жим штанги на наклонной', '3-1-1-0'],
  ['жим штанги', '2-0-X-0'],
  ['тяга к лицу', '2-1-1-1'],
  ['разгибание ног', '3-0-1-1'],
  ['сгибание ног', '3-2-1-0'],
  ['наклонный жим', '3-1-1-0'],
  ['румынская', '3-1-1-0'],
  ['кроссовер', '3-2-1-0'],
  ['присед', '2-0-X-0'],
  ['становая', '2-0-X-0'],
  ['жим лёжа', '2-0-X-0'],
  ['жим стоя', '2-0-X-0'],
  ['наклонной', '3-1-1-0'],
  ['incline', '3-1-1-0'],
  ['сведение', '3-2-1-0'],
  ['махи', '2-1-1-1'],
  ['squat', '2-0-X-0'],
  ['deadlift', '2-0-X-0'],
  ['rdl', '3-1-1-0'],
  ['sissy', '4-1-1-0'],
  ['сисси', '4-1-1-0'],
  ['fly', '3-2-1-0'],
  ['crossover', '3-2-1-0'],
  ['leg curl', '3-2-1-0'],
  ['face pull', '2-1-1-1'],
  ['army press', '2-0-X-0'],
  ['bench press', '2-0-X-0'],
  ['lateral raise', '2-1-1-1'],
  ['leg extension', '3-0-1-1'],
  ['развод', '3-2-1-0'],
  ['брусь', '3-1-1-0'],
];

export interface ExerciseTempoPick {
  notation: string;
  /** false — взято из таблицы overrides; true — fallback по цели */
  estimated: boolean;
  reason: string;
}

const GOAL_FALLBACK: Record<string, string> = {
  strength: 'strength',
  hypertrophy: 'hypertrophy_compound',
  power: 'power',
  technique: 'technique',
  conditioning: 'conditioning',
};

/**
 * Превью «сост/изол» для хаба (замена goalTempos на generateRepTempo в TempoTab).
 * Чистое отображение канона — без pattern/rationale-слоя генератора.
 */
export function goalPreviewFor(goal: string): { compound: string; isolation: string } {
  switch (goal) {
    case 'strength':
      return { compound: TEMPO_CANON.strength.notation, isolation: TEMPO_CANON.strength.notation };
    case 'hypertrophy':
      return { compound: TEMPO_CANON.hypertrophy_compound.notation, isolation: TEMPO_CANON.hypertrophy_isolation.notation };
    case 'power':
      return { compound: TEMPO_CANON.power.notation, isolation: TEMPO_CANON.power.notation };
    default:
      return { compound: TEMPO_CANON.technique.notation, isolation: TEMPO_CANON.technique.notation };
  }
}

/** Темп под конкретное упражнение: overrides → fallback канона по цели. */
export function tempoForExerciseName(name: string, goal = 'hypertrophy'): ExerciseTempoPick {
  const n = (name || '').toLowerCase();
  const sorted = [...EXERCISE_TEMPO_KEYS].sort((a, b) => b[0].length - a[0].length);
  for (const [key, notation] of sorted) {
    if (n.includes(key)) {
      return { notation, estimated: false, reason: `Паттерн «${key}» — специфичный темп упражнения` };
    }
  }
  const canonKey = GOAL_FALLBACK[goal] ?? 'hypertrophy_compound';
  return {
    notation: TEMPO_CANON[canonKey].notation,
    estimated: true,
    reason: 'Упражнение не в таблице — взят темп цели (ориентир)',
  };
}

/** Форматирует CanonTempo в нотацию (зеркало старого formatTempo). */
export function formatTempoCanon(t: CanonTempo): string {
  return t.notation;
}

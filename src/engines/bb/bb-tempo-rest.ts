/**
 * bb-tempo-rest.ts — темп, TUT, интервалы отдыха по характеру дня (Этап BB12 + Фаза 2.1).
 */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export type DayCharacter = 'тяж' | 'памп' | 'лёг';

export type TempoProfile =
  | 'auto'
  | 'hypertrophy_controlled'
  | 'lengthened_pause'
  | 'explosive_power'
  | 'constant_tension'
  | 'slow_eccentric';

export interface TempoSpec { eccentric: number; pause: number; concentric: number; notation: string; tutPerRep: number; }

export const TEMPO_PROFILE_DEFAULT: Record<Exclude<TempoProfile, 'auto'>, string> = {
  hypertrophy_controlled: '3-0-1-1',
  lengthened_pause: '3-2-1-0',
  explosive_power: '2-0-1-0',
  constant_tension: '2-0-2-1',
  slow_eccentric: '4-1-1-0',
};

export const TEMPO_BY_CHARACTER: Record<DayCharacter, TempoSpec> = {
  тяж:  { eccentric: 2, pause: 1, concentric: 1, notation: '2-1-1-0', tutPerRep: 4 },
  памп: { eccentric: 3, pause: 0, concentric: 1, notation: '3-0-1-0', tutPerRep: 4 },
  лёг:  { eccentric: 2, pause: 0, concentric: 1, notation: '2-0-1-0', tutPerRep: 3 },
};

export const REST_BY_CHARACTER: Record<DayCharacter, number> = {
  тяж: 180,  // 2-4 мин → 180с
  памп: 60,  // 45-90с → 60с
  лёг: 90,
};

/** TUT сета = tempo.tutPerRep × reps. */
export function tutForSet(reps: number, character: DayCharacter): number {
  return TEMPO_BY_CHARACTER[character].tutPerRep * reps;
}

/**
 * Санитайзер нотации темпа `E-B-C-T` (эксцентрик-паузаВнизу-концентрик-пикВверху).
 * Отбрасывает текстовый мусор / длинные описания, вытаскивает чистую 4-цифровую нотацию.
 */
export function sanitizeTempoNotation(raw?: string | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const m = /\b([1-6])-([0-5])-([1-5])-([0-5])\b/.exec(trimmed);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
}

/** Суммарный TUT (сек) на 1 повторение из строки темпа `E-B-C-T`. */
export function parseTempoTutPerRep(tempo?: string | null, fallback = 4): number {
  const clean = sanitizeTempoNotation(tempo);
  if (!clean) return fallback;
  const sum = clean.split('-').reduce((acc, s) => acc + Number(s), 0);
  if (!Number.isFinite(sum) || sum <= 0) return fallback;
  return Math.max(2, Math.min(12, sum));
}

/**
 * FIX-B2 + W-5: Per-exercise tempo overrides (стандарт E-B-C-T: эксцентрик-паузаВнизу-концентрик-пикВверху):
 * - Тяжёлые многосуставные (присед/становая/жим): 2-0-1-0
 * - Растянутые упражнения (RDL/наклонный жим): 3-1-1-0 (пауза внизу растяжения)
 * - Изоляция на пиковое сокращение (кроссовер/сведение/leg curl): 3-0-1-2 (задержка 2с на пике)
 * - Махи/face pull: 2-1-1-1 (ритм, контроль)
 */
const EXERCISE_TEMPO_OVERRIDES: Record<string, string> = {
  // Тяжёлые compound — взрывной концентрический
  'присед': '2-0-1-0',
  'squat': '2-0-1-0',
  'становая': '2-0-1-0',
  'deadlift': '2-0-1-0',
  'жим штанги': '2-0-1-0',
  'bench press': '2-0-1-0',
  'жим лёжа': '2-0-1-0',
  'army press': '2-0-1-0',
  'жим стоя': '2-0-1-0',
  // Растянутые — длинный эксцентрик, пауза в растянутой позиции (B=1)
  'румынская': '3-1-1-0',
  'rdl': '3-1-1-0',
  'наклонной': '3-1-1-0',
  'наклонный жим': '3-1-1-0',
  'incline': '3-1-1-0',
  'сисси': '4-1-1-0',
  'sissy': '4-1-1-0',
  // Пиковое сокращение — задержка 2с в укороченной позиции (T=2, W-5 fix вместо 3-2-1-0)
  'кроссовер': '3-0-1-2',
  'crossover': '3-0-1-2',
  'сведение': '3-0-1-2',
  'fly': '3-0-1-2',
  'leg curl': '3-0-1-2',
  'сгибание ног': '3-0-1-2',
  'leg extension': '3-0-1-1',
  'разгибание ног': '3-0-1-1',
  // Ритм/контроль — махи, face pull
  'махи': '2-1-1-1',
  'lateral raise': '2-1-1-1',
  'face pull': '2-1-1-1',
  'тяга к лицу': '2-1-1-1',
};

/** Найти per-exercise tempo override по имени упражнения. */
export function exerciseTempoOverride(name: string): string | undefined {
  const n = (name || '').toLowerCase();
  const keys = Object.keys(EXERCISE_TEMPO_OVERRIDES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (n.includes(key)) return EXERCISE_TEMPO_OVERRIDES[key];
  }
  return undefined;
}

interface CatalogTempoHint { pauseSeconds: number; stretchPhase: boolean; peakContraction: boolean }
let _catalogTempoHints: Map<string, CatalogTempoHint> | null = null;

/** Подсказка каталога по имени упражнения (ленивая карта, ~590 записей). */
export function catalogTempoHints(name: string): CatalogTempoHint | undefined {
  if (!_catalogTempoHints) {
    _catalogTempoHints = new Map();
    for (const ex of EXERCISE_CATALOG as any[]) {
      const n = String(ex?.name || '').toLowerCase().trim();
      if (!n || _catalogTempoHints.has(n)) continue;
      _catalogTempoHints.set(n, {
        pauseSeconds: Number(ex?.pauseSeconds || 0),
        stretchPhase: !!ex?.stretchPhase,
        peakContraction: !!ex?.peakContraction,
      });
    }
  }
  return _catalogTempoHints.get((name || '').toLowerCase().trim());
}

/**
 * Темп под характер + phase + интенс-технику + опциональный профиль темпа и eccentricMult.
 * W-5: на deload используем плавный восстановительный темп 2-0-1-0 (без искусственных 4с негативов).
 */
export function tempoFor(
  character: DayCharacter,
  technique?: string,
  phase?: string,
  exerciseName?: string,
  opts?: { tempoProfile?: TempoProfile; eccentricMult?: number },
): TempoSpec {
  const base = { ...TEMPO_BY_CHARACTER[character] };
  let notation: string | null = null;

  if (phase !== 'deload' && opts?.tempoProfile && opts.tempoProfile !== 'auto') {
    notation = TEMPO_PROFILE_DEFAULT[opts.tempoProfile];
  }

  if (!notation && phase !== 'deload' && exerciseName) {
    const override = exerciseTempoOverride(exerciseName);
    if (override) notation = override;
  }

  if (!notation && phase) {
    const phaseTempo: Record<string, string> = {
      accumulation: '3-1-1-0',
      intensification: '2-1-1-0',
      peaking: '2-0-1-0',
      deload: '2-0-1-0',
      resensitization: '2-0-1-0',
      metabolite: '2-0-1-0',
    };
    const pt = phaseTempo[phase];
    if (pt) notation = pt;
  }

  if (notation && exerciseName && phase !== 'deload'
    && (!opts?.tempoProfile || opts.tempoProfile === 'auto')
    && technique !== 'slow_eccentric' && technique !== 'negatives') {
    const hint = catalogTempoHints(exerciseName);
    if (hint && hint.pauseSeconds >= 2) {
      const parts = notation.split('-').map(Number);
      if (parts.length === 4 && parts.every(p => !isNaN(p))) {
        if (hint.stretchPhase) parts[1] = Math.max(parts[1], Math.min(3, hint.pauseSeconds));
        else if (hint.peakContraction) parts[3] = Math.max(parts[3], Math.min(2, hint.pauseSeconds));
        notation = parts.join('-');
      }
    }
  }

  if (notation && opts?.eccentricMult && opts.eccentricMult > 1 && phase !== 'deload') {
    const parts = notation.split('-').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      const extraEcc = opts.eccentricMult >= 1.2 ? 2 : 1;
      parts[0] = Math.min(6, Math.max(parts[0] + extraEcc, 3));
      notation = parts.join('-');
    }
  }

  if (notation) {
    const parts = notation.split('-').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      base.eccentric = parts[0];
      base.pause = parts[1];
      base.concentric = parts[2];
      base.notation = notation;
      base.tutPerRep = parts[0] + parts[1] + parts[2] + parts[3];
    }
  }
  if (technique === 'slow_eccentric' || technique === 'negatives') {
    base.eccentric = 4; base.notation = '4-0-1-0'; base.tutPerRep = 5;
  }
  return base;
}

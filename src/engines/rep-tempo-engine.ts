/**
 * Rep Pattern Engine + Tempo Engine — Combined Training Quality Module
 *
 * Rep Pattern Engine: selects optimal repetition pattern based on goal.
 * Tempo Engine: assigns tempo prescription (eccentric-pause-concentric-pause).
 *
 * Rep patterns:
 *  - normal: standard full ROM reps
 *  - pause: 1-2s pause at bottom/stretch position
 *  - tempo: slow eccentric, controlled concentric
 *  - explosive: max concentric speed, controlled eccentric
 *  - cluster: mini-rests between reps within a set
 *  - rest_pause: short rests between sub-maximal clusters
 *  - partial: limited ROM (for overload/rehab)
 *  - slow: 4-5s ecc, 2-3s conc (rehab/hypertrophy)
 *
 * Tempo format: ECC-BOT-CON-TOP (seconds)
 *  Example: "3-1-1-0" = 3s eccentric, 1s pause bottom, 1s concentric, 0s pause top
 *
 * @module rep-tempo-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates if a string is a valid tempo notation (e.g. "3-1-1-0" or "2-0-X-0")
 */
export function isValidTempo(tempo: string): boolean {
  const parts = tempo.split('-');
  if (parts.length !== 4) return false;
  return parts.every(p => p === 'X' || (!isNaN(Number(p)) && Number(p) >= 0));
}

/**
 * Parses a tempo string into a Tempo object
 */
export function parseTempo(tempoStr: string): Tempo | null {
  if (!isValidTempo(tempoStr)) return null;
  const parts = tempoStr.split('-');
  const ecc = Number(parts[0]);
  const bot = Number(parts[1]);
  const conc = parts[2] === 'X' ? 0 : Number(parts[2]);
  const top = Number(parts[3]);
  return {
    eccentric: ecc,
    pauseBottom: bot,
    concentric: conc,
    pauseTop: top,
    toString: tempoStr,
  };
}

export type RepPattern = 'normal' | 'pause' | 'tempo' | 'explosive' | 'cluster' | 'rest_pause' | 'partial' | 'slow';

export interface Tempo {
  eccentric: number;
  pauseBottom: number;
  concentric: number;
  pauseTop: number;
  toString: string; // "3-1-1-0"
}

export interface RepTempoOutput {
  pattern: RepPattern;
  tempo: Tempo;
  rationale: string;
  targetRPE: number;
  targetRIR: number;
}

export interface RepTempoInput {
  goal: 'strength' | 'hypertrophy' | 'conditioning' | 'technique' | 'rehab' | string;
  riskLevel: 'low' | 'medium' | 'high';
  difficultyLevel: 'low' | 'medium' | 'high';
  techniqueIssues: string[];
  isMainLift: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tempo templates
// ═══════════════════════════════════════════════════════════════════════════

const TEMPO_TEMPLATES: Record<string, Tempo> = {
  'strength_normal': { eccentric: 2, pauseBottom: 0, concentric: 1, pauseTop: 0, toString: '2-0-1-0' },
  'strength_explosive': { eccentric: 2, pauseBottom: 0, concentric: 0, pauseTop: 0, toString: '2-0-X-0' },
  'hypertrophy_normal': { eccentric: 3, pauseBottom: 0, concentric: 1, pauseTop: 0, toString: '3-0-1-0' },
  'hypertrophy_pause': { eccentric: 3, pauseBottom: 2, concentric: 1, pauseTop: 0, toString: '3-2-1-0' },
  'hypertrophy_tempo': { eccentric: 4, pauseBottom: 1, concentric: 2, pauseTop: 0, toString: '4-1-2-0' },
  'technique_slow': { eccentric: 4, pauseBottom: 2, concentric: 2, pauseTop: 1, toString: '4-2-2-1' },
  'rehab_slow': { eccentric: 5, pauseBottom: 2, concentric: 2, pauseTop: 1, toString: '5-2-2-1' },
  'conditioning_normal': { eccentric: 1, pauseBottom: 0, concentric: 1, pauseTop: 0, toString: '1-0-1-0' },
  'explosive': { eccentric: 2, pauseBottom: 0, concentric: 0, pauseTop: 0, toString: '2-0-X-0' },
};

function makeTempo(ecc: number, bot: number, conc: number, top: number): Tempo {
  const concStr = conc === 0 ? 'X' : String(conc);
  return {
    eccentric: ecc,
    pauseBottom: bot,
    concentric: conc,
    pauseTop: top,
    toString: `${ecc}-${bot}-${concStr}-${top}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Rep pattern selection
// ═══════════════════════════════════════════════════════════════════════════

interface PatternRule {
  pattern: RepPattern;
  tempo: Tempo;
  rationale: string;
  targetRPE: number;
  targetRIR: number;
  condition: (input: RepTempoInput) => boolean;
}

const PATTERN_RULES: PatternRule[] = [
  // ── Technique / Rehab ──
  {
    pattern: 'slow',
    tempo: makeTempo(5, 2, 2, 1),
    rationale: 'Реабилитационный режим: максимальный контроль, минимальный стресс на суставы',
    targetRPE: 5,
    targetRIR: 5,
    condition: (i) => i.goal === 'rehab',
  },
  {
    pattern: 'tempo',
    tempo: makeTempo(4, 2, 2, 1),
    rationale: 'Технический режим: исправление паттерна движения через замедление',
    targetRPE: 6,
    targetRIR: 4,
    condition: (i) => i.goal === 'technique' || i.techniqueIssues.length > 2,
  },

  // ── Strength ──
  {
    pattern: 'explosive',
    tempo: makeTempo(2, 0, 0, 0),
    rationale: 'Взрывной режим: максимальная скорость концентрики для развития мощности',
    targetRPE: 7,
    targetRIR: 3,
    condition: (i) => i.goal === 'strength' && i.isMainLift && i.riskLevel === 'low',
  },
  {
    pattern: 'normal',
    tempo: makeTempo(2, 0, 1, 0),
    rationale: 'Силовой режим: контролируемая эксцентрика, мощная концентрика',
    targetRPE: 8,
    targetRIR: 2,
    condition: (i) => i.goal === 'strength' && !i.isMainLift,
  },
  {
    pattern: 'cluster',
    tempo: makeTempo(1, 0, 1, 0),
    rationale: 'Кластерный режим: мини-отдых между повторами для сохранения скорости',
    targetRPE: 8,
    targetRIR: 2,
    condition: (i) => i.goal === 'strength' && i.isMainLift && i.difficultyLevel === 'high',
  },

  // ── Hypertrophy ──
  {
    pattern: 'tempo',
    tempo: makeTempo(4, 1, 2, 0),
    rationale: 'Гипертрофийный темп: удлинённая эксцентрика для микротравм',
    targetRPE: 7,
    targetRIR: 3,
    condition: (i) => i.goal === 'hypertrophy' && i.techniqueIssues.length > 0,
  },
  {
    pattern: 'pause',
    tempo: makeTempo(3, 2, 1, 0),
    rationale: 'Пауза в растянутой позиции: увеличение времени под нагрузкой',
    targetRPE: 7,
    targetRIR: 2,
    condition: (i) => i.goal === 'hypertrophy' && i.riskLevel !== 'high',
  },
  {
    pattern: 'normal',
    tempo: makeTempo(3, 0, 1, 0),
    rationale: 'Стандартный гипертрофийный режим: 3-0-1-0',
    targetRPE: 7,
    targetRIR: 2,
    condition: (i) => i.goal === 'hypertrophy',
  },

  // ── Conditioning ──
  {
    pattern: 'normal',
    tempo: makeTempo(1, 0, 1, 0),
    rationale: 'Кондиционный режим: быстрый темп, высокий пульс',
    targetRPE: 6,
    targetRIR: 4,
    condition: (i) => i.goal === 'conditioning',
  },

  // ── Fallback (always matches) ──
  {
    pattern: 'normal',
    tempo: makeTempo(2, 0, 1, 0),
    rationale: 'Стандартный режим: контролируемое движение',
    targetRPE: 7,
    targetRIR: 3,
    condition: () => true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateRepTempo(input: RepTempoInput): RepTempoOutput {
  // Override: high risk always forces slow/tempo
  if (input.riskLevel === 'high') {
    return {
      pattern: 'slow',
      tempo: makeTempo(4, 2, 2, 1),
      rationale: 'Высокий риск — максимальный контроль движения',
      targetRPE: 6,
      targetRIR: 4,
    };
  }

  // Find first matching rule
  for (const rule of PATTERN_RULES) {
    if (rule.condition(input)) {
      return {
        pattern: rule.pattern,
        tempo: rule.tempo,
        rationale: rule.rationale,
        targetRPE: rule.targetRPE,
        targetRIR: rule.targetRIR,
      };
    }
  }

  // Should never reach here due to fallback rule
  return {
    pattern: 'normal',
    tempo: makeTempo(2, 0, 1, 0),
    rationale: 'Стандартный режим по умолчанию',
    targetRPE: 7,
    targetRIR: 3,
  };
}

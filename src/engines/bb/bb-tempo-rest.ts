/**
 * bb-tempo-rest.ts — темп, TUT, интервалы отдыха по характеру дня (Этап BB12, NEW).
 */
export type DayCharacter = 'тяж' | 'памп' | 'лёг';

export interface TempoSpec { eccentric: number; pause: number; concentric: number; notation: string; tutPerRep: number; }

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

/** Темп под характер + опционально phase (ACSM 2023: eccentric 2-4с) + интенс-технику. */
export function tempoFor(character: DayCharacter, technique?: string, phase?: string): TempoSpec {
  const base = { ...TEMPO_BY_CHARACTER[character] };
  // Phase-based eccentric emphasis (ACSM 2023: accumulation 3с, peaking 2с, deload 4с)
  if (phase) {
    const phaseTempo: Record<string, { notation: string; eccentric: number }> = {
      accumulation:    { notation: '3-1-1-0', eccentric: 3 },
      intensification: { notation: '2-1-1-0', eccentric: 2 },
      peaking:         { notation: '2-0-1-0', eccentric: 2 },
      deload:          { notation: '4-2-2-0', eccentric: 4 },
    };
    const pt = phaseTempo[phase];
    if (pt) {
      base.eccentric = pt.eccentric;
      base.notation = pt.notation;
      base.tutPerRep = base.eccentric + base.pause + base.concentric;
    }
  }
  if (technique === 'slow_eccentric' || technique === 'negatives') {
    base.eccentric = 4; base.notation = '4-0-1-0'; base.tutPerRep = 5;
  }
  return base;
}
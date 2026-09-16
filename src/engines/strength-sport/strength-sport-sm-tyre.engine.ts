/**
 * strength-sport-sm-tyre.engine.ts — ТАЙР-ФЛИП: время 2-й тяги (SM movement P5)
 *
 * Систематика Hindle 2019: HP vs LP тайр-флип различаются временем 2-й тяги
 * (HP 0.38±0.17с vs LP 1.49±0.92с) — главный дискриминатор результата.
 * Фаза не входит в SMWeakPoint (инвариант библиотеки 48 записей цел) — движок
 * standalone, хост-фаза для моста — 'conditioning' (тяга+взрыв+толчок коленом).
 * 3 коррекции — собственный экспорт SM_TYRE_CORRECTIVES (не в SM_CORRECTIVES).
 *
 * Чистый движок, без UI/storage.
 */

export const SM_TYRE_HOST_PHASE = 'conditioning' as const;

export interface SMTyreInput {
  secondPullS?: number | null; // время 2-й тяги (подрыв→переворот), с
  flipsPerMin?: number | null; // темп серии (флипы/мин) — опционально
}

export interface SMTyreResult {
  valid: boolean;
  verdict: 'ok' | 'warn' | 'critical';
  text: string;
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;

/** 2-я тяга: ≤0.6с топ-зона (HP), ≤1.0с норма, дольше — слабое место. */
export function diagnoseTyreSecondPull(input: SMTyreInput): SMTyreResult | null {
  const t = num(input.secondPullS);
  if (t == null) return null;
  if (t <= 0.6) return { valid: true, verdict: 'ok', text: `2-я тяга ${t}с ≤0.6с — топ-зона (HP 0.38с)` };
  if (t <= 1.0) return { valid: true, verdict: 'ok', text: `2-я тяга ${t}с ≤1.0с — норма` };
  if (t <= 1.5) {
    return { valid: true, verdict: 'warn', text: `2-я тяга ${t}с >1.0с — LP-зона: взрыв таза + толчок коленом (HP 0.38 vs LP 1.49с)` };
  }
  return { valid: true, verdict: 'critical', text: `2-я тяга ${t}с >1.5с — переворот висит: сумо-тяга + прыжки + покрышка легче` };
}

export interface SMTyreCorrective {
  id: string;
  kind: 'technique' | 'strength' | 'stability';
  target: string;
  protocol: string;
  cue: string;
  source: string;
}

/** 3 коррекции тайра (own export — инвариант 48 записей SM_CORRECTIVES не тронут). */
export const SM_TYRE_CORRECTIVES: SMTyreCorrective[] = [
  {
    id: 'sm_tyre_second_pull_tech',
    kind: 'technique',
    target: 'Быстрая 2-я тяга (подрыв→колено→переворот)',
    protocol: '4×3 @70%, отдых 120с',
    cue: 'Таз взрывом, колено толкает шину, руки-канаты',
    source: 'Hindle 2019 (HP 2nd pull)',
  },
  {
    id: 'sm_tyre_second_pull_strength',
    kind: 'strength',
    target: 'Мощный подрыв (таз+квадры)',
    protocol: '5×3 сумо-тяга @80%, отдых 180с',
    cue: 'High-hips старт как на камне, грудь к шине',
    source: 'Winwood deadlift/tyre',
  },
  {
    id: 'sm_tyre_second_pull_stability',
    kind: 'stability',
    target: 'Удержание позиции под шиной',
    protocol: '3×20м сэндбэг-крыло @60%, отдых 90с',
    cue: 'Нейтраль спины, короткие шаги, дыхание в brace',
    source: 'McGill carry-brace',
  },
];

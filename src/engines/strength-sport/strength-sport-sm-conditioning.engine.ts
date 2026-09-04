/**
 * strength-sport-sm-conditioning.engine.ts — КОНДИЦИОНИРОВАНИЕ СТРОНГМЕНА (SM PRO)
 *
 * Три энергосистемы (Jamieson): alactic 8×10с/50с (1:5) → lactic 5×60с/90с →
 * aerobic Zone2 30мин. Выбор по провалу: medley >60с = lactic, декремент MHV >15% =
 * alactic, иначе aerobic-база. Prowler/sled/tire — имплементы из SM_BIOMECH.
 * Medley-осознание: суммарный cap ивентов → целевой work/rest.
 * Источники: Jamieson 3 системы, AthleteProfile lactate >14 ммоль/л в medley 30-60с,
 * Winwood taper (кондиция режется за 7-12д), PoinT GO MHV-декремент 15%.
 *
 * Чистый движок, без UI/storage.
 */

export type SMCondGoal = 'alactic' | 'lactic' | 'aerobic';

export const SM_COND_LABELS: Record<SMCondGoal, string> = {
  alactic: 'Алактат (взрыв 10с)',
  lactic: 'Лактат (medley 60с)',
  aerobic: 'Аэробная база (Zone2)',
};

export interface SMCondSession {
  goal: SMCondGoal;
  modality: string;
  sets: number;
  work: string;
  rest: string;
  hrZone: string;
  note: string;
}

const SESSIONS: Record<SMCondGoal, SMCondSession> = {
  alactic: {
    goal: 'alactic',
    modality: 'Prowler push 100ft / sled sprint 25м',
    sets: 8,
    work: '10с макс',
    rest: '50с (1:5)',
    hrZone: 'восстановление <130',
    note: 'Скорость, не тяжёлый толчок: пустые сани + спринт-техника (EliteFTS prowler)',
  },
  lactic: {
    goal: 'lactic',
    modality: 'Prowler 10×100ft/60с / tire flip EMOM',
    sets: 5,
    work: '60с',
    rest: '90с',
    hrZone: 'пик 170+ — терпеть',
    note: 'Medley 30-60с → лактат >14 ммоль/л: учимся держать темп под закислением',
  },
  aerobic: {
    goal: 'aerobic',
    modality: 'Zone2 30мин (вел/гребля/ходьба в гору)',
    sets: 1,
    work: '30мин',
    rest: '—',
    hrZone: '130-150 (<ANT)',
    note: 'База восстановления между event-днями; не мешает силе (Cerberus block)',
  },
};

export interface SMCondInput {
  medleyTimeS?: number | null; // факт medley, с
  medleyCapS?: number | null; // cap контеста, с
  mhvDecrementPct?: number | null; // декремент скорости йока, %
  conditioningFail?: boolean | null; // провал medley из хаба
  goal?: SMCondGoal | null; // ручной оверрайд
}

/** Автовыбор системы по провалу (ручной goal приоритетнее). */
export function smCondGoalFor(input: SMCondInput): SMCondGoal {
  if (input.goal) return input.goal;
  if (input.conditioningFail) return 'lactic';
  if (input.medleyTimeS != null && input.medleyCapS != null && input.medleyCapS > 0 && input.medleyTimeS > input.medleyCapS) return 'lactic';
  if (input.mhvDecrementPct != null && input.mhvDecrementPct > 15) return 'alactic';
  return 'aerobic';
}

export function smCondSessionFor(input: SMCondInput): SMCondSession {
  return SESSIONS[smCondGoalFor(input)];
}

/** Все три сессии для справки хаба (таб Хват/Кор). */
export function allSMCondSessions(): SMCondSession[] {
  return [SESSIONS.alactic, SESSIONS.lactic, SESSIONS.aerobic];
}

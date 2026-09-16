/**
 * arm-humerus-checklist.engine.ts — позиционный чек-лист перед тяжёлым столом (PRO-3 P8).
 * Источник маркеров: видеоанализ 74 переломов (SpringerMedicine 2024–2025) —
 * ротация туловища, сломанная ось «кисть–локоть–плечо», запястье позади плеча (81,1%),
 * 62,2% переломов — в защитной позиции. Плюс разминка (ретроспектива PMC 2023:
 * холодный сезон и отсутствие разминки — фактор риска).
 * Чистый движок без порогов силы: любой «нет» → стоп тяжёлого стола сегодня.
 */

export interface HumerusCheck {
  id: string;
  label: string;
  hint: string;
}

export const HUMERUS_CHECKS: HumerusCheck[] = [
  { id: 'axis', label: 'Ось цела', hint: 'кисть–локоть–плечо на одной линии' },
  { id: 'wrist', label: 'Запястье впереди', hint: 'не позади плеча' },
  { id: 'shoulder', label: 'Плечо не внутрь', hint: 'не ушло внутрь/назад (защита ≠ завал)' },
  { id: 'elbow', label: 'Локоть стоит', hint: 'не едет по подушке' },
  { id: 'warmup', label: 'Разминка сделана', hint: 'кровь в локте/кисти, лёгкие подходы' },
];

export interface HumerusCheckResult {
  ok: boolean;
  failedIds: string[];
  failedLabels: string[];
  stopLine: string | null;
}

export function checkHumerusChecklist(failedIds: string[]): HumerusCheckResult {
  const known = new Set(HUMERUS_CHECKS.map((c) => c.id));
  const failed = (failedIds || []).filter((id) => known.has(id));
  const labels = failed.map((id) => HUMERUS_CHECKS.find((c) => c.id === id)?.label || id);
  return {
    ok: failed.length === 0,
    failedIds: failed,
    failedLabels: labels,
    stopLine: failed.length
      ? `⛔ broken arm position — стоп: тяжёлый стол сегодня запрещён (сбоит: ${labels.join(', ')})`
      : null,
  };
}

// ── P5: humerus-danger v2 — динамика схватки, не только поза ─────────────
// Источники: Ogawa syst. review (winning 9 / even 17 / losing 20 из 46 —
// ломаются во всех фазах, не только в проигрыше), Kruczynski 60 MPa,
// teen medial epicondyle (зона роста), WAF dangerous position.

export interface HumerusDangerInput {
  losing?: boolean | null; // идёт проигрыш прямо сейчас
  sideMax?: boolean | null; // дожимание на максимуме
  elbowDeg?: number | null; // угол локтя (оценка)
  fatigue?: boolean | null; // усталость/конец турнира
  teen?: boolean | null; // 14–17 лет (epicondyle, не shaft)
  pressAttempt?: boolean | null; // идёт пресс
  axisOk?: boolean | null; // ось кисть–локоть–плечо цела
}

export interface HumerusDangerResult {
  stop: boolean;
  reasons: string[];
  note: string;
}

/** Живой guard: losing + side_max + острый локоть + усталость = стоп. */
export function assessHumerusDanger(input: HumerusDangerInput = {}): HumerusDangerResult {
  const reasons: string[] = [];
  if (input.losing && input.sideMax) {
    reasons.push('дожим на максимуме в проигрыше — торсия пиковая (сдайся/уйди в ремень, не держи на кости)');
  }
  const elbow = Number(input.elbowDeg);
  if (Number.isFinite(elbow) && elbow < 90) {
    reasons.push(`локоть ~${elbow}° <90° под нагрузкой — острый угол + торсия`);
  }
  if (input.fatigue && (input.losing || input.sideMax)) {
    reasons.push('усталость + борьба до конца — моторика плывёт, риск позы');
  }
  if (input.axisOk === false) {
    reasons.push('ось разбита — момент уходит в кость, а не в мышцы');
  }
  if (input.pressAttempt && input.axisOk === false) {
    reasons.push('пресс на разбитой оси — запрещён (только по оси + tendon≤18)');
  }
  const teenNote = input.teen
    ? ' Teen 14–17: риск не shaft, а medial epicondyle — без отказов и без максимумов в проигрыше.'
    : '';
  const stop = reasons.length > 0;
  return {
    stop,
    reasons,
    note: stop
      ? `⛔ humerus-danger: ${reasons.join('; ')}.${teenNote}`
      : `Опасной динамики нет.${teenNote}`,
  };
}

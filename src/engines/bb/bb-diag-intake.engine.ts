/**
 * bb-diag-intake.engine.ts — D1-приёмник движений ББ-диагностики (§9 плана BB-AUTO-EXHAUSTIVE-PRO).
 *
 * Владелец BBDiagnosticsHub шлёт в мост `movementDriver/singleLeg/vbtLossPct`
 * (`BBDiagnosticsHub.tsx:653-680`), приёмник их не читал. Решение §9.2 — гибрид
 * «A-инфо / B-сборка»: **сборку НЕ меняем**:
 *  - `movementDriver` НЕ пишется в `mobilityRestrictions` (единый источник ограничений — профиль,
 *    один клик «В профиль» в хабе; transient-канал дал бы расходящийся второй источник);
 *  - `singleLeg.weakSide` НЕ превращается в `lrTopUp` (у стороны нет мышцы-группы; L/R-добивка
 *    применяется прямым инжектом хаба в план);
 *  - `vbtLossPct` НЕ читается (хаб всегда шлёт `null` by design — VBT живёт в Анализе силы).
 *
 * Возвращает чистое решение (без сайд-эффектов; localStorage/сеттеры — за компонентом):
 *  - `bits`   — компактные человекочитаемые строки для `диагностика:`-тоста;
 *  - `persist`— санитизированные объекты для `he_bb_last_movement_driver`/`he_bb_last_single_leg`;
 *  - `clean`  — нужно ли снять stale L/R-канал (`he_bb_lr_topup`/`he_bb_return_action`).
 *
 * Маркер L/R-канала = ключ `lrVerdicts` ПРИСУТСТВУЕТ в payload: BB-хаб шлёт его всегда,
 * WL/SM/Arm-хабы — нет, значит их мосты ничего не сносят (обратная совместимость).
 */

export interface BbDiagMovementDriver {
  driver: string;
  label: string;
  fix: string;
  confidence: number;
}

export interface BbDiagSingleLeg {
  weakSide: 'left' | 'right' | null;
  text: string;
}

/** Вход: структурный срез payload (важен только факт присутствия ключей, значения — unknown). */
export interface BbDiagIntakeInput {
  movementDriver?: unknown;
  singleLeg?: unknown;
  lrVerdicts?: unknown;
  lrTopUp?: unknown;
  returnAction?: unknown;
  returnStage?: unknown;
  /** D1–D5: плечо/шарнир/YBT/лопатка/видео/замены — всё опционально. */
  shoulder?: unknown;
  hinge?: unknown;
  ybt?: unknown;
  scapPain?: unknown;
  videoStandard?: unknown;
  driverSubs?: unknown;
  asymPriority?: unknown;
}

export interface BbDiagIntakeExtras {
  bits: string[];
  persist: { movementDriver?: BbDiagMovementDriver; singleLeg?: BbDiagSingleLeg; movementExtra?: Record<string, string> };
  clean: { lrTopUp: boolean; returnAction: boolean };
}

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Санитизация драйвера: label обязателен (иначе объект не несёт информации), confidence — 0..1. */
function sanitizeMovementDriver(v: unknown): BbDiagMovementDriver | undefined {
  if (!isRec(v)) return undefined;
  const label = str(v.label);
  if (!label) return undefined;
  const driver = str(v.driver) || label;
  const fix = str(v.fix);
  const c = typeof v.confidence === 'number' && Number.isFinite(v.confidence)
    ? Math.max(0, Math.min(1, v.confidence))
    : 0;
  return { driver, label, fix, confidence: c };
}

/** Санитизация одностороннего: текст обязателен, сторона — строго left/right, мусор → null. */
function sanitizeSingleLeg(v: unknown): BbDiagSingleLeg | undefined {
  if (!isRec(v)) return undefined;
  const text = str(v.text);
  if (!text) return undefined;
  const weakSide = v.weakSide === 'left' || v.weakSide === 'right' ? v.weakSide : null;
  return { weakSide, text };
}

/**
 * Чистое решение приёмника: что показать (bits), что сохранить (persist) и что снять (clean).
 * Без сайд-эффектов, идемпотентна, вход не мутирует.
 */
export function resolveBbDiagIntakeExtras(d: BbDiagIntakeInput | null | undefined): BbDiagIntakeExtras {
  const src: BbDiagIntakeInput = isRec(d) ? d : {};

  const movementDriver = sanitizeMovementDriver(src.movementDriver);
  const singleLeg = sanitizeSingleLeg(src.singleLeg);

  const bits: string[] = [];
  if (movementDriver) {
    bits.push(movementDriver.fix
      ? `движение: ${movementDriver.label} (фикс: ${movementDriver.fix})`
      : `движение: ${movementDriver.label}`);
  }
  if (singleLeg?.weakSide) {
    bits.push(`односторонний: слабее ${singleLeg.weakSide === 'left' ? 'левая' : 'правая'}`);
  }
  // D1–D5: только заполненное, мусор — тихо (санитизация через trim, кап 300).
  const extra: Record<string, string> = {};
  const take = (key: string, v: unknown, pick: (r: Record<string, unknown>) => string): void => {
    if (!isRec(v)) return;
    const t = pick(v).trim().slice(0, 300);
    if (t) { extra[key] = t; bits.push(t); }
  };
  take('shoulder', src.shoulder, (r) => (typeof r.text === 'string' && (r.pass === false || /плечо у стены/i.test(r.text)) ? `плечо: ${r.text}` : ''));
  take('hinge', src.hinge, (r) => (typeof r.text === 'string' && !/не проверял/i.test(r.text) ? `шарнир: ${r.text}` : ''));
  take('ybt', src.ybt, (r) => (typeof r.text === 'string' && !/не замерялся/i.test(r.text) ? `${r.text}` : ''));
  take('scapPain', src.scapPain, (r) => (typeof r.text === 'string' && r.text ? `${r.text}` : ''));
  take('driverSubs', src.driverSubs, (r) => {
    const pref = Array.isArray(r.prefer) ? r.prefer.map(String).filter(Boolean).slice(0, 3).join(' · ') : '';
    return pref ? `замены: ${pref}` : '';
  });
  // asymPriority едет строкой (не объектом) — отдельный гейт.
  if (typeof src.asymPriority === 'string') {
    const t = src.asymPriority.trim().slice(0, 300);
    if (t && !/значимых нет/i.test(t)) { extra.asymPriority = t; bits.push(t); }
  }
  if (typeof src.videoStandard === 'string') {
    const t = src.videoStandard.trim().slice(0, 300);
    if (t) { extra.videoStandard = t; bits.push(`видео: ${t}`); }
  }

  const hasLrMarker = src.lrVerdicts !== undefined;
  const clean = {
    lrTopUp: hasLrMarker && (src.lrTopUp === undefined || src.lrTopUp === null),
    returnAction: hasLrMarker
      && (src.returnAction === undefined || src.returnAction === null)
      && (src.returnStage === undefined || src.returnStage === null),
  };

  const persist: BbDiagIntakeExtras['persist'] = {};
  if (movementDriver) persist.movementDriver = movementDriver;
  if (singleLeg) persist.singleLeg = singleLeg;
  if (Object.keys(extra).length) persist.movementExtra = extra;

  return { bits, persist, clean };
}

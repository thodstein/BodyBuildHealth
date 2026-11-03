/**
 * bb-hub-export.ts — PRO-5 Э5: единый сборщик PRO-меты выдачи ББ-диагностики.
 *
 * Раньше HTML/CSV/печать собирали мету тремя копиями литералов, и CSV молча терял
 * `driver_subs` (движок его читает — строка не появлялась). Теперь один объект:
 * HTML и CSV получают идентичную мету (различие поверхностей — только обёртка),
 * чистый модуль без стора/сайд-эффектов, вход — значения мемов хаба.
 */

export interface BbHubPro2Input {
  lrVerdicts: Array<{
    group: string; left: number; right: number; asymPct: number | null;
    weakSide: 'left' | 'right' | null; verdict: string; topUpSets: number; text: string;
  }>;
  moveDriver: unknown;
  singleLeg: unknown;
  ohs: { totalScore: number; failed: number };
  mmcLine: string | null;
  shoulder: unknown;
  /** `${hingeV.text} · ${loadedV.text}` — как в карточке шага (строка, не объект). */
  hingeText: string;
  ybt: unknown;
  asymText: string;
  /** `${prefer.join(' · ')} — ${note}` (или null — секции нет). */
  driverSubsText: string | null;
  bench: { level: string; text: string } | null;
  painMonLine: string | null;
  posterior: { nhe: string | null; adductor: string | null } | null;
  loadedHinge: { text: string } | null;
  erir: { text: string } | null;
  screenPriority: string[] | null;
  correctiveDetail: unknown;
  /** ROUND-10: строки блока коррекции (волна) — тот же источник, что карточка хаба. */
  correctionBlock: string[] | null;
  lrDirection: Array<{ group: string; text: string }>;
  /**
   * AUDIT 2026-11 (BB-D-33): поля, которые HTML умеет рисовать, а сборщик их не
   * отдавал — секции «Готовность/Флаги/Возврат/LVP/Сухожилия/Подросток/Женские/
   * Рабочий вес» в экспорте оставались пустыми при живых данных хаба.
   */
  readiness?: { level: string; advice: string; reasons: string[] } | null;
  redFlags?: { active: boolean; blocked: boolean; items: string[]; text: string } | null;
  returnTo?: { text: string; stages: Array<{ stage: number; title: string; volume: string; rir: string; note: string; action?: { volumeMult: number; rirShift: number } }> } | null;
  lvp?: { lift: string; r2: number; e1rm: number | null; text: string; valid?: boolean } | null;
  tendon?: { elbow: string; shoulder: string } | null;
  teen?: string | null;
  femaleNotes?: string[] | null;
  workingRange?: string | null;
  /**
   * BB-G-01/04: сводка «Объём · Recovery · Mobility» (чипы, ограничитель, действия)
   * и строка эффекта коррекции. Раньше шестого экрана не было вовсе — экспорт ему
   * не соответствовал; теперь «показано = выгружено».
   */
  volumeRecovery?: {
    chips: Array<{ label: string; value: string; detail: string }>;
    limiter: { label: string; detail: string } | null;
    advice: string[];
    effect: string | null;
  } | null;
  /**
   * BB-G-08: 1–2 действия «что делать дальше» из шапки хаба. Без поля секции в
   * отчёте нет — старые вызовы сборщика остаются байт-в-байт.
   */
  nextActions?: Array<{
    title: string;
    why: string;
    kind: string;
    zone: string;
    where: { type: string; id: string; label: string } | null;
  }> | null;
}

/** Единая мета для `buildBBDiagnosticsHtml` и `buildBBDiagnosticsCsv` (пусто — тихо). */
export function buildPro2Meta(i: BbHubPro2Input): Record<string, unknown> {
  return {
    lr: i.lrVerdicts.map((v) => ({
      group: v.group, left: v.left, right: v.right, asymPct: v.asymPct,
      weakSide: v.weakSide, verdict: v.verdict, topUpSets: v.topUpSets, text: v.text,
    })),
    movementDriver: i.moveDriver,
    singleLeg: i.singleLeg,
    ohs: i.ohs,
    mmc: i.mmcLine,
    shoulder: i.shoulder,
    hinge: { text: i.hingeText },
    ybt: i.ybt,
    asymPriority: i.asymText,
    driverSubs: i.driverSubsText ? { text: i.driverSubsText } : null,
    bench: i.bench,
    painMon: i.painMonLine,
    posterior: i.posterior,
    loadedHinge: i.loadedHinge,
    erir: i.erir,
    screenPriority: i.screenPriority,
    correctiveDetail: i.correctiveDetail,
    correctionBlock: i.correctionBlock,
    lrDirection: i.lrDirection,
    readiness: i.readiness ?? undefined,
    redFlags: i.redFlags ?? undefined,
    returnTo: i.returnTo ?? undefined,
    lvp: i.lvp ?? undefined,
    tendon: i.tendon ?? undefined,
    teen: i.teen ?? undefined,
    femaleNotes: i.femaleNotes?.length ? i.femaleNotes : undefined,
    workingRange: i.workingRange ?? undefined,
    volumeRecovery: i.volumeRecovery ?? undefined,
    nextActions: i.nextActions?.length ? i.nextActions : undefined,
  };
}

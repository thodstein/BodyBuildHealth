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
  };
}

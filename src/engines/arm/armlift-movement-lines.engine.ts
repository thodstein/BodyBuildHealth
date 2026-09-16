/**
 * armlift-movement-lines.engine.ts — строки движения из моста в конструктор (PRO-6 M10).
 * Хаб шлёт 8 опциональных полей (`diagTimelinePhase/diagAttemptPlan/diagHandNote/
 * diagHoldCurve/diagConditionsNote/diagVideoNote/diagPainZones/diagPainNote`);
 * приёмник показывает их видимыми строками, сборку не меняет
 * (прецедент PRO-5 «диагноз видимой строкой»).
 * Пусто/мусор — тихо. Чистые функции, без стораджа.
 */

export interface ArmliftMovementLines {
  lines: string[];
  /** true → красные флаги карты боли (стоп к врачу). */
  painStop: boolean;
}

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

/** Видимые строки движения из `armLifting`-пейлоада моста. */
export function armliftMovementFlashLines(al: unknown): ArmliftMovementLines {
  const lines: string[] = [];
  let painStop = false;
  if (!al || typeof al !== 'object') return { lines, painStop };
  const a = al as Record<string, unknown>;

  const tp = a.diagTimelinePhase;
  if (tp && typeof tp === 'object') {
    const label = str((tp as Record<string, unknown>).label);
    if (label) lines.push(`фаза срыва: ${label}`);
  }
  const ap = a.diagAttemptPlan;
  if (ap && typeof ap === 'object') {
    const r = ap as Record<string, unknown>;
    const nums = [r.opener, r.second, r.third].map(Number);
    if (nums.every((n) => Number.isFinite(n) && n > 0)) {
      lines.push(`попытки: ${nums.join('/')}`);
    }
  }
  const hand = str(a.diagHandNote);
  if (hand) lines.push(hand);
  const hc = a.diagHoldCurve;
  if (hc && typeof hc === 'object') {
    const note = str((hc as Record<string, unknown>).note);
    if (note) lines.push(note);
  }
  const cond = str(a.diagConditionsNote);
  if (cond) lines.push(cond);
  const vid = str(a.diagVideoNote);
  if (vid) lines.push(vid);
  const pain = str(a.diagPainNote);
  if (pain) {
    // painStop потребляется здесь же: стоп-строка с ⛔ видна в линии моста.
    if (pain.startsWith('Стоп:')) { painStop = true; lines.push(`⛔ ${pain}`); }
    else lines.push(pain);
  }
  return { lines, painStop };
}

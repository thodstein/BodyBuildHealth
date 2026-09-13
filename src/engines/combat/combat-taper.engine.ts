/**
 * combat-taper.engine.ts — тапер к дате боя (Bosquet 2007 + ISSN 2025).
 * Изолировано.
 */

export interface TaperConfig {
  fightDate: string; // ISO
  taperWeeks: number; // 1 | 2
  startDate?: string | null; // ISO start of plan, default today
}

function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  if (!Number.isFinite(d.getTime())) return false;
  // проверяем что 2025-02-30 не превратился в 2025-03-02
  return d.toISOString().slice(0, 10) === str;
}

export function fightWeekIndex(fightDate: string, startDate: string | null | undefined, totalWeeks: number): number {
  try {
    if (!isValidIsoDate(fightDate)) return totalWeeks;
    const f = new Date(fightDate).getTime();
    if (!startDate) {
      // детерминированный fallback: если старт не задан — бой в конце плана (последняя неделя), не завязываемся на Date.now()
      return totalWeeks;
    }
    if (!isValidIsoDate(startDate)) return totalWeeks;
    const s = new Date(startDate).getTime();
    if (f < s) {
      // бой до старта — невалидно, считаем бой в конце (не в начале кэмпа)
      return totalWeeks;
    }
    const diffDays = Math.round((f - s) / 86400000);
    // неделя 1 = дни 0-6, неделя 2 = 7-13 etc; если после — к totalWeeks
    const w = Math.floor(diffDays / 7) + 1;
    return Math.max(1, Math.min(totalWeeks, w));
  } catch {
    return totalWeeks;
  }
}

export function isTaperByFightDate(week: number, totalWeeks: number, cfg: TaperConfig | null | undefined): boolean {
  if (!cfg || !cfg.fightDate) return false;
  const fw = fightWeekIndex(cfg.fightDate, cfg.startDate, totalWeeks);
  const tw = Math.max(1, Math.min(2, Math.round(cfg.taperWeeks || 1)));
  return week >= fw - tw + 1 && week <= fw;
}

export function taperVolumeMultiplier(week: number, totalWeeks: number, cfg: TaperConfig | null | undefined, isDeload?: boolean): number {
  return scMult(week, totalWeeks, cfg, isDeload);
}

export function buildTaperRationale(cfg: TaperConfig | null | undefined, totalWeeks: number): string[] {
  if (!cfg || !cfg.fightDate) return [];
  const fw = fightWeekIndex(cfg.fightDate, cfg.startDate, totalWeeks);
  const tw = cfg.taperWeeks || 1;
  return [`Тапер ${tw}нед к бою ${cfg.fightDate} (нед ${fw}): объём 0.65→0.45, интенсивность 90-95%, спарринг ↓30%`, 'Heat acclimation: сауна 15-20′×3/нед в тапер (опционально)'];
}

// ── P1 PRO: единый тапер (Bosquet 2007 + Boxing Science + fight-week практика) ──
// Один источник «тейпера»: conditioning/sparring-ветки делегируют сюда, дубли не плодятся.

/**
 * Единые факторы тапера — один источник для зала, кондиции и сплита.
 * Кондиция (×0.7/×0.6) и делод (×0.6) берутся отсюда же (см. combat-conditioning.engine).
 */
export const TAPER_SC_PRE = 0.65;
export const TAPER_SC_FIGHT = 0.45;
export const TAPER_SC_FIGHT_SHORT = 0.55;
export const TAPER_COND = 0.7;
export const TAPER_DELOAD = 0.6;

/** Единственная реализация S&C-кривой (taperVolumeMultiplier и сплит — тонкие обёртки). */
function scMult(week: number, totalWeeks: number, cfg: TaperConfig | null | undefined, isDeload?: boolean): number {
  if (isDeload) return TAPER_DELOAD;
  if (!cfg || !cfg.fightDate) return 1;
  const fw = fightWeekIndex(cfg.fightDate, cfg.startDate, totalWeeks);
  const tw = Math.max(1, Math.min(2, Math.round(cfg.taperWeeks || 1)));
  if (tw === 2) {
    if (week === fw - 1) return TAPER_SC_PRE; // предпоследняя
    if (week === fw) return TAPER_SC_FIGHT; // последняя
  } else {
    if (week === fw) return TAPER_SC_FIGHT_SHORT;
  }
  return 1;
}

/** Раздельные кривые тапера: S&C-зал / кондиция / жёсткий спарринг. */
export interface TaperSplit { sc: number; cond: number; sparringHard: number; }

/**
 * Раздельный мультипликатор недели (сила и кондиция тейперятся раздельно —
 * разные скорости восстановления, Boxing Science; sparring hard → 0 к бою).
 * sc повторяет taperVolumeMultiplier 1-в-1 (калибровки целы).
 */
export function taperSplitForWeek(
  week: number,
  totalWeeks: number,
  cfg: TaperConfig | null | undefined,
  isDeload?: boolean
): TaperSplit {
  const sc = scMult(week, totalWeeks, cfg, isDeload);
  if (!cfg || !cfg.fightDate) return { sc, cond: 1, sparringHard: 1 };
  const fw = fightWeekIndex(cfg.fightDate, cfg.startDate, totalWeeks);
  const tw = Math.max(1, Math.min(2, Math.round(cfg.taperWeeks || 1)));
  const inTaper = week >= fw - tw + 1 && week <= fw;
  const isFightWeek = week === fw;
  return {
    sc,
    // кондиция-тапер дольше и мягче (тип интервалов не менять — см. conditioning engine, тот же TAPER_COND)
    cond: isDeload ? TAPER_DELOAD : inTaper ? TAPER_COND : 1,
    // дни 14–10 — последний hard spar (0.5 = technical only), fight week — 0 (запрет)
    sparringHard: isFightWeek ? 0 : inTaper ? 0.5 : 1,
  };
}

/**
 * Рекомендуемая длительность тапера от объёма кэмпа (UFC PI / James et al.):
 * 2×/день (≈10+ сессий/нед) → 14 дней (2 нед); 4–5×/нед → 7–10 дней (1 нед).
 */
export function recommendTaperWeeks(gymDaysPerWeek: number, outsideSessionsPerWeek: number): 1 | 2 {
  const total = Math.max(0, gymDaysPerWeek || 0) + Math.max(0, outsideSessionsPerWeek || 0);
  return total >= 8 ? 2 : 1;
}

/**
 * Блокирующая проверка дат (P1-гейт): мусорные даты — error, а не молчаливый totalWeeks.
 * Возвращает errors (пусто = даты валидны или боя нет).
 */
export function validateTaperConfig(
  fightDate: string | null | undefined,
  startDate: string | null | undefined,
  taperWeeks?: number
): string[] {
  const errs: string[] = [];
  if (!fightDate) return errs;
  if (!isValidIsoDate(fightDate)) {
    errs.push(`Дата боя «${fightDate}» невалидна (нужен ISO ГГГГ-ММ-ДД) — тапер не построен`);
    return errs;
  }
  if (startDate && isValidIsoDate(startDate)) {
    if (new Date(fightDate).getTime() < new Date(startDate).getTime()) {
      errs.push(`Бой ${fightDate} раньше старта плана ${startDate} — тапер не построен`);
    }
  }
  if (taperWeeks != null && (!Number.isFinite(taperWeeks) || taperWeeks < 1 || taperWeeks > 3)) {
    errs.push(`Длина тапера ${taperWeeks} вне 1–3 нед — взят кламп 1–2`);
  }
  return errs;
}

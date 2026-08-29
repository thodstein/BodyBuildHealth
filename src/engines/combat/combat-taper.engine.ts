/**
 * combat-taper.engine.ts — тапер к дате боя (Bosquet 2007 + ISSN 2025).
 * Изолировано.
 */

export interface TaperConfig {
  fightDate: string; // ISO
  taperWeeks: number; // 1 | 2
  startDate?: string | null; // ISO start of plan, default today
}

export function fightWeekIndex(fightDate: string, startDate: string | null | undefined, totalWeeks: number): number {
  try {
    const f = new Date(fightDate).getTime();
    if (!Number.isFinite(f)) return totalWeeks;
    if (!startDate) {
      // детерминированный fallback: если старт не задан — бой в конце плана (последняя неделя), не завязываемся на Date.now()
      return totalWeeks;
    }
    const s = new Date(startDate).getTime();
    if (!Number.isFinite(s)) return totalWeeks;
    const diffDays = Math.round((f - s) / 86400000);
    // неделя 1 = дни 0-6, неделя 2 = 7-13 etc; если бой до старта — кламп к 1, если после — к totalWeeks
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
  if (isDeload) return 0.60;
  if (!cfg || !cfg.fightDate) return 1;
  const fw = fightWeekIndex(cfg.fightDate, cfg.startDate, totalWeeks);
  const tw = Math.max(1, Math.min(2, Math.round(cfg.taperWeeks || 1)));
  if (tw === 2) {
    if (week === fw - 1) return 0.65; // предпоследняя
    if (week === fw) return 0.45; // последняя
  } else {
    if (week === fw) return 0.55;
  }
  return 1;
}

export function buildTaperRationale(cfg: TaperConfig | null | undefined, totalWeeks: number): string[] {
  if (!cfg || !cfg.fightDate) return [];
  const fw = fightWeekIndex(cfg.fightDate, cfg.startDate, totalWeeks);
  const tw = cfg.taperWeeks || 1;
  return [`Тапер ${tw}нед к бою ${cfg.fightDate} (нед ${fw}): объём 0.65→0.45, интенсивность 90-95%, спарринг ↓30%`, 'Heat acclimation: сауна 15-20′×3/нед в тапер (опционально)'];
}

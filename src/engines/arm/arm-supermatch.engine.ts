/**
 * arm-supermatch.engine.ts — суперматч best-of-5/6 и спец. выносливость (эпик C).
 *
 * Формат: раунды 10-15с fight / 60-90с rest, 3-6 раундов по уровню.
 * Нагрузка: пиковые удержания в слабом углу + скоростная пронация + wrist-roller.
 * Делоадная неделя: −40% объёма (GripStrength Week 12).
 */

export interface SupermatchRound {
  round: number;
  fightSec: number;
  restSec: number;
  intensityPct: number; // 0.85-1.0
}

export interface SupermatchPlan {
  rounds: SupermatchRound[];
  totalTimeUnderTensionSec: number;
  totalRestSec: number;
  isDeload: boolean;
  volumeSets: number; // силовых сетов в неделю под суперматч
  note: string;
}

export function supermatchRoundsFor(level: string, isDeload: boolean): { rounds: number; fightSec: number; restSec: number } {
  const lvl = (level || '').toLowerCase();
  if (isDeload) return { rounds: 3, fightSec: 10, restSec: 90 };
  if (lvl === 'beginner') return { rounds: 3, fightSec: 10, restSec: 90 };
  if (lvl === 'intermediate') return { rounds: 4, fightSec: 12, restSec: 75 };
  if (lvl === 'advanced') return { rounds: 5, fightSec: 15, restSec: 60 };
  return { rounds: 6, fightSec: 15, restSec: 60 }; // enhanced
}

export function buildSupermatchPlan(input: {
  level?: string;
  week?: number;
  isDeload?: boolean;
  baseSets?: number;
}): SupermatchPlan {
  const isDeload = !!input.isDeload;
  const cfg = supermatchRoundsFor(input.level || 'intermediate', isDeload);
  const rounds: SupermatchRound[] = [];
  for (let i = 1; i <= cfg.rounds; i++) {
    // нарастание к 3-му раунду, затем поддержание (пик середины матча)
    const intensityPct = isDeload ? 0.85 : i <= 3 ? 0.9 + i * 0.02 : 0.96;
    rounds.push({ round: i, fightSec: cfg.fightSec, restSec: i === cfg.rounds ? 0 : cfg.restSec, intensityPct: Math.round(intensityPct * 100) / 100 });
  }
  const totalTimeUnderTensionSec = rounds.reduce((s, r) => s + r.fightSec, 0);
  const totalRestSec = rounds.reduce((s, r) => s + r.restSec, 0);
  const base = Math.max(4, Math.round(input.baseSets ?? 12));
  const volumeSets = isDeload ? Math.max(2, Math.round(base * 0.6)) : base;
  return {
    rounds,
    totalTimeUnderTensionSec,
    totalRestSec,
    isDeload,
    volumeSets,
    note: isDeload
      ? `Делоад суперматча: ${cfg.rounds}×${cfg.fightSec}с, объём −40%.`
      : `Суперматч: ${cfg.rounds} раундов × ${cfg.fightSec}с / отдых ${cfg.restSec}с. Пин-холды в слабом углу + скорость.`,
  };
}

/** Проверка выносливости: удержание пина должно расти к пику, падать в делоад. */
export function supermatchProgressionOk(weeks: Array<{ tutSec: number; isDeload?: boolean }>): boolean {
  if (weeks.length < 2) return true;
  const peak = weeks.filter((w) => !w.isDeload).map((w) => w.tutSec);
  for (let i = 1; i < peak.length; i++) if (peak[i] < peak[i - 1]) return false;
  const deloads = weeks.filter((w) => w.isDeload);
  const maxPeak = peak.length ? Math.max(...peak) : 0;
  for (const d of deloads) if (d.tutSec >= maxPeak) return false;
  return true;
}

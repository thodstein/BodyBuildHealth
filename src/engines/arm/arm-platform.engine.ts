/**
 * arm-platform.engine.ts — армлифтинг-помост (эпик J PRO-плана).
 *
 * Правила ArmliftingUSA/IronMind: 1 минута на макс, промах = выбыл,
 * только DOH, без лямок. Симулятор: 3 попытки на снаряд, выбор веса,
 * итог + % от мирового рекорда.
 */

export interface PlatformAttempt {
  attempt: number; // 1-3
  weightKg: number;
  success: boolean; // ввод факта
}

export interface PlatformResult {
  implement: string;
  bestKg: number;
  attemptsUsed: number;
  totalScore: number; // сумма лучших по снарядам (для многоборья считает вызывающий)
  worldRecordKg: number;
  wrPct: number; // best/WR*100
  note: string;
}

/** Мировые ориентиры (муж, открытая; женские — через коэффициент 0.59). */
export const PLATFORM_WR: Record<string, { maleKg: number; femaleKg: number; name: string }> = {
  rolling_thunder: { maleKg: 130.5, femaleKg: 77.2, name: 'Rolling Thunder' },
  apollon_axle: { maleKg: 133, femaleKg: 78, name: 'Apollon Axle' },
  saxon_bar: { maleKg: 133, femaleKg: 70, name: 'Saxon Bar' },
  hub: { maleKg: 45, femaleKg: 25, name: 'IronMind Hub' },
  pinch_block: { maleKg: 80, femaleKg: 45, name: 'Pinch Block' },
  coc_gripper: { maleKg: 55, femaleKg: 30, name: 'CoC (эквивалент)' },
};

export function platformWrFor(implement: string, sex: string): number {
  const rec = PLATFORM_WR[implement] || PLATFORM_WR['rolling_thunder'];
  return (sex || '').toLowerCase() === 'female' ? rec.femaleKg : rec.maleKg;
}

/** План попыток: opener 90%, second 95-97%, third 101-103% от цели. */
export function planAttempts(targetKg: number): number[] {
  const t = Number(targetKg);
  if (!Number.isFinite(t) || t <= 0) return [];
  const r = (v: number) => Math.round(v * 2) / 2;
  return [r(t * 0.9), r(t * 0.96), r(t * 1.02)];
}

export function scorePlatform(input: {
  implement?: string;
  sex?: string;
  attempts: PlatformAttempt[];
}): PlatformResult {
  const implement = input.implement || 'rolling_thunder';
  const wr = platformWrFor(implement, input.sex || 'male');
  const ok = (input.attempts || []).filter((a) => a.success && Number.isFinite(Number(a.weightKg)));
  const bestKg = ok.length ? Math.max(...ok.map((a) => Number(a.weightKg))) : 0;
  const wrPct = wr > 0 ? Math.round((bestKg / wr) * 1000) / 10 : 0;
  return {
    implement,
    bestKg,
    attemptsUsed: (input.attempts || []).length,
    totalScore: bestKg,
    worldRecordKg: wr,
    wrPct,
    note:
      ok.length === 0
        ? 'Все попытки сорваны — занизить opener до 85%.'
        : wrPct >= 90
          ? `Элита: ${wrPct}% WR.`
          : wrPct >= 70
            ? `Соревновательный уровень: ${wrPct}% WR.`
            : `База: ${wrPct}% WR — работать opener.`,
  };
}

/** Ротация снарядов по неделям: support → pinch → crush (цикл 3). */
export function platformRotationForWeek(week: number): 'support' | 'pinch' | 'crush' {
  const pos = ((Math.max(1, Math.round(week)) - 1) % 3 + 3) % 3;
  return pos === 0 ? 'support' : pos === 1 ? 'pinch' : 'crush';
}

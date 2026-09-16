/**
 * arm-table-strength.engine.ts — P4: силовая кривая стола (HUMAC-лайт).
 *
 * Без прибора: 3-сек изометрия в ремне (кг) + пин-холд (с) + усталость
 * по раундам best-of-5/7. Популяционных норм не выдумываем — только
 * наличие/дельты/провалы: чего нет, что просело к 3-му раунду, где дыра.
 * Референс-протокол в подсказках: isokinetic 60°/s сила, 180°/s мощность.
 */

export interface TableStrengthInput {
  wristFlexKg?: number | null;
  pronKg?: number | null;
  risingKg?: number | null;
  pinHoldSec?: number | null;
  round1Sec?: number | null;
  round3Sec?: number | null;
}

export interface TableStrengthResult {
  filledCount: number;
  scoreReliable: boolean;
  fatigueIndex: number | null;
  gaps: string[];
  note: string;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function assessTableStrength(input: TableStrengthInput = {}): TableStrengthResult {
  const w = num(input.wristFlexKg);
  const p = num(input.pronKg);
  const r = num(input.risingKg);
  const hold = num(input.pinHoldSec);
  const r1 = num(input.round1Sec);
  const r3 = num(input.round3Sec);
  const filled = [w, p, r, hold].filter((x) => x != null && (x as number) > 0).length;
  const gaps: string[] = [];
  if (w == null || w <= 0) gaps.push('wristFlex: нет замера — 3с изометрия сгибания кисти в ремне.');
  if (p == null || p <= 0) gaps.push('pron: нет замера — 3с пронация в ремне.');
  if (r == null || r <= 0) gaps.push('rising: нет замера — 3с подъём костяшек в ремне.');
  if (hold == null || hold <= 0) gaps.push('pinHold: нет замера — удержание в слабом углу до отказа.');
  let fatigueIndex: number | null = null;
  if (r1 != null && r3 != null && r1 > 0) {
    fatigueIndex = Math.round(((r1 - r3) / r1) * 100);
    if (fatigueIndex >= 30) gaps.push(`Усталость ${fatigueIndex}% (раунд1 ${r1}с → раунд3 ${r3}с): выносливость поздних раундов — статика 10–20с + TUT.`);
  }
  // Слабое звено среди заполненных (минимум).
  const entries: Array<[string, number]> = [];
  if (w != null && w > 0) entries.push(['wristFlex', w]);
  if (p != null && p > 0) entries.push(['pron', p]);
  if (r != null && r > 0) entries.push(['rising', r]);
  entries.sort((a, b) => a[1] - b[1]);
  let note: string;
  if (!filled) {
    note = 'Силы стола нет — замерь 4 точки: wristFlex/pron/rising (кг, 3с) + pinHold (с). Референс: isokinetic 60°/s сила, 180°/s мощность.';
  } else if (entries.length) {
    const weak = entries[0][0];
    const weakRu = weak === 'wristFlex' ? 'сгибание кисти' : weak === 'pron' ? 'пронация' : 'райзинг';
    note = `Заполнено ${filled}/4. Слабое звено стола: ${weakRu}.` +
      (fatigueIndex != null ? ` Усталость к 3-му раунду: ${fatigueIndex}%.` : '') +
      (gaps.length ? ` Добрать: ${gaps.length} замер(а).` : '');
  } else {
    note = `Заполнено ${filled}/4 (только pinHold ${hold}с). Добавь кг-замеры трёх векторов.`;
  }
  return {
    filledCount: filled,
    scoreReliable: filled >= 2,
    fatigueIndex,
    gaps,
    note,
  };
}

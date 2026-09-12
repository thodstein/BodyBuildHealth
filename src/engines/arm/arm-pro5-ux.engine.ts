/**
 * arm-pro5-ux.engine.ts — PRO-5 P7 + P5-хелперы UX (чистый модуль без импортов).
 *
 * - suggestSplitForCycle: несочетаемый цикл↔сплит чинится в 1 клик (вместо warning);
 * - consentPreview: диалог согласия fit показывает было/стало;
 * - deloadEnforcement: проверка каденса делоадов (каждые 4, masters 50+ — каждые 3);
 * - ARM_PHASE_PRESETS: годовая лестница off-season → strength/power → peaking.
 */

export interface CycleLite {
  id: string;
  name: string;
  daysPerWeek: number;
  tablePerWeek: number;
  discipline: string;
}

export interface SplitLite {
  id: string;
  name: string;
  sessionsPerRotation: number;
  rotationDays: number;
}

/** Подобрать сплит под цикл по дням/нед (ближайший по частоте + стол). */
export function suggestSplitForCycle(cycle: CycleLite, splits: SplitLite[]): SplitLite | null {
  if (!cycle || !Array.isArray(splits) || splits.length === 0) return null;
  const perWeek = (p: SplitLite) => (p.sessionsPerRotation * 7) / Math.max(1, p.rotationDays);
  const tableNeed = Number(cycle.tablePerWeek || 0);
  const sorted = [...splits].sort((a, b) => {
    const da = Math.abs(perWeek(a) - cycle.daysPerWeek);
    const db = Math.abs(perWeek(b) - cycle.daysPerWeek);
    if (da !== db) return da - db;
    const ta = /table/i.test(a.id) || /table/i.test(a.name) ? 0 : 1;
    const tb = /table/i.test(b.id) || /table/i.test(b.name) ? 0 : 1;
    if (tableNeed > 0 && ta !== tb) return ta - tb;
    return 0;
  });
  return sorted[0] || null;
}

/** Превью согласия fit: было недель/фаз → станет (extend/shrink), честные строки. */
export function consentPreview(input: {
  fit: string;
  cycleWeeks: number;
  targetWeeks: number;
  cycleName: string;
}): { title: string; lines: string[]; canApply: boolean } {
  const fit = String(input.fit || 'exact');
  if (fit === 'exact')
    return { title: 'Цикл лёг 1-в-1', lines: [`${input.cycleName}: ${input.cycleWeeks} нед → ${input.targetWeeks} нед — без изменений.`], canApply: true };
  if (fit === 'proposed_extend')
    return {
      title: 'Растянуть цикл?',
      lines: [
        `Было: ${input.cycleName} ${input.cycleWeeks} нед.`,
        `Станет: ${input.targetWeeks} нед (финал повторяется последними фазами, объём ×0.9).`,
        'Без согласия — generic-фазы, цикл не применяется.',
      ],
      canApply: true,
    };
  if (fit === 'proposed_shrink')
    return {
      title: 'Сжать цикл?',
      lines: [
        `Было: ${input.cycleName} ${input.cycleWeeks} нед.`,
        `Станет: ${input.targetWeeks} нед (середина вырезается, пик и делоад сохраняются).`,
        'Без согласия — generic-фазы, цикл не применяется.',
      ],
      canApply: true,
    };
  return {
    title: 'Без согласия — пропущен',
    lines: [`${input.cycleName} не лёг на ${input.targetWeeks} нед без согласия — построен generic.`],
    canApply: false,
  };
}

/** Каденс делоадов: окно без делоада длиннее каденса → warning. */
export function deloadEnforcement(
  phases: Record<number, string>,
  weeks: number,
  mastersDeload: boolean,
): string[] {
  const cadence = mastersDeload ? 3 : 4;
  const out: string[] = [];
  let since = 0;
  for (let w = 1; w <= weeks; w++) {
    if (String(phases[w]) === 'deload') since = 0;
    else {
      since++;
      if (since > cadence && w < weeks)
        out.push(`Н${w}: без делоада ${since} нед подряд (каденс ${cadence}) — вставить разгрузку.`);
    }
  }
  return out;
}

/** Годовая лестница: фазовые пресеты объёма (множитель к MRV-таргету). */
export const ARM_PHASE_PRESETS: Record<string, { volumeMult: number; rirShift: number; note: string }> = {
  off_season: { volumeMult: 1, rirShift: 1, note: 'Off-season: containment/wrist integrity, RIR+1, tendon-care.' },
  strength_power: { volumeMult: 1, rirShift: 0, note: 'Strength/power: интенсивность растёт, объём держится.' },
  peaking: { volumeMult: 0.6, rirShift: 2, note: 'Peaking: −40% объёма, без максимума до старта.' },
};

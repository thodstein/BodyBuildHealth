/**
 * combat-export-ru.test.ts — экспорты без английских id: печать/CSV/XLS/ICS
 * и годовая печать показывают теги/фазы/стили по-русски.
 */
import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { buildCombatPrintHtml, buildCombatCsv, buildCombatPlanIcs } from '../combat-print.engine';
import { buildCombatXlsxHtml, buildCombatXlsxBuffer } from '../combat-xlsx.engine';
import { buildAnnualATR, buildAnnualPrintHtml, buildAnnualIcs } from '../combat-annual';

const mkPlan = () => finalizeCombatPlan(buildCombatPlan({
  discipline: 'mma', goal: 'camp', level: 'advanced', weeks: 4, daysPerWeek: 3,
  fightStyle: 'striker', weightCutKg: 4, bodyweight: 80,
} as any));

describe('combat export RU', () => {
  it('печать: теги/фазы/стили по-русски', () => {
    const html = buildCombatPrintHtml(mkPlan());
    expect(html).toContain('Верх · тяж');
    expect(html).not.toContain('upper_power');
    expect(html).toContain('Обоснование');
    expect(html).not.toContain('Rationale');
    expect(html).not.toContain('same-day');
    expect(html).not.toContain('✓подтверждено');
    expect(html).toContain('ударник');
  });

  it('CSV/XLS/ICS: теги и фазы по-русски', () => {
    const plan = mkPlan();
    const csv = buildCombatCsv(plan);
    expect(csv).not.toContain('upper_power');
    const ics = buildCombatPlanIcs(plan, null);
    expect(ics).not.toContain('upper_power');
    const xls = buildCombatXlsxHtml(plan);
    expect(xls).not.toContain('upper_power');
    expect(xls).not.toContain('weighInType');
    const buf = buildCombatXlsxBuffer(plan);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('год: фазы/статусы по-русски', () => {
    const ann = buildAnnualATR('mma', 12, null, { cycles: 1 } as any);
    const html = buildAnnualPrintHtml(ann);
    expect(html).toContain('Накопление');
    expect(html).not.toContain('accumulation');
    expect(html).toContain('запланирован');
    const ics = buildAnnualIcs(ann, null);
    expect(ics).toContain('Накопление');
  });

  it('новичок + combat_4 → откат на доступный сплит с пометкой', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'beginner',
      weeks: 4, daysPerWeek: 4, patternId: 'combat_4',
    } as any));
    expect(plan.patternId).toBe('combat_3');
    expect(plan.weeksData.every(w => w.sessions.length <= 3)).toBe(true);
    expect(plan.rationale.join(' ')).toContain('не для уровня');
  });
});

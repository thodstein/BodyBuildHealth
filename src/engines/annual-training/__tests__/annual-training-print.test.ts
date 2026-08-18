/**
 * annual-training-print.test.ts — HTML-сводка годового плана (печать).
 * Покрывает: содержимое (блоки/статусы/фазы/настройки), XSS-экранирование,
 * предупреждения валидации, превью сессий собранных блоков.
 */
import { describe, it, expect } from 'vitest';
import { buildAnnualPrintHtml } from '../annual-training-print';
import { annualPlanFromMacro, buildAnnualBlock } from '../block-builders.engine';
import type { Macrocycle } from '../../lms/macrocycle.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';

const CYCLE_ID = LMS_CYCLES[0]?.meta.id ?? 'cycle-01';

function makeMacro(overrides: Partial<Macrocycle> = {}): Macrocycle {
  return {
    blocks: [
      { phase: 'endurance', weeks: 6, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'Выносливость' },
      { phase: 'strength', weeks: 6, weekOffset: 7, kind: 'BB', description: 'Силовой BB' },
      { phase: 'peak', weeks: 2, weekOffset: 13, kind: 'SRC', cycleId: CYCLE_ID, description: 'Пик' },
    ],
    totalWeeks: 15,
    rationale: [],
    ...overrides,
  };
}

describe('buildAnnualPrintHtml', () => {
  it('содержит блоки года: недели, фазы, конструкторы, статусы', () => {
    const plan = annualPlanFromMacro(makeMacro());
    const html = buildAnnualPrintHtml(plan, 'Мой год');
    expect(html).toContain('Мой год');
    expect(html).toContain('15 нед');
    expect(html).toContain('1–6');
    expect(html).toContain('7–12');
    expect(html).toContain('Выносливость');
    expect(html).toContain('ПЛ (СРЦ-цикл)');
    expect(html).toContain('ББ (ББ-авто)');
    expect(html).toContain('не собран');
  });

  it('показывает настройки блока: цикл, сплит, taper, пик-неделя', () => {
    const plan = annualPlanFromMacro(makeMacro());
    const withCfg = { ...plan, blocks: plan.blocks.map((b, i) => i === 0
      ? { ...b, config: { ...b.config, taper: { enabled: true, weeks: 2 } } }
      : i === 1 ? { ...b, config: { ...b.config, splitPattern: 'ppl_6', peakWeek: true } } : b) };
    const html = buildAnnualPrintHtml(withCfg);
    expect(html).toContain('📉 taper 2 нед');
    expect(html).toContain('сплит ppl_6');
    expect(html).toContain('🎭 пик-неделя');
    expect(html).toContain('цикл «');
  });

  it('собранные блоки: превью сессий недели 1 + бейдж taper/пик', () => {
    const macro = makeMacro();
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[1], plan, macro, { daysPerWeek: 4, level: 'intermediate' });
    const html = buildAnnualPrintHtml({ ...plan, blocks: [built, ...plan.blocks.slice(1)] });
    expect(html).toContain('превью сессий');
    expect(html).toContain('собран');
  });

  it('XSS-экранирование пользовательских строк (description/error)', () => {
    const plan = annualPlanFromMacro(makeMacro());
    const evil = '<script>alert(1)</script>';
    const html = buildAnnualPrintHtml({
      ...plan,
      blocks: [
        { ...plan.blocks[0], ref: { ...plan.blocks[0].ref, description: evil }, status: 'error', error: evil },
        ...plan.blocks.slice(1),
      ],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('валидационные предупреждения разметки попадают в вывод', () => {
    const macro: Macrocycle = {
      blocks: [
        { phase: 'endurance', weeks: 4, weekOffset: 1, kind: 'SRC', cycleId: CYCLE_ID, description: 'A' },
        { phase: 'strength', weeks: 4, weekOffset: 7, kind: 'SRC', cycleId: CYCLE_ID, description: 'B' },
      ],
      totalWeeks: 10, rationale: [],
    };
    const html = buildAnnualPrintHtml(annualPlanFromMacro(macro));
    expect(html).toContain('пропуск нед 5–6');
    expect(html).toContain('Разметка года');
  });

  it('сводка статусов: собранные/устаревшие/ошибки', () => {
    const plan = annualPlanFromMacro(makeMacro());
    const mixed = { ...plan, blocks: [
      { ...plan.blocks[0], status: 'built' as const },
      { ...plan.blocks[1], status: 'stale' as const },
      { ...plan.blocks[2], status: 'error' as const, error: 'boom' },
    ] };
    const html = buildAnnualPrintHtml(mixed);
    expect(html).toContain('✅ собранных: 1');
    expect(html).toContain('устарело: 1');
    expect(html).toContain('ошибок: 1');
    expect(html).toContain('boom');
  });

  it('cardioText (Этап 4): кардио-сводка в печати + XSS-экранирование', () => {
    const plan = annualPlanFromMacro(makeMacro());
    const html = buildAnnualPrintHtml(plan, 'Мой год', ['Нед 1–6 [Выносливость]: maintenance, 120 мин/нед.', '<b>не должен стать HTML</b>']);
    expect(html).toContain('❤️ Кардио по блокам года');
    expect(html).toContain('Нед 1–6 [Выносливость]: maintenance, 120 мин/нед.');
    expect(html).not.toContain('<b>не должен стать HTML</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

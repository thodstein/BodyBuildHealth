/**
 * lms-taper-print.test.ts — C4: печать тапер-плана (buildPLTaperPrintHtml).
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks, type LMSBuildOutput } from '../lms-builder.engine';
import { buildPLTaperPrintHtml } from '../lms-taper-coach.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildBase(weeks = 8): LMSBuildOutput {
  return buildLMSPlan({ template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: weeks, faithful: true } as never);
}

describe('buildPLTaperPrintHtml', () => {
  it('выводит таблицу недель блока с типами (тапер/mock/соревнования)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { windowWeeks: 6, mockMeet: true, meetWeek: true });
    const html = buildPLTaperPrintHtml(next);
    expect(html).toContain('<table>');
    expect(html).toContain('🏁 Соревнования');
    expect(html).toContain('🎯 Mock meet');
    expect(html).toContain('📉 Тапер');
    expect(html).toContain('Тапер-план (пик-блок ПЛ)');
  });

  it('без тапера — сообщение о пустом блоке', () => {
    const plan = buildBase(6);
    const html = buildPLTaperPrintHtml(plan);
    expect(html).toContain('Тапер-блок не сгенерирован');
  });

  it('XSS-экранирование: пользовательские имена/заметки не исполняются', () => {
    const plan = buildBase(6);
    // Испортим название цикла инъекцией (несколько заметок внедряем через taperNote).
    const injected = {
      ...plan,
      template: { ...plan.template, meta: { ...plan.template.meta, title: '<script>alert(1)</script>' } },
    };
    const next = appendPLTaperWeeks(injected, 2, { mockMeet: true, meetWeek: true });
    // taperNote из лифтов прикидов — добавляем инъекцию в заметку mock недели.
    const withInj = {
      ...next,
      weeks: next.weeks.map(w => w.mockMeet ? { ...w, taperNote: 'Прикиды <img src=x onerror=alert(1)>' } : w),
    };
    const html = buildPLTaperPrintHtml(withInj);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('даты недель попадают в таблицу', () => {
    const plan = buildBase(6);
    const ref = '2026-12-05';
    const next = appendPLTaperWeeks(plan, 2, { windowWeeks: 6, meetWeek: true, reference: ref });
    const html = buildPLTaperPrintHtml(next);
    expect(html).toContain('2026-12-05');
  });
});

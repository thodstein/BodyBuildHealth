/**
 * arm-print-modern.test.ts — современная выдача печати (план + диагностика).
 * Контентные контракты старых тестов не дублируем — только новая подача
 * поверх тех же строк ( witnesses: week/t/pro/chips + старые маркеры целы).
 */
import { describe, it, expect } from 'vitest';
import { buildArmPrintHtml } from '../arm-export.engine';
import { buildArmDiagnosticsHtml } from '../arm-diagnostics-export.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';

function demoPlan(): any {
  const p: any = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_4_upper_lower', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 4 });
  return finalizeArmPlan(p, { level: 'intermediate' });
}

describe('arm-print-modern', () => {
  it('план: секции недель, таблицы, гантт, футер', () => {
    const html = buildArmPrintHtml(demoPlan());
    for (const marker of ['class="week"', 'class="t"', '<thead>', 'class="gantt"', 'class="chips"', 'class="foot"', 'lang="ru"']) {
      expect(html, marker).toContain(marker);
    }
    // старые контракты целы
    for (const marker of ['Неделя 1', 'Арм-план', 'PRO:', 'display:flex', '22c55e', 'f59e0b']) {
      expect(html, marker).toContain(marker);
    }
  });
  it('печать R3: итоги недель/сессий, thead-repeat, @page, веса', () => {
    const html = buildArmPrintHtml(demoPlan());
    expect(html).toContain('class="wtot"');
    expect(html).toMatch(/\d+ сетов · \d+ сесс\./);
    expect(html).toMatch(/День 1 — .*<span class="wtot">\d+ сетов<\/span>/);
    expect(html).toContain('table.t thead{display:table-header-group}');
    expect(html).toContain('@page{margin:12mm}');
  });
  it('диагностика: hero, таблица с thead, секции', () => {
    const h = buildArmDiagnosticsHtml({
      date: '2026-09-05', level: 'intermediate', technique: 'hook',
      points: [{ weakPoint: 'side_pin', label: 'Side pin', angleRangeDeg: [0, 20], keyJoint: 'плечо', cause: 'volume', causeFix: 'фикс', topCorrections: [{ id: 'x', score: 1 }] }],
    } as any);
    for (const marker of ['class="hero"', '<thead>', 'Мёртвые точки (1)', 'Side pin', 'lang="ru"']) {
      expect(h, marker).toContain(marker);
    }
  });
});

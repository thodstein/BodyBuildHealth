import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { tableIqTrend } from '../arm-table-iq.engine';
import { buildArmDiagnosticsHtml, buildArmDiagnosticsCsv } from '../arm-diagnostics-export.engine';
import { ArmDiagnosticsHub } from '../../../ui/screens/TrainingScreen_parts/ArmDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
});

describe('arm TOP wave-10 trend', () => {
  it('мало данных — null-тренд', () => {
    const t = tableIqTrend([{ fouls: 1 }, { fouls: 0 }]);
    expect(t.trend).toBeNull();
    expect(t.note).toMatch(/≥4/);
  });
  it('чище — up', () => {
    const t = tableIqTrend([
      { fouls: 2, slip: true, dateIso: '2026-08-01' },
      { fouls: 2, slip: true, dateIso: '2026-08-08' },
      { fouls: 0, dateIso: '2026-08-15' },
      { fouls: 0, dateIso: '2026-08-22' },
    ]);
    expect(t.trend).toBe('up');
    expect(t.foulDelta).toBeLessThan(0);
  });
  it('грязнее — down', () => {
    const t = tableIqTrend([
      { fouls: 0, dateIso: '2026-08-01' },
      { fouls: 0, dateIso: '2026-08-08' },
      { fouls: 2, slip: true, dateIso: '2026-08-15' },
      { fouls: 1, dateIso: '2026-08-22' },
    ]);
    expect(t.trend).toBe('down');
  });
  it('стабильно — flat', () => {
    const t = tableIqTrend([
      { fouls: 1, dateIso: '2026-08-01' },
      { fouls: 1, dateIso: '2026-08-08' },
      { fouls: 1, dateIso: '2026-08-15' },
      { fouls: 1, dateIso: '2026-08-22' },
    ]);
    expect(t.trend).toBe('flat');
  });
});

describe('arm TOP wave-10 export', () => {
  const data: any = {
    date: '2026-09-05', level: 'intermediate', technique: 'hook', points: [],
    matchup: { note: 'Матчап hook vs toproll', priority: ['pronators'], gameplan: ['Держать rise'] },
    tableIq: { note: 'Table-IQ 4 схваток', levers: ['Фолы'], trend: 'Тренд ▲ чище' },
    rehab: { note: 'ucl: фаза 2', phase: 2, title: 'Light pron/sup' },
  };
  it('HTML: TOP-секции', () => {
    const h = buildArmDiagnosticsHtml(data);
    expect(h).toContain('Матчап');
    expect(h).toContain('Table-IQ');
    expect(h).toContain('Return-to-pull');
    expect(h).toContain('Тренд');
  });
  it('HTML: XSS в TOP-секциях', () => {
    const h = buildArmDiagnosticsHtml({ ...data, matchup: { note: '<script>alert(1)</script>' } });
    expect(h).not.toContain('<script>alert(1)</script>');
  });
  it('CSV: TOP-строки', () => {
    const s = buildArmDiagnosticsCsv(data);
    expect(s).toContain('matchup;');
    expect(s).toContain('tableiq;');
    expect(s).toContain('rehab;');
  });
  it('без TOP — как раньше', () => {
    const h = buildArmDiagnosticsHtml({ date: '2026-09-05', level: 'intermediate', technique: 'hook', points: [] });
    expect(h).not.toContain('Матчап');
    const s = buildArmDiagnosticsCsv({ date: '2026-09-05', level: 'intermediate', technique: 'hook', points: [] });
    expect(s).not.toContain('matchup;');
  });
});

describe('arm TOP wave-10 hub', () => {
  it('тренд из seed-журнала', () => {
    localStorage.setItem('he_arm_table_iq', JSON.stringify([
      { fouls: 2, slip: true, dateIso: '2026-08-01' },
      { fouls: 2, slip: true, dateIso: '2026-08-08' },
      { fouls: 0, dateIso: '2026-08-15' },
      { fouls: 0, dateIso: '2026-08-22' },
    ]));
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('Тренд');
  });
});

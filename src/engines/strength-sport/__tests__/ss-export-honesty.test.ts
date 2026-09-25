/**
 * ss-export-honesty.test.ts — честность экспортов ТА/стронг-диагностики.
 *
 * Два дефекта ревизии:
 *  1) escCsv только удваивал кавычки → значение вида «=cmd|'/c calc'!A1» Excel
 *     исполнил как формулу (формульная инъекция). Теперь префикс `'`.
 *  2) отчёт печатал дату через toISOString() (UTC) → в UTC+ вечером в шапке
 *     стояло «вчера». Теперь локальная дата (канон localIsoDate).
 */
import { describe, it, expect } from 'vitest';
import { buildWLCsv, buildWLDiagnosticsHtml } from '../strength-sport-wl-export.engine';
import { buildSMCsv, buildSMDiagnosticsHtml } from '../strength-sport-sm-export.engine';
import { pushCheckin } from '../strength-sport-planner-pro.engine';
import { localIsoDate } from '../../workout-logger.engine';

const WL: any = { weakPoints: ['snatch_mid'], score: 88, level: 'ok', verification: 0.3, findings: ['ok'] };
const SM: any = { weakPoints: ['yoke_turn'], score: 80, level: 'ok', verification: 0.3, findings: ['ok'] };

describe('экспорт: CSV-формулы не исполняются', () => {
  // Вектор — пользовательский текст в строках findings/causes/corrections.
  it('ТА: значение, начинающееся с =, экранируется префиксом', () => {
    const csv = buildWLCsv({ ...WL, findings: ["=cmd|'/c calc'!A1"] });
    expect(csv).toContain(`"'=cmd`);
    expect(csv).not.toMatch(/,"=cmd/);
  });

  it('стронг: те же знаки (+ - @) экранируются', () => {
    for (const evil of ['=1+1', '+cmd', '-2+3', '@SUM(A1)']) {
      const csv = buildSMCsv({ ...SM, findings: [evil] });
      expect(csv, `не экранировано: ${evil}`).toContain(`"'${evil}`);
    }
  });

  it('обычные значения не получают префикс (байт-в-байт для нормальных данных)', () => {
    const csv = buildWLCsv({ ...WL, findings: ['yoke_walk 3×20 м — ok'] });
    expect(csv).toContain('"yoke_walk 3×20 м — ok"');
    expect(csv).not.toContain(`"'yoke_walk`);
  });

  it('кавычки по-прежнему удваиваются', () => {
    const csv = buildSMCsv({ ...SM, findings: ['say "hi"'] });
    expect(csv).toContain('"say ""hi"""');
  });
});

describe('экспорт: дата отчёта — локальная, не UTC', () => {
  it('ТА-отчёт печатает локальную дату', () => {
    expect(buildWLDiagnosticsHtml(WL)).toContain(localIsoDate());
  });

  it('стронг-отчёт печатает локальную дату', () => {
    expect(buildSMDiagnosticsHtml(SM)).toContain(localIsoDate());
  });

  it('чек-ин пишет локальную дату (раньше toISOSlice → «вчера» в UTC+)', () => {
    const out = pushCheckin([], { rpe: 8, sleep: 7, soreness: 3, note: 'ok' } as any);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe(localIsoDate());
  });

  it('явно переданная дата не перебивается', () => {
    const out = pushCheckin([], { rpe: 8 } as any, '2026-01-02');
    expect(out[0].date).toBe('2026-01-02');
  });
});

import { describe, it, expect } from 'vitest';
import { buildArmliftingReport, cocLevelToPct } from '../armlifting-diagnostics.engine';
import { buildArmliftingHtml, buildArmliftingCsv } from '../armlifting-diagnostics.engine';

/** PRO-3 W-AL: отдельный хаб армлифтинга — движок. */
describe('W-AL движок: вердикт по снарядам', () => {
  it('пусто — хинт, filled 0', () => {
    const r = buildArmliftingReport({});
    expect(r.filled).toBe(0);
    expect(r.weakest).toBeNull();
    expect(r.avgPct).toBeNull();
    expect(r.verdict).toContain('Введи замеры');
  });
  it('RT 65.25 муж → 50% WR', () => {
    const r = buildArmliftingReport({ rtKg: 65.25, sex: 'male' });
    const rt = r.rows.find((x) => x.implement === 'rolling_thunder')!;
    expect(rt.scorePct).toBe(50);
    expect(rt.internal).toBe(false);
    expect(rt.attempts.length).toBe(3);
  });
  it('RT жен — женский WR 77.2', () => {
    const r = buildArmliftingReport({ rtKg: 38.6, sex: 'female' });
    expect(r.rows[0].scorePct).toBe(50);
  });
  it('Axle saxon vs apollon — разные снаряды, WR оба 133 (честная оценка движка)', () => {
    const s = buildArmliftingReport({ axleKg: 100, axleImpl: 'saxon', sex: 'male' });
    const a = buildArmliftingReport({ axleKg: 100, axleImpl: 'apollon', sex: 'male' });
    expect(s.rows[0].implement).toBe('saxon_bar');
    expect(s.rows[0].internal).toBe(true);
    expect(a.rows[0].implement).toBe('apollon_axle');
    expect(a.rows[0].internal).toBe(false);
    expect(s.rows[0].scorePct).toBe(a.rows[0].scorePct);
  });
  it('weakest — минимальный %; avg — среднее; verdict называет снаряд', () => {
    const r = buildArmliftingReport({ rtKg: 117.45, axleKg: 66.5, axleImpl: 'saxon', sex: 'male' });
    // RT 90%, Saxon 50% → weakest saxon
    expect(r.weakest).toBe('saxon_bar');
    expect(r.avgPct).toBe(70);
    expect(r.verdict).toContain('Saxon Bar');
    expect(r.verdict).toContain('Многоборье');
  });
  it('Excalibur — факт без %, но в тотале и с попытками', () => {
    const r = buildArmliftingReport({ excalKg: 40, sex: 'male' });
    const ex = r.rows.find((x) => x.implement === 'excalibur')!;
    expect(ex.scorePct).toBeNull();
    expect(ex.level).toBe('none');
    expect(ex.attempts.length).toBe(3);
    expect(r.totalKg).toBe(40);
    expect(r.verdict).toContain('Excalibur');
  });
  it('CoC ordinal: №2 → 70, №3 → 100', () => {
    expect(cocLevelToPct(2)).toBe(70);
    expect(cocLevelToPct(3)).toBe(100);
    const r = buildArmliftingReport({ cocLevel: 2, sex: 'male' });
    expect(r.rows[0].internal).toBe(true);
    expect(r.rows[0].scorePct).toBe(70);
  });
  it('Pinch 15 с → 100 (внутренний ориентир)', () => {
    const r = buildArmliftingReport({ pinchSec: 15, sex: 'male' });
    expect(r.rows[0].scorePct).toBe(100);
    expect(r.rows[0].internal).toBe(true);
  });
  it('W5c: экспорт HTML/CSV содержит вердикт и снаряды', () => {
    const report = buildArmliftingReport({ rtKg: 65.25, excalKg: 40, sex: 'male' });
    const data = { date: '2026-09-11', sex: 'М', report };
    const html = buildArmliftingHtml(data);
    expect(html).toContain('Армлифтинг-диагностика');
    expect(html).toContain('Rolling Thunder');
    expect(html).toContain('50%');
    expect(html).toContain('Excalibur');
    const csv = buildArmliftingCsv(data);
    expect(csv.charCodeAt(0)).toBe(65279);
    expect(csv).toContain('rolling_thunder');
    expect(csv).toContain('verdict;');
  });
  it('W5c: XSS в вердикте экранируется', () => {
    const report = buildArmliftingReport({ rtKg: 60, sex: 'male' });
    const html = buildArmliftingHtml({ date: '<script>', sex: 'М', report });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

/**
 * lab-exercise-export.test.ts — Epic F: экспорт HTML/CSV (XSS + антиформула).
 */
import { describe, it, expect } from 'vitest';
import { buildLabExportHtml, buildLabExportCsv, collectLabExportDiagnoses } from '../lab-exercise-export.engine';

const audit = {
  audit: { avgSfr: 3.8, lengthenedRatio: 0.4 },
  labScore: 72,
  safetyFlags: [],
  totalExercises: 3,
  totalSets: 9,
} as never;

describe('lab-exercise-export', () => {
  it('HTML экранирует пользовательские строки (XSS)', () => {
    const html = buildLabExportHtml(audit, [
      { name: '<script>alert(1)</script>', score: 50, flags: ['x'], issues: ['<b>bold</b>'] },
    ]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Lab 72/100');
  });

  it('collect: дедуп по id, худший скор, сортировка', () => {
    const plan = {
      weeks: [
        { sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'bench', muscle: 'chest', sets: 3 }] }] },
        { sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'bench', muscle: 'chest', sets: 3 }] }] },
      ],
    };
    const list = collectLabExportDiagnoses(plan, { goal: 'hypertrophy' });
    expect(list).toHaveLength(1);
    expect(list[0].score).toBeLessThan(100);
    expect(list[0].flags.length).toBeGreaterThan(0);
  });

  it('CSV: BOM + антиформула для =+-@', () => {
    const csv = buildLabExportCsv([
      { name: '=cmd|calc', score: 10, flags: [], issues: [] },
      { name: 'Жим', score: 90, flags: ['lowSFRHighFatigue'], issues: ['a'] },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(`"'=cmd|calc"`);
    expect(csv).toContain('Жим');
  });
});

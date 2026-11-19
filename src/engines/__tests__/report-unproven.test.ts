/**
 * report-unproven.test.ts — проход 154: отчёт для врача называет записи без
 * вердикта, а не печатает серое «—».
 *
 * Было: `assignStatus` не ставил статус ни обрезанному числу, чью сторону
 * граница не доказывает («СРБ <0.5» при норме 0–5), ни маркеру без нормы, а
 * HTML печатал в колонке статуса «—». В отчёте это читалось как «смотреть
 * нечего», хотя запись говорит «меньше 0.5» — то есть решение не принято.
 * Плюс маркер с односторонней нормой (у общего холестерина есть только верх)
 * не получал вердикта вовсе: точное 4.5 при верхней 5.2 печаталось «—».
 *
 * Стало: `ReportMetric.unproven` (`'bound' | 'no_norm'`), бейдж «БЕЗ ВЫВОДА» и
 * счётчик под таблицей с причиной; односторонняя норма даёт «НОРМА»/«ВНИМАНИЕ».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('../../core/profile-manager', () => ({
  getProfile: vi.fn(() => ({
    settings: {
      personal: { age: 30, sex: 'male', weight: 85, height: 180, bodyFat: 15 },
      pharma: { courseStartDate: '2026-05-15', trainingCycleWeeks: 16, phase: 'course', trainingCycleType: 'mass', currentSubstances: [] },
      goals: { primaryGoal: 'mass' },
      nutrition: { proteinPerKg: 2, mealsPerDay: 5, manualTargets: { kcal: 2800, protein: 180, fat: 80, carbs: 320 } },
      lifestyle: { sleepHours: 7, stressLevel: 5, morningHRV: 65, restingHR: 60, dailySteps: 8000 },
    },
    name: 'Тестовый пользователь',
  })),
}));

vi.mock('../../engines/profile-store', () => ({
  getWeightLog: vi.fn(() => []),
  getMeasurementsLog: vi.fn(() => []),
}));

const HISTORY: Record<string, Array<{ date: string; value: number; bound?: '<' | '>'; unit: string }>> = {
  'СРБ': [
    { date: '2026-08-01', value: 0.5, bound: '<', unit: 'mg/L' },
  ],
  'Холестерин общий': [
    { date: '2026-08-01', value: 4.5, unit: 'mmol/L' },
  ],
  'АЛТ': [
    { date: '2026-08-01', value: 30, unit: 'U/L' },
  ],
};

vi.mock('../../engines/lab-diary.engine', () => ({
  getLabDiary: vi.fn(() => []),
  getMarkerHistory: vi.fn((_diary: unknown, code: string) => HISTORY[code] ?? []),
  getLabDiaryStats: vi.fn(() => ({ totalDays: 0, totalMarkers: 0, markerCodes: [], lastDate: '', firstDate: '' })),
}));

vi.mock('../../engines/body-composition.engine', () => ({ loadEntries: vi.fn(() => []) }));
vi.mock('../../engines/strength-diary.engine', () => ({ strengthDiary: { getWorkoutLogs: vi.fn(() => []) } }));
vi.mock('../../engines/workout-logger.engine', () => ({ loadSessions: vi.fn(() => []) }));
vi.mock('../../engines/symptom-diary.engine', () => ({
  getSymptomDiary: vi.fn(() => []),
  getSymptomDiaryStats: vi.fn(() => ({ activeSymptoms: 0, improving: 0, worsening: 0, resolved: 0 })),
}));
vi.mock('../../engines/profile-settings.engine', () => ({ loadMetrics: vi.fn(() => []) }));
vi.mock('../../core/bp-hr-data', () => ({ getBpEntries: vi.fn(() => []) }));
vi.mock('../../engines/score-history', () => ({ getScoreHistory: vi.fn(() => []) }));

import { generateComprehensiveReport, assignStatus } from '../comprehensive-report.engine';
import { generateComprehensiveReportHTML } from '../comprehensive-report-html';

const RANGE = { type: 'weekly' as const, dateFrom: '2026-07-26', dateTo: '2026-08-02' };

beforeEach(() => {
  localStorage.removeItem('he_risk_bridge');
  localStorage.removeItem('he_support_plan_result');
});

const labsMetric = async (label: string) => {
  const report = await generateComprehensiveReport(RANGE);
  const section = report.sections.find(s => s.id === 'labs')!;
  return section.metrics.find(m => m.label === label)!;
};

describe('проход 154: запись без вердикта называет себя', () => {
  it('«СРБ <0.5» при норме 0–5 — unproven «bound», статуса нет', async () => {
    const crp = await labsMetric('СРБ');
    expect(crp.bound).toBe('<');
    expect(crp.status).toBeUndefined();
    expect(crp.unproven).toBe('bound');
  });

  it('точное число в норме — статус есть, unproven нет', async () => {
    const alt = await labsMetric('АЛТ');
    expect(alt.status).toBe('normal');
    expect(alt.unproven).toBeUndefined();
  });

  it('односторонняя норма (холестерин: только верх) даёт «норму», а не «—»', async () => {
    const chol = await labsMetric('Холестерин общий');
    expect(chol.refLow).toBeUndefined();
    expect(chol.refHigh).toBe(5.2);
    expect(chol.status).toBe('normal');
    expect(chol.unproven).toBeUndefined();
  });

  it('нормы нет вовсе — «no_norm»', () => {
    const m: any = { label: 'X', unit: '', current: 5 };
    assignStatus(m);
    expect(m.status).toBeUndefined();
    expect(m.unproven).toBe('no_norm');
  });

  it('нет текущего значения — «—» без unproven (записи нет)', () => {
    const m: any = { label: 'X', unit: '', current: null, refLow: 1, refHigh: 2 };
    assignStatus(m);
    expect(m.status).toBe('info');
    expect(m.unproven).toBeUndefined();
  });
});

describe('проход 154: HTML-отчёт объясняет статус', () => {
  const row = (html: string, label: string) => html.split('<tr>').find(r => r.includes(label)) ?? '';

  it('«СРБ <0.5» — бейдж «БЕЗ ВЫВОДА», а не «—» в статусе', async () => {
    const html = generateComprehensiveReportHTML(await generateComprehensiveReport(RANGE));
    const crp = row(html, 'СРБ');
    expect(crp).toContain('БЕЗ ВЫВОДА');
    expect(crp).toContain('&lt;0.5');
  });

  it('под таблицей — счётчик без вывода с причиной', async () => {
    const html = generateComprehensiveReportHTML(await generateComprehensiveReport(RANGE));
    expect(html).toContain('data-lab-unproven="1"');
    expect(html).toContain('граница бланка не доказывает сторону');
  });

  it('точные числа остаются с вердиктами, счётчик их не считает', async () => {
    const html = generateComprehensiveReportHTML(await generateComprehensiveReport(RANGE));
    expect(row(html, 'АЛТ')).toContain('НОРМА');
    expect(row(html, 'Холестерин общий')).toContain('НОРМА');
    // Ровно одна запись без вывода, а не три.
    expect(html.split('data-lab-unproven="1"').length - 1).toBe(1);
  });
});

describe('проход 154: копия, CSV и архив называют вердикт', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');

  it('вердикт берётся из единственного модуля отклонений, а не своей копией', () => {
    expect(src).toContain('computeMarkerDeviations((labs || [])');
    expect(src).toContain('for (const u of summary.unknown)');
    expect(src).not.toContain('const unknownCount = labRisks?.unknownCount');
  });

  it('CSV печатает колонку verdict, копия — вердикт строкой', () => {
    expect(src).toContain('code;name;value;unit;date;verdict\\n');
    expect(src).toContain('${verdict ? ` — ${verdict}` : \'\'}');
  });

  it('архив хранит знак границы и вердикт записи', () => {
    expect(src).toContain('bound: l.bound, verdict: labVerdict(l.code)');
    expect(src).toContain('r.unprovenCount');
  });
});

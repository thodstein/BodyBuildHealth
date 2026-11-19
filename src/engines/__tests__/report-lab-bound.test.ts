/**
 * report-lab-bound.test.ts — проход 143: знак границы доезжает до отчёта.
 *
 * Отчёт получал из дневника только число: «Тромбоциты >1000» печатались как
 * 1000, и разность с прошлым считалась по обрезанным числам («упало на 200»
 * вместо «упало на 200 или меньше»). Статус тоже сравнивал обрезанное число с
 * нормой напрямую, поэтому «СРБ <0.5» при норме 0–5 получал «в норме» —
 * хотя запись говорит лишь «меньше 0.5».
 *
 * Теперь `ReportMetric` хранит `bound`/`prevBound`, статус берёт сторону из
 * `boundProvesSide`, разность при границе не считается, а HTML печатает знак
 * сущностью.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// История маркеров: по каждому коду — свои точки. Границу несёт только та
// запись, где она была в бланке.
const HISTORY: Record<string, Array<{ date: string; value: number; bound?: '<' | '>'; unit: string }>> = {
  'Тромбоциты': [
    { date: '2026-07-20', value: 800, bound: '>', unit: '10⁹/L' },
    { date: '2026-08-01', value: 1000, bound: '>', unit: '10⁹/L' },
  ],
  'СРБ': [
    { date: '2026-08-01', value: 0.5, bound: '<', unit: 'mg/L' },
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

import { generateComprehensiveReport } from '../comprehensive-report.engine';
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

describe('проход 143: отчёт читает знак границы', () => {
  it('«>1000» при норме 150–400 — доказанное высокое, критично', async () => {
    const plt = await labsMetric('Тромбоциты');
    expect(plt.current).toBe(1000);
    expect(plt.bound).toBe('>');
    expect(plt.status).toBe('critical');
  });

  it('«<0.5» при норме 0–5 не получает «в норме»', async () => {
    const crp = await labsMetric('СРБ');
    expect(crp.bound).toBe('<');
    expect(crp.status).toBeUndefined();
  });

  it('число без границы считается как раньше', async () => {
    const alt = await labsMetric('АЛТ');
    expect(alt.bound).toBeUndefined();
    expect(alt.status).toBe('normal');
  });

  it('разность обрезанных чисел не выдумывается', async () => {
    const plt = await labsMetric('Тромбоциты');
    // «>800 → >1000» — это не «+200»: истинные значения неизвестны.
    expect(plt.prevBound).toBe('>');
    expect(plt.delta).toBeNull();
    expect(plt.deltaPct).toBeNull();
    expect(plt.trend).toBe('no_data');
  });
});

describe('проход 143: HTML-отчёт печатает знак', () => {
  const row = (html: string, label: string) => html.split('<tr>').find(r => r.includes(label)) ?? '';

  it('«>1000» едет сущностью, голого 1000 нет', async () => {
    const html = generateComprehensiveReportHTML(await generateComprehensiveReport(RANGE));
    const plt = row(html, 'Тромбоциты');
    expect(plt).toContain('&gt;1000');
    expect(plt).not.toContain('>1000');
    // Разность не показана — вместо пустой ячейки стоит «—».
    expect(plt).toContain('—');
  });

  it('«<0.5» не обрывает ячейку тегом', async () => {
    const html = generateComprehensiveReportHTML(await generateComprehensiveReport(RANGE));
    const crp = row(html, 'СРБ');
    expect(crp).toContain('&lt;0.5');
    expect(crp).not.toContain('<0.5');
  });
});

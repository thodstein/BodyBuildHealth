import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeDelta, assignStatus, generateComprehensiveReport } from '../comprehensive-report.engine';
import { getBpEntries } from '../../core/bp-hr-data';
import { getProfile } from '../../core/profile-manager';

// Мокаем все хранилища
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
  getWeightLog: vi.fn(() => [{ date: '2026-08-01', weight: 86 }, { date: '2026-08-07', weight: 85.2 }]),
  getMeasurementsLog: vi.fn(() => []),
}));

vi.mock('../../engines/lab-diary.engine', () => ({
  getLabDiary: vi.fn(() => []),
  getMarkerHistory: vi.fn(() => []),
}));

vi.mock('../../engines/body-composition.engine', () => ({
  loadEntries: vi.fn(() => [
    { date: '2026-08-01', weightKg: 86, bodyFatPercent: 15 },
    { date: '2026-08-07', weightKg: 85.2, bodyFatPercent: 14.2 },
  ]),
}));

vi.mock('../../engines/strength-diary.engine', () => ({
  strengthDiary: {
    getWorkoutLogs: vi.fn(() => []),
  },
}));

vi.mock('../../engines/workout-logger.engine', () => ({
  loadSessions: vi.fn(() => []),
}));

vi.mock('../../engines/symptom-diary.engine', () => ({
  getSymptomDiary: vi.fn(() => []),
  getSymptomDiaryStats: vi.fn(() => ({ activeSymptoms: 0, improving: 0, worsening: 0, resolved: 0 })),
}));

vi.mock('../../engines/profile-settings.engine', () => ({
  loadMetrics: vi.fn(() => []),
}));

vi.mock('../../core/bp-hr-data', () => ({
  getBpEntries: vi.fn(() => []),
}));

vi.mock('../../engines/score-history', () => ({
  getScoreHistory: vi.fn(() => []),
}));

describe('computeDelta', () => {
  it('returns up for increase', () => {
    const r = computeDelta(100, 110);
    expect(r.delta).toBe(10);
    expect(r.deltaPct).toBe(10);
    expect(r.trend).toBe('up');
  });

  it('returns down for decrease', () => {
    const r = computeDelta(100, 90);
    expect(r.delta).toBe(-10);
    expect(r.deltaPct).toBe(-10);
    expect(r.trend).toBe('down');
  });

  it('returns stable for small change', () => {
    const r = computeDelta(100, 100.5);
    expect(r.delta).toBe(0.5);
    expect(r.deltaPct).toBe(0.5);
    expect(r.trend).toBe('stable');
  });

  it('returns no_data when prev is null', () => {
    const r = computeDelta(null, 100);
    expect(r.trend).toBe('no_data');
  });
});

describe('assignStatus', () => {
  it('assigns normal when within range', () => {
    const m: any = { current: 5, refLow: 4, refHigh: 6 };
    assignStatus(m);
    expect(m.status).toBe('normal');
  });

  it('assigns warning when just outside range', () => {
    const m: any = { current: 3.5, refLow: 4, refHigh: 6 };
    assignStatus(m);
    expect(m.status).toBe('warning');
  });

  it('assigns critical when far outside range', () => {
    const m: any = { current: 8, refLow: 4, refHigh: 6 };
    assignStatus(m);
    expect(m.status).toBe('critical');
  });
});

describe('generateComprehensiveReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates weekly report with 9 sections', async () => {
    const report = await generateComprehensiveReport({ type: 'weekly' });
    expect(report.meta.type).toBe('weekly');
    expect(report.sections.length).toBeGreaterThanOrEqual(9);
    expect(report.sections.find(s => s.id === 'anthropometry')).toBeDefined();
    expect(report.sections.find(s => s.id === 'labs')).toBeDefined();
    expect(report.sections.find(s => s.id === 'training')).toBeDefined();
    expect(report.sections.find(s => s.id === 'nutrition')).toBeDefined();
    expect(report.sections.find(s => s.id === 'recovery')).toBeDefined();
    expect(report.sections.find(s => s.id === 'blood_pressure')).toBeDefined();
    expect(report.sections.find(s => s.id === 'course')).toBeDefined();
    expect(report.sections.find(s => s.id === 'symptoms')).toBeDefined();
    expect(report.sections.find(s => s.id === 'risks')).toBeDefined();
  });

  it('generates monthly report with trends', async () => {
    const report = await generateComprehensiveReport({ type: 'monthly' });
    expect(report.meta.type).toBe('monthly');
    expect(report.trends).toBeDefined();
  });

  it('includes support section', async () => {
    const report = await generateComprehensiveReport({ type: 'weekly' });
    expect(report.support).toBeDefined();
    expect(report.support.course).toBeDefined();
    expect(report.support.schedule).toBeDefined();
    expect(report.support.monitoring).toBeDefined();
    expect(report.support.monitoring.length).toBeGreaterThan(0);
  });

  it('generates recommendations', async () => {
    const report = await generateComprehensiveReport({ type: 'weekly' });
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('has correct meta', async () => {
    const report = await generateComprehensiveReport({ type: 'weekly' });
    expect(report.meta.userName).toBe('Тестовый пользователь');
    expect(report.meta.age).toBe(30);
    expect(report.meta.sex).toBe('male');
    expect(report.meta.period).toBe('mass');
  });

  it('blood pressure: splits morning/evening by timeOfDay, not by pulse', async () => {
    (getBpEntries as any).mockReturnValue([
      // morning запись с высоким пульсом — раньше ошибочно уходила бы в «вечер»
      { date: '2026-08-01', systolic: 120, diastolic: 80, hr: 92, timeOfDay: 'morning' },
      { date: '2026-08-02', systolic: 140, diastolic: 90, hr: 60, timeOfDay: 'evening' },
    ]);
    const report = await generateComprehensiveReport({ type: 'weekly', dateFrom: '2026-07-26', dateTo: '2026-08-02' });
    const bp = report.sections.find(s => s.id === 'blood_pressure');
    expect(bp).toBeDefined();
    const labels = bp!.metrics.map(m => m.label);
    expect(labels).toContain('Утро: систолическое');
    expect(labels).toContain('Вечер: систолическое');
    expect(labels.some(l => l.includes('ЧСС<70'))).toBe(false);
    const morning = bp!.metrics.find(m => m.label === 'Утро: систолическое');
    const evening = bp!.metrics.find(m => m.label === 'Вечер: систолическое');
    expect(morning!.current).toBe(120);
    expect(evening!.current).toBe(140);
  });
});

// ────────────────────────────────────────────────────────────────
//  Единицы и имена в отчёте (аудит 2026-11)
//  Раньше план поддержки попадал в отчёт сырыми id ('selenium') без дозы,
//  а GH в курсе подписывался как «8 мг» вместо «8 МЕ».
// ────────────────────────────────────────────────────────────────
describe('support section: единицы и имена из плана', () => {
  const baseProfile = () => ({
    settings: {
      personal: { age: 30, sex: 'male', weight: 85, height: 180, bodyFat: 15 },
      pharma: {
        courseStartDate: '2026-05-15', trainingCycleWeeks: 16, phase: 'course',
        currentSubstances: [{ id: 'hgh', name: 'ГР', doseMg: 8, route: 'inject' }],
      },
      goals: { primaryGoal: 'mass' },
      nutrition: { proteinPerKg: 2, mealsPerDay: 5, currentSupplements: [{ id: 'selenium', name: 'Селен', doseMg: 200, doseUnit: 'mcg' }] },
      lifestyle: { sleepHours: 7, stressLevel: 5, morningHRV: 65, restingHR: 60, dailySteps: 8000 },
    },
    name: 'Тестовый пользователь',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (getProfile as any).mockReturnValue(baseProfile());
    localStorage.setItem('he_support_plan_result', JSON.stringify(['selenium', 'vitamin_d3']));
  });

  it('план из id: имя по-русски, ед. измерителя по веществу, без дублей', async () => {
    const report = await generateComprehensiveReport({ type: 'weekly' });
    const supps = report.support.supplements;
    const se = supps.find(s => s.id === 'selenium');
    const d3 = supps.find(s => s.id === 'vitamin_d3');
    expect(se).toBeDefined();
    expect(d3).toBeDefined();
    // Селен уже есть в профиле — не дублируется планом.
    expect(supps.filter(s => s.id === 'selenium')).toHaveLength(1);
    expect(se!.unit).toBe('мкг');
    expect(d3!.unit).toBe('МЕ');
    // Имя человека-читаемое, а не сырой id.
    expect(d3!.name).not.toBe('vitamin_d3');
    // Доза из дефолтов каталога, а не 0.
    expect(d3!.doseMg).toBeGreaterThan(0);
  });

  it('GH в курсе — «МЕ», а не «мг»', async () => {
    const report = await generateComprehensiveReport({ type: 'weekly' });
    const gh = report.support.course.substances.find(s => s.id === 'hgh');
    expect(gh).toBeDefined();
    expect(gh!.doseDisplay).toContain('МЕ');
    expect(gh!.doseDisplay).not.toContain('мг');
  });

  it('старая запись с doseUnit="g" (значение не пересчитано) не даёт «5000 г»', async () => {
    const p = baseProfile();
    (getProfile as any).mockReturnValue({
      ...p,
      settings: {
        ...p.settings,
        nutrition: { ...p.settings.nutrition, currentSupplements: [{ id: 'nac', name: 'NAC', doseMg: 5000, doseUnit: 'g' }] },
      },
    });
    const report = await generateComprehensiveReport({ type: 'weekly' });
    const nac = report.support.supplements.find(s => s.id === 'nac');
    expect(nac).toBeDefined();
    expect(nac!.unit).toBe('мг');
  });
});

/**
 * comprehensive-report-sex-refs.test.ts — проход 76: референсы и пороги
 * рекомендаций сводного отчёта зависят от пола.
 *
 * Было: `gatherLabs` держала собственную таблицу (АЛТ/АСТ 40, ГГТ 60,
 * креатинин 110, HGB 160, HCT 50, PRL 400) — четвёртая шкала рядом с
 * резолвером, карточками K0–K10 и панелями, и вся мужская. Женщина видела
 * «Референс: 0 – 40» у АЛТ (её ВГН 31), «120 – 160 г/л» у HGB (её 120–150),
 * «36 – 50 %» у HCT (её верх 48) и статус «норма» на реальном отклонении.
 *
 * Рекомендации были не лучше: HCT >54/>50, АЛТ >80/>40, PRL >600/>400 — для
 * женщины её нормальный пролактин 650 мМЕ/л давал «значительно выше нормы».
 *
 * Контракт: референсы и пороги — из `lab-norms.engine` с полом пациента;
 * без пола (мужской профиль) — мужские числа резолвера.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateComprehensiveReport } from '../comprehensive-report.engine';
import { getProfile } from '../../core/profile-manager';
import { LFT_ULN, GGT_ULN, CREATININE_ULN, HCT_THRESHOLDS, FEMALE_HORMONE_BANDS, E2_PG_TO_PMOL, PRL_NG_TO_MIU, getLabNorm } from '../lab-norms.engine';

const LABS: Record<string, Array<{ date: string; value: number }>> = {
  'АЛТ': [{ date: '2026-11-10', value: 70 }],
  'ГГТ': [{ date: '2026-11-10', value: 40 }],
  'Креатинин': [{ date: '2026-11-10', value: 100 }],
  'Гемоглобин': [{ date: '2026-11-10', value: 155 }],
  'Гематокрит': [{ date: '2026-11-10', value: 53 }],
  'Пролактин': [{ date: '2026-11-10', value: 850 }],
  'Эстрадиол': [{ date: '2026-11-10', value: 500 }],
  'Тестостерон': [{ date: '2026-11-10', value: 3 }],
  'ЛГ': [{ date: '2026-11-10', value: 30 }],
  'ФСГ': [{ date: '2026-11-10', value: 12 }],
  'Мочевая кислота': [{ date: '2026-11-10', value: 380 }],
};

const hoisted = vi.hoisted(() => ({ labs: {} as Record<string, Array<{ date: string; value: number }>> }));

vi.mock('../../core/profile-manager', () => ({
  getProfile: vi.fn(() => undefined),
  updateProfile: vi.fn(),
}));

vi.mock('../../engines/lab-diary.engine', () => ({
  getLabDiary: vi.fn(() => []),
  getMarkerHistory: vi.fn((_d: unknown, code: string) => hoisted.labs[code] ?? []),
}));

vi.mock('../../engines/profile-store', () => ({
  getWeightLog: vi.fn(() => []),
  getMeasurementsLog: vi.fn(() => []),
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

const profile = (sex: 'male' | 'female', opts: { lastPeriodStart?: string; cycleLengthDays?: number } = {}) => ({
  settings: {
    personal: { age: 30, sex, weight: 85, height: 180, bodyFat: 15 },
    pharma: { courseStartDate: '2026-09-01', trainingCycleWeeks: 16, phase: 'course', currentSubstances: [] },
    goals: { primaryGoal: 'mass' },
    nutrition: { proteinPerKg: 2, mealsPerDay: 5 },
    lifestyle: {
      sleepHours: 7, stressLevel: 5, morningHRV: 65, restingHR: 60, dailySteps: 8000,
      ...(opts.lastPeriodStart ? { lastPeriodStart: opts.lastPeriodStart } : {}),
      ...(opts.cycleLengthDays ? { cycleLengthDays: opts.cycleLengthDays } : {}),
    },
  },
  name: 'Тест',
});

const RANGE = { type: 'weekly' as const, dateFrom: '2026-11-01', dateTo: '2026-11-14' };

async function reportFor(sex: 'male' | 'female', opts: { lastPeriodStart?: string; cycleLengthDays?: number } = {}) {
  (getProfile as any).mockReturnValue(profile(sex, opts));
  const report = await generateComprehensiveReport(RANGE);
  const labOf = (label: string) =>
    report.sections.find(s => s.id === 'labs')!.metrics.find(m => m.label === label)!;
  const recOf = (section: string) => report.recommendations.filter(r => r.section === section);
  return { report, labOf, recOf };
}

describe('сводный отчёт: референсы по полу', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.labs = LABS;
    localStorage.removeItem('he_support_plan_result');
    localStorage.removeItem('he_risk_bridge');
  });

  it('женщина: референсы из резолвера (АЛТ 31, ГГТ 31, креатинин 97, HGB 150, HCT 48)', async () => {
    const { labOf } = await reportFor('female');
    expect(labOf('АЛТ').refHigh).toBe(LFT_ULN.ALT.female);
    expect(labOf('ГГТ').refHigh).toBe(GGT_ULN.female);
    expect(labOf('Креатинин').refHigh).toBe(CREATININE_ULN.female);
    expect(labOf('Гемоглобин').refHigh).toBe(150);
    expect(labOf('Гематокрит').refHigh).toBe(48);
  });

  it('мужчина: те же маркеры — мужские числа резолвера', async () => {
    const { labOf } = await reportFor('male');
    expect(labOf('АЛТ').refHigh).toBe(LFT_ULN.ALT.male);
    expect(labOf('ГГТ').refHigh).toBe(GGT_ULN.male);
    expect(labOf('Креатинин').refHigh).toBe(CREATININE_ULN.male);
    expect(labOf('Гемоглобин').refHigh).toBe(170);
    expect(labOf('Гематокрит').refHigh).toBe(52);
  });

  it('женщина: HGB 155 и креатинин 100 — выше её нормы, а не «норма»', async () => {
    const { labOf } = await reportFor('female');
    expect(labOf('Гемоглобин').status).not.toBe('normal');
    expect(labOf('Креатинин').status).not.toBe('normal');
    // У мужчины те же 155 г/л и 100 мкмоль/л — в норме.
    const male = await reportFor('male');
    expect(male.labOf('Гемоглобин').status).toBe('normal');
    expect(male.labOf('Креатинин').status).toBe('normal');
  });

  it('женщина: пролактин — норма из бэндов (500 мМЕ/л), мужчина — из резолвера (318)', async () => {
    const female = await reportFor('female');
    expect(female.labOf('Пролактин').refHigh).toBe(FEMALE_HORMONE_BANDS.PRL.range.high);
    // Мужская ВГН 15 нг/мл × 21.2 = 318 мМЕ/л (было «на глаз» 400 ≈ 18.9 нг/мл).
    expect(getLabNorm('PRL', 'male')!.uln * PRL_NG_TO_MIU).toBeCloseTo(318, 0);
    const male = await reportFor('male');
    expect(male.labOf('Пролактин').refHigh).toBe(318);
  });

  it('женщина: E2 — объединение фазовых коридоров в пмоль/л, статус «норма» на 500', async () => {
    const { labOf } = await reportFor('female');
    const p = FEMALE_HORMONE_BANDS.E2.phases;
    expect(labOf('Эстрадиол').refLow).toBe(Math.round(Math.min(p.follicular.low, p.luteal.low) * E2_PG_TO_PMOL));
    expect(labOf('Эстрадиол').refHigh).toBe(Math.round(Math.max(p.follicular.high, p.luteal.high) * E2_PG_TO_PMOL));
    expect(labOf('Эстрадиол').status).toBe('normal');
    // Мужская строка (40–160 пмоль/л) не тронута — но 500 у мужчины уже высоко.
    const male = await reportFor('male');
    expect(male.labOf('Эстрадиол').refLow).toBe(40);
    expect(male.labOf('Эстрадиол').refHigh).toBe(160);
    expect(male.labOf('Эстрадиол').status).not.toBe('normal');
  });

  it('женщина: TT 3 нмоль/л и ЛГ 30 — выше её половин, а не «норма» по мужским', async () => {
    const female = await reportFor('female');
    expect(female.labOf('Тестостерон').refLow).toBe(FEMALE_HORMONE_BANDS.TT.range.low);
    expect(female.labOf('Тестостерон').refHigh).toBe(FEMALE_HORMONE_BANDS.TT.range.high);
    expect(female.labOf('Тестостерон').status).toBe('warning');
    expect(female.labOf('ЛГ').refHigh).toBe(FEMALE_HORMONE_BANDS.LH.phases.luteal.high);
    expect(female.labOf('ЛГ').status).toBe('warning');
    expect(female.labOf('ФСГ').refHigh).toBe(FEMALE_HORMONE_BANDS.FSH.phases.follicular.high);
    expect(female.labOf('ФСГ').status).toBe('warning');
    // У мужчины та же TT 3 нмоль/л — резко низкая, а ЛГ 30 и ФСГ 12 — по его шкале.
    const male = await reportFor('male');
    expect(male.labOf('Тестостерон').refLow).toBe(10);
    expect(male.labOf('Тестостерон').refHigh).toBe(35);
    expect(male.labOf('Тестостерон').status).toBe('critical');
    expect(male.labOf('ЛГ').refHigh).toBe(9.3);
    expect(male.labOf('ФСГ').status).toBe('normal');
  });
});

describe('сводный отчёт: пороги рекомендаций по полу', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.labs = LABS;
    localStorage.removeItem('he_support_plan_result');
    localStorage.removeItem('he_risk_bridge');
  });

  it('женщина: HCT 53 → критично (её порог блока 52)', async () => {
    const { recOf } = await reportFor('female');
    expect(HCT_THRESHOLDS.female.block).toBe(52);
    const blood = recOf('Кровь');
    expect(blood.some(r => r.priority === 'critical' && r.text.includes('полицитемия'))).toBe(true);
  });

  it('мужчина: HCT 53 → только предупреждение (его эритроцитоз от 51, блок 54)', async () => {
    const { recOf } = await reportFor('male');
    const blood = recOf('Кровь');
    expect(blood.some(r => r.priority === 'critical')).toBe(false);
    expect(blood.some(r => r.priority === 'warning')).toBe(true);
  });

  it('женщина: АЛТ 70 → критично (её 2×ВГН 62); у мужчины — предупреждение', async () => {
    const female = await reportFor('female');
    expect(female.recOf('Печень').some(r => r.priority === 'critical' && r.text.includes('гепатотоксичность'))).toBe(true);
    const male = await reportFor('male');
    expect(male.recOf('Печень').some(r => r.priority === 'critical')).toBe(false);
    expect(male.recOf('Печень').some(r => r.priority === 'warning')).toBe(true);
  });

  it('женщина: PRL 850 → предупреждение, а не критично (красный бэнд 1500)', async () => {
    const { recOf } = await reportFor('female');
    const horm = recOf('Гормоны');
    expect(horm.some(r => r.priority === 'critical')).toBe(false);
    expect(horm.some(r => r.priority === 'warning')).toBe(true);
  });

  it('мужчина: PRL 850 → критично (его порог 600)', async () => {
    const { recOf } = await reportFor('male');
    expect(recOf('Гормоны').some(r => r.priority === 'critical')).toBe(true);
  });
});

/**
 * Проход 165: таблица `gatherLabs` была четвёртым реестром чисел — рядом с
 * `UCUM_MAP`, резолвером и карточками. Маркеры, у которых подпись отчёта и
 * единица резолвера — одна шкала, обязаны брать числа резолвера; строки в
 * других единицах (TT нмоль/л, E2 пмоль/л) остаются как были.
 */
describe('сводный отчёт: референс — из резолвера, а не своя таблица', () => {
  const NORM_LABS: Record<string, Array<{ date: string; value: number }>> = {
    'Глюкоза': [{ date: '2026-11-10', value: 5.0 }],
    'Лейкоциты': [{ date: '2026-11-10', value: 5.0 }],
    'Свободный T4': [{ date: '2026-11-10', value: 15 }],
    'ЛПВП': [{ date: '2026-11-10', value: 1.2 }],
    'Инсулин': [{ date: '2026-11-10', value: 8 }],
    'Мочевина': [{ date: '2026-11-10', value: 5 }],
    'СРБ': [{ date: '2026-11-10', value: 2 }],
    'Билирубин общий': [{ date: '2026-11-10', value: 10 }],
    'ГГТ': [{ date: '2026-11-10', value: 30 }],
    'АЛТ': [{ date: '2026-11-10', value: 20 }],
    'Тестостерон': [{ date: '2026-11-10', value: 20 }],
    'Эстрадиол': [{ date: '2026-11-10', value: 100 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.labs = NORM_LABS;
    localStorage.removeItem('he_support_plan_result');
    localStorage.removeItem('he_risk_bridge');
  });

  it('числа совпадают с `getLabNorm` (глюкоза, лейкоциты, Т4св, ЛПВП, инсулин, мочевина)', async () => {
    const { labOf } = await reportFor('male');
    for (const [label, code] of [
      ['Глюкоза', 'GLU'], ['Лейкоциты', 'WBC'], ['Свободный T4', 'FT4'],
      ['ЛПВП', 'HDL'], ['Инсулин', 'INS'], ['Мочевина', 'UREA'],
    ] as const) {
      const n = getLabNorm(code, 'male')!;
      expect({ label, low: labOf(label).refLow, high: labOf(label).refHigh })
        .toEqual({ label, low: n.lln, high: n.uln });
    }
  });

  it('СРБ, билирубин, ГГТ и нижняя граница АЛТ — тоже резолвер', async () => {
    const { labOf } = await reportFor('male');
    expect(labOf('СРБ').refLow).toBe(getLabNorm('CRP', 'male')!.lln);
    expect(labOf('Билирубин общий').refHigh).toBe(getLabNorm('BIL', 'male')!.uln);
    expect(labOf('ГГТ').refHigh).toBe(getLabNorm('GGT', 'male')!.uln);
    expect(labOf('АЛТ').refLow).toBe(getLabNorm('ALT', 'male')!.lln);
  });

  it('строки в других единицах остаются прежними (TT 10–35 нмоль/л, E2 40–160 пмоль/л)', async () => {
    const { labOf } = await reportFor('male');
    expect([labOf('Тестостерон').refLow, labOf('Тестостерон').refHigh]).toEqual([10, 35]);
    expect([labOf('Эстрадиол').refLow, labOf('Эстрадиол').refHigh]).toEqual([40, 160]);
  });

  it('холестерин общий: верх из резолвера, нижней границы нет (lln 0 = «нет границы»)', async () => {
    const { labOf } = await reportFor('male');
    const n = getLabNorm('CHOL', 'male')!;
    expect(labOf('Холестерин общий').refHigh).toBe(n.uln);
    // Проход 168: `lln: 0` в каталоге — это «нижней границы нет», а не норма
    // «от нуля». Отчёт печатал «0–5.2» и выдавал одностороннюю норму за двустороннюю.
    expect(n.lln).toBe(0);
    expect(labOf('Холестерин общий').refLow).toBeUndefined();
  });
});

describe('сводный отчёт: фазовая модель E2/ЛГ/ФСГ по дню цикла (проход 77)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.labs = LABS;
    localStorage.removeItem('he_support_plan_result');
    localStorage.removeItem('he_risk_bridge');
  });

  it('лютеиновая (16-й день): E2 70–500 пг/мл в пмоль/л, ЛГ 5–25, ФСГ 1.5–8', async () => {
    const { labOf, report } = await reportFor('female', { lastPeriodStart: '2026-10-30' });
    expect(report.meta.cyclePhase).toEqual({ label: 'Лютеиновая', cycleDay: 16, cycleLength: 28 });
    const e2 = FEMALE_HORMONE_BANDS.E2.phases.luteal;
    expect(labOf('Эстрадиол').refLow).toBe(Math.round(e2.low * E2_PG_TO_PMOL));
    expect(labOf('Эстрадиол').refHigh).toBe(Math.round(e2.high * E2_PG_TO_PMOL));
    expect(labOf('ЛГ').refLow).toBe(5);
    expect(labOf('ЛГ').refHigh).toBe(25);
    expect(labOf('ФСГ').refLow).toBe(1.5);
    expect(labOf('ФСГ').refHigh).toBe(8);
  });

  it('фолликулярная (7-й день): E2 800 пмоль/л выше нормы фазы, в лютеиновую — норма', async () => {
    hoisted.labs = { ...LABS, 'Эстрадиол': [{ date: '2026-11-10', value: 800 }] };
    const foll = await reportFor('female', { lastPeriodStart: '2026-11-08' });
    expect(foll.report.meta.cyclePhase?.label).toBe('Фолликулярная');
    expect(foll.labOf('Эстрадиол').refHigh)
      .toBe(Math.round(FEMALE_HORMONE_BANDS.E2.phases.follicular.high * E2_PG_TO_PMOL));
    expect(foll.labOf('Эстрадиол').status).toBe('warning');
    const lut = await reportFor('female', { lastPeriodStart: '2026-10-30' });
    expect(lut.labOf('Эстрадиол').status).toBe('normal');
  });

  it('нет даты цикла — объединение фаз и никакой фазы в meta', async () => {
    const { labOf, report } = await reportFor('female');
    expect(report.meta.cyclePhase).toBeUndefined();
    const p = FEMALE_HORMONE_BANDS.E2.phases;
    expect(labOf('Эстрадиол').refHigh).toBe(Math.round(Math.max(p.follicular.high, p.luteal.high) * E2_PG_TO_PMOL));
    expect(labOf('ЛГ').refHigh).toBe(25);
    expect(labOf('ФСГ').refLow).toBe(1.5);
  });

  it('мужчине дата цикла ничего не меняет', async () => {
    const { labOf, report } = await reportFor('male', { lastPeriodStart: '2026-10-30' });
    expect(report.meta.cyclePhase).toBeUndefined();
    expect(labOf('Эстрадиол').refHigh).toBe(160);
  });

  it('овуляторная — коридора нет, остаётся объединение фаз (пик не наказываем)', async () => {
    const { labOf, report } = await reportFor('female', { lastPeriodStart: '2026-11-02' });
    expect(report.meta.cyclePhase).toEqual({ label: 'Овуляторная', cycleDay: 13, cycleLength: 28 });
    const p = FEMALE_HORMONE_BANDS.E2.phases;
    expect(labOf('Эстрадиол').refHigh).toBe(Math.round(Math.max(p.follicular.high, p.luteal.high) * E2_PG_TO_PMOL));
  });
});

describe('сводный отчёт: мочевая кислота по полу (проход 77)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.labs = LABS;
    localStorage.removeItem('he_support_plan_result');
    localStorage.removeItem('he_risk_bridge');
  });

  it('женщина: 380 мкмоль/л выше её ВГН 350 — и в референсе, и в рекомендации', async () => {
    const { labOf, recOf } = await reportFor('female');
    expect(labOf('Мочевая кислота').refLow).toBe(150);
    expect(labOf('Мочевая кислота').refHigh).toBe(350);
    expect(labOf('Мочевая кислота').status).toBe('warning');
    expect(recOf('Метаболизм').some(r => r.text.includes('гиперурикемия') && r.text.includes('350'))).toBe(true);
  });

  it('мужчина: те же 380 — в его норме до 420, рекомендации нет', async () => {
    const { labOf, recOf } = await reportFor('male');
    // Низ мужчины — 210 (ИНВИТРО, >14 лет), проход 189; до него в отчёте
    // печаталось 200 из каталога, где низ был раздвоен (200 и 150).
    expect(labOf('Мочевая кислота').refLow).toBe(210);
    expect(labOf('Мочевая кислота').refHigh).toBe(420);
    expect(labOf('Мочевая кислота').status).toBe('normal');
    expect(recOf('Метаболизм').some(r => r.text.includes('гиперурикемия'))).toBe(false);
  });
});

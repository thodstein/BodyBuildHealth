/**
 * Аудит кардио-планировщика — спринт 1 (безопасность и валидность).
 * Каждый тест — мутационный: падает на старом коде.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCardioCycle, cardioHiitInjectGate, capSessionsToDays, needsMedicalBlock,
  buildCardioCycleFromPrep, type CardioCycle, type CardioPrepPlanLike,
} from '../cardio.engine';
import { validateCardioCycle } from '../cardio-plan-validate.engine';
import { applyMesoMult } from '../cardio-meso-progression.engine';
import { finishCardioCycle } from '../cardio-templates.engine';

const PREP_MIN: CardioPrepPlanLike = {
  id: 'prep-min',
  showDate: '2026-09-15',
  category: 'bikini',
  sex: 'female',
  preparation: {
    startDate: '2026-06-01', weeks: 6, finalWeeks: 2, targetRatePctPerWeek: 0.5,
    startingWeightKg: 60, currentCalories: 1600, stepsPerDay: 9000, cardioMinutesPerWeek: 120,
  },
  taper: { enabled: true, weeks: 2 },
  peakWeek: { enabled: true },
  phases: [
    { key: 'preparation', weekStart: 1, weekEnd: 4, dateStart: '2026-06-01', dateEnd: '2026-06-28' },
    { key: 'final_preparation', weekStart: 5, weekEnd: 6, dateStart: '2026-06-29', dateEnd: '2026-07-12' },
    { key: 'taper', weekStart: 7, weekEnd: 8, dateStart: '2026-07-13', dateEnd: '2026-07-26' },
    { key: 'peak_week', weekStart: 9, weekEnd: 9, dateStart: '2026-07-27', dateEnd: '2026-08-02' },
  ],
};

const CYCLE_8W = () => buildCardioCycle({
  goal: 'cut', totalWeeks: 8, daysAvailable: 5, bodyWeight: 80, startDate: '2026-01-05',
  taperWeeks: 2, competitions: [{ id: 'c1', name: 'Race', week: 7, priority: 'A' }],
});

describe('P0: мед-гейт ручной HIIT-инъекции', () => {
  it('gate блокирует HIIT при красном флаге и даёт честную причину', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, daysAvailable: 4, bodyWeight: 80, age: 55, redFlags: ['chest_pain'] });
    const gate = cardioHiitInjectGate(c);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('HIIT/MISS запрещены');
    expect(gate.reason).toContain('Скрининг, не диагноз');
  });

  it('gate блокирует подростка 14–15 (teen-гейт)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, daysAvailable: 4, bodyWeight: 60, age: 15 });
    expect(cardioHiitInjectGate(c).allowed).toBe(false);
    // 40+ без флага — НЕ блокирует (возраст сам по себе не болезнь)
    const ok = buildCardioCycle({ goal: 'cut', totalWeeks: 6, daysAvailable: 4, bodyWeight: 80, age: 52 });
    expect(cardioHiitInjectGate(ok).allowed).toBe(true);
  });

  it('gate разрешает HIIT без флагов и при null-цикле не падает', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, daysAvailable: 4, bodyWeight: 80 });
    expect(cardioHiitInjectGate(c)).toEqual({ allowed: true, reason: null });
    expect(cardioHiitInjectGate(null).allowed).toBe(true);
    expect(cardioHiitInjectGate(undefined).allowed).toBe(true);
  });

  it('РЕГРЕСС: план с мед-блоком не содержит HIIT/MISS, и инъекция даёт medical_block', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, daysAvailable: 4, bodyWeight: 80, startDate: '2026-01-05', age: 55, redFlags: ['chest_pain'] });
    // сборка сама чистая
    expect(c.weeks.every(w => w.sessions.every(s => s.type !== 'hiit' && s.type !== 'miss'))).toBe(true);
    // НО кнопка «+HIIT» предлагается по варнингу z2_without_hiit — значит
    // без UI-гейта пользователь получает ошибку. Гейт обязан её закрыть.
    const mb = needsMedicalBlock(c.config?.redFlags, c.config?.age);
    const v = validateCardioCycle(c, { medicalBlock: mb });
    expect(v.issues.some(i => i.code === 'z2_without_hiit_low_volume')).toBe(true);
    // имитация инъекции (UI addHiitToCycle) → без гейта plan сломан
    const broken: CardioCycle = {
      ...c,
      weeks: c.weeks.map(w => w.week === 1
        ? { ...w, sessions: [...w.sessions, { type: 'hiit' as const, durationMin: 20, weeklyFrequency: 1, intensity: 'high' as const, kcalPerSession: 200, purpose: 'SIT 8x20' }] }
        : w),
    };
    expect(validateCardioCycle(broken, { medicalBlock: mb }).valid).toBe(false);
    // гейт не даёт инъекцию → цикл остаётся валидным
    expect(cardioHiitInjectGate(c).allowed).toBe(false);
    expect(validateCardioCycle(c, { medicalBlock: mb }).valid).toBe(true);
  });
});

describe('P1: daysAvailable >= 1 (никакого пустого плана)', () => {
  it('buildCardioCycle: 0 дней поднимается до 1 и план непустой', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, daysAvailable: 0, bodyWeight: 80, startDate: '2026-01-05' });
    expect(c.config?.daysAvailable).toBe(1);
    expect(c.weeks.every(w => w.sessions.length === 0)).toBe(false);
    expect(validateCardioCycle(c).valid).toBe(true);
  });

  it('buildCardioCycleFromPrep: тот же floor 1', () => {
    const c = buildCardioCycleFromPrep(PREP_MIN, { daysAvailable: 0, referenceIso: '2026-01-05' });
    expect(c).not.toBeNull();
    expect(c!.weeks.every(w => w.sessions.length === 0)).toBe(false);
  });

  it('capSessionsToDays(0) больше не вызывается из сборки (floor в движке)', () => {
    // сам helper по контракту остаётся общим (0 → пусто), но сборка его не достигает
    expect(capSessionsToDays([{ type: 'zone2', durationMin: 40, weeklyFrequency: 3, intensity: 'easy', kcalPerSession: 300, purpose: 'z2' }], 0)).toEqual([]);
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 3, daysAvailable: 1, bodyWeight: 80, startDate: '2026-01-05' });
    expect(c.weeks.every(w => w.sessions.length >= 1)).toBe(true);
  });

  it('валидатор ловит пустую неделю как error (старые/импортированные циклы)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, daysAvailable: 3, bodyWeight: 80, startDate: '2026-01-05' });
    const broken: CardioCycle = { ...c, weeks: c.weeks.map((w, i) => (i === 1 ? { ...w, sessions: [], totalMinutes: 0, totalKcal: 0 } : w)) };
    const v = validateCardioCycle(broken);
    expect(v.valid).toBe(false);
    expect(v.issues.some(i => i.code === 'empty_week')).toBe(true);
    expect(v.qualityScore).toBeLessThan(100);
  });
});

describe('P1: cross-meso множитель не трогает делод/тапер/гонку', () => {
  it('делод-неделя сохраняет объём при ×1.15', () => {
    const c = CYCLE_8W();
    const di = c.weeks.findIndex(w => w.deload);
    expect(di).toBeGreaterThanOrEqual(0);
    const after = applyMesoMult(c, 1.15);
    expect(after.weeks[di].totalMinutes).toBe(c.weeks[di].totalMinutes);
  });

  it('гоночная неделя (taper) сохраняет объём при ×1.15', () => {
    const c = CYCLE_8W();
    const wi = c.weeks.findIndex(w => w.week === 7);
    const after = applyMesoMult(c, 1.15);
    expect(after.weeks[wi].totalMinutes).toBe(c.weeks[wi].totalMinutes);
  });

  it('рабочие недели масштабируются (старый контракт сохранён)', () => {
    const c = CYCLE_8W();
    const work = c.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'peak' && w.phase !== 'transition');
    const after = applyMesoMult(c, 1.15);
    for (const w of work) {
      const a = after.weeks.find(x => x.week === w.week)!;
      expect(a.totalMinutes).toBeGreaterThan(w.totalMinutes);
    }
  });

  it('mult <= 1 — точный no-op (тот же объект)', () => {
    const c = CYCLE_8W();
    expect(applyMesoMult(c, 1)).toBe(c);
    expect(applyMesoMult(c, 0.9)).toBe(c);
  });

  it('finishCardioCycle: cross-meso ДО каскада соревнований (taper не раздувается)', () => {
    const c = buildCardioCycle({
      goal: 'cut', totalWeeks: 8, daysAvailable: 5, bodyWeight: 80, startDate: '2026-01-05',
      taperWeeks: 2, competitions: [{ id: 'c1', name: 'Race', week: 7, priority: 'A' }],
    });
    const noMeso = finishCardioCycle(c, { taperEnabled: true, competitions: [{ week: 7, priority: 'A' }] });
    const withMeso = finishCardioCycle(c, { taperEnabled: true, competitions: [{ week: 7, priority: 'A' }], mesoMult: 1.15 });
    const w7a = noMeso.weeks.find(w => w.week === 7)!;
    const w7b = withMeso.weeks.find(w => w.week === 7)!;
    expect(w7b.totalMinutes).toBe(w7a.totalMinutes);
    // rationale честно говорит, что не все недели тронуты
    expect(withMeso.rationale.some(r => r.includes('делод/тапер/гонки не тронуты'))).toBe(true);
  });
});

/**
 * bb-taper-adaptive-p2.test.ts — P2: визуализация, сравнение, экспорт, напоминания, отмена, путешествия, ветераны, календарь.
 */
import { describe, it, expect } from 'vitest';
import {
  taperCurveSVG,
  compareTaperStrategies,
  exportPeakWeek,
  buildPeakReminders,
  buildPeakCancellationPlan,
  travelTaperMod,
  veteranTaperMod,
  buildTaperCalendar,
} from '../bb-taper-adaptive.engine';
import type { BBContestPrepConfig, TrainingTaperWeek } from '../bb-contest-prep.engine';

const baseCfg: BBContestPrepConfig = {
  sex: 'male',
  category: 'mens_bb',
  weightKg: 90,
  experienceLevel: 'intermediate',
  enhanced: false,
  prepCount: 0,
  showDate: '2026-11-01',
  weeksOut: 4,
  trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate',
  waterStrategy: 'stable',
  sodiumStrategy: 'stable',
};

const taper4: TrainingTaperWeek[] = [
  { weekOffset: -4, label: 'Подводящая', volumePct: 0.9, intensityPct: 0.95, rirMin: 2, rirMax: 3, focus: '', deloadBefore: true },
  { weekOffset: -3, label: 'Taper-2', volumePct: 0.85, intensityPct: 0.95, rirMin: 2, rirMax: 3, focus: '', deloadBefore: false },
  { weekOffset: -2, label: 'Taper-1', volumePct: 0.7, intensityPct: 0.9, rirMin: 2, rirMax: 4, focus: '', deloadBefore: false },
  { weekOffset: -1, label: 'Финал', volumePct: 0.6, intensityPct: 0.85, rirMin: 2, rirMax: 4, focus: '', deloadBefore: false },
];

describe('taperCurveSVG', () => {
  it('возвращает SVG с полилиниями', () => {
    const svg = taperCurveSVG(taper4);
    expect(svg).toContain('<svg');
    expect(svg).toContain('<polyline');
    expect(svg).toContain('объём');
  });

  it('пустой тапер → пустая строка', () => {
    expect(taperCurveSVG([])).toBe('');
  });
});

describe('compareTaperStrategies', () => {
  it('6 стратегий для категории', () => {
    const rows = compareTaperStrategies(baseCfg.category);
    expect(rows).toHaveLength(6);
    expect(rows.map(r => r.strategy)).toEqual(['front', 'moderate', 'back', 'undulating', 'linear', 'direct']);
  });

  it('у каждой стратегии бюджет и spill risk', () => {
    for (const r of compareTaperStrategies(baseCfg.category)) {
      expect(r.carbBudgetGPerKg[0]).toBeGreaterThan(0);
      expect(r.carbBudgetGPerKg[1]).toBeGreaterThanOrEqual(r.carbBudgetGPerKg[0]);
      expect(['low', 'medium', 'high']).toContain(r.spillRisk);
      expect(r.bestFor.length).toBeGreaterThan(0);
    }
  });
});

describe('exportPeakWeek', () => {
  const plan = [
    { day: 1, date: '2026-10-26', phase: 'deplete_1', phaseLabel: 'Деплеция 1', kcal: 1800, proteinG: 180, carbsG: 120, fatG: 60, fiberMaxG: 20, waterLiters: 3, sodiumMg: 2800, potassiumMg: 3500, training: { type: 'train', minutes: 45, details: [] }, cardioSteps: 0, posingMinutes: 20, sleepHours: 8, supplementNotes: [], mealNotes: [] },
    { day: 7, date: '2026-11-01', phase: 'show', phaseLabel: 'Шоу', kcal: 1600, proteinG: 160, carbsG: 150, fatG: 55, fiberMaxG: 10, waterLiters: 2.5, sodiumMg: 2000, potassiumMg: 3000, training: { type: 'rest', minutes: 0, details: [] }, cardioSteps: 0, posingMinutes: 0, sleepHours: 8, supplementNotes: [], mealNotes: [] },
  ] as any;

  it('HTML содержит таблицу и даты', () => {
    const e = exportPeakWeek(plan, '2026-11-01');
    expect(e.html).toContain('<html>');
    expect(e.html).toContain('2026-11-01');
    expect(e.html).toContain('Деплеция');
  });

  it('ICS содержит VCALENDAR и VEVENT', () => {
    const e = exportPeakWeek(plan, '2026-11-01');
    expect(e.ics).toContain('BEGIN:VCALENDAR');
    expect(e.ics).toContain('BEGIN:VEVENT');
    expect(e.ics).toContain('DTSTART;VALUE=DATE=20261101');
  });

  it('CSV содержит заголовок и строки', () => {
    const e = exportPeakWeek(plan, '2026-11-01');
    expect(e.csv).toContain('day,phase,kcal');
    expect(e.csv).toContain('7,Шоу');
  });
});

describe('buildPeakReminders', () => {
  const plan = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 9, 26 + i);
    return {
    day: i + 1,
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    phase: 'load_1',
    phaseLabel: `Day ${i + 1}`,
    kcal: 2000,
    proteinG: 180,
    carbsG: 300,
    fatG: 60,
    fiberMaxG: 12,
    waterLiters: 3,
    sodiumMg: 2800,
    potassiumMg: 3500,
    training: { type: 'rest', minutes: 0, details: [] },
    cardioSteps: 0,
    posingMinutes: 0,
    sleepHours: 8,
    supplementNotes: [],
    mealNotes: [],
    };
  }) as any;

  it('7 напоминаний с датами', () => {
    const r = buildPeakReminders(plan);
    expect(r).toHaveLength(7);
    expect(r[0].date).toBe('2026-10-26');
    expect(r[6].date).toBe('2026-11-01');
  });

  it('каждое напоминание содержит воду и натрий', () => {
    for (const r of buildPeakReminders(plan)) {
      expect(r.detail).toContain('Вода');
      expect(r.detail).toContain('Na');
    }
  });
});

describe('buildPeakCancellationPlan', () => {
  it('3 дня с возвратом к норме', () => {
    const c = buildPeakCancellationPlan();
    expect(c.days).toHaveLength(3);
    expect(c.days[0].waterTarget).toBe('3.5л');
    expect(c.days[0].sodiumTarget).toBe('2800мг');
  });

  it('заметки о безопасности', () => {
    const c = buildPeakCancellationPlan();
    expect(c.notes.length).toBeGreaterThan(0);
    expect(c.notes.join(' ')).toContain('обратимы');
  });
});

describe('travelTaperMod', () => {
  it('без путешествия → нулевые дельты', () => {
    const m = travelTaperMod(false);
    expect(m.waterDeltaL).toBe(0);
  });

  it('перелёт 6+ ч → +0.5л воды', () => {
    const m = travelTaperMod(true, 8);
    expect(m.waterDeltaL).toBe(0.5);
  });

  it('перелёт <6 ч → +0.3л воды', () => {
    const m = travelTaperMod(true, 3);
    expect(m.waterDeltaL).toBe(0.3);
  });
});

describe('veteranTaperMod', () => {
  it('до 40 → без изменений', () => {
    expect(veteranTaperMod(35).taperLength).toBe(4);
    expect(veteranTaperMod(35).volumeMult).toBe(1);
  });

  it('40+ → объём ×1.05, интенсивность ×0.97', () => {
    const m = veteranTaperMod(45);
    expect(m.volumeMult).toBe(1.05);
    expect(m.intensityMult).toBe(0.97);
  });
});

describe('buildTaperCalendar', () => {
  it('4 недели с датами и фазами', () => {
    const days = buildTaperCalendar(taper4, '2026-11-01', 4);
    expect(days).toHaveLength(4);
    expect(days[3].phase).toBe('Подводящая');
    expect(days[0].phase).toBe('Финал');
  });

  it('isDeload при volumePct < 0.65', () => {
    const days = buildTaperCalendar(taper4, '2026-11-01', 4);
    const finals = days.filter(d => d.isDeload);
    expect(finals.length).toBeGreaterThanOrEqual(1);
  });
});

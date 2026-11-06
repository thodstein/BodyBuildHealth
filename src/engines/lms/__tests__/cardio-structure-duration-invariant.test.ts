/**
 * cardio-structure-duration-invariant.test.ts — 13-й проход аудита (ноябрь 2026):
 * инвариант «структура интервалов не режется» соблюдается не только в
 * редакторе, но и во ВСЕХ путях, которые масштабируют длительность сессии:
 * taper (PL/BB/индивидуальный), каскад стартов, ACWR-адаптации, новичок на
 * сложном шаблоне. Плюс:
 *  - prep-путь назначает HIIT машинную структуру (раньше текст был, отрезков нет);
 *  - смена типа (MISS/HIIT → zone2) снимает структуру, иначе таймер вёл бы
 *    интервалы у «ровной» зоны 2.
 */
import { describe, expect, it } from 'vitest';
import {
  adaptCardioToStrength,
  applyCardioCompetitionCascade,
  applyIndividualizedTaperToCycle,
  buildCardioCycle,
  buildCardioCycleFromPrep,
  cardioStructuredMainSec,
  scaleCardioDurationMin,
  type CardioCycle,
  type CardioPrepPlanLike,
  type CardioSession,
} from '../cardio.engine';
import { buildCardioCycleFromTemplateId } from '../cardio-templates.engine';

const LONG_BLOCK = { workSec: 600, restSec: 120, reps: 3 };   // 36 мин основной части
const SHORT_BLOCK = { workSec: 60, restSec: 60, reps: 5 };    // 10 мин

/** Сессии, где план обещает меньше минут, чем занимает сама структура. */
function brokenStructure(cycle: CardioCycle): string[] {
  const bad: string[] = [];
  for (const w of cycle.weeks) {
    for (const s of w.sessions) {
      const mainMin = cardioStructuredMainSec(s.structured) / 60;
      if (mainMin > 0 && s.durationMin + 1e-9 < mainMin) {
        bad.push(`нед ${w.week}: ${s.type} ${s.durationMin} мин < структура ${mainMin.toFixed(1)} мин`);
      }
    }
  }
  return bad;
}

/** Подменить сессии недели, сохранив валидную неделю. */
function withWeekSession(base: CardioCycle, weekNo: number, session: CardioSession): CardioCycle {
  return {
    ...base,
    weeks: base.weeks.map(w => (w.week === weekNo
      ? {
          ...w,
          sessions: [session],
          totalMinutes: session.durationMin * session.weeklyFrequency,
          totalKcal: session.kcalPerSession * session.weeklyFrequency,
        }
      : w)),
  };
}

function structuredSession(type: CardioSession['type'], durationMin: number, block = LONG_BLOCK): CardioSession {
  return {
    type,
    durationMin,
    weeklyFrequency: 1,
    intensity: type === 'miss' ? 'moderate' : 'high',
    kcalPerSession: 300,
    purpose: 'Тестовая структурированная сессия',
    structured: [{ ...block }],
  };
}

const baseCycle = (weeks = 8): CardioCycle =>
  buildCardioCycle({ goal: 'maintenance', totalWeeks: weeks, daysAvailable: 7, bodyWeight: 80, level: 'intermediate' });

const prepMale: CardioPrepPlanLike = {
  id: 'prep-struct',
  showDate: '2026-09-15',
  category: 'mens_bb',
  sex: 'male',
  preparation: {
    startDate: '2026-06-01',
    weeks: 12,
    finalWeeks: 2,
    targetRatePctPerWeek: 0.5,
    startingWeightKg: 88,
    currentCalories: 2600,
    stepsPerDay: 9000,
    cardioMinutesPerWeek: 240,
  },
  taper: { enabled: true, weeks: 2 },
  peakWeek: { enabled: true },
  phases: [
    { key: 'preparation', weekStart: 1, weekEnd: 10, dateStart: '2026-06-01', dateEnd: '2026-08-09' },
    { key: 'final_preparation', weekStart: 11, weekEnd: 12, dateStart: '2026-08-10', dateEnd: '2026-08-23' },
    { key: 'taper', weekStart: 13, weekEnd: 14, dateStart: '2026-08-24', dateEnd: '2026-09-06' },
    { key: 'peak_week', weekStart: 15, weekEnd: 15, dateStart: '2026-09-07', dateEnd: '2026-09-13' },
  ],
};

describe('scaleCardioDurationMin: структура важнее целевого объёма', () => {
  it('не опускает сессию ниже основной части', () => {
    const s = { durationMin: 48, structured: [LONG_BLOCK] };
    expect(scaleCardioDurationMin(s, 0.5)).toBe(36); // 48×0.5=24 < 36 → 36
    expect(scaleCardioDurationMin(s, 0.7)).toBe(36); // 33.6 < 36 мин структуры → 36
    expect(scaleCardioDurationMin(s, 1)).toBe(48);
  });

  it('без структуры работает как раньше (floor 10 мин)', () => {
    expect(scaleCardioDurationMin({ durationMin: 20, structured: undefined }, 0.5)).toBe(10);
    expect(scaleCardioDurationMin({ durationMin: 45 }, 0.9)).toBe(41);
  });

  it('короткая структура не мешает обычной урезке', () => {
    expect(scaleCardioDurationMin({ durationMin: 40, structured: [SHORT_BLOCK] }, 0.5)).toBe(20);
  });
});

describe('taper/каскад/адаптации не рвут структуру', () => {
  it('каскад стартов (B): MISS со структурой 36 мин остаётся 36 мин', () => {
    const c = withWeekSession(baseCycle(), 5, structuredSession('miss', 48));
    const out = applyCardioCompetitionCascade(c, [{ week: 6, priority: 'B' }]);
    const s = out.weeks.find(w => w.week === 5)!.sessions[0];
    expect(s.durationMin).toBe(36);                   // 48×0.7=34 → поднято до структуры
    expect(s.type).toBe('miss');
    expect(s.structured?.length).toBe(1);
    expect(brokenStructure(out)).toEqual([]);
  });

  it('PL taper: структурированная zone2 не короче своей структуры', () => {
    const c = withWeekSession(baseCycle(), 5, structuredSession('zone2', 60));
    const out = applyIndividualizedTaperToCycle(c, {
      durationDays: 14, reductionPct: 60, model: 'exponential', tauDays: 7,
      expectedGainPct: 2, reasons: ['тест'], sleepHygiene: true,
    }, { showWeek: 6 }).cycle;
    expect(brokenStructure(out)).toEqual([]);
    const s = out.weeks.find(w => w.week === 5)!.sessions[0];
    expect(s.durationMin).toBeGreaterThanOrEqual(36);
  });

  it('ACWR опасный: zone2 со структурой не режется ниже структуры', () => {
    const c = withWeekSession(baseCycle(), 3, structuredSession('zone2', 60));
    const out = adaptCardioToStrength(c, { acwr: 1.8 });
    expect(brokenStructure(out)).toEqual([]);
    const s = out.weeks.find(w => w.week === 3)!.sessions[0];
    expect(s.durationMin).toBe(36);                   // 60×0.6=36
  });

  it('ACWR осторожный: MISS со структурой не режется ниже структуры', () => {
    const c = withWeekSession(baseCycle(), 3, structuredSession('miss', 48));
    const out = adaptCardioToStrength(c, { acwr: 1.4 });
    expect(brokenStructure(out)).toEqual([]);
  });

  it('частота ног ≥4: MISS → zone2 снимает структуру (никаких интервалов в «ровной» зоне)', () => {
    const c = withWeekSession(baseCycle(), 3, structuredSession('miss', 48));
    const out = adaptCardioToStrength(c, { legDaysPerWeek: 4 });
    const s = out.weeks.find(w => w.week === 3)!.sessions[0];
    expect(s.type).toBe('zone2');
    expect(s.structured).toBeUndefined();
  });
});

describe('шаблоны: новичок на сложном плане', () => {
  it('объём ×0.8 не опускает структурированную сессию ниже структуры', () => {
    const out = buildCardioCycleFromTemplateId('cardio-bike-ftp-builder-6', { level: 'beginner' });
    expect(out).not.toBeNull();
    const structured = out!.weeks.flatMap(w => w.sessions.filter(s => (s.structured?.length ?? 0) > 0));
    expect(structured.length).toBeGreaterThan(0);
    expect(brokenStructure(out!)).toEqual([]);
  });
});

describe('prep-путь: HIIT получает машинную структуру', () => {
  it('у каждого HIIT есть structured, текст SIT и отрезки влезают в сессию', () => {
    const c = buildCardioCycleFromPrep(prepMale, { daysAvailable: 7, age: 30, level: 'intermediate' });
    expect(c).not.toBeNull();
    const hiits = c!.weeks.flatMap(w => w.sessions.filter(s => s.type === 'hiit'));
    expect(hiits.length).toBeGreaterThan(0);
    for (const s of hiits) {
      expect(s.structured?.length).toBe(1);
      expect(s.structured![0].workSec).toBe(20);
      expect(s.structured![0].restSec).toBe(10);
      expect(s.purpose ?? '').toMatch(/SIT/);
      expect(s.durationMin * 60).toBeGreaterThanOrEqual(cardioStructuredMainSec(s.structured));
    }
    expect(brokenStructure(c!)).toEqual([]);
  });
});

describe('генератор: структура и текст согласованы', () => {
  it('cut: budget таймера не превышает длительность ни в одной сессии', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 12, daysAvailable: 7, bodyWeight: 80, level: 'advanced' });
    expect(brokenStructure(c)).toEqual([]);
  });
});

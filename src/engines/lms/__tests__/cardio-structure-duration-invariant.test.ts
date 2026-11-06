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
  buildCardioIcs,
  buildCardioIntervalPlan,
  buildCardioPrintHtml,
  buildCardioSummaryText,
  buildCardioTcx,
  cardioSessionProtocol,
  cardioStructuredMainSec,
  loadActiveCardioCycle,
  loadCardioCycles,
  normalizeCardioCycle,
  scaleCardioDurationMin,
  setActiveCardioCycle,
  CARDIO_CYCLES_KEY,
  type CardioCycle,
  type CardioPrepPlanLike,
  type CardioSession,
} from '../cardio.engine';
import { buildCardioCycleFromTemplateId } from '../cardio-templates.engine';
import { getCardioIntervalPreset } from '../cardio-interval-presets.engine';

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

describe('экспорт: структура не теряется в печати и тексте', () => {
  it('⚡-подпись есть в печатном плане, копируемой сводке и календаре', () => {
    const c = withWeekSession(baseCycle(2), 1, structuredSession('hiit', 30, { workSec: 30, restSec: 30, reps: 8 }));
    const html = buildCardioPrintHtml(c);
    const text = buildCardioSummaryText(c);
    const ics = buildCardioIcs(c, '2026-11-02');
    expect(html).toContain('⚡ 8×30 с/30 с');
    expect(text).toContain('⚡ 8×30 с/30 с');
    expect(ics).toContain('⚡ 8×30 с/30 с');
  });

  it('structureLabel описывает все блоки, а не только первый', () => {
    const plan = buildCardioIntervalPlan({
      type: 'hiit',
      durationMin: 60,
      structured: [
        { workSec: 240, restSec: 180, reps: 4 },
        { workSec: 30, restSec: 30, reps: 8 },
      ],
    })!;
    expect(plan.structureLabel).toBe('4×4 мин/3 мин + 8×30 с/30 с');
    expect(plan.blockCount).toBe(2);
    expect(plan.workSteps).toBe(12);
  });
});

describe('превью-протокол не выдаёт эвристику за структуру', () => {
  it('HIIT/MISS без structured: отрезки помечены как ориентир, таймер ведёт ровно', () => {
    for (const type of ['hiit', 'miss'] as const) {
      const phases = cardioSessionProtocol({ type, durationMin: 30 });
      const main = phases.find(p => p.name === 'Интервалы' || p.name === 'Темповые отрезки')!;
      expect(main.note).toContain('структура не задана');
      expect(main.note).toContain('ровным темпом');
    }
  });

  it('со structured такой пометки нет — это реальные отрезки', () => {
    const phases = cardioSessionProtocol({
      type: 'hiit', durationMin: 30, structured: [{ workSec: 30, restSec: 30, reps: 8 }],
    });
    const main = phases.find(p => p.name === 'Интервалы')!;
    expect(main.note).not.toContain('не задана');
    expect(main.note).toContain('8×30 с');
  });
});

describe('старые циклы и напоминания календаря', () => {
  it('legacy: durationMin короче структуры — при чтении поднимается, ккал и итоги пересчитаны', () => {
    const legacy = withWeekSession(baseCycle(2), 1, structuredSession('hiit', 24, LONG_BLOCK)); // структура 36 мин
    localStorage.setItem(CARDIO_CYCLES_KEY, JSON.stringify([legacy]));

    const loaded = loadCardioCycles()[0];
    const s = loaded.weeks[0].sessions[0];
    expect(s.durationMin).toBe(36);
    expect(loaded.weeks[0].totalMinutes).toBe(36);
    expect(loaded.weeks[0].totalKcal).toBe(s.kcalPerSession);
    expect(brokenStructure(loaded)).toEqual([]);

    setActiveCardioCycle(legacy);
    expect(loadActiveCardioCycle()!.weeks[0].sessions[0].durationMin).toBe(36);
  });

  it('валидный цикл нормализация не трогает', () => {
    const ok = withWeekSession(baseCycle(2), 1, structuredSession('hiit', 36, LONG_BLOCK));
    expect(normalizeCardioCycle(ok)).toBe(ok);
    localStorage.setItem(CARDIO_CYCLES_KEY, JSON.stringify([ok]));
    expect(loadCardioCycles()[0].weeks[0].totalMinutes).toBe(ok.weeks[0].totalMinutes);
  });

  it('.ics несёт напоминание за час до сессии', () => {
    const c = withWeekSession(baseCycle(2), 1, structuredSession('hiit', 36, LONG_BLOCK));
    const ics = buildCardioIcs(c, '2026-11-02');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT60M');
    expect(ics).toContain('ACTION:DISPLAY');
  });
});

describe('числовая цель отрезка не теряется', () => {
  it('RPE и мощность попадают в таймер и превью', () => {
    const rpe = [{ workSec: 30, restSec: 30, reps: 4, target: 'rpe' as const, targetValue: 8 }];
    const plan = buildCardioIntervalPlan({ type: 'hiit', durationMin: 30, structured: rpe })!;
    expect(plan.steps.find(s => s.kind === 'work')!.note).toContain('RPE 8');
    const proto = cardioSessionProtocol({ type: 'hiit', durationMin: 30, structured: rpe });
    expect(proto.find(p => p.name === 'Интервалы')!.note).toContain('RPE 8');

    const powerPlan = buildCardioIntervalPlan({
      type: 'miss', durationMin: 30,
      structured: [{ workSec: 120, restSec: 60, reps: 4, target: 'power', targetValue: 250 }],
    })!;
    expect(powerPlan.steps.find(s => s.kind === 'work')!.note).toContain('250 Вт');
  });

  it('у цели «пульс» числовая метка не выдумывается', () => {
    const plan = buildCardioIntervalPlan({
      type: 'hiit', durationMin: 30,
      structured: [{ workSec: 30, restSec: 30, reps: 4, target: 'hr', targetHr: { min: 150, max: 170 }, targetValue: 8 }],
    })!;
    const work = plan.steps.find(s => s.kind === 'work')!;
    expect(work.note ?? '').not.toContain('RPE');
    expect(work.hrZone).toEqual({ min: 150, max: 170 });
  });
});

describe('дистанционные интервалы: метры и темп', () => {
  const DIST_BLOCK = { workSec: 90, restSec: 90, reps: 8, target: 'pace' as const, targetValue: 240, distanceM: 400 };

  it('время работы считается из дистанции и темпа, подпись показывает метры', () => {
    const plan = buildCardioIntervalPlan({ type: 'hiit', durationMin: 40, structured: [DIST_BLOCK] })!;
    const work = plan.steps.filter(s => s.kind === 'work');
    expect(work).toHaveLength(8);
    // 400 м × 4:00/км = 96 с, а не оставшиеся в данных 90 с.
    expect(work[0].sec).toBe(96);
    expect(work[0].label).toContain('400 м');
    expect(work[0].note).toContain('4:00/км');
    expect(work[0].distanceM).toBe(400);
    expect(plan.workSec).toBe(96);
    expect(plan.structureLabel).toBe('8×400 м/1:30');
    expect(cardioStructuredMainSec([DIST_BLOCK])).toBe((96 + 90) * 8);
  });

  it('дистанция без темпа не выдумывает время — остаётся заданный workSec', () => {
    const row = { workSec: 360, restSec: 180, reps: 4, target: 'pace' as const, distanceM: 1500 };
    const plan = buildCardioIntervalPlan({ type: 'hiit', durationMin: 40, structured: [row] })!;
    expect(plan.steps.find(s => s.kind === 'work')!.sec).toBe(360);
    expect(plan.structureLabel).toBe('4×1500 м/3 мин');
  });

  it('метры и темп попадают в печать, сводку, календарь, TCX и протокол', () => {
    const c = withWeekSession(baseCycle(2), 1, structuredSession('hiit', 40, DIST_BLOCK));
    expect(buildCardioPrintHtml(c)).toContain('8×400 м/1:30');
    expect(buildCardioSummaryText(c)).toContain('8×400 м/1:30');
    expect(buildCardioIcs(c, '2026-11-02')).toContain('8×400 м/1:30');
    expect(buildCardioTcx(c, '2026-11-02')).toContain('<DistanceMeters>400</DistanceMeters>');

    const proto = cardioSessionProtocol({ type: 'hiit', durationMin: 40, structured: [DIST_BLOCK] });
    const main = proto.find(p => p.name === 'Интервалы')!;
    expect(main.note).toContain('400 м');
    expect(main.note).toContain('4:00/км');
  });

  it('пресет гребли несёт дистанцию 1500 м и не выдумывает темп', () => {
    const preset = getCardioIntervalPreset('row-4x1500')!;
    const block = preset.build({});
    expect(block.distanceM).toBe(1500);
    expect(block.targetValue).toBeUndefined();
  });
});

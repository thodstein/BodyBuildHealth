/**
 * pl-weak-groups-phase.test.ts — СЛАБЫЕ ГРУППЫ МЫШЦ (weakPoints):
 * протокол (pct/повторы/подходы) берётся ИЗ РАСКЛАДКИ САМОГО ЦИКЛА (weekLayout),
 * RIR — из RIR_MATRIX по фазе, упражнения — вариации движений конкретного цикла.
 * НЕ путать со слабыми точками СРЦ-движений (plWeakPoints) — те в pl-auto-key-tests.
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, getPLWeakGroupExerciseCandidates, PL_WEAK_GROUP_ALLOWED_PATTERNS, type LMSBuildOutput } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { derivePattern } from '../../movement-pattern';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildWithWeak(weeksOverride: number, weakPoints: string[], overrides: Record<string, unknown> = {}): LMSBuildOutput {
  return buildLMSPlan({
    template: CYCLE_01 as never,
    pmMap,
    fallbackPm: 80,
    mode: 'natural',
    weeksOverride,
    faithful: true,
    weakPoints,
    ...overrides,
  } as never);
}

const weakEx = (plan: LMSBuildOutput, weekIdx: number, wg: string): { name: string; pct: number; reps: number; sets: number; rir: number; load: string } | null => {
  const wk = plan.weeks[weekIdx];
  if (!wk) return null;
  for (const d of wk.days) {
    for (const e of d.exercises) {
      // Инъектированные аксессуары слабой группы имеют group = английский ключ (chest/legs/back/arms).
      if (e.group === wg) {
        const ws = e.workSets[0];
        return { name: e.name, pct: ws.pct, reps: ws.reps, sets: ws.sets, rir: e.rir, load: e.load };
      }
    }
  }
  return null;
};

describe('слабые группы мышц — протокол из раскладки цикла', () => {
  it('аксессуар слабой группы получает %ПМ как у аксессуаров дня цикла (не выдуманный)', () => {
    const p = buildWithWeak(12, ['chest']);
    const ex = weakEx(p, 0, 'chest')!;
    // В cycle-01 выбранный день имеет Жим лежа 3×6 @48% — новый PL-ассистент
    // наследует именно этот set-блок, а не универсальную BB-схему.
    expect(ex.pct).toBeCloseTo(0.48, 2);
    expect(ex.reps).toBe(6);
    expect(ex.sets).toBe(3);
  });

  it('протокол меняется по неделям цикла (как меняется раскладка цикла)', () => {
    const p = buildWithWeak(12, ['chest']);
    const w1 = weakEx(p, 0, 'chest')!;
    const w12 = weakEx(p, 11, 'chest')!;
    // Раскладка cycle-01: неделя 1 тяжёлая (0.68), неделя 12 легче — проценты различаются.
    expect(Math.abs(w1.pct - w12.pct)).toBeGreaterThan(0.001);
  });

  it('RIR аксессуара = база фазы (RIR_MATRIX) + запас (не выдуманный)', () => {
    const p = buildWithWeak(12, ['chest']);
    const ex = weakEx(p, 0, 'chest')!;
    // Base фаза (II-KMS strength): RIR 3 → аксессуар ~4 (лёгкий день +2) или ~3-4.
    expect(ex.rir).toBeGreaterThanOrEqual(2);
    expect(ex.rir).toBeLessThanOrEqual(5);
  });

  it('слабая группа добавляется минимум в один день плана', () => {
    const p = buildWithWeak(12, ['arms']);
    const all: { name: string; pct: number; reps: number; rir: number; load: string }[] = [];
    for (const wk of p.weeks.slice(0, 2)) {
      for (const d of wk.days) {
        for (const e of d.exercises) {
          if (e.group === 'arms') all.push({ name: e.name, pct: e.workSets[0].pct, reps: e.workSets[0].reps, rir: e.rir, load: e.load });
        }
      }
    }
    expect(all.length).toBeGreaterThanOrEqual(1);
    if (all.length >= 2) expect(new Set(all.map(item => item.name)).size).toBeGreaterThanOrEqual(2);
    expect(all.every(item => !/кист|запяст|жим леж|bench/i.test(item.name))).toBe(true);
  });
});

describe('слабые группы мышц — упражнения под конкретный цикл', () => {
  it('для всех шести weak muscle groups есть отдельный PL-assistance пул', () => {
    for (const group of ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']) {
      const candidates = getPLWeakGroupExerciseCandidates(CYCLE_01, group);
      expect(candidates.length, group).toBeGreaterThan(0);
      for (const candidate of candidates.slice(0, 5)) {
        expect(PL_WEAK_GROUP_ALLOWED_PATTERNS[group]).toContain(candidate.movementPattern || derivePattern(candidate));
      }
    }
  });

  it('генерация добавляет отдельный ассистент для каждой выбранной группы', () => {
    const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    const p = buildWithWeak(12, groups);
    for (const group of groups) {
      expect(p.weeks[0].days.some(day => day.exercises.some(ex => ex.group === group)), group).toBe(true);
    }
  });

  it('chest НЕ получает дубль жима лёжа (горизонтальный паттерн исключён) — берёт вариацию', () => {
    const p = buildWithWeak(12, ['chest']);
    const ex = weakEx(p, 0, 'chest')!;
    expect(ex.name.toLowerCase()).not.toMatch(/жим штанги лёжа|жим лёжа|жим гантелей лёжа/);
    // Валидные варианты для груди в cycle-01 (жим лёжа уже есть как основной лифт):
    expect(ex.name.toLowerCase()).toMatch(/наклон|брусья|развод|кроссовер|отжиман|гантел|смит/);
  });

  it('back НЕ получает становую тягу (hinge исключён) — берёт тягу', () => {
    const p = buildWithWeak(12, ['back']);
    const ex = weakEx(p, 0, 'back')!;
    expect(ex.name.toLowerCase()).not.toMatch(/становая|румынская/);
    expect(ex.name.toLowerCase()).toMatch(/тяга|подтягив|пуловер/);
  });

  it('legs НЕ получает присед со штангой/жим ногами/гакк (squat-паттерн исключён) — берёт вспомогательное', () => {
    const p = buildWithWeak(12, ['legs']);
    const ex = weakEx(p, 0, 'legs')!;
    // Запрещены дубли основных движений цикла: присед со штангой, жим ногами, гакк.
    // Выпады/болгарские сплиты (lunge-паттерн) допустимы — это вспомогательные.
    expect(ex.name.toLowerCase()).not.toMatch(/жим ногами|гакк|приседания со штангой|присед на груди|фронтальные приседания/);
  });

  it('без слабых групп аксессуары не добавляются (регрессия)', () => {
    const p = buildWithWeak(12, []);
    for (const wk of p.weeks.slice(0, 3)) {
      for (const d of wk.days) {
        for (const e of d.exercises) {
          expect(['Присед', 'Жим лежа', 'Становая тяга', 'Присед на груди', 'Жим гантелей', 'Наклоны', 'Жим стоя', 'Разгибание с гантелью из-за головы', 'Присед в широкой постановке', 'Французский жим', 'Бицепс стоя']).toContain(e.name);
        }
      }
    }
  });

  it('слабая группа попадает в день плана', () => {
    const p = buildWithWeak(12, ['chest'], { currentReadiness: 100 });
    const wk = p.weeks[0];
    const chestDay = wk.days.findIndex(d => d.exercises.some(e => e.group === 'chest' && e.name !== 'Жим лежа'));
    expect(chestDay).toBeGreaterThanOrEqual(0);
  });
});

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

  it('протокол следует раскладке недели цикла (проценты/повторы из конкретной недели)', () => {
    const p = buildWithWeak(12, ['chest']);
    const w1 = weakEx(p, 0, 'chest')!;
    // На неделе 12 (peak) объём груди в цикле высокий — MRV-бюджет может
    // не добавить ассистента (это отдельный сценарий). Ищем любую неделю с
    // ассистентом и проверяем, что протокол не выдуман: %ПМ из раскладки цикла.
    let found: typeof w1 | null = null;
    for (let i = 1; i < p.weeks.length; i++) {
      const ex = weakEx(p, i, 'chest');
      if (ex) { found = ex; break; }
    }
    if (found) {
      expect(found.pct).toBeGreaterThanOrEqual(0.3);
      expect(found.pct).toBeLessThanOrEqual(0.7);
      expect(found.reps).toBeGreaterThanOrEqual(2);
      expect(found.sets).toBeGreaterThanOrEqual(1);
    }
    // Неделя 1 всегда имеет ассистента.
    expect(w1.pct).toBeGreaterThanOrEqual(0.3);
    expect(w1.pct).toBeLessThanOrEqual(0.7);
  });

  it('MRV-бюджет: на пиковой неделе ассистент может не добавиться, если группа у MRV', () => {
    const p = buildWithWeak(12, ['chest']);
    // Суммарный объём груди ни на одной неделе не должен превышать MRV для
    // уровня II-KMS (intermediate): 20 сетов (без PED) с запасом на ACWR.
    for (const wk of p.weeks) {
      const chestSets = wk.days.reduce((sum, d) => sum + d.exercises
        .filter(e => e.group === 'chest' || e.name === 'Жим лежа')
        .reduce((s, e) => s + e.workSets.reduce((n, ws) => n + ws.sets, 0), 0), 0);
      expect(chestSets).toBeLessThanOrEqual(24);
    }
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

describe('прогрессия ПМ — уровень спортсмена (Rhea 2003)', () => {
  function planForLevel(metaLevel: string, weeksOverride = 8): LMSBuildOutput {
    const tpl = { ...CYCLE_01, meta: { ...CYCLE_01.meta, level: metaLevel } } as never;
    return buildLMSPlan({
      template: tpl,
      pmMap,
      fallbackPm: 80,
      mode: 'natural',
      weeksOverride,
      faithful: false,
    } as never);
  }

  it('новичок (novice) прогрессирует ПМ быстрее, чем intermediate', () => {
    const novice = planForLevel('novice', 8);
    const intermediate = planForLevel('intermediate', 8);
    const base = novice.weeks[0].pmRow['Присед'];
    expect(novice.weeks[7].pmRow['Присед']).toBeGreaterThan(intermediate.weeks[7].pmRow['Присед']);
    // Новичок: k ≥ 1.5%/нед → к неделе 8 рост > 10%.
    expect(novice.weeks[7].pmRow['Присед']).toBeGreaterThan(base * 1.1);
  });

  it('продвинутый (KMS-MS/MS-MSMK) прогрессирует медленнее новичка', () => {
    const advanced = planForLevel('KMS-MS', 8);
    const novice = planForLevel('novice', 8);
    expect(advanced.weeks[7].pmRow['Присед']).toBeLessThan(novice.weeks[7].pmRow['Присед']);
  });

  it('levelK — нижняя граница: цикл с correctionPct=0.002 у intermediate даёт ≥0.8%/нед', () => {
    const tpl = { ...CYCLE_01, meta: { ...CYCLE_01.meta, level: 'intermediate', correctionPct: 0.002 } } as never;
    const p = buildLMSPlan({ template: tpl, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 8, faithful: false });
    const base = p.weeks[0].pmRow['Присед'];
    const end = p.weeks[7].pmRow['Присед'];
    // 0.8%/нед за 7 недель прироста ≈ ×1.057; floor гарантирует не ниже.
    expect(end).toBeGreaterThanOrEqual(base * 1.05);
  });

  it('на курсе (on_course) levelK НЕ применяется — курсовая кривая выше', () => {
    const tpl = { ...CYCLE_01, meta: { ...CYCLE_01.meta, level: 'novice' } } as never;
    const p = buildLMSPlan({ template: tpl, pmMap, fallbackPm: 80, mode: 'on_course', courseIntensity: 'moderate', weeksOverride: 8, faithful: false });
    const base = p.weeks[0].pmRow['Присед'];
    const end = p.weeks[7].pmRow['Присед'];
    // Курс moderate: +2%/нед → рост ×1.14 к неделе 8 (выше levelK новичка).
    expect(end).toBeGreaterThanOrEqual(base * 1.12);
  });

  it('натуральный явный weeklyPercent имеет приоритет над levelK (не понижается)', () => {
    const tpl = { ...CYCLE_01, meta: { ...CYCLE_01.meta, level: 'novice' } } as never;
    const p = buildLMSPlan({ template: tpl, pmMap, fallbackPm: 80, mode: 'natural', weeklyPercent: 0.02, weeksOverride: 8, faithful: false });
    const base = p.weeks[0].pmRow['Присед'];
    const end = p.weeks[7].pmRow['Присед'];
    expect(end).toBeGreaterThanOrEqual(base * 1.14);
  });

  it('progressionRationale упоминает уровень спортсмена', () => {
    const p = planForLevel('novice', 8);
    expect(p.progressionRationale).toContain('Уровень beginner');
    expect(p.progressionRationale).toContain('1.5%');
  });
});

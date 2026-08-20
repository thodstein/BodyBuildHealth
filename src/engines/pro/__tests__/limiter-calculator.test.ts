import { describe, expect, it } from 'vitest';
import {
  LIMITER_CATEGORIES, LIMITER_OPTIONS, limiterCategoriesForLift, limiterOptionsFor,
  limiterOptionsForLift, limiterOptionById, analyzeLimiterOption, resolveLimiterExercise,
  limiterGroupForExercise, analyzeLimiterForLift, limiterProtocolFor, limiterNameGroup,
} from '../limiter-calculator.engine';
import type { LimiterCategory } from '../limiter-calculator.engine';
import type { Lift } from '../../lms/weakpoint-pl';

const ALL_LIFTS: Lift[] = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press', 'sumo', 'biceps'];
const CORE_LIFTS: Lift[] = ['bench', 'squat', 'deadlift', 'sumo', 'ohp', 'biceps'];

describe('limiter-calculator.engine: структура', () => {
  it('ровно 10 категорий с иконками/описаниями, идемпотентный индекс', () => {
    expect(LIMITER_CATEGORIES).toHaveLength(10);
    expect(LIMITER_CATEGORIES.map(c => c.id)).toEqual([
      'speed_strength', 'partial_amplitude', 'stabilization', 'contraction_mode', 'limiter_hypertrophy',
      'anthropometry', 'start_specific', 'grip_stiffness', 'coordination', 'endurance_profile',
    ]);
    for (const c of LIMITER_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(3);
      expect(c.icon).toBeTruthy();
      expect(c.description.length).toBeGreaterThan(10);
    }
  });

  it('MRV учитывается только для гипертрофии лимитирующих групп', () => {
    const byId = Object.fromEntries(LIMITER_CATEGORIES.map(c => [c.id, c]));
    expect(byId.limiter_hypertrophy.countsTowardMrv).toBe(true);
    for (const id of ['speed_strength', 'partial_amplitude', 'stabilization', 'contraction_mode', 'anthropometry', 'start_specific', 'grip_stiffness', 'coordination', 'endurance_profile'] as LimiterCategory[]) {
      expect(byId[id].countsTowardMrv).toBe(false);
    }
  });

  it('все опции валидны: протокол, помощь, ссылки, уникальные id', () => {
    const ids = new Set<string>();
    for (const o of LIMITER_OPTIONS) {
      expect(ids.has(o.id)).toBe(false);
      ids.add(o.id);
      expect(ALL_LIFTS).toContain(o.lift);
      expect(LIMITER_CATEGORIES.some(c => c.id === o.category)).toBe(true);
      expect(o.label.length).toBeGreaterThan(5);
      expect(o.description.length).toBeGreaterThan(10);
      expect(o.method.length).toBeGreaterThan(10);
      expect(o.assistance.length).toBeGreaterThanOrEqual(1);
      expect(o.references.length).toBeGreaterThanOrEqual(1);
      expect(o.protocol.sets).toBeGreaterThanOrEqual(1);
      expect(o.protocol.reps).toBeGreaterThanOrEqual(1);
      expect(o.protocol.pct).toBeGreaterThan(0);
      expect(o.protocol.pct).toBeLessThanOrEqual(1.05);
      expect(o.protocol.rir).toBeGreaterThanOrEqual(0);
    }
  });

  it('каждое ядровое движение (жим/присед/тяга/сумо/жим стоя/бицепс) покрыто ≥2 категориями', () => {
    for (const lift of CORE_LIFTS) {
      expect(limiterCategoriesForLift(lift).length, `${lift} категорий`).toBeGreaterThanOrEqual(2);
    }
  });

  it('у каждой категории есть опции хотя бы для одного движения', () => {
    for (const c of LIMITER_CATEGORIES) {
      const any = ALL_LIFTS.some(lift => limiterOptionsFor(c.id, lift).length > 0);
      expect(any, `категория ${c.id}`).toBe(true);
    }
  });

  it('limiterOptionById и limiterOptionsForLift работают', () => {
    const first = LIMITER_OPTIONS[0];
    expect(limiterOptionById(first.id)).toEqual(first);
    expect(limiterOptionById('нет_такой')).toBeUndefined();
    const allForLift = limiterOptionsForLift('bench');
    expect(allForLift.length).toBeGreaterThan(0);
    expect(allForLift.every(o => o.lift === 'bench')).toBe(true);
  });

  it('протокол опции возвращается limiterProtocolFor', () => {
    const o = LIMITER_OPTIONS[0];
    expect(limiterProtocolFor(o)).toEqual(o.protocol);
  });
});

describe('limiter-calculator.engine: качество упражнений', () => {
  it('каждая опция резолвится в ≥1 реальное упражнение пула (каталог/СРЦ)', () => {
    const unresolved: string[] = [];
    for (const o of LIMITER_OPTIONS) {
      const { items } = analyzeLimiterOption(o);
      if (items.length === 0) unresolved.push(`${o.category}/${o.id}: ${o.assistance.join(', ')}`);
    }
    expect(unresolved).toEqual([]);
  });

  it('резолвер находит и каталожные, и СРЦ-специфичные упражнения', () => {
    // Каталожные (общий каталог)
    expect(resolveLimiterExercise('Жим узким хватом')).toBeTruthy();
    expect(resolveLimiterExercise('Наклоны со штангой')).toBeTruthy();
    // СРЦ-пул (дожимы/рамы/скоростные/плинты)
    expect(resolveLimiterExercise('Дожим с 3 см')).toBeTruthy();
    expect(resolveLimiterExercise('Дожим с 5 см')).toBeTruthy();
    expect(resolveLimiterExercise('Становая тяга с плинтов')).toBeTruthy();
    expect(resolveLimiterExercise('Тяга с подчеркнутым стартом')).toBeTruthy();
    expect(resolveLimiterExercise('Тяга уступающая')).toBeTruthy();
    expect(resolveLimiterExercise('Скоростной жим')).toBeTruthy();
    expect(resolveLimiterExercise('Жим в раме (старт)')).toBeTruthy();
  });

  it('внутри опции нет дублей упражнений и у каждого есть группа', () => {
    for (const o of LIMITER_OPTIONS) {
      const { items } = analyzeLimiterOption(o);
      const names = items.map(i => i.exercise.name);
      expect(new Set(names).size, `${o.id} дублей`).toBe(names.length);
      for (const item of items) {
        expect(item.targetGroup.length).toBeGreaterThan(0);
        expect(item.pattern.length).toBeGreaterThan(0);
        expect(item.protocol).toEqual(o.protocol);
      }
    }
  });

  it('у первой опции топ-1 помечен optimal', () => {
    for (const o of LIMITER_OPTIONS) {
      const { items } = analyzeLimiterOption(o);
      if (items.length > 0) expect(items[0].optimal).toBe(true);
    }
  });

  it('анализ по движению возвращает все категории с непустыми/пустыми списками опций', () => {
    const full = analyzeLimiterForLift('bench');
    expect(Object.keys(full).length).toBe(10);
    const speedCount = full.speed_strength.length;
    expect(speedCount).toBeGreaterThanOrEqual(2);
    const biceps = analyzeLimiterForLift('biceps');
    expect(biceps.anthropometry.length).toBe(0); // у бицепса нет антропометрии
    expect(biceps.limiter_hypertrophy.length).toBeGreaterThan(0);
  });

  it('специальные методы имеют свои протоколы (скорость 8×2, дожим 4×3, эксцентрика темп)', () => {
    const speed = limiterOptionById('speed_bench_start')!;
    expect(speed.protocol.sets).toBe(8);
    expect(speed.protocol.reps).toBe(2);
    expect(speed.protocol.pct).toBe(0.55);
    const partial = limiterOptionById('partial_bench_lockout')!;
    expect(partial.protocol.pct).toBeGreaterThanOrEqual(0.8);
    const ecc = limiterOptionById('mode_squat_ecc')!;
    expect(ecc.protocol.tempo).toMatch(/6/);
    const iso = limiterOptionById('mode_bench_iso')!;
    expect(iso.protocol.holdSec).toBeGreaterThanOrEqual(3);
  });

  it('ВСЕ 9 движений покрыты хотя бы одной категорией (нет мёртвых движений)', () => {
    for (const lift of ALL_LIFTS) {
      expect(limiterCategoriesForLift(lift).length, `${lift} категорий`).toBeGreaterThanOrEqual(1);
    }
    expect(limiterCategoriesForLift('row').length).toBeGreaterThanOrEqual(2);
    expect(limiterCategoriesForLift('pulldown').length).toBeGreaterThanOrEqual(1);
    expect(limiterCategoriesForLift('incline_press').length).toBeGreaterThanOrEqual(2);
  });

  it('классификатор групп ПО ИМЕНИ: бицепс→arms, присед→legs, наклонный жим→chest', () => {
    expect(limiterNameGroup('Бицепс стоя')).toBe('arms');
    expect(limiterNameGroup('Бицепс с гантелями')).toBe('arms');
    expect(limiterNameGroup('Молотковые сгибания')).toBe('arms');
    expect(limiterNameGroup('Французский жим')).toBe('arms');
    expect(limiterNameGroup('Жим узким хватом')).toBe('arms');
    expect(limiterNameGroup('Сгибания кисти стоя')).toBe('arms');
    expect(limiterNameGroup('Присед')).toBe('legs');
    expect(limiterNameGroup('Присед на ящик (box squat)')).toBe('legs');
    expect(limiterNameGroup('Жим ногами')).toBe('legs');
    expect(limiterNameGroup('Разгибания ног в тренажёре')).toBe('legs');
    expect(limiterNameGroup('Сгибание ног лёжа (бицепс бедра)')).toBe('legs');
    expect(limiterNameGroup('Жим на наклонной')).toBe('chest');
    expect(limiterNameGroup('Жим штанги на наклонной (30°)')).toBe('chest');
    expect(limiterNameGroup('Скоростной жим')).toBe('chest');
    expect(limiterNameGroup('Дожим с 3 см')).toBe('chest');
    expect(limiterNameGroup('Тяга с плинтов (rack pull)')).toBe('back');
    expect(limiterNameGroup('Становая тяга с дефицитом')).toBe('back');
    expect(limiterNameGroup('Наклоны со штангой')).toBe('back');
    expect(limiterNameGroup('Гиперэкстензия')).toBe('back');
    expect(limiterNameGroup('Армейский жим')).toBe('shoulders');
    expect(limiterNameGroup('Махи гантелями в стороны')).toBe('shoulders');
    expect(limiterGroupForExercise('Бицепс стоя')).toBe('arms');
  });

  it('скобко-точный резолв: «Жим в раме (старт)» ≠ «Жим в раме (дожим)»', () => {
    expect(resolveLimiterExercise('Жим в раме (старт)')?.name).toBe('Жим в раме (старт)');
    expect(resolveLimiterExercise('Жим в раме (дожим)')?.name).toBe('Жим в раме (дожим)');
    expect(resolveLimiterExercise('Жим с досок (board press)')?.name).toBe('Жим с досок (board press)');
    expect(resolveLimiterExercise('Присед на ящик (box squat)')?.name).toBe('Присед на ящик (box squat)');
    expect(resolveLimiterExercise('Присед Андерсона (со дна)')?.name).toBe('Присед Андерсона (со дна)');
  });

  it('реальные упражнения из базы резолвятся точно (метод-оверлеи переведены в отдельные)', () => {
    for (const n of ['Темповой присед (5-3-0)', 'Присед на ящик (box squat)', 'Присед Андерсона (со дна)',
      'Тяга с плинтов (rack pull)', 'Становая тяга с дефицитом', 'Становая тяга с паузой ниже колен',
      'Жим с пинков (pin press)', 'Жим Спото (пауза над грудью)', 'Удержание штанги в становой',
      'Жим с цепями', 'Жим с резиновыми лентами', 'Гудморнинг (наклоны со штангой)',
      'Сгибание ног лёжа (бицепс бедра)', 'Разгибания ног в тренажёре', 'Фронтальный присед']) {
      expect(resolveLimiterExercise(n)?.name, n).toBe(n);
    }
  });

  it('метод-оверлеи не используют только основное движение (всё впрыскиваемо)', () => {
    // Ни одна опция не имеет assistance, состоящий ТОЛЬКО из названия основного лифта.
    const MAIN = new Set(['Присед', 'Жим лежа', 'Становая тяга', 'Жим стоя', 'Подъём на бицепс']);
    for (const o of LIMITER_OPTIONS) {
      if (o.methodOverlay) continue;
      const allMain = o.assistance.every(n => MAIN.has(n));
      expect(allMain, `опция ${o.id} состоит только из основного движения`).toBe(false);
    }
  });
});

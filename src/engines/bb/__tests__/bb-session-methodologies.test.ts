import { describe, expect, it } from 'vitest';
import { orderSessionExercises } from '../bb-session-order.engine';

const mk = (o: any) => ({
  name: o.name, muscle: o.muscle || 'chest', role: o.role || 'accessory',
  character: o.character || 'памп', rir: o.rir ?? 2, sets: 3,
  workSets: [{ reps: o.reps ?? 12, rir: o.rir ?? 2, weight: 20 }],
  ...o,
});

const HEAVY = () => mk({ name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', rir: 1, reps: 6 });
const ACTIVATION = () => mk({ name: 'Разводка гантелей лёжа', character: 'памп', rir: 4, reps: 12 });
const PUMP_ISO = () => mk({ name: 'Кроссовер', character: 'памп', rir: 1, reps: 15 });
const STRETCH = () => mk({ name: 'Растяжка груди hold 30с', character: 'памп', rir: 3, reps: 12 });

describe('bb-session-order: mountain_dog / fst7 / hyperemia', () => {
  it('дефолт compound_first: тяж-compound раньше изоляций', () => {
    const out = orderSessionExercises([PUMP_ISO(), HEAVY(), ACTIVATION()], { sessionTag: 'ChestBack' });
    expect(out[0].name).toBe('Жим штанги лёжа');
  });

  it('mountain_dog: активация (RIR≥3) → тяж → памп → стретч последним', () => {
    const out = orderSessionExercises([PUMP_ISO(), STRETCH(), HEAVY(), ACTIVATION()], { sessionTag: 'ChestBack', methodology: 'mountain_dog' });
    const names = out.map(e => e.name);
    expect(names[0]).toBe('Разводка гантелей лёжа');
    expect(names[1]).toBe('Жим штанги лёжа');
    expect(names[names.length - 1]).toBe('Растяжка груди hold 30с');
  });

  it('mountain_dog: изоляция в отказ (RIR1) НЕ считается активацией', () => {
    const failIso = mk({ name: 'Разводка гантелей лёжа', character: 'памп', rir: 1, reps: 12 });
    const out = orderSessionExercises([failIso, HEAVY()], { sessionTag: 'ChestBack', methodology: 'mountain_dog' });
    expect(out[0].name).toBe('Жим штанги лёжа');
  });

  it('fst7: памп-праймер RIR≥3 первым, стретч последним', () => {
    const primer = mk({ name: 'Сведение в кроссовере', character: 'лёг', rir: 4, reps: 15 });
    const out = orderSessionExercises([PUMP_ISO(), STRETCH(), HEAVY(), primer], { sessionTag: 'ChestBack', methodology: 'fst7' });
    const names = out.map(e => e.name);
    expect(names[0]).toBe('Сведение в кроссовере');
    expect(names[names.length - 1]).toBe('Растяжка груди hold 30с');
  });

  it('hyperemia: у изоляций лёг раньше тяж (стандарт — наоборот)', () => {
    // Обе — tier-2 изоляции (не финишеры: повторы <12, характер не памп),
    // различаются только charRank.
    const heavyIso = mk({ name: 'Разводка гантелей', character: 'тяж', rir: 2, reps: 8 });
    const lightIso = mk({ name: 'Сведение в кроссовере лёгкое', character: 'лёг', rir: 2, reps: 10 });
    const std = orderSessionExercises([lightIso, heavyIso], { sessionTag: 'ChestBack' });
    expect(std[0].name).toBe('Разводка гантелей');
    const hyper = orderSessionExercises([lightIso, heavyIso], { sessionTag: 'ChestBack', methodology: 'hyperemia' });
    expect(hyper[0].name).toBe('Сведение в кроссовере лёгкое');
  });

  it('hyperemia не трогает порядок compounds (тяж-база первой)', () => {
    const out = orderSessionExercises([PUMP_ISO(), HEAVY()], { sessionTag: 'ChestBack', methodology: 'hyperemia' });
    expect(out[0].name).toBe('Жим штанги лёжа');
  });

  it('warmupActivator всегда первый при любой методике', () => {
    const warm = mk({ name: 'Разминка', character: 'лёг', rir: 5, reps: 15, warmupActivator: true, muscle: 'shoulders' });
    for (const m of ['mountain_dog', 'fst7', 'hyperemia', 'pre_exhaust'] as const) {
      const out = orderSessionExercises([HEAVY(), warm], { sessionTag: 'ChestBack', methodology: m });
      expect(out[0].name).toBe('Разминка');
    }
  });
});

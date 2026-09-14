import { describe, expect, it } from 'vitest';
import { ANGLE_CLASSES, lengthenedBonus, lengthenedBonusForExercise } from '../bb-exercise-selection.engine';
import { tempoFor } from '../bb-tempo-rest';

/** Волна-1 (аудит 2026-09): отбор упражнений — флаг-осведомлённый lengthened
 *  и живые угловые классы (seated_curl больше не перехватывается curl). */
describe('Волна-1 — lengthenedBonusForExercise (флаг каталога stretchPhase)', () => {
  it('regex-имя → бонус как раньше', () => {
    expect(lengthenedBonus('Румынская тяга', 'hypertrophy')).toBe(10);
    expect(lengthenedBonusForExercise({ name: 'Румынская тяга' }, 'hypertrophy')).toBe(10);
  });

  it('флаг stretchPhase без regex-имени → бонус выдаётся (раньше флаг не читался)', () => {
    expect(lengthenedBonus('Неизвестное упражнение', 'hypertrophy')).toBe(0);
    expect(lengthenedBonusForExercise({ name: 'Неизвестное упражнение', stretchPhase: true }, 'hypertrophy')).toBe(10);
  });

  it('focus модулирует: strength ×0.5, endurance ×1.5', () => {
    expect(lengthenedBonusForExercise({ name: 'x', stretchPhase: true }, 'strength')).toBe(5);
    expect(lengthenedBonusForExercise({ name: 'x', stretchPhase: true }, 'endurance')).toBe(15);
  });

  it('без флага и без имени → 0', () => {
    expect(lengthenedBonusForExercise({ name: 'Жим штанги лёжа' }, 'hypertrophy')).toBe(0);
  });
});

describe('Волна-1 — углы хамстрингов: seated_curl достижим', () => {
  it('«Сгибания ног сидя» → класс seated_curl (раньше перехватывал curl)', () => {
    const cls = ANGLE_CLASSES.hamstrings.find(ac => ac.match({ name: 'Сгибания ног сидя', id: 'leg_curl_seated' } as any));
    expect(cls?.name).toBe('seated_curl');
  });

  it('«Сгибания ног лёжа» → класс curl', () => {
    const cls = ANGLE_CLASSES.hamstrings.find(ac => ac.match({ name: 'Сгибания ног в тренажёре лёжа', id: 'leg_curl' } as any));
    expect(cls?.name).toBe('curl');
  });
});

describe('Волна-1 — темпы: чистка tempoFor (deload доминирует, override работает)', () => {
  it('per-exercise override применяется вне deload', () => {
    expect(tempoFor('тяж', undefined, 'accumulation', 'Румынская тяга').notation).toBe('3-1-1-0');
  });

  it('deload подавляет override — фазовый темп 4-1-1-0', () => {
    expect(tempoFor('тяж', undefined, 'deload', 'Румынская тяга').notation).toBe('4-1-1-0');
  });

  it('интенс-техника negatives → 4-0-1-0', () => {
    expect(tempoFor('тяж', 'negatives', 'accumulation').notation).toBe('4-0-1-0');
  });
});

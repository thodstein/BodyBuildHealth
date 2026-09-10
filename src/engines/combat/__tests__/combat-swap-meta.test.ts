/**
 * combat-swap-meta.test.ts — мета замены берётся из движка, фолбэк —
 * текущая группа (раньше чужой id падал в group 'core' / pattern 'unknown').
 */
import { describe, it, expect } from 'vitest';
import { cbExerciseName, resolveCombatSwapMeta } from '../combat-builder.engine';

describe('combat swap meta', () => {
  it('движковая мета для id вне локального маппинга UI', () => {
    const m = resolveCombatSwapMeta('neck_isometric_front', { name: 'Шея с упряжью', group: 'neck', pattern: 'isolation' });
    expect(m.name).toBe('Изометрия шеи фронтальная');
    expect(m.group).toBe('neck');
    expect(m.pattern).toBe('isolation');
  });

  it('неизвестный id — фолбэк текущей группы без порчи', () => {
    const fb = { name: 'Моё', group: 'neck', pattern: 'isolation' };
    expect(resolveCombatSwapMeta('nope_x', fb)).toEqual(fb);
  });

  it('cbExerciseName: RU имя или сам id', () => {
    expect(cbExerciseName('bench_bar')).toBe('Жим лёжа');
    expect(cbExerciseName('nope_x')).toBe('nope_x');
  });
});

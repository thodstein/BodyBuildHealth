import { describe, expect, it } from 'vitest';
import { checkLiftRules } from '../pl-competition-rules.engine';
import { checkRedFlags } from '../pl-red-flags.engine';

describe('pl-competition-rules', () => {
  it('squat: всё соблюдено → clean', () => {
    const r = checkLiftRules('squat', { depth: true, lockout: true, no_bounce: true, signals: true });
    expect(r.verdict).toBe('clean');
  });
  it('squat: глубина провалена → fail', () => {
    const r = checkLiftRules('squat', { depth: false, lockout: true, no_bounce: true });
    expect(r.verdict).toBe('fail');
    expect(r.failed).toContain('depth');
  });
  it('bench: пауза неизвестна → question, не fail', () => {
    const r = checkLiftRules('bench', { touch: true, lockout: true, no_down: true });
    expect(r.verdict).toBe('question');
  });
  it('нет чек-листа (biceps) → question с честным текстом', () => {
    const r = checkLiftRules('biceps', {});
    expect(r.verdict).toBe('question');
    expect(r.text).toContain('нет');
  });
});

describe('pl-red-flags', () => {
  it('пусто → не заблокировано', () => {
    expect(checkRedFlags([]).blocked).toBe(false);
  });
  it('острая боль → стоп', () => {
    const r = checkRedFlags(['sharp_pain']);
    expect(r.blocked).toBe(true);
    expect(r.text).toContain('Стоп');
  });
  it('отёк/онемение → стоп, щелчок с болью → только осторожность', () => {
    expect(checkRedFlags(['swelling']).blocked).toBe(true);
    expect(checkRedFlags(['numbness']).blocked).toBe(true);
    const c = checkRedFlags(['painful_click']);
    expect(c.blocked).toBe(false);
    expect(c.cautionItems.length).toBe(1);
  });
});

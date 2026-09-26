/**
 * bb-return-to-criteria.test.ts — П2: измеримые критерии ВЫХОДА из return-to (26.09.2026).
 *
 * Источники порогов (не выдуманы):
 * - Silbernagel KG et al. Am J Sports Med 2007;35(6):897-906 · PMID 17307888 — pain-monitoring
 *   модель: продолжать при боли ≤5/10; стоп при (а) боли не падает сразу, (б) не проходит к утру,
 *   (в) росте боли/скованности от недели к неделе.
 * - JOSPT Silbernagel Program: «pain <5/10 for 10 DL hops» — критерий входа в плиометрику.
 *
 * ГЛАВНЫЙ ИНВАРИАНТ РАУНДА: `no_data` (нет данных) НЕ должен читаться как «всё хорошо» —
 * allMet обязан быть false, пока не заполнены все 4 критерия. Это ровно тот класс дефекта,
 * который уже ловили в П1-А (вакуумные локи).
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateReturnToCriteria,
  RETURN_PAIN_MAX_LOAD,
  RETURN_PAIN_MAX_MORNING,
  type ReturnCriteriaInput,
} from '../bb-return-to.engine';

const full = (o: Partial<ReturnCriteriaInput> = {}): ReturnCriteriaInput => ({
  painDuringLoad: 3, painNextMorning: 2, morningStiffness: 'same', plyoTolerated: true, ...o,
});

describe('П2: критерии выхода из return-to', () => {
  it('пустой вход → все no_data, allMet=false (нет данных ≠ «всё хорошо»)', () => {
    const r = evaluateReturnToCriteria(null);
    expect(r.criteria).toHaveLength(4);
    expect(r.criteria.every(c => c.state === 'no_data')).toBe(true);
    expect(r.allMet).toBe(false);
    expect(r.blocked).toBe(false);
    expect(r.filled).toBe(0);
    expect(r.text).toContain('нет данных');
  });

  it('все 4 критерия met → allMet, ступень НЕ переключается сама', () => {
    const r = evaluateReturnToCriteria(full());
    expect(r.allMet).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.metCount).toBe(4);
    // важно: текст говорит «обсуждать», а не «переходим»
    expect(r.text).toMatch(/обсуждать следующую ступень/);
    expect(r.text).toMatch(/переход остаётся за вами/);
  });

  it('боль при нагрузке 5 = met, 6 = not_met (граница по источнику)', () => {
    expect(evaluateReturnToCriteria(full({ painDuringLoad: 5 })).criteria[0].state).toBe('met');
    expect(evaluateReturnToCriteria(full({ painDuringLoad: 6 })).criteria[0].state).toBe('not_met');
    expect(RETURN_PAIN_MAX_LOAD).toBe(5);
  });

  it('утренняя боль 4 = met, 5 = not_met («<5 на следующее утро»)', () => {
    expect(evaluateReturnToCriteria(full({ painNextMorning: 4 })).criteria[1].state).toBe('met');
    expect(evaluateReturnToCriteria(full({ painNextMorning: 5 })).criteria[1].state).toBe('not_met');
    expect(RETURN_PAIN_MAX_MORNING).toBe(4);
  });

  it('скованность «хуже» = not_met, «так же»/«лучше» = met', () => {
    expect(evaluateReturnToCriteria(full({ morningStiffness: 'worse' })).criteria[2].state).toBe('not_met');
    expect(evaluateReturnToCriteria(full({ morningStiffness: 'same' })).criteria[2].state).toBe('met');
    expect(evaluateReturnToCriteria(full({ morningStiffness: 'better' })).criteria[2].state).toBe('met');
  });

  it('плиометрика не терпится → not_met (риск сухожилия), терпится → met', () => {
    expect(evaluateReturnToCriteria(full({ plyoTolerated: false })).criteria[3].state).toBe('not_met');
    expect(evaluateReturnToCriteria(full({ plyoTolerated: true })).criteria[3].state).toBe('met');
  });

  it('провал блокирует allMet и перечисляет проваливший критерий', () => {
    const r = evaluateReturnToCriteria(full({ painDuringLoad: 7, plyoTolerated: false }));
    expect(r.allMet).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.text).toContain('Боль при нагрузке');
    expect(r.text).toContain('Плиометрика');
  });

  it('частичный ввод: allMet=false даже если введённые критерии met', () => {
    const r = evaluateReturnToCriteria({ painDuringLoad: 2, painNextMorning: 1 });
    expect(r.metCount).toBe(2);
    expect(r.filled).toBe(2);
    expect(r.allMet).toBe(false);
    expect(r.text).toMatch(/Заполнено 2 из 4/);
  });

  it('у каждого критерия есть источник и проверяемое правило (не «по ощущениям»)', () => {
    const r = evaluateReturnToCriteria(full());
    for (const c of r.criteria) {
      expect(c.source.length).toBeGreaterThan(10);
      expect(c.rule).toMatch(/\d|не растёт/);
    }
    expect(r.criteria[0].source).toContain('17307888');
    expect(r.criteria[3].source).toContain('PMC8364697');
  });

  it('оговорка честная: 5/10 — эвристика, не диагноз и не автопереход', () => {
    const r = evaluateReturnToCriteria(full());
    expect(r.note).toContain('эвристика');
    expect(r.note).toMatch(/не валидировался/i);
    expect(r.note).toMatch(/НЕ диагноз/);
    expect(r.note).toMatch(/НЕ автопереход/);
  });

  it('мусорные входы не ломают и не превращаются в «met»', () => {
    const r = evaluateReturnToCriteria({ painDuringLoad: NaN, painNextMorning: 'abc' as never, morningStiffness: 'worse' as never });
    expect(r.criteria[0].state).toBe('no_data');
    expect(r.criteria[1].state).toBe('no_data');
    expect(r.criteria[2].state).toBe('not_met');
    expect(r.allMet).toBe(false);
  });

  /* Регресс (пойман UI-тестом 26.09.2026): null/'' не должны превращаться в 0.
   * Number(null) === 0 и Number('') === 0 — из-за этого незаполненное поле
   * читалось как «боль 0 → met», то есть пустой чек-лист врал, что критерий выполнен. */
  it('null и пустая строка = «нет данных», а НЕ «боль 0 → met»', () => {
    const r = evaluateReturnToCriteria({ painDuringLoad: null, painNextMorning: null, morningStiffness: null, plyoTolerated: null });
    expect(r.criteria.every(c => c.state === 'no_data')).toBe(true);
    expect(r.filled).toBe(0);
    expect(r.allMet).toBe(false);
    const empty = evaluateReturnToCriteria({ painDuringLoad: '' as never, painNextMorning: '  ' as never });
    expect(empty.criteria[0].state).toBe('no_data');
    expect(empty.criteria[1].state).toBe('no_data');
    // и настоящий ноль — валидные данные, met
    expect(evaluateReturnToCriteria(full({ painDuringLoad: 0 })).criteria[0].state).toBe('met');
  });
});

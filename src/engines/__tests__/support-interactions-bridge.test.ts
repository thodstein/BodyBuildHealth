/**
 * support-interactions-bridge.test.ts — этап E4: второй реестр взаимодействий
 * (`support-interactions-db.ts`, 265 записей) доходит до плана.
 *
 * Контракт адаптера:
 *  - оба конца обязаны быть в наборе id (иначе это не конфликт стека);
 *  - id плана (lowercase, `udca`) и реестра (UPPERCASE, `TUDCA`) нормализуются;
 *    префикс `PHARMA_` у реестра необязателен (`TADALAFIL` = `PHARMA_TADALAFIL`);
 *  - дубли пары схлопываются по строгости: conflict > caution > synergy,
 *    затем HIGH > MEDIUM > LOW (в реестре есть пара с противоположным смыслом).
 */
import { describe, expect, it } from 'vitest';
import { findSupportDbPairs } from '../support-plan/support-pairs';

describe('второй реестр: пары для набора id плана', () => {
  it('конфликт обоих концов находится и дедуплицируется (iron + zinc)', () => {
    const pairs = findSupportDbPairs(['iron', 'zinc']);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: 'IRON', b: 'ZINC', type: 'conflict', severity: 'MEDIUM' });
  });

  it('противоположные записи пары не дают двух ответов (berberine + metformin)', () => {
    const pairs = findSupportDbPairs(['berberine', 'metformin']);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].type).toBe('caution');
  });

  it('алиас плана и префикс PHARMA_ резолвятся (tadalafil + citrulline)', () => {
    const pairs = findSupportDbPairs(['tadalafil', 'citrulline']);
    expect(pairs.some((p) => p.type === 'conflict' && p.aId === 'citrulline' && p.bId === 'tadalafil')).toBe(true);
  });

  it('канонический алиас плана работает (udca → TUDCA)', () => {
    const pairs = findSupportDbPairs(['udca', 'nac']);
    expect(pairs.some((p) => p.type === 'synergy' && p.a === 'NAC' && p.b === 'TUDCA')).toBe(true);
  });

  it('один конец — не пара: витамин K2 без варфарина ничего не возвращает', () => {
    expect(findSupportDbPairs(['vitamin_k2'])).toEqual([]);
  });

  it('класс-псевдоним не разворачивается в конкретный препарат', () => {
    // WARFARIN + VITAMIN_K2 есть; ANTI-COAGULANTS-класс без варфарина — нет пары.
    expect(findSupportDbPairs(['vitamin_k2', 'aspirin']).some((p) => p.a === 'WARFARIN')).toBe(false);
  });
});

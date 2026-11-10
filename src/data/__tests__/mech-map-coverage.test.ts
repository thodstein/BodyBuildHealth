/**
 * mech-map-coverage.test.ts — guard покрытия каталога механизм-моделью.
 *
 * Аудит 2026-11: 67 из 521 вещества каталога молча давали 0 вклада в покрытие
 * риска (регистровые дубли `NAC`/`TUDCA` + 15 реальных пробелов: цинк, селен,
 * куркумин, AI/SERM…). Эти тесты фиксируют, что пробел не вернётся:
 *  - весь каталог резолвится хотя бы в один механизм;
 *  - индекс механизмов содержит все id каталога;
 *  - кураторские (доказательные) записи НЕ перетираются производной оценкой;
 *  - производная оценка консервативна (q='C', k ≤ 0.12);
 *  - все препараты PHARMA_DB имеют запись в DRUG_DB.
 */
import { describe, it, expect } from 'vitest';
import {
  canonSupportId,
  deriveFromCatalog,
  getSupportMechIndex,
  getSupportMechs,
  isCuratedSupport,
  listUnmappedSupportIds,
  DERIVED_SOURCE,
} from '../support-db/mech-map';
import { SUPPORT_CATALOG_DATA } from '../support-catalog-data';
import { DRUG_DB, TZ_MECH_LABELS } from '../support-db';
import { PHARMA_DB } from '../../core/pharma-database';
import { resolvePedAlias } from '../ped-alias-map';

describe('покрытие каталога механизмами ТЗ', () => {
  it('нет веществ каталога без механизмов', () => {
    expect(listUnmappedSupportIds()).toEqual([]);
  });

  it('индекс механизмов содержит каждый id каталога', () => {
    const index = getSupportMechIndex();
    const missing = Object.keys(SUPPORT_CATALOG_DATA).filter(id => !index[id] || index[id].length === 0);
    expect(missing).toEqual([]);
  });

  it('все механизмы индекса существуют в модели ТЗ и имеют валидные q/k', () => {
    const knownMechs = new Set(Object.keys(TZ_MECH_LABELS));
    for (const [id, list] of Object.entries(getSupportMechIndex())) {
      for (const e of list) {
        // Механизм обязан быть одним из 28 механизмов спецификации — иначе
        // запись молча не участвовала бы в расчёте риска.
        expect(knownMechs.has(e.mechId), `${id}: неизвестный механизм ${e.mechId}`).toBe(true);
        expect(['A', 'B', 'C'], `${id}: q`).toContain(e.q);
        expect(Number.isFinite(e.k), `${id}: k`).toBe(true);
        expect(e.k, `${id}: k>=0`).toBeGreaterThanOrEqual(0);
        expect(e.k, `${id}: k<=1`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('кураторские записи не перетираются', () => {
  it('NAC остаётся доказательной записью (не производной)', () => {
    const list = getSupportMechs('nac');
    expect(list.length).toBeGreaterThan(0);
    expect(isCuratedSupport('nac')).toBe(true);
    expect(list.some(e => e.source === DERIVED_SOURCE)).toBe(false);
  });

  it('регистр id не меняет состав механизмов', () => {
    expect(getSupportMechs('NAC')).toEqual(getSupportMechs('nac'));
    expect(getSupportMechs('TUDCA')).toEqual(getSupportMechs('tudca'));
  });

  it('новые явные доработки находятся (zinc/selenium/curcumin)', () => {
    for (const id of ['zinc_sup', 'selenium_sup', 'curcumin_sup']) {
      const list = getSupportMechs(id);
      expect(list.length, id).toBeGreaterThan(0);
      expect(isCuratedSupport(id), id).toBe(true);
    }
  });
});

describe('производная оценка консервативна', () => {
  it('все производные механизмы q=C и k ≤ 0.12', () => {
    // Берём вещество каталога БЕЗ кураторской записи.
    const candidate = Object.keys(SUPPORT_CATALOG_DATA).find(
      id => !isCuratedSupport(id) && deriveFromCatalog(canonSupportId(id)).length > 0,
    );
    expect(candidate, 'нужен хотя бы один производный случай').toBeTruthy();
    const derived = deriveFromCatalog(canonSupportId(candidate!));
    for (const e of derived) {
      expect(e.q).toBe('C');
      expect(e.k).toBeLessThanOrEqual(0.12);
      expect(e.source).toBe(DERIVED_SOURCE);
    }
  });

  it('канонизация не ломает известные id', () => {
    expect(canonSupportId('NAC')).toBe('nac');
    expect(canonSupportId('  Zinc_Sup ')).toBe('zinc_sup');
    expect(canonSupportId('')).toBe('');
  });
});

describe('препараты PHARMA_DB покрыты DRUG_DB', () => {
  it('каждый препарат курса резолвится в модель риска', () => {
    const missing: string[] = [];
    for (const id of Object.keys(PHARMA_DB)) {
      const key = resolvePedAlias(id);
      const entry = DRUG_DB[key] || DRUG_DB[String(id).toLowerCase()];
      if (!entry || !entry.mechanismWeights || Object.keys(entry.mechanismWeights).length === 0) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });
});

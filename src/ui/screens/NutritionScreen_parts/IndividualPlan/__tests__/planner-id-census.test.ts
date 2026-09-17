/**
 * planner-id-census.test.ts — ЦЕНЗ ПРОДУКТОВ: дрейф id экзотики.
 *
 * История: реальные id шардов FOOD_DB дважды проскакивали мимо гейтов
 * (`fruit_salak`, `fruit_papaya_fresh`, `fruit_tamarind`, `fruit_loquat`,
 * `greens_watercress`, `veg_fennel`…) — канонические двойники в EXOTIC/SPECIALTY
 * были, а эти id генерация видела как 'core' и клала в автоплан (проба 16 дней).
 *
 * Гвард: ЛЮБОЙ id FOOD_DB с токеном экзотического продукта обязан быть непланируемым
 * по умолчанию (`foodAvailableForPlan` без preferred). Новый шард с «мангустином»
 * упадёт здесь до того, как попадёт в рацион.
 */
import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { foodAvailableForPlan, EXOTIC_FOOD_IDS, SPECIALTY_FOOD_IDS, SPECIALTY_POSITION_SUBSTITUTE } from '../food-availability';

/** Токены экзотики/нишевых продуктов из аудита дрейфа (растут вместе с находками). */
const EXOTIC_TOKENS = [
  'tamarind', 'loquat', 'salak', 'passion', 'dragonfruit', 'dragon_fruit', 'pitaya', 'pitahaya',
  'durian', 'lychee', 'rambutan', 'mangosteen', 'cherimoya', 'jackfruit', 'starfruit', 'soursop',
  'ugli', 'acai', 'goji', 'medlar', 'sapodilla', 'boysenberry', 'cloudberry', 'loganberry',
  'elderberry', 'pawpaw', 'feijoa', 'pomelo', 'kumquat', 'longan', 'watercress', 'fennel',
  'geoduck', 'abalone', 'sea_urchin', 'escargot', 'kangaroo', 'ostrich', 'crocodile',
];

/**
 * Документированные дрейф-двойники, ожидающие волну компенсации.
 * ВОЛНА-3 (2026-09-17): pending-5 закрыт кодом (EXOTIC-гейт + SPECIALTY_POSITION_SUBSTITUTE);
 * список обязан оставаться пустым — новый дрейф обязан падать здесь, а не расширять allowlist.
 */
const KNOWN_PENDING_LEAKS: string[] = [];

/** Закрытые волной-3 дрейф-двойники — регресс-лок (обязаны быть непланируемыми). */
const CLOSED_WAVE3 = ['sea_urchin', 'abalone', 'ostrich_egg', 'berry_acai', 'fruit_durian'];

describe('CENSUS: дрейф id экзотики — гейт держит все реальные id шардов', () => {
  it('каждый FOOD_DB-id с экзотическим токеном непланируем (кроме документированного pending-5)', () => {
    const leaks: string[] = [];
    for (const f of FOOD_DB) {
      const id = (f.id || '').toLowerCase();
      if (!EXOTIC_TOKENS.some(t => id.includes(t))) continue;
      if (!foodAvailableForPlan(f)) continue;
      if (KNOWN_PENDING_LEAKS.includes(f.id)) continue;
      leaks.push(`${f.id} (${f.category})`);
    }
    expect(leaks, `новый дрейф (не в KNOWN_PENDING_LEAKS): → ${leaks.join(', ')}`).toEqual([]);
  });

  it('pending-список пуст (pending-5 закрыт волной-3, allowlist не расширяется)', () => {
    // Если волна закрыла часть — обнови KNOWN_PENDING_LEAKS и EXOTIC/SPECIALTY; если
    // появились новые — это падение первого теста, а не расширение списка.
    expect(KNOWN_PENDING_LEAKS.length, 'pending-дрейф вырос — нужна волна гейта (см. бэклог)').toBe(0);
  });

  it('волна-3: закрытые дрейф-двойники непланируемы и имеют позиционную замену', () => {
    for (const id of CLOSED_WAVE3) {
      const f = FOOD_DB.find(x => x.id === id);
      expect(f, `FOOD_DB потерял id ${id}`).toBeTruthy();
      expect(foodAvailableForPlan(f!), `${id}: обязан быть загейчен`).toBe(false);
      expect(SPECIALTY_POSITION_SUBSTITUTE[id], `${id}: нет позиционной замены`).toBeTruthy();
    }
  });

  it('загейченные id приходят из реестров (EXOTIC/SPECIALTY), а не из случайной фильтрации', () => {
    const registry = new Set<string>([...EXOTIC_FOOD_IDS, ...SPECIALTY_FOOD_IDS]);
    const tokenHits = FOOD_DB.filter(f => EXOTIC_TOKENS.some(t => (f.id || '').toLowerCase().includes(t)));
    expect(tokenHits.length, 'ценз пуст — токены разъехались с БД').toBeGreaterThan(20);
    for (const f of tokenHits) {
      if (KNOWN_PENDING_LEAKS.includes(f.id)) continue;
      const inRegistry = registry.has(f.id);
      const plannable = foodAvailableForPlan(f);
      // Либо id в реестре и потому загейчен, либо он не попадает под гейт по другой
      // причине (консервы/соусы) — но тогда обязан быть непланируемым.
      expect(inRegistry || !plannable, `${f.id}: не в реестре, но планируем`).toBe(true);
    }
  });
});

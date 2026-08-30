/**
 * planner-id-safety.test.ts — B7 (Эпик B, NUTRITION-PLANNER-QUALITY-PLAN).
 * Инвариант: все захардкоженные списки id пулов существуют в FOOD_DB и не содержат
 * экзотику/specialty (раньше переименование/удаление id в БД ТИХО опустошало пул —
 * «протеин-ротация» без белка, fallback завтрака без углеводов).
 */
import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { HARDCODED_ID_POOLS, BREAKFAST_TEMPLATES } from '../meal-plan-engine';
import { TOPUP_PROTEIN_IDS as CORR_P, TOPUP_CARB_IDS as CORR_C, TOPUP_FAT_IDS as CORR_F } from '../day-target-corrector';
import { TOPUP_PROTEIN_IDS as RM_P, TOPUP_CARB_IDS as RM_C, TOPUP_FAT_IDS as RM_F } from '../planner-recipe-mode';
import { EXOTIC_FOOD_IDS, SPECIALTY_FOOD_IDS, MEAL_LEGAL_SUPPLEMENT_IDS } from '../food-availability';

const FOOD_IDS = new Set(FOOD_DB.map(f => f.id));

describe('B7: хардкод-пулы id существуют в FOOD_DB', () => {
  for (const [pool, ids] of Object.entries(HARDCODED_ID_POOLS)) {
    it(`пул «${pool}»: все id существуют`, () => {
      const missing = ids.filter(id => !FOOD_IDS.has(id));
      expect(missing, `отсутствуют в FOOD_DB: ${missing.join(', ')}`).toEqual([]);
    });
    it(`пул «${pool}»: нет экзотики/specialty (иначе молча фильтруются из автотарелки)`, () => {
      const bad = ids.filter(id => EXOTIC_FOOD_IDS.has(id) || SPECIALTY_FOOD_IDS.has(id));
      expect(bad, `экзотика/specialty в курируемом пуле: ${bad.join(', ')}`).toEqual([]);
    });
  }
});

describe('B7: TOPUP-пулы корректора и рецептурного режима', () => {
  const pools = { corrP: CORR_P, corrC: CORR_C, corrF: CORR_F, rmP: RM_P, rmC: RM_C, rmF: RM_F };
  for (const [name, ids] of Object.entries(pools)) {
    it(`${name}: все id существуют и доступны`, () => {
      const missing = ids.filter(id => !FOOD_IDS.has(id) || EXOTIC_FOOD_IDS.has(id) || SPECIALTY_FOOD_IDS.has(id));
      expect(missing, `${name}: ${missing.join(', ')}`).toEqual([]);
    });
  }
});

describe('B7: MEAL_LEGAL_SUPPLEMENT_IDS существуют в FOOD_DB', () => {
  // maltodextrin/vitargo/cyclic_dextrin — синтетические intra-пункты (движок собирает item
  // вручную, не из FOOD_DB) — допущены как forward-compat, строгая проверка не требуется.
  const SYNTHETIC_OK = new Set(['maltodextrin', 'vitargo', 'cyclic_dextrin']);
  it('все легальные добавки есть в БД (кроме синтетических intra-id)', () => {
    const missing = [...MEAL_LEGAL_SUPPLEMENT_IDS].filter(id => !FOOD_IDS.has(id) && !SYNTHETIC_OK.has(id));
    expect(missing).toEqual([]);
  });
});

describe('B7: завтрак-шаблоны консистентны', () => {
  it('foods и portions ключи совпадают', () => {
    for (const t of BREAKFAST_TEMPLATES) {
      const portions = Object.keys(t.portions || {}).sort();
      const foods = [...t.foods].sort();
      expect(portions, `шаблон ${t.id}`).toEqual(foods);
    }
  });
  it('порции шаблонов в человеческих пределах (10-250 г)', () => {
    for (const t of BREAKFAST_TEMPLATES) {
      for (const [id, g] of Object.entries(t.portions || {})) {
        expect(g, `${t.id}/${id}`).toBeGreaterThanOrEqual(10);
        expect(g, `${t.id}/${id}`).toBeLessThanOrEqual(250);
      }
    }
  });
});

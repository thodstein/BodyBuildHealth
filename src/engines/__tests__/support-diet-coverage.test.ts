/**
 * support-diet-coverage.test.ts — движок «рацион покрывает вещество».
 * Контракт: чистые функции, вход не мутируется; пустой intake = прежний
 * результат (важно для будущего тумблера в runSupportUnified).
 */
import { describe, expect, it } from 'vitest';
import {
  DIET_RDA,
  dietCoverage,
  coveredByDiet,
  annotatePlanSubsByDiet,
  annotateRecSubsByDiet,
  type DietIntake,
  type NutrientCoverage,
} from '../support-diet-coverage.engine';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { DEFAULT_DOSAGES } from '../../data/support-meta';

function coverageOf(intake: DietIntake, key: keyof DietIntake): NutrientCoverage {
  const row = dietCoverage(intake).find((c) => c.key === key);
  if (!row) throw new Error(`нет строки покрытия для ${String(key)}`);
  return row;
}

describe('DIET_RDA — таблица норм', () => {
  it('каждая строка имеет число, единицу и источник EFSA', () => {
    expect(DIET_RDA.length).toBeGreaterThan(0);
    for (const r of DIET_RDA) {
      expect(Number.isFinite(r.rda)).toBe(true);
      expect(r.rda).toBeGreaterThan(0);
      expect(r.unit.length).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.source).toContain('EFSA');
    }
  });

  it('ключи уникальны; белка в таблице нет (норма — г/кг, а не фикс. граммы)', () => {
    const keys = DIET_RDA.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('proteinG');
  });
});

describe('dietCoverage — состояния и границы', () => {
  it('undefined/null intake → все unknown, intake/ratio = null', () => {
    for (const input of [undefined, null]) {
      const rows = dietCoverage(input);
      expect(rows).toHaveLength(DIET_RDA.length);
      expect(rows.every((r) => r.state === 'unknown')).toBe(true);
      expect(rows.every((r) => r.intake === null && r.ratio === null)).toBe(true);
    }
  });

  it('NaN/undefined по нутриенту → unknown только для него', () => {
    const rows = dietCoverage({ fiberG: NaN, ironMg: undefined, calciumMg: 1000 });
    expect(rows.find((r) => r.key === 'fiberG')?.state).toBe('unknown');
    expect(rows.find((r) => r.key === 'ironMg')?.state).toBe('unknown');
    expect(rows.find((r) => r.key === 'calciumMg')?.state).toBe('covered');
  });

  it('границы 0.5 и 1.0 включительно (клетчатка: RDA 25 г)', () => {
    expect(coverageOf({ fiberG: 12.4 }, 'fiberG').state).toBe('insufficient');
    expect(coverageOf({ fiberG: 12.5 }, 'fiberG').state).toBe('partial');
    expect(coverageOf({ fiberG: 12.5 }, 'fiberG').ratio).toBe(0.5);
    expect(coverageOf({ fiberG: 24.99 }, 'fiberG').state).toBe('partial');
    expect(coverageOf({ fiberG: 25 }, 'fiberG').state).toBe('covered');
    expect(coverageOf({ fiberG: 25 }, 'fiberG').ratio).toBe(1);
    expect(coverageOf({ fiberG: 30 }, 'fiberG').state).toBe('covered');
  });

  it('витамин D: 300 МЕ = partial (0.5), 600 МЕ = covered', () => {
    expect(coverageOf({ vitaminDIu: 299 }, 'vitaminDIu').state).toBe('insufficient');
    expect(coverageOf({ vitaminDIu: 300 }, 'vitaminDIu').state).toBe('partial');
    expect(coverageOf({ vitaminDIu: 600 }, 'vitaminDIu').state).toBe('covered');
  });

  it('proteinG не создаёт строку покрытия и не влияет на результат', () => {
    const withProtein = dietCoverage({ proteinG: 200 });
    expect(withProtein.every((r) => r.state === 'unknown')).toBe(true);
    expect(withProtein.some((r) => r.key === 'proteinG')).toBe(false);
    expect(coveredByDiet(withProtein)).toEqual({});
    expect(dietCoverage({ proteinG: 200 })).toEqual(dietCoverage({}));
  });
});

describe('coveredByDiet', () => {
  it('покрытые нутриенты → их канонические id веществ', () => {
    const cov = dietCoverage({ fiberG: 30, ironMg: 20 });
    const map = coveredByDiet(cov);
    expect(Object.keys(map).sort()).toEqual(['fiber', 'iron', 'iron_bisglycinate']);
    expect(map.fiber.ratio).toBeCloseTo(1.2, 10);
    expect(map.fiber.label).toBe('Клетчатка');
    expect(map.iron.ratio).toBeCloseTo(1.25, 10);
  });

  it('частичное покрытие в карту не попадает', () => {
    expect(coveredByDiet(dietCoverage({ fiberG: 20 }))).toEqual({});
  });

  it('все id из маппинга существуют в репозитории (SUPPLEMENTS_DB / DEFAULT_DOSAGES)', () => {
    const full = Object.fromEntries(DIET_RDA.map((r) => [r.key, r.rda])) as DietIntake;
    const ids = Object.keys(coveredByDiet(dietCoverage(full)));
    const known = new Set([...Object.keys(SUPPLEMENTS_DB), ...Object.keys(DEFAULT_DOSAGES)]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(known.has(id)).toBe(true);
  });
});

describe('annotatePlanSubsByDiet', () => {
  type PlanSub = { id: string; note?: string };

  it('добавляет пометку, сохраняет длину и порядок, не мутирует вход', () => {
    const subs: PlanSub[] = [{ id: 'nac', note: 'старт' }, { id: 'fiber' }, { id: 'creatine' }];
    const before = JSON.parse(JSON.stringify(subs));
    const { subs: out, notes } = annotatePlanSubsByDiet(subs, dietCoverage({ fiberG: 30 }));

    expect(out).not.toBe(subs);
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.id)).toEqual(['nac', 'fiber', 'creatine']);
    expect(out[1].note).toContain('покрыто питанием');
    expect(out[1].note).toContain('120%');
    expect(out[0].note).toBe('старт');
    expect(subs).toEqual(before);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('покрыто питанием');
  });

  it('пометка дописывается к существующей note, а не заменяет её', () => {
    const subs: PlanSub[] = [{ id: 'omega3', note: 'с едой' }];
    const { subs: out } = annotatePlanSubsByDiet(subs, dietCoverage({ epaDhaMg: 500 }));
    expect(out[0].note).toContain('с едой');
    expect(out[0].note).toContain('покрыто питанием');
  });

  it('пустой intake → notes пустые, массив тот же', () => {
    const subs: PlanSub[] = [{ id: 'fiber' }, { id: 'omega3' }];
    const res = annotatePlanSubsByDiet(subs, dietCoverage({}));
    expect(res.subs).toBe(subs);
    expect(res.notes).toEqual([]);
  });

  it('пустое покрытие → notes пустые, массив тот же', () => {
    const subs: PlanSub[] = [{ id: 'fiber' }];
    const res = annotatePlanSubsByDiet(subs, []);
    expect(res.subs).toBe(subs);
    expect(res.notes).toEqual([]);
  });

  it('несопоставленный id не тронут (тот же объект)', () => {
    const subs: PlanSub[] = [{ id: 'creatine', note: '5 г' }];
    const { subs: out, notes } = annotatePlanSubsByDiet(subs, dietCoverage({ fiberG: 30, ironMg: 20 }));
    expect(out[0]).toBe(subs[0]);
    expect(out[0].note).toBe('5 г');
    expect(notes).toEqual([]);
  });

  it('алиас приводится к канону (magnesium_glycinate → magnesium)', () => {
    const subs: PlanSub[] = [{ id: 'magnesium_glycinate' }];
    const { subs: out } = annotatePlanSubsByDiet(subs, dietCoverage({ magnesiumMg: 350 }));
    expect(out[0].note).toContain('покрыто питанием');
  });

  it('уже помеченная позиция не дублирует пометку', () => {
    const mark = '🍽 Железо — покрыто питанием (125% нормы: 20 мг из 16 мг)';
    const subs: PlanSub[] = [{ id: 'iron', note: mark }];
    const { subs: out, notes } = annotatePlanSubsByDiet(subs, dietCoverage({ ironMg: 20 }));
    expect(out[0]).toBe(subs[0]);
    expect(notes).toEqual([]);
  });

  it('неизвестный intake → ни одна позиция не помечена', () => {
    const subs: PlanSub[] = [{ id: 'fiber' }, { id: 'iron' }];
    const { subs: out, notes } = annotatePlanSubsByDiet(subs, dietCoverage(undefined));
    expect(out).toBe(subs);
    expect(notes).toEqual([]);
  });
});

describe('annotateRecSubsByDiet', () => {
  type RecSub = { id: string; reason?: string };

  it('пометка идёт в reason; длина/порядок сохранены, вход не мутируется', () => {
    const subs: RecSub[] = [
      { id: 'omega3', reason: 'кардио' },
      { id: 'nac', reason: 'печень' },
    ];
    const before = JSON.parse(JSON.stringify(subs));
    const { subs: out, notes } = annotateRecSubsByDiet(subs, dietCoverage({ epaDhaMg: 500 }));

    expect(out).not.toBe(subs);
    expect(out.map((s) => s.id)).toEqual(['omega3', 'nac']);
    expect(out[0].reason).toContain('кардио');
    expect(out[0].reason).toContain('покрыто питанием');
    expect(out[1]).toBe(subs[1]);
    expect(subs).toEqual(before);
    expect(notes).toHaveLength(1);
  });

  it('пустой intake → вход без изменений', () => {
    const subs: RecSub[] = [{ id: 'omega3' }];
    const res = annotateRecSubsByDiet(subs, dietCoverage({}));
    expect(res.subs).toBe(subs);
    expect(res.notes).toEqual([]);
  });
});

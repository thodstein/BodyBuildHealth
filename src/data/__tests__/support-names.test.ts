/**
 * support-names.test.ts — единый резолвер «id → имя».
 *
 * Guard: `he_support_plan_result` хранит МАССИВ id, а экраны Тренировок/Хаба
 * раньше показывали пустоту или сырые id (`pharma_anastrozole`). Резолвер
 * обязан отдавать человекочитаемые русские имена и не дублировать их.
 */
import { describe, it, expect } from 'vitest';
import { supportNameRu, supportNamesRu } from '../support-names';

describe('supportNameRu', () => {
  it('находит имя в каталоге независимо от регистра', () => {
    const lower = supportNameRu('vitamin_c');
    expect(lower).toBeTruthy();
    expect(lower).not.toBe('vitamin_c');
    expect(supportNameRu('VITAMIN_C')).toBe(lower);
  });

  it('не возвращает сырой id для базовых веществ плана', () => {
    for (const id of ['hydration', 'no_smoking', 'no_alcohol', 'electrolyte_balance']) {
      expect(supportNameRu(id)).not.toBe(id);
    }
  });

  it('уважает явный fallback и не падает на пустом id', () => {
    expect(supportNameRu('unknown_xyz', 'Своё имя')).toBe('Своё имя');
    expect(supportNameRu('')).toBe('—');
  });

  it('fallback не «залипает» в кэше для последующих вызовов', () => {
    expect(supportNameRu('unknown_abc', 'Разовое имя')).toBe('Разовое имя');
    expect(supportNameRu('unknown_abc')).toBe('unknown_abc');
  });
});

describe('supportNamesRu', () => {
  it('разворачивает массив id в имена без дублей, сохраняя порядок', () => {
    const names = supportNamesRu(['hydration', 'hydration', 'no_alcohol']);
    expect(names.length).toBe(2);
    expect(names[0]).toBe(supportNameRu('hydration'));
    expect(names[1]).toBe(supportNameRu('no_alcohol'));
  });

  it('не отдаёт пустые элементы', () => {
    expect(supportNamesRu(['', 'hydration'])).toEqual([supportNameRu('hydration')]);
  });
});

/**
 * ClassifyCourseDrug.test.tsx — guard на расхождение вкладки с калькулятором:
 * таб классифицировал препараты сабстрингами, каноника (buildTzInput) — полем
 * class из DRUG_DB. Расходилось: mk677/mgf → 'aas' вместо 'gh',
 * trena → 'inject' вместо 'oral'. После фикса — единое правило.
 */
import { describe, it, expect } from 'vitest';
import { classifyCourseDrug } from '../RiskSpecMethod';

describe('classifyCourseDrug (паритет с buildTzInput)', () => {
  it('1. базовые классы совпадают', () => {
    expect(classifyCourseDrug('test_enan')).toEqual({ drugClass: 'aas', form: 'inject', canon: 'test_enan' });
    expect(classifyCourseDrug('ins_short')).toEqual({ drugClass: 'insulin', form: 'inject', canon: 'ins_short' });
    expect(classifyCourseDrug('cjc1295')).toEqual({ drugClass: 'gh', form: 'inject', canon: 'cjc1295' });
  });

  it('2. бывшие расхождения: mk677/mgf → gh, trena → oral', () => {
    expect(classifyCourseDrug('mk677').drugClass).toBe('gh');
    expect(classifyCourseDrug('mk677').form).toBe('oral');
    expect(classifyCourseDrug('mgf').drugClass).toBe('gh');
    expect(classifyCourseDrug('trena')).toEqual({ drugClass: 'aas', form: 'oral', canon: 'trena' });
  });

  it('3. неизвестный id — безопасный фолбэк как у каноники', () => {
    expect(classifyCourseDrug('unknown_xyz')).toEqual({ drugClass: 'aas', form: 'inject', canon: 'unknown_xyz' });
    expect(classifyCourseDrug('')).toEqual({ drugClass: 'aas', form: 'inject', canon: 'unknown' });
  });
});

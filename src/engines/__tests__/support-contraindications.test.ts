/**
 * support-contraindications.test.ts — B1 аудита docs/SUPPORT-CALCULATOR-PRO-AUDIT.md:
 * прямые юнит-тесты checkContraindications (safety-critical, раньше — 0 прямых тестов,
 * только косвенно через resolvePlan с пустыми условиями).
 */
import { describe, expect, it } from 'vitest';
import {
  checkContraindications,
  getContraindications,
  hasContraindications,
  CONTRAINDICATIONS,
} from '../../data/substance-contraindications';

describe('B1 — checkContraindications: абсолютные по заболеванию', () => {
  it('tadalafil + severe_hypotension → absolute ⛔', () => {
    const a = checkContraindications(['tadalafil'], ['severe_hypotension']);
    expect(a.some(x => x.substanceId === 'tadalafil' && x.severity === 'absolute')).toBe(true);
    expect(a[0].action).toContain('Не назначать');
  });

  it('spironolactone + pregnancy → absolute (и аас_course тоже absolute)', () => {
    expect(checkContraindications(['spironolactone'], ['pregnancy']).some(x => x.severity === 'absolute')).toBe(true);
    expect(checkContraindications(['spironolactone'], ['aas_course']).some(x => x.severity === 'absolute')).toBe(true);
  });

  it('metformin + ckd_stage4_5 → absolute (лактоацидоз)', () => {
    expect(checkContraindications(['metformin'], ['ckd_stage4_5']).some(x => x.severity === 'absolute')).toBe(true);
  });

  it('testosterone + severe_polycythemia → absolute (Hct>54)', () => {
    expect(checkContraindications(['testosterone'], ['severe_polycythemia']).some(x => x.severity === 'absolute')).toBe(true);
  });

  it('iron_bisglycinate + hemochromatosis → absolute (перегрузка железом)', () => {
    expect(checkContraindications(['iron_bisglycinate'], ['hemochromatosis']).some(x => x.severity === 'absolute')).toBe(true);
  });

  it('telmisartan + pregnancy_2nd_3rd → absolute', () => {
    expect(checkContraindications(['telmisartan'], ['pregnancy_2nd_3rd']).some(x => x.severity === 'absolute')).toBe(true);
  });

  it('vitamin_k2 + anticoagulant_therapy → absolute (антагонист варфарина)', () => {
    expect(checkContraindications(['vitamin_k2'], ['anticoagulant_therapy']).some(x => x.severity === 'absolute')).toBe(true);
  });
});

describe('B1 — относительные по заболеванию', () => {
  it('nebivolol + diabetes → relative ⚠ (маскировка гипогликемии)', () => {
    const a = checkContraindications(['nebivolol'], ['diabetes']);
    expect(a.some(x => x.substanceId === 'nebivolol' && x.severity === 'relative')).toBe(true);
  });

  it('curcumin + anticoagulant → relative', () => {
    expect(checkContraindications(['curcumin'], ['anticoagulant']).some(x => x.severity === 'relative')).toBe(true);
  });

  it('одно заболевание даёт relative, а absolute не срабатывает', () => {
    const a = checkContraindications(['metformin'], ['ckd_stage3']);
    expect(a.every(x => x.severity === 'relative')).toBe(true);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('B1 — устойчивость к входам', () => {
  it('регистр не важен: ВЕЩЕСТВО и УСЛОВИЕ в верхнем регистре', () => {
    const a = checkContraindications(['TADALAFIL'], ['SEVERE_HYPOTENSION']);
    expect(a.some(x => x.severity === 'absolute')).toBe(true);
  });

  it('неизвестное вещество — нет алертов, нет краша', () => {
    expect(checkContraindications(['unknown_substance_xyz'], ['pregnancy'])).toEqual([]);
  });

  it('пустые списки → []', () => {
    expect(checkContraindications([], ['pregnancy'])).toEqual([]);
    expect(checkContraindications(['tadalafil'], [])).toEqual([]);
    expect(checkContraindications([], [])).toEqual([]);
    expect(checkContraindications(['tadalafil'], undefined)).toEqual([]);
  });

  it('без совпадающих заболеваний — только релевантные условия триггерят', () => {
    // у tadalafil absoluteConditions не содержат pregnancy → relative/absolute пусто
    expect(checkContraindications(['tadalafil'], ['pregnancy'])).toEqual([]);
  });

  it('несколько веществ × несколько условий → все алерты собраны', () => {
    const a = checkContraindications(['tadalafil', 'metformin'], ['severe_hypotension', 'ckd_stage4_5']);
    expect(a.filter(x => x.severity === 'absolute').length).toBe(2);
  });
});

describe('B1 — справочник: getContraindications/hasContraindications', () => {
  it('запись резолвится в обоих регистрах', () => {
    expect(getContraindications('tadalafil')?.substanceId).toBe('tadalafil');
    expect(getContraindications('TADALAFIL')?.substanceId).toBe('tadalafil');
  });

  it('неизвестное → null / false', () => {
    expect(getContraindications('unknown_substance_xyz')).toBeNull();
    expect(hasContraindications('unknown_substance_xyz')).toBe(false);
  });

  it('структура правил полная: у каждой записи массивы условий и строк', () => {
    for (const [id, r] of Object.entries(CONTRAINDICATIONS)) {
      expect(r.substanceId, id).toBe(id);
      expect(Array.isArray(r.absolute), id).toBe(true);
      expect(Array.isArray(r.absoluteConditions), id).toBe(true);
      expect(Array.isArray(r.relative), id).toBe(true);
      expect(Array.isArray(r.relativeConditions), id).toBe(true);
    }
  });
});

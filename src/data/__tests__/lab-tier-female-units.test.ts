/**
 * lab-tier-female-units.test.ts — проход 148: женские бэнды пролактина и
 * тестостерона сравниваются в тех единицах, в которых калькулятор читает анализ.
 *
 * Было: `FEMALE_HORMONE_ULN` задан в мМЕ/л и нмоль/л, а форма через
 * `LAB_UNIT_READ`/`LAB_TIERS` держит канон нг/мл и нг/дл. Поэтому пролактин
 * 80 нг/мл (явно высокий) молчал — он меньше порога 800, — а тестостерон
 * 50 нг/дл (норма женщины) был «больше 2.5» и давал вирилизацию каждой.
 * Плюс форма отдаёт канон `PROLACTIN`, а ветка знала только `PRL`.
 *
 * Теперь порог переводится единственным коэффициентом (`PRL_NG_TO_MIU`,
 * `TT_NMOL_TO_NG_DL`) в `FEMALE_HORMONE_ULN_READ`, и оба имени маркера идут
 * одной веткой.
 */
import { describe, it, expect } from 'vitest';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { FEMALE_HORMONE_ULN, FEMALE_HORMONE_ULN_READ } from '../../engines/lab-norms.engine';
import { PRL_NG_TO_MIU, TT_NMOL_TO_NG_DL, readLabValue } from '../../core/constants';

const alerts = (labs: Record<string, number>) =>
  computeTierAdjustments(labs, 'female').alerts.map(a => a.message).join(' ');

describe('проход 148: единицы женских бэндов', () => {
  it('порог пролактина — тот же мМЕ-бэнд, переведённый коэффициентом', () => {
    expect(FEMALE_HORMONE_ULN_READ.PRL.high).toBeCloseTo(FEMALE_HORMONE_ULN.PRL.high / PRL_NG_TO_MIU, 1);
    expect(FEMALE_HORMONE_ULN_READ.PRL.criticalHigh).toBeCloseTo(FEMALE_HORMONE_ULN.PRL.criticalHigh / PRL_NG_TO_MIU, 1);
    expect(FEMALE_HORMONE_ULN_READ.PRL.unit).toBe('нг/мл');
  });

  it('порог тестостерона — тот же нмоль-бэнд, переведённый коэффициентом', () => {
    expect(FEMALE_HORMONE_ULN_READ.TT.high).toBeCloseTo(FEMALE_HORMONE_ULN.TT.high * TT_NMOL_TO_NG_DL, 1);
    expect(FEMALE_HORMONE_ULN_READ.TT.criticalHigh).toBeCloseTo(FEMALE_HORMONE_ULN.TT.criticalHigh * TT_NMOL_TO_NG_DL, 1);
    expect(FEMALE_HORMONE_ULN_READ.TT.unit).toBe('нг/дл');
  });
});

describe('проход 148: пролактин нг/мл', () => {
  it('80 нг/мл — алерт; 30 — тишина; оба имени работают', () => {
    expect(alerts({ PRL: 80 })).toContain('эндокринолог');
    expect(alerts({ PROLACTIN: 80 })).toContain('эндокринолог');
    expect(alerts({ PROLACTIN: 30 })).toBe('');
  });

  it('бланк 1600 мМЕ/л (75.5 нг/мл) — алерт, 300 мМЕ/л — нет', () => {
    const high = readLabValue('Prolactin', 1600, 'мМЕ/л').value;
    const normal = readLabValue('Prolactin', 300, 'мМЕ/л').value;
    expect(alerts({ PROLACTIN: high })).toContain('эндокринолог');
    expect(alerts({ PROLACTIN: normal })).toBe('');
  });
});

describe('проход 148: тестостерон нг/дл', () => {
  it('50 нг/дл (норма) — тишина, 200 — вирилизация в нг/дл', () => {
    expect(alerts({ TESTOSTERONE: 50 })).toBe('');
    expect(alerts({ TESTOSTERONE: 200 })).toContain('нг/дл');
    expect(alerts({ TT: 200 })).toContain('нг/дл');
  });

  it('граница — из общего порога, не из литерала', () => {
    const cut = FEMALE_HORMONE_ULN_READ.TT.criticalHigh;
    expect(alerts({ TESTOSTERONE: cut + 1 })).toContain('нг/дл');
    expect(alerts({ TESTOSTERONE: cut - 1 })).toBe('');
  });
});

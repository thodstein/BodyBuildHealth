/**
 * lab-name-bridge.test.ts — проход 169: одно имя анализа на границе `labValues`.
 *
 * Класс дефекта: значение склада (`CHOL`, `CREATININE`, `UA`, `EGFR`, `DHEA_S`,
 * `TNF_ALPHA`, `BIL`, `HGB`) не находило ключа движка (`TC`, `CREAT`, `URIC`,
 * `eGFR`, `DHEAS`, `TNFA`). Анализ есть — вклада нет, верификация пишет «нет
 * данных». Гард меряет поведением: карта в кодах склада и карта в прежних
 * именах обязаны давать один и тот же расчёт.
 *
 * Вторая гарантия — имена не путаются: общий Т3 (`T3`, nmol/L) не подменяет
 * свободный (`FT3`, pmol/L), иначе 2.0 nmol/L читались бы как тяжёлый дефицит.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  canonicalLabValues,
  LEGACY_LAB_CODES,
} from '../lab-code-bridge';
import {
  calculateTzSpecRisk,
  clinicalFloorsForLabs,
  getMiFromLab,
  type TzSpecInput,
} from '../risk-engine-tz-spec';
import { buildVerificationReport, VERIFICATION_SYSTEMS, labAliasMap } from '../risk-verification.engine';
import { UCUM_MAP } from '../../core/constants';

const input = (labValues: Record<string, number>): TzSpecInput => ({
  drugClass: 'aas', drugName: 'test_enan', dose: 500, duration: 12, form: 'inject',
  combinations: 1, labCoverage: 1, labValues, supportSubstances: [],
  sex: 'male',
});

const shape = (r: ReturnType<typeof calculateTzSpecRisk>) => JSON.stringify({
  organs: r.organs.map(o => `${o.id}:${o.rawPercent}:${o.afterPercent}:${o.category}:${o.floors.map(f => f.label).join(',')}`),
  overallRaw: r.overallRaw,
  overallAfter: r.overallAfter,
});

describe('мост имён: канон склада', () => {
  it('легаси-имя получает канонический ключ, исходные ключи не теряются', () => {
    const m = canonicalLabValues({ TC: 6.1, CREAT: 130, URIC: 450, DHEAS: 60, PHOS: 0.8, FOLATE: 5, ANTI_TPO: 40, TNFA: 4, HB: 150 });
    expect(m['CHOL']).toBe(6.1);
    expect(m['CREATININE']).toBe(130);
    expect(m['UA']).toBe(450);
    expect(m['DHEA_S']).toBe(60);
    expect(m['P']).toBe(0.8);
    expect(m['FOL']).toBe(5);
    expect(m['TPO_AB']).toBe(40);
    expect(m['TNF_ALPHA']).toBe(4);
    expect(m['HGB']).toBe(150);
    // исходные имена остаются (счётчик «сколько анализов введено» не меняется)
    expect(m['TC']).toBe(6.1);
    expect(m['CREAT']).toBe(130);
  });

  it('канон главнее: значение склада не перезаписывается легаси-именем', () => {
    const m = canonicalLabValues({ CREAT: 130, CREATININE: 95 });
    expect(m['CREATININE']).toBe(95);
  });

  it('канон-ключи моста — настоящие коды склада', () => {
    for (const canon of Object.values(LEGACY_LAB_CODES)) {
      expect(UCUM_MAP[canon], `${canon} должен быть кодом UCUM_MAP`).toBeDefined();
    }
  });

  it('подпись поля формы (`labMarkerCanon`) тоже приводит к канону', () => {
    const m = canonicalLabValues({ TOTAL_CHOLESTEROL: 6.1, URIC_ACID: 450, T3_FREE: 3.0, T4_FREE: 8, ANTI_TPO: 40 });
    expect(m['CHOL']).toBe(6.1);
    expect(m['UA']).toBe(450);
    expect(m['FT3']).toBe(3.0);
    expect(m['FT4']).toBe(8);
    expect(m['TPO_AB']).toBe(40);
  });
});

describe('движок: карта склада и карта прежних имён дают один расчёт', () => {
  it('m_i совпадает для почек, липидов, воспаления, билирубина', () => {
    const pairs: Array<[string, Record<string, number>, Record<string, number>]> = [
      ['ren1', { eGFR: 45, CREAT: 160, URIC: 500 }, { EGFR: 45, CREATININE: 160, UA: 500 }],
      ['cv2', { TC: 6.4, LDL: 4.0 }, { CHOL: 6.4, LDL: 4.0 }],
      ['cns2', { TNFA: 6 }, { TNF_ALPHA: 6 }],
      ['liv2', { BILIRUBIN: 45 }, { BIL: 45 }],
      ['hem1', { HB: 180, HCT: 56 }, { HGB: 180, HCT: 56 }],
    ];
    for (const [mech, legacy, canon] of pairs) {
      expect(getMiFromLab(mech, legacy), `${mech}: легаси-имена`).toBe(getMiFromLab(mech, canon));
    }
  });

  it('clinicalFloorsForLabs: та же находка по СКФ и креатинину', () => {
    const legacy = clinicalFloorsForLabs({ eGFR: 25, CREAT: 260, URIC: 520 }, 'male');
    const canon = clinicalFloorsForLabs({ EGFR: 25, CREATININE: 260, UA: 520 }, 'male');
    expect(JSON.stringify(legacy)).toBe(JSON.stringify(canon));
    expect(legacy.some(f => f.label.includes('eGFR'))).toBe(true);
  });

  it('calculateTzSpecRisk: полный результат совпадает', () => {
    const legacy = {
      HCT: 54, HGB: 175, ALT: 80, GGT: 70, LDL: 4.2, TC: 6.4, CREAT: 150,
      eGFR: 60, URIC: 480, TNFA: 5, DHEAS: 40, T3: 3.0, T4: 8, K: 3.2,
    };
    const canon = {
      HCT: 54, HGB: 175, ALT: 80, GGT: 70, LDL: 4.2, CHOL: 6.4, CREATININE: 150,
      EGFR: 60, UA: 480, TNF_ALPHA: 5, DHEA_S: 40, T3: 3.0, T4: 8, K: 3.2,
    };
    expect(shape(calculateTzSpecRisk(input(canon)))).toBe(shape(calculateTzSpecRisk(input(legacy))));
  });
});

describe('общий Т3/Т4 не подменяет свободные', () => {
  it('cns4 читает только свободные (FT3/FT4)', () => {
    const basal = getMiFromLab('cns4', {});
    // Общий Т3 2.0 nmol/L — норма общего гормона; свободный 2.0 pmol/L — тяжёлый дефицит.
    expect(getMiFromLab('cns4', { T3: 2.0, T4: 60 })).toBe(basal);
    expect(getMiFromLab('cns4', { FT3: 2.0 })).toBeGreaterThan(basal);
  });
});

describe('верификация: значение склада подтверждает свой анализ', () => {
  it('карта склада помечает маркеры почек и поднимает якоря СКФ', () => {
    const rep = buildVerificationReport({ EGFR: 25, CREATININE: 200, UA: 450 });
    const renal = rep.systems.find(s => s.id === 'renal')!;
    const ren1 = renal.mechanisms.find(m => m.id === 'ren1')!;
    expect(ren1.markers.map(x => x.code)).toEqual(['EGFR', 'CREATININE', 'UREA', 'UA']);
    expect(ren1.markers.filter(x => x.present).map(x => x.code)).toEqual(['EGFR', 'CREATININE', 'UA']);
    expect(renal.floorHits.map(f => f.code)).toEqual(['EGFR', 'EGFR']);
    expect(rep.presentMarkers).toBeGreaterThan(0);
  });

  it('легаси-карта и карта склада дают одно покрытие', () => {
    const legacy = buildVerificationReport({ eGFR: 25, CREAT: 200, URIC: 450, TC: 6.4, TNFA: 6 });
    const canon = buildVerificationReport({ EGFR: 25, CREATININE: 200, UA: 450, CHOL: 6.4, TNF_ALPHA: 6 });
    expect(canon.presentMarkers).toBe(legacy.presentMarkers);
    expect(canon.floorsCount).toBe(legacy.floorsCount);
    expect(canon.overall).toBe(legacy.overall);
  });

  it('labAliasMap оставляет канон первым и не удаляет исходные ключи', () => {
    const m = labAliasMap({ HB: 150, eGFR: 80 });
    expect(m['HGB']).toBe(150);
    expect(m['HB']).toBe(150);
    expect(m['EGFR']).toBe(80);
    expect(m['eGFR']).toBe(80);
  });

  it('ни один маркер верификации не остался под прежним именем', () => {
    const legacyCodes = new Set(['TC', 'CREAT', 'URIC', 'eGFR', 'DHEAS', 'TNFA', 'T3', 'T4', 'ALDO', 'PTH', 'ANTI_TPO']);
    for (const sys of VERIFICATION_SYSTEMS) {
      for (const mech of sys.mechanisms) {
        for (const mk of mech.markers) expect(legacyCodes.has(mk.code), `${mk.code} — прежнее имя`).toBe(false);
      }
      for (const f of sys.floors) expect(legacyCodes.has(f.code), `${f.code} — прежнее имя якоря`).toBe(false);
    }
  });
});

describe('источник: движок читает только канон', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/engines/risk-engine-tz-spec.ts'), 'utf8');
  const legacyRead = /lv\s*\[\s*'(CREAT|TC|URIC|DHEAS|PHOS|FOLATE|ALDO|PTH|ANTI_TPO|TNFA|eGFR|T3|T4)'\s*\]/;

  it('нет чтения по прежним именам', () => {
    expect(src.match(legacyRead)).toBeNull();
  });

  it('мост стоит на входе движка и якорей', () => {
    expect(src).toContain("import { canonicalLabValues } from './lab-code-bridge'");
    expect(src.match(/canonicalLabValues\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

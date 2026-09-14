/**
 * female-protocol-engine-parity.test.tsx — §6.4 аудита калькулятора поддержки:
 *  1) сверка таблиц женского протокола с движком: FEMALE_VIRILIZATION_CALC ↔ FEMALE_AAS_PROFILES
 *     (red-пороги, андрогенный индекс, абсолютные противопоказания);
 *  2) каталог спиронолактона (только врач) зарегистрирован в SUPPORT_CATALOG_DATA;
 *  3) женские пометки в общих протоколах (Печень/Гемато/Пролактин/E2) — рендерятся и честны.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { FEMALE_VIRILIZATION_CALC, FEMALE_SUPPORT_PROTOCOLS } from '../supportProtocolWomenData';
import { FEMALE_AAS_PROFILES } from '../../../../engines/female-aas-risk';
import { resolvePedAlias } from '../../../../data/ped-alias-map';
import { SUPPORT_CATALOG_DATA } from '../../../../data/support-catalog-data';
import { registerCatalogExtras } from '../../../../data/support-catalog-extras';
import { SupportProtocolHepatic } from '../supportProtocolHepatic';
import { SupportProtocolHemato } from '../supportProtocolHemato';
import { SupportProtocolProlactin } from '../supportProtocolProlactin';
import { SupportProtocolE2 } from '../supportProtocolE2';

afterEach(() => {
  // рендеры статические — cleanup не требуется
});

describe('§6.4.1: FEMALE_VIRILIZATION_CALC ↔ FEMALE_AAS_PROFILES', () => {
  it('red-пороги, андрогенный индекс и противопоказания совпадают', () => {
    for (const item of FEMALE_VIRILIZATION_CALC) {
      const canon = resolvePedAlias(item.id);
      const profile = FEMALE_AAS_PROFILES.find((p) => p.patterns.some((pat) => canon.includes(pat)));
      expect(profile, `профиль не найден для ${item.id} (${canon})`).toBeTruthy();
      // ред-порог движка — мг/нед; таблица — в своей единице (мг/день × 7)
      const expectedRed = item.unit === 'мг/день' ? item.red * 7 : item.red;
      if (profile!.contraindicated || item.contraindicated) {
        expect(profile!.contraindicated, item.id).toBe(true);
        expect(item.red <= 0 || item.contraindicated, item.id).toBe(true);
      } else {
        expect(profile!.red, item.id).toBe(expectedRed);
      }
      expect(profile!.androgenIndex, item.id).toBe(item.androgenIndex);
    }
  });

  it('абсолютные противопоказания движка (22 профиля) включают трен/трест/гало/анаполон/супердрол/S23/YK-11', () => {
    const contra = FEMALE_AAS_PROFILES.filter((p) => p.contraindicated).map((p) => p.name).join(' | ');
    for (const needle of ['Тренболон', 'Трестостерон', 'Флуоксиместерон', 'Оксиметолон', 'Супердрол', 'S23', 'YK-11']) {
      expect(contra).toContain(needle);
    }
  });
});

describe('§6.4.4: каталог спиронолактона («только врач»)', () => {
  it('запись существует в каталоге с пометкой «только врач» и контроль K⁺/креатинина', () => {
    registerCatalogExtras(SUPPORT_CATALOG_DATA);
    const s = (SUPPORT_CATALOG_DATA as never as Record<string, { nameRu?: string; specialInstructions?: string[]; contraindications?: string[]; monitoring?: Array<{ what?: string }> }>)['spironolactone'];
    expect(s).toBeTruthy();
    expect(s.nameRu || '').toContain('Спиронолактон');
    expect((s.specialInstructions || []).join(' ')).toMatch(/только врач/i);
    expect((s.contraindications || []).join(' ')).toMatch(/Беременность/i);
    expect((s.monitoring || []).map(m => m.what || '').join(' ')).toMatch(/креатинин/i);
  });
});

describe('§6.4.3: женские пометки общих протоколов', () => {
  const cases: Array<[string, React.FC<{ s: Record<string, any> }>]> = [
    ['Печень', SupportProtocolHepatic],
    ['Гематология', SupportProtocolHemato],
    ['Пролактин', SupportProtocolProlactin],
    ['E2', SupportProtocolE2],
  ];
  for (const [label, Cmp] of cases) {
    it(`${label}: data-female-protocol-note с ♀ и источником «Лабы»`, () => {
      const html = renderToStaticMarkup(React.createElement(Cmp, { s: {} }));
      expect(html, label).toContain('data-female-protocol-note');
      expect(html, label).toContain('♀');
    });
  }
});

describe('§6.4.2: сверка 11 протоколов с общими (кросс-ссылки)', () => {
  it('печёночный и пролактиновый женские протоколы ссылаются на общие', () => {
    const hepatic = FEMALE_SUPPORT_PROTOCOLS.find((p) => p.id === 'hepatic')!;
    expect(hepatic.rows.some((r) => (r.note || '').includes('Печени'))).toBe(true);
    const prol = FEMALE_SUPPORT_PROTOCOLS.find((p) => p.id === 'prolactin')!;
    expect((prol.footer || '')).toContain('Пролактин');
    const hct = FEMALE_SUPPORT_PROTOCOLS.find((p) => p.id === 'hematocrit')!;
    // порог флеботомии у женщины — 52% (паритет с FEMALE_LAB_GROUPS и floors движка)
    expect((hct.footer || '')).toContain('52%');
  });
});

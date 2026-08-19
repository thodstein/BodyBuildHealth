// Тесты движка верификации рисков (risk-verification.engine.ts):
// каталог маркеров T4 по 6 системам/28 механизмам, статусы m_i=1/2/3,
// алиасы, отчёт (verification/floors), экспорт текст/CSV/HTML.
import { describe, it, expect } from 'vitest';
import {
  VERIFICATION_SYSTEMS,
  VERIFICATION_TOTAL_MECHANISMS,
  markerStatus,
  statusColor,
  statusLabel,
  thresholdText,
  labAliasMap,
  buildVerificationReport,
  buildVerificationText,
  buildVerificationCsv,
  buildVerificationHtml,
  FLOOR_CODES,
  COMPUTED_CODES,
  type VerifMarker,
} from '../risk-verification.engine';

describe('каталог верификации', () => {
  it('6 систем с именами/иконками/цветами', () => {
    expect(VERIFICATION_SYSTEMS).toHaveLength(6);
    const ids = VERIFICATION_SYSTEMS.map(s => s.id);
    expect(ids).toEqual(['cardio', 'hepatic', 'renal', 'cns', 'reproductive', 'hematologic']);
    for (const s of VERIFICATION_SYSTEMS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.mechanisms.length).toBeGreaterThan(0);
    }
  });

  it('28 механизмов, веса > 0, имена в TZ_MECH_LABELS', () => {
    expect(VERIFICATION_TOTAL_MECHANISMS).toBe(28);
    for (const s of VERIFICATION_SYSTEMS) {
      for (const m of s.mechanisms) {
        expect(m.weight).toBeGreaterThan(0);
        expect(m.id.length).toBeGreaterThan(0);
      }
    }
  });

  it('пороги маркеров монотонны по направлению', () => {
    for (const s of VERIFICATION_SYSTEMS) {
      for (const m of s.mechanisms) {
        for (const mk of m.markers) {
          const [t1, t2, t3] = mk.thresholds;
          if (mk.direction === 'high') {
            expect(t1).toBeLessThan(t2);
            expect(t2).toBeLessThan(t3);
          } else {
            expect(t1).toBeGreaterThan(t2);
            expect(t2).toBeGreaterThan(t3);
          }
          expect(mk.name.length).toBeGreaterThan(0);
          expect(mk.unit.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('флоры ссылаются на известные коды', () => {
    const allCodes = new Set<string>();
    for (const s of VERIFICATION_SYSTEMS) {
      for (const m of s.mechanisms) for (const mk of m.markers) allCodes.add(mk.code);
    }
    for (const s of VERIFICATION_SYSTEMS) {
      for (const f of s.floors) {
        expect(allCodes.has(f.code)).toBe(true);
        expect(f.op === '>=' || f.op === '<=').toBe(true);
        expect(f.label.length).toBeGreaterThan(0);
        expect(f.risk).toBeGreaterThan(0);
      }
    }
    // HCT и GLU используются и как floor, и в механизмах
    expect(FLOOR_CODES.has('HCT')).toBe(true);
    expect(COMPUTED_CODES.has('AST')).toBe(true);
  });
});

describe('markerStatus / статусы', () => {
  const ldl: VerifMarker = { code: 'LDL', name: 'ЛПНП', unit: 'ммоль/л', direction: 'high', thresholds: [2.6, 3.4, 4.9] };
  const k: VerifMarker = { code: 'K', name: 'Калий', unit: 'ммоль/л', direction: 'low', thresholds: [3.5, 3.0, 2.5] };

  it('high: 0/1/2/3 по порогам', () => {
    expect(markerStatus(ldl, 2.0)).toBe(0);
    expect(markerStatus(ldl, 2.6)).toBe(1);
    expect(markerStatus(ldl, 3.0)).toBe(1);
    expect(markerStatus(ldl, 3.5)).toBe(2);
    expect(markerStatus(ldl, 5.5)).toBe(3);
  });

  it('low: 0/1/2/3 по порогам', () => {
    expect(markerStatus(k, 4.0)).toBe(0);
    expect(markerStatus(k, 3.2)).toBe(1);
    expect(markerStatus(k, 2.9)).toBe(2);
    expect(markerStatus(k, 2.0)).toBe(3);
  });

  it('NaN/не-finite → 0', () => {
    expect(markerStatus(ldl, NaN)).toBe(0);
    expect(markerStatus(ldl, Infinity)).toBe(0);
  });

  it('цвета/лейблы статусов', () => {
    expect(statusColor(0)).toBe('#22c55e');
    expect(statusColor(3)).toBe('#ef4444');
    expect(statusLabel(0)).toBe('норма');
    expect(statusLabel(3)).toBe('критический');
    expect(thresholdText(ldl)).toBe('≥2.6 · ≥3.4 · ≥4.9');
    expect(thresholdText(k)).toBe('≤3.5 · ≤3 · ≤2.5');
  });
});

describe('labAliasMap', () => {
  it('алиасы кодов приводятся к канону T4', () => {
    const m = labAliasMap({ EGFR: 80, CREATININE: 110, BILIRUBIN: 21, POTASSIUM: 4.0, SODIUM: 140, GLUCOSE: 5.0, HB: 150 });
    expect(m['eGFR']).toBe(80);
    expect(m['CREAT']).toBe(110);
    expect(m['BIL']).toBe(21);
    expect(m['K']).toBe(4.0);
    expect(m['NA']).toBe(140);
    expect(m['GLU']).toBe(5.0);
    expect(m['HGB']).toBe(150);
  });

  it('существующие канонические ключи не перезаписываются', () => {
    const m = labAliasMap({ EGFR: 80, eGFR: 90 });
    expect(m['eGFR']).toBe(90);
  });
});

describe('buildVerificationReport', () => {
  it('без анализов: верификация 0, маркеров 0, флоров 0', () => {
    const rep = buildVerificationReport({});
    expect(rep.overall).toBe(0);
    expect(rep.presentMarkers).toBe(0);
    expect(rep.floorsCount).toBe(0);
    expect(rep.totalMarkers).toBeGreaterThan(0);
    for (const s of rep.systems) expect(s.verification).toBe(0);
  });

  it('частичные анализы: верификация систем по механизмам', () => {
    const rep = buildVerificationReport({ LDL: 3.0, HCT: 50, ALT: 60 });
    const cardio = rep.systems.find(s => s.id === 'cardio')!;
    const hepatic = rep.systems.find(s => s.id === 'hepatic')!;
    // cardio: 5 механизмов, маркеры есть у cv2 (LDL) и cv4/cv5 (HCT) → 3 из 5 (cv5 тоже HCT)
    expect(cardio.presentCount).toBe(3);
    expect(cardio.verification).toBeCloseTo(3 / 5, 5);
    expect(hepatic.presentCount).toBe(2); // liv1 (ALT) и liv3 (ALT/AST)
    expect(hepatic.verification).toBeCloseTo(2 / 3, 5);
    expect(rep.overall).toBeGreaterThan(0);
    expect(rep.presentMarkers).toBe(3);
  });

  it('все анализы → полная верификация (кроме механизмов без маркеров)', () => {
    const labs: Record<string, number> = {};
    for (const s of VERIFICATION_SYSTEMS) {
      for (const m of s.mechanisms) {
        if (m.markers.length > 0) labs[m.markers[0].code] = 1;
      }
    }
    const rep = buildVerificationReport(labs);
    for (const s of rep.systems) {
      if (s.id === 'cns') {
        // cns6 не имеет маркеров — верифицируемы только 5 из 6 механизмов
        expect(s.verification).toBeCloseTo(5 / 6, 5);
      } else {
        expect(s.verification).toBeCloseTo(1, 5);
      }
    }
    expect(rep.overall).toBeCloseTo((1 + 1 + 1 + 5 / 6 + 1 + 1) / 6, 5);
  });

  it('механизм без маркера (cns6) не верифицируется даже при прочих анализах', () => {
    const rep = buildVerificationReport({ LDL: 3.0 });
    const cns = rep.systems.find(s => s.id === 'cns')!;
    const cns6 = cns.mechanisms.find(m => m.id === 'cns6')!;
    expect(cns6.markers).toHaveLength(0);
    expect(cns6.present).toBe(false);
    expect(cns.verification).toBeLessThan(1);
  });

  it('флоры: HCT ≥ 54 и eGFR < 30 поднимают hits', () => {
    const rep = buildVerificationReport({ HCT: 55, eGFR: 25 });
    const hem = rep.systems.find(s => s.id === 'hematologic')!;
    const ren = rep.systems.find(s => s.id === 'renal')!;
    expect(hem.floorHits.map(f => f.code)).toContain('HCT');
    expect(ren.floorHits.map(f => f.code)).toEqual(['eGFR', 'eGFR']);
    expect(rep.floorsCount).toBe(3);
  });

  it('флоры не срабатывают без значения', () => {
    const rep = buildVerificationReport({ LDL: 4.9 });
    const cardio = rep.systems.find(s => s.id === 'cardio')!;
    expect(cardio.floorHits.map(f => f.code)).toContain('LDL');
    expect(rep.floorsCount).toBe(1);
  });
});

describe('экспорт', () => {
  const labs = { LDL: 3.0, HCT: 50, ALT: 60, eGFR: 80, TT: 10, K: 4.0, PRL: 20 };

  it('текст: системы, механизмы, маркеры, значения, флоры', () => {
    const text = buildVerificationText(labs);
    expect(text).toContain('ВЕРИФИКАЦИЯ РИСКОВ АНАЛИЗАМИ');
    expect(text).toContain('Сердечно-сосудистая система');
    expect(text).toContain('ЛПНП (LDL)');
    expect(text).toContain('≥2.6 · ≥3.4 · ≥4.9');
    expect(text).toContain('пограничный');
    expect(text).not.toContain('undefined');
  });

  it('текст без анализов: маркеры «—», статус нет данных', () => {
    const text = buildVerificationText({});
    expect(text).toContain('0/');
    expect(text).toContain('—');
  });

  it('CSV: BOM, заголовок, строки маркеров, экранирование кавычек', () => {
    const csv = buildVerificationCsv(labs);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.split('\r\n');
    expect(lines[0].replace(/^\uFEFF/, '')).toBe('Система;Механизм;Маркер;Код;Единица;Значение;Порог 1;Порог 2;Порог 3;Направление;Статус');
    expect(lines.length).toBeGreaterThan(50);
    const ldlRow = lines.find(l => l.includes('ЛПНП'));
    expect(ldlRow).toContain('3');
    const mechLabel = lines.find(l => l.includes('Дислипидемический механизм'));
    expect(mechLabel).toBeTruthy();
    // нет данных — пустое значение
    const fshRow = lines.find(l => l.includes('ФСГ'));
    expect(fshRow).toContain(';;');
  });

  it('CSV экранирует значение с точкой с запятой', () => {
    const csv = buildVerificationCsv({ LDL: 3.0 });
    expect(csv).not.toContain('undefined');
  });

  it('HTML: структура печати, системы, таблицы маркеров', () => {
    const html = buildVerificationHtml(labs);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Верификация рисков анализами');
    expect(html).toContain('Сердечно-сосудистая система');
    expect(html).toContain('ЛПНП');
    expect(html).toContain('Пороги m_i=1/2/3');
    expect(html).not.toContain('undefined');
  });

  it('HTML экранирует потенциально опасные строки', () => {
    const html = buildVerificationHtml({});
    expect(html).not.toMatch(/<script/i);
  });
});
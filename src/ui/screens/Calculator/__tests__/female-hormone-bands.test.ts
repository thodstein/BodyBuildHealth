/**
 * female-hormone-bands.test.ts — проход 58: цели таблицы мониторинга для E2,
 * пролактина и креатинина были только мужскими.
 *
 *  • креатинин — `<110 мкмоль/л` (у женщины ВГН 97);
 *  • PRL — `<320/400 мМЕ/л` (женская норма 100–500, действие — с 800);
 *  • E2 — `100–200 пмоль/л (на курсе)`: у женщины это подавление, её норма
 *    фазовая (40–200 фолл. / 70–500 лют. пг/мл), а красный флаг `>800 или <30`.
 *
 * Контракт: зоны живут в `FEMALE_HORMONE_BANDS`, ВГН-текст — `labUlnText(code)`.
 * Женский таб (`supportProtocolWomenData`) читает те же записи, а не свои копии.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FEMALE_HORMONE_BANDS, FEMALE_LAB_BOUNDS, labUlnText,
} from '../../../../engines/lab-norms.engine';
import { LAB_MONITOR_DB } from '../../SupportScreen_parts/UnifiedSynergyCalculator';
import { FEMALE_LAB_GROUPS } from '../../SupportScreen_parts/supportProtocolWomenData';

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('labUlnText — «♂ / ♀» из резолвера, без ручных литералов', () => {
  it('креатинин 110/97 и АЛТ 40/31', () => {
    expect(labUlnText('CREATININE')).toBe('♂ <110 / ♀ <97');
    expect(labUlnText('ALT')).toBe('♂ <40 / ♀ <31');
  });

  it('код без женской границы — только мужская («PRL» = 15 нг/мл)', () => {
    expect(labUlnText('PRL')).toBe('<15');
    expect(FEMALE_LAB_BOUNDS.PRL).toBeUndefined();
  });
});

describe('FEMALE_HORMONE_BANDS — одна запись на женские гормональные зоны', () => {
  it('E2 фазовая модель и красные флаги', () => {
    expect(FEMALE_HORMONE_BANDS.E2.unit).toBe('пг/мл');
    expect(FEMALE_HORMONE_BANDS.E2.normal).toContain('40–200');
    expect(FEMALE_HORMONE_BANDS.E2.normal).toContain('70–500');
    expect(FEMALE_HORMONE_BANDS.E2.red).toBe('>800 или <30');
  });

  it('PRL: норма 100–500, действие с 800, МРТ с 1500', () => {
    expect(FEMALE_HORMONE_BANDS.PRL.unit).toBe('мМЕ/л');
    expect(FEMALE_HORMONE_BANDS.PRL.normal).toBe('100–500');
    expect(FEMALE_HORMONE_BANDS.PRL.green).toBe('<800');
    expect(FEMALE_HORMONE_BANDS.PRL.red).toBe('>1500');
  });
});

describe('женский таб «Лабы» читает те же числа (кросс-лок)', () => {
  const rows = FEMALE_LAB_GROUPS.flatMap(g => g.rows as Array<Record<string, string>>);
  const byMarker = (m: string) => rows.find(r => r.marker === m);

  it('E2 и PRL — ровно из бэндов', () => {
    const e2 = byMarker('Эстрадиол (E2)')!;
    expect(e2.red).toBe(FEMALE_HORMONE_BANDS.E2.red);
    expect(e2.yellow).toBe(FEMALE_HORMONE_BANDS.E2.yellow);
    expect(e2.normal).toContain(FEMALE_HORMONE_BANDS.E2.normal);
    const prl = byMarker('Пролактин')!;
    expect(prl.red).toBe(FEMALE_HORMONE_BANDS.PRL.red);
    expect(prl.green).toBe(FEMALE_HORMONE_BANDS.PRL.green);
    expect(prl.normal).toContain(FEMALE_HORMONE_BANDS.PRL.normal);
  });

  it('АЛТ/АСТ/ГГТ — от ВГН резолвера (31), зоны 1.5×/3× посчитаны', () => {
    for (const [marker, code] of [['АЛТ', 'ALT'], ['АСТ', 'AST'], ['ГГТ', 'GGT']] as const) {
      const row = byMarker(marker)!;
      const uln = FEMALE_LAB_BOUNDS[code].uln;
      expect(row.normal, marker).toContain(String(uln));
      expect(row.red, marker).toContain(String(Math.round(uln * 3)));
      expect(row.green, marker).toContain(String(Math.round(uln * 1.5)));
    }
  });

  it('креатинин: зелёная зона = ВГН резолвера (97)', () => {
    expect(byMarker('Креатинин')!.green).toBe(`<${FEMALE_LAB_BOUNDS.CREATININE.uln}`);
  });

  it('литералов 34/32/102/96 в женских печёночных зонах нет', () => {
    const women = src('src/ui/screens/SupportScreen_parts/supportProtocolWomenData.ts');
    expect(women).not.toContain('8–34');
    expect(women).not.toContain('7–32');
    expect(women).not.toContain("yellow:'51–102'");
    expect(women).not.toContain("red:'>96'");
  });
});

describe('LAB_MONITOR_DB: каждая гормональная/почечная цель называет пол', () => {
  const rows = Object.values(LAB_MONITOR_DB).flat() as Array<Record<string, string>>;

  it('креатинин — ♂ <110 / ♀ <97', () => {
    const creat = rows.filter(r => r.markerRu === 'Креатинин' && /мкмоль/.test(r.target || ''));
    expect(creat.length).toBeGreaterThan(0);
    for (const r of creat) {
      expect(r.target).toContain('♂ <110');
      expect(r.target).toContain('♀ <97');
    }
  });

  it('PRL — мужская титрация рядом с женским порогом 800', () => {
    const prl = rows.filter(r => r.markerRu === 'Пролактин (PRL)');
    expect(prl.length).toBeGreaterThanOrEqual(2);
    for (const r of prl) {
      expect(r.target).toContain('♂ <');
      expect(r.target).toContain(`♀ ${FEMALE_HORMONE_BANDS.PRL.green}`);
    }
  });

  it('E2 на курсе — женская фазовая цель вместо «100–200 пмоль/л»', () => {
    const e2 = rows.filter(r => r.markerRu === 'Эстрадиол (E2)' && /на курсе/.test(r.target || ''));
    expect(e2.length).toBeGreaterThanOrEqual(2);
    for (const r of e2) {
      expect(r.target).toContain('♀ по фазе');
      expect(r.target).toContain(FEMALE_HORMONE_BANDS.E2.normal);
    }
  });
});

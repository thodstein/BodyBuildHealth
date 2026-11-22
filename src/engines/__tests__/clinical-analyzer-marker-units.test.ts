import { describe, it, expect } from 'vitest';
import { analyzeClinicalRisks } from '../clinical-analyzer.engine';

/**
 * Проход 199: клинический анализатор читает число в единице своего реестра.
 *
 * `CLINICAL_MARKERS` (реестр патологий) держит ДГТ в нмоль/л (ec50 2.5), а склад
 * отдаёт канон приложения — пг/мл. Без единицы 500 пг/мл считались 500 нмоль/л,
 * и любая живая запись ДГТ выглядела тяжёлой; гемоглобин в г/л (150) против
 * ec50 17 г/дл — тем же образом «всегда высокий».
 *
 * Имена тоже сводятся одним мостом: реестр зовёт анализ `Hematocrit`, склад —
 * `HCT`. Это один анализ, и панель эритроцитоза должна читать оба имени.
 */

const base = { compounds: [], tWeeks: 1, weeksSinceLab: 0, genetics: [] } as const;

const acne = (markers: Parameters<typeof analyzeClinicalRisks>[0]['markers']) =>
  analyzeClinicalRisks({ ...base, markers }).results.find((r) => r.pathologyId === 'acne');

const erythrocytosis = (markers: Parameters<typeof analyzeClinicalRisks>[0]['markers']) =>
  analyzeClinicalRisks({ ...base, markers }).results.find((r) => r.pathologyId === 'erythrocytosis');

describe('проход 199: значение маркера читается в единице реестра', () => {
  it('ДГТ 726 пг/мл — это те же 2.5 нмоль/л: та же точка кривой', () => {
    const inPg = acne([{ code: 'DHT', value: 726.1, unit: 'пг/мл' }]);
    const inNmol = acne([{ code: 'DHT', value: 2.5, unit: 'нмоль/л' }]);
    expect(inPg?.hillScore).toBe(0.5);
    expect(inNmol?.hillScore).toBe(0.5);
  });

  it('без единицы число читается как раньше — в единице реестра', () => {
    // Поле необязательное: старые вызовы и записи без единицы не меняют смысл.
    expect(acne([{ code: 'DHT', value: 2.5 }])?.hillScore).toBe(0.5);
  });

  it('единица другой величины — маркер назван непрочитанным, а не «в норме»', () => {
    const out = analyzeClinicalRisks({ ...base, markers: [{ code: 'DHT', value: 500, unit: '10⁹/л' }] });
    expect(out.markersUnread).toEqual([
      { code: 'DHT', value: 500, unit: '10⁹/л', expectedUnit: 'нмоль/л' },
    ]);
    // Патология без прочитанных маркеров не появляется вовсе.
    expect(out.results.some((r) => r.pathologyId === 'acne')).toBe(false);
  });

  it('имена реестра и склада — один анализ: HCT и Hematocrit дают одно и то же', () => {
    const asRegistry = erythrocytosis([{ code: 'Hematocrit', value: 52, unit: '%' }]);
    const asStorage = erythrocytosis([{ code: 'HCT', value: 52, unit: '%' }]);
    expect(asRegistry?.hillScore).toBe(0.5);
    expect(asStorage?.hillScore).toBe(asRegistry?.hillScore);
    expect(asStorage?.markersUsed).toContain('Hematocrit');
  });

  it('гемоглобин 150 г/л читается как 15 г/дл — единица реестра, не догадка', () => {
    // ec50 реестра — 17 г/дл; в г/л это 170. Прежние 150 «г/дл» давали 0.99.
    const out = erythrocytosis([{ code: 'HGB', value: 150, unit: 'г/л' }]);
    expect(out?.hillScore).toBeLessThan(0.6);
    expect(out?.hillScore).toBeCloseTo((15 * 15) / (17 * 17 + 15 * 15), 2);
  });

  it('прочитанные и непрочитанные не смешиваются в один счётчик', () => {
    const out = analyzeClinicalRisks({
      ...base,
      markers: [
        { code: 'HGB', value: 150, unit: 'г/л' },
        { code: 'DHT', value: 500, unit: '10⁹/л' },
      ],
    });
    expect(out.markersUnread.map((u) => u.code)).toEqual(['DHT']);
    expect(out.markersAnalyzed).toBe(1);
  });
});

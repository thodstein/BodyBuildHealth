import { describe, it, expect } from 'vitest';
import { processUploadedFile } from '../ocr-engine';

/**
 * Регрессия по РЕАЛЬНОМУ выводу tesseract.js (rus+eng, v7), а не по
 * придуманному тексту. Бланк Хеликс отрендерен в PNG (Arial, таблица
 * «Показатель / Результат / Референсные значения / Единицы измерения»)
 * и распознан тем же движком, что в АПК. Текст ниже — дословный output.
 *
 * Что ломалось на этом тексте до фиксов:
 *  - тестостерон 18,4 нмоль/л сохранялся как «18.4 ng/dL» (потеря «н») —
 *    реально 530.7 ng/dL;
 *  - витамин D брался как 25 из названия «25-ОН» вместо 75;
 *  - С-реактивный белок = 5 (верхняя граница 0-5) вместо 1.2;
 *  - ДГЭА-С = 12.08 из строки «Дата 12.08.2026» (fuzzy «Дата»→«дгэа»).
 */
const HELIX_OCR = `ХЕЛИКС

Лабораторная служба Хеликс

Пациент: Иванов Иван Иванович, 34 года

Дата взятия биоматериала: 03.09.2026

Заказ № 7745120
Показатель Результат  Pedepenchbie значенийдиницы измрения
АЛТ 42 0-41 Е/л

АСТ 30 0-40 E/n
Креатинин 88 62 - 106 мкмоль/л
Мочевина 5,2 2,5 - 8,3 ммоль/л
Глюкоза 5,1 4,1 - 5,9 ммоль/л
Tr 1,8 0,4 - 4,0 МЕд/л
T4 свободный 14,2 9,0 - 19,1 nmonb/n
Тестостерон общий 18,4 8,6 - 29,0 HMonb/n
Эстрадиол 120 68 - 1268 nmonb/n
Пролактин 240 86 - 324 мЕд/л
Ферритин 210 30 - 400 мкг/л
25-ОН витамин D 75 75 - 250 нмоль/л
С-реактивный белок 1,2 0-5 мг/л
`;

describe('реальный OCR-текст бланка Хеликс → показатели', () => {
  it('распознаёт значения, единицы и референсы без искажений', async () => {
    const res = await processUploadedFile(new File([HELIX_OCR], 'helix-ocr.txt', { type: 'text/plain' }));
    const byCode = new Map(res.labs.map((l) => [l.code, l]));

    expect(res.date).toBe('2026-09-03');
    expect(byCode.size).toBeGreaterThanOrEqual(11);

    // Печёночные/почечные — значения и референсы из таблицы.
    expect(byCode.get('ALT')).toMatchObject({ value: 42, unit: 'U/L', refHigh: 41, isAbnormal: true });
    expect(byCode.get('AST')).toMatchObject({ value: 30, unit: 'U/L', refHigh: 40, isAbnormal: false });
    expect(byCode.get('CREATININE')).toMatchObject({ value: 88, unit: 'umol/L', refLow: 62, refHigh: 106 });
    expect(byCode.get('UREA')).toMatchObject({ value: 5.2, refLow: 2.5, refHigh: 8.3 });
    expect(byCode.get('GLU')).toMatchObject({ value: 5.1, refLow: 4.1, refHigh: 5.9 });

    // Единицы с префиксом «н»/«п» больше не теряются: коэффициенты применились.
    expect(byCode.get('TT')?.value).toBeCloseTo(530.7, 1);
    expect(byCode.get('TT')?.unit).toBe('ng/dL');
    expect(byCode.get('E2')?.value).toBeCloseTo(32.69, 1);
    expect(byCode.get('E2')?.unit).toBe('pg/mL');
    expect(byCode.get('PRL')?.value).toBeCloseTo(11.32, 1);
    expect(byCode.get('PRL')?.unit).toBe('ng/mL');
    expect(byCode.get('FERRITIN')?.value).toBe(210);

    // OCR прочитал «T4 свободный» латинской T — такой вариант тоже должен
    // находиться (иначе FT4 молча выпадал).
    expect(byCode.get('FT4')?.value).toBe(14.2);
    expect(byCode.get('FT4')?.unit).toBe('pmol/L');
    expect(byCode.get('FT4')?.refLow).toBe(9);
    expect(byCode.get('FT4')?.refHigh).toBe(19.1);

    // Значение равно нижней границе референса — это значение, а не граница.
    expect(byCode.get('VITD')?.value).toBeCloseTo(30.05, 1);
    expect(byCode.get('VITD')?.unit).toBe('ng/mL');

    // «1,2 0-5 мг/л»: раньше верхняя граница 5 становилась результатом.
    expect(byCode.get('CRP')?.value).toBe(1.2);
    expect(byCode.get('CRP')?.refLow).toBe(0);
    expect(byCode.get('CRP')?.refHigh).toBe(5);

    // Ложные показатели из служебных слов/обрывков не появляются.
    expect(byCode.has('DHEA_S')).toBe(false);
    expect(byCode.has('TR')).toBe(false);
  });
});

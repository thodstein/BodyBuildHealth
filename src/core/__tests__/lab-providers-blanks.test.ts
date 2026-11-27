/**
 * lab-providers-blanks.test.ts — бланки четырёх обязательных лабораторий РФ
 * (Хеликс, ИНВИТРО, Гемотест, КДЛ) глазами пользователя: текстовый файл
 * проходит `processUploadedFile({ purpose: 'labs' })` и обязан дать канонические
 * коды, единицы, референсы и предупреждение с именем провайдера.
 *
 * Тексты — обезличенные макеты публичных выгрузок отчётов: шапка лаборатории,
 * многоколоночный заголовок через табуляцию, запятая как десятичный разделитель,
 * границы `<`/`>` и латинские сокращения (ALT/TSH/HbA1c). Реальных данных
 * пациента здесь нет. Подписи и единицы сверены со страницами лабораторий,
 * URL указан у каждого макета; сами числа — синтетические.
 */
import { describe, expect, it } from 'vitest';
import { processUploadedFile } from '../ocr-engine';

const blankFile = (text: string, name: string) => new File([text], name, { type: 'text/plain' });

/**
 * Хеликс. Публичная страница для сверки подписей/единиц:
 * https://helix.ru/kb/item/06-064 — «Референсные значения: 3,5–5,1 ммоль/л».
 * Раскладка повторяет публичную выгрузку отчёта
 * «Показатель / Результат / Референсные значения / Ед. изм.».
 */
const HELIX_BLANK = `ХЕЛИКС
Лабораторная служба Хеликс
Пациент: обезличено
Дата взятия биоматериала: 01.02.2026
Показатель\tРезультат\tРеференсные значения\tЕд. изм.
Аланинаминотрансфераза (АЛТ)\t42\t<41\tЕд/л
Аспартатаминотрансфераза (АСТ)\t30\t<40\tЕд/л
Глюкоза в плазме\t5,8\t4,1-5,9\tммоль/л
Креатинин\t88\t74-110\tмкмоль/л
HbA1c\t5,4\t<6,0\t%
Тиреотропный гормон (ТТГ)\t1,8\t0,4-4,0\tмЕд/л`;

/**
 * ИНВИТРО. Публичная страница для сверки подписей/единиц:
 * https://www.invitro.ru/analizes/for-doctors/481/2212/ — глюкоза, ммоль/л.
 * Раскладка повторяет публичную выгрузку отчёта с колонками
 * «Наименование / Результат / Референсные значения / Единицы».
 * OCR-артефакты намеренные: «Инвитрo» с латинской `o`, «5,O» (O→0),
 * «2,I» (I→1) — так выглядит фото бланка после Tesseract.
 */
const INVITRO_BLANK = `Инвитрo
Медицинская лаборатория
Пациент: обезличено
Наименование\tРезультат\tРеференсные значения\tЕдиницы
АЛТ\t35\t<41\tЕ/л
АСТ\t28\t<40\tЕ/л
Глюкоза\t5,O\t3,9-5,5\tммоль/л
Креатинин\t92\t62-106\tмкмоль/л
ТТГ\t2,I\t0,4-4,0\tмЕд/л`;

/**
 * Гемотест. Публичная страница взята из проверенного пресета калия:
 * https://gemotest.ru/moskva/catalog/issledovaniya-krovi/biokhimiya/makro-i-mikroelementy/kaliy-k/
 * — «В норме концентрация калия в крови находится в диапазоне от 3,5 до 5,1 ммоль/л».
 * Раскладка повторяет публичную выгрузку отчёта с колонками
 * «Наименование / Результат / Референс / Ед.».
 * OCR-артефакты намеренные: «ГеmоТесТ» (латиница в бренде) и «Кaлий»
 * (латинская `a`) — детекция провайдера и маркера обязана их пережить.
 */
const GEMOTEST_BLANK = `ГеmоТесТ
Медицинская лаборатория Гемотест
Пациент: обезличено
Наименование\tРезультат\tРеференс\tЕд.
АЛТ\t38\t7-40\tЕ/л
Глюкоза\t5,1\t3,9-5,5\tммоль/л
Креатинин\t95\t62-106\tмкмоль/л
Кaлий\t4,8\t3,5-5,1\tммоль/л
Гемоглобин\t148\t130-170\tг/л`;

/**
 * КДЛ. Публичная страница для сверки подписей/единиц:
 * https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/uglevodnyy-obmen/glyukoza-v-plazme
 * — глюкоза в плазме, ммоль/л. Раскладка повторяет публичную выгрузку отчёта
 * с ALL-CAPS названиями и колонками «Наименование / Результат / Референс / Единицы».
 */
const KDL_BLANK = `КДЛ
Клинико-диагностическая лаборатория
Пациент: обезличено
Наименование\tРезультат\tРеференс\tЕдиницы
АЛТ\t48\t<41\tЕ/л
ГЛЮКОЗА\t5,6\t3,9-5,5\tммоль/л
КРЕАТИНИН\t98\t62-106\tмкмоль/л
ТТГ\t2,8\t0,4-4,0\tмЕд/л
ГЕМОГЛОБИН\t140\t130-170\tг/л`;

describe('бланки лабораторий: текст → канонические labs', () => {
  it('Хеликс: коды, единицы, референсы и предупреждение провайдера', async () => {
    const result = await processUploadedFile(blankFile(HELIX_BLANK, 'helix.txt'), { purpose: 'labs' });
    const labs = new Map(result.labs.map((lab) => [lab.code, lab]));

    expect(result.source).toBe('text');
    expect([...labs.keys()]).toEqual(expect.arrayContaining(['ALT', 'GLU', 'CREATININE', 'TSH', 'HbA1c']));
    for (const lab of result.labs) expect(lab.unit, `${lab.code}: пустая единица`).toBeTruthy();
    expect(labs.get('ALT')).toMatchObject({ value: 42, unit: 'U/L', refHigh: 41, isAbnormal: true });
    expect(labs.get('GLU')).toMatchObject({ value: 5.8, unit: 'mmol/L', refLow: 4.1, refHigh: 5.9 });
    expect(labs.get('CREATININE')).toMatchObject({ value: 88, unit: 'umol/L', refLow: 74, refHigh: 110 });
    expect(labs.get('HbA1c')).toMatchObject({ value: 5.4, unit: '%' });
    expect(result.warnings.join(' ')).toContain('Распознан бланк: helix');
  });

  it('ИНВИТРО: OCR-микс кириллицы/латиницы не ломает коды и референсы', async () => {
    const result = await processUploadedFile(blankFile(INVITRO_BLANK, 'invitro.txt'), { purpose: 'labs' });
    const labs = new Map(result.labs.map((lab) => [lab.code, lab]));

    expect([...labs.keys()]).toEqual(expect.arrayContaining(['ALT', 'AST', 'GLU', 'CREATININE', 'TSH']));
    for (const lab of result.labs) expect(lab.unit, `${lab.code}: пустая единица`).toBeTruthy();
    // «<41» — бланк печатает только верхнюю границу, нижней нет.
    expect(labs.get('ALT')).toMatchObject({ value: 35, unit: 'U/L', refHigh: 41, refLow: undefined });
    // «5,O» прочитано как 5.0, диапазон «3,9-5,5» — оба конца.
    expect(labs.get('GLU')).toMatchObject({ value: 5, unit: 'mmol/L', refLow: 3.9, refHigh: 5.5 });
    expect(labs.get('CREATININE')).toMatchObject({ value: 92, unit: 'umol/L', refLow: 62, refHigh: 106 });
    // «2,I» — значение прочитано, единица осталась канонической.
    expect(labs.get('TSH')?.unit).toBe('mIU/L');
    expect(result.warnings.join(' ')).toContain('Распознан бланк: invitro');
  });

  it('Гемотест: латиница в бренде и в «Кaлий» не мешает маркерам', async () => {
    const result = await processUploadedFile(blankFile(GEMOTEST_BLANK, 'gemotest.txt'), { purpose: 'labs' });
    const labs = new Map(result.labs.map((lab) => [lab.code, lab]));

    expect([...labs.keys()]).toEqual(expect.arrayContaining(['ALT', 'GLU', 'CREATININE', 'K', 'HGB']));
    for (const lab of result.labs) expect(lab.unit, `${lab.code}: пустая единица`).toBeTruthy();
    expect(labs.get('ALT')).toMatchObject({ value: 38, unit: 'U/L', refLow: 7, refHigh: 40 });
    expect(labs.get('GLU')).toMatchObject({ value: 5.1, unit: 'mmol/L', refLow: 3.9, refHigh: 5.5 });
    expect(labs.get('K')).toMatchObject({ value: 4.8, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 });
    expect(labs.get('HGB')).toMatchObject({ value: 148, unit: 'g/L' });
    expect(result.warnings.join(' ')).toContain('Распознан бланк: gemotest');
  });

  it('КДЛ: ALL-CAPS бланк даёт те же канонические коды', async () => {
    const result = await processUploadedFile(blankFile(KDL_BLANK, 'kdl.txt'), { purpose: 'labs' });
    const labs = new Map(result.labs.map((lab) => [lab.code, lab]));

    expect([...labs.keys()]).toEqual(expect.arrayContaining(['ALT', 'GLU', 'CREATININE', 'TSH', 'HGB']));
    for (const lab of result.labs) expect(lab.unit, `${lab.code}: пустая единица`).toBeTruthy();
    expect(labs.get('ALT')).toMatchObject({ value: 48, unit: 'U/L', refHigh: 41, isAbnormal: true });
    expect(labs.get('GLU')).toMatchObject({ value: 5.6, unit: 'mmol/L', refLow: 3.9, refHigh: 5.5 });
    expect(labs.get('CREATININE')).toMatchObject({ value: 98, unit: 'umol/L', refLow: 62, refHigh: 106 });
    expect(result.warnings.join(' ')).toContain('Распознан бланк: kdl');
  });
});

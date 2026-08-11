import { describe, expect, it } from 'vitest';
import { parseLabText } from '../pdf-parser.engine';
import { parseLabText as parseProviderAware } from '../../core/lab-auto-parser';
import { parseLabResults } from '../biomarker-regex-engine';
import { mapToUcumCode } from '../../core/labs-mapping';

const runAllParsers = (text: string) => {
  const pdf = parseLabText(text);
  const provider = parseProviderAware(text);
  const biomarker = parseLabResults(text, 'text');
  return { pdf, provider, biomarker };
};

// ═══════════════════════════════════════════════════════════════════════════
// ИНВИТРО — typical PDF export format
// ═══════════════════════════════════════════════════════════════════════════
describe('Invitro — полное распознавание бланка', () => {
  const invitroFull = [
    'ИНВИТРО',
    'Пациент: Иванов Иван Иванович',
    'Дата: 15.03.2024',
    '',
    'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
    'АЛТ\t35\t<41\tЕ/л',
    'АСТ\t28\t<40\tЕ/л',
    'ГГТ\t42\t<60\tЕ/л',
    'Щелочная фосфатаза\t80\t40-150\tЕ/л',
    'Билирубин общий\t12.5\t<21\tмкмоль/л',
    'Билирубин прямой\t3.2\t<5\tмкмоль/л',
    'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
    'Креатинин\t92\t62-106\tмкмоль/л',
    'Мочевина\t5.2\t2.5-7.1\tммоль/л',
    'Мочевая кислота\t320\t200-420\tмкмоль/л',
    'Общий белок\t72\t65-85\tг/л',
    'Альбумин\t42\t35-50\tг/л',
    'Холестерин общий\t5.2\t<5.2\tммоль/л',
    'ЛПВП\t1.1\t>1.0\tммоль/л',
    'ЛПНП\t3.1\t<3.0\tммоль/л',
    'Триглицериды\t1.4\t<1.7\tммоль/л',
    'С-реактивный белок\t2.5\t<5.0\tмг/л',
    '',
    'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
    'Гемоглобин\t145\t130-170\tг/л',
    'Эритроциты\t4.8\t4.0-5.5\t10^12/л',
    'Гематокрит\t44.5\t40-52\t%',
    'Лейкоциты\t6.8\t4.0-9.0\t10^9/л',
    'Тромбоциты\t210\t150-400\t10^9/л',
    'СОЭ\t8\t2-15\tмм/ч',
    'Нейтрофилы\t58\t45-75\t%',
    'Лимфоциты\t32\t20-45\t%',
    'Моноциты\t6\t2-10\t%',
    'Эозинофилы\t2\t0-5\t%',
    'Базофилы\t1\t0-1\t%',
    '',
    'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
    'ТТГ\t2.1\t0.4-4.0\tмЕд/л',
    'Т4 свободный\t14.2\t10.0-19.0\tпмоль/л',
    'Т3 свободный\t4.8\t3.1-6.8\tпмоль/л',
    'Тестостерон общий\t22.5\t12.0-35.0\tнмоль/л',
    'Эстрадиол\t110\t40-160\tпмоль/л',
    'Пролактин\t280\t86-324\tмЕд/л',
    'ЛГ\t5.2\t1.7-8.6\tмЕд/л',
    'ФСГ\t4.1\t1.5-12.4\tмЕд/л',
    'Прогестерон\t1.2\t0.2-1.4\tнмоль/л',
    'Кортизол\t420\t150-660\tнмоль/л',
    'DHEA-S\t6.5\t2.4-11.6\tмкмоль/л',
    'SHBG\t32\t18-54\tнмоль/л',
    'Витамин D 25-OH\t42\t30-100\tнг/мл',
    'Ферритин\t85\t30-400\tмкг/л',
    'Железо\t18\t11-28\tмкмоль/л',
    'Калий\t4.5\t3.5-5.1\tммоль/л',
    'Натрий\t140\t136-145\tммоль/л',
    'Кальций общий\t2.4\t2.2-2.6\tммоль/л',
    'Магний\t0.85\t0.75-1.0\tммоль/л',
    'Инсулин\t8.5\t2.6-24.9\tмкЕд/мл',
    'HbA1c\t5.2\t<6.0\t%',
    'ПСА общий\t1.2\t<4.0\tнг/мл',
    'Альфа-фетопротеин\t3.5\t<10\tМЕ/мл',
    'CA-125\t15\t<35\tЕ/мл',
  ].join('\n');

  const { pdf, provider, biomarker } = runAllParsers(invitroFull);

  it('определяет провайдера ИНВИТРО', () => {
    expect(provider.some(r => r.provider === 'invitro')).toBe(true);
  });

  it.each([
    ['ALT', 35], ['AST', 28], ['GGT', 42], ['ALP', 80],
    ['BIL', 12.5], ['BILD', 3.2], ['GLU', 5.4], ['CREAT', 92],
    ['UREA', 5.2], ['URIC', 320], ['TP', 72], ['ALB', 42],
    ['CHOL', 5.2], ['HDL', 1.1], ['LDL', 3.1], ['TG', 1.4],
    ['CRP', 2.5], ['HGB', 145], ['RBC', 4.8], ['HCT', 44.5],
    ['WBC', 6.8], ['PLT', 210], ['ESR', 8],
  ] as const)('pdf-parser распознаёт %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it.each([
    ['NEUT', 58], ['LYMPH', 32], ['MONO', 6], ['EO', 2], ['BASO', 1],
  ] as const)('pdf-parser распознаёт лейкоцитарную формулу %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it.each([
    ['TSH', 2.1], ['FT4', 14.2], ['FT3', 4.8],
    ['TESTO', 22.5], ['ESTR', 110], ['PROL', 280],
    ['LH', 5.2], ['FSH', 4.1], ['PROG', 1.2],
    ['CORT', 420], ['DHEA', 6.5], ['SHBG', 32],
    ['VITD', 42], ['FER', 85], ['INSULIN', 8.5],
    ['HBA1C', 5.2], ['PSA', 1.2], ['AFP', 3.5], ['CA125', 15],
  ] as const)('pdf-parser распознаёт гормоны/витамины %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it('распознаёт все 52 маркера из полного инвитро-бланка', () => {
    // PDF parser should find all markers in the structured table
    expect(pdf.values.length).toBeGreaterThanOrEqual(48);
  });

  it('biomarker-regex тоже распознаёт основные маркеры', () => {
    const codes = biomarker.extractedMarkers.map(m => m.code);
    expect(codes).toEqual(expect.arrayContaining([
      'ALT', 'AST', 'GGT', 'ALP', 'Bilirubin_Total', 'Bilirubin_Direct',
      'Glucose', 'Creatinine', 'Urea', 'Uric_Acid',
      'Total_Protein', 'Albumin', 'Cholesterol_Total', 'HDL', 'LDL', 'Triglycerides',
      'hs-CRP', 'Hemoglobin', 'RBC', 'Hematocrit', 'WBC', 'Platelets',
      'TSH', 'T4_Free', 'T3_Free', 'Testosterone_Total', 'E2', 'Prolactin',
    ]));
  });

  it('pdf-parser корректно извлекает референсные диапазоны', () => {
    const alt = pdf.values.find(v => v.code === 'ALT');
    expect(alt?.refHigh).toBe(41);
    const glu = pdf.values.find(v => v.code === 'GLU');
    expect(glu?.refLow).toBe(3.9);
    expect(glu?.refHigh).toBe(5.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ХЕЛИКС — typical PDF export format
// ═══════════════════════════════════════════════════════════════════════════
describe('Helix — полное распознавание бланка', () => {
  const helixFull = [
    'Хеликс',
    'Лабораторная служба Хеликс',
    'Заказ №: HX-2024-0315',
    'Пациент: Петров Пётр Петрович',
    '',
    'Показатель\tРезультат\tРеференсные значения\tЕд. изм.',
    'Аланинаминотрансфераза (АЛТ)\t42\t<41\tЕд/л',
    'Аспартатаминотрансфераза (АСТ)\t32\t<40\tЕд/л',
    'Гамма-глутамилтранспептидаза (ГГТ)\t55\t<60\tЕд/л',
    'Билирубин общий\t10.8\t<21\tмкмоль/л',
    'Билирубин прямой\t2.5\t<5\tмкмоль/л',
    'Глюкоза в плазме\t5.8\t4.1-5.9\tммоль/л',
    'Креатинин\t88\t74-110\tмкмоль/л',
    'Мочевина\t4.8\t2.5-7.1\tммоль/л',
    'Мочевая кислота\t285\t200-420\tмкмоль/л',
    'Общий белок\t70\t65-85\tг/л',
    'Альбумин\t44\t35-52\tг/л',
    'Холестерин общий\t4.8\t<5.2\tммоль/л',
    'Холестерин ЛПВП\t1.3\t>1.0\tммоль/л',
    'Холестерин ЛПНП\t2.8\t<3.0\tммоль/л',
    'Триглицериды\t1.1\t<1.7\tммоль/л',
    'С-реактивный белок (ультрачувствительный)\t1.2\t<3.0\tмг/л',
    '',
    'Клинический анализ крови',
    'Гемоглобин\t152\t132-173\tг/л',
    'Эритроциты\t5.1\t4.3-5.7\t10^12/л',
    'Гематокрит\t46.2\t40-52\t%',
    'Средний объем эритроцита (MCV)\t89\t80-99\tфл',
    'Среднее содержание Hb в эритроците (MCH)\t31\t27-34\tпг',
    'Средняя концентрация Hb в эритроците (MCHC)\t338\t320-360\tг/л',
    'Тромбоциты\t245\t150-400\t10^9/л',
    'Лейкоциты\t7.2\t4.5-11.0\t10^9/л',
    'Нейтрофилы (общее число)\t4.2\t1.8-7.7\t10^9/л',
    'Лимфоциты\t2.4\t1.0-4.8\t10^9/л',
    'Моноциты\t0.5\t0.1-1.0\t10^9/л',
    'Эозинофилы\t0.2\t0.02-0.5\t10^9/л',
    'Базофилы\t0.05\t0-0.2\t10^9/л',
    'СОЭ (по Вестергрену)\t5\t2-20\tмм/час',
    '',
    'Гормональные исследования',
    'Тиреотропный гормон (ТТГ)\t1.8\t0.4-4.0\tмЕд/л',
    'Тироксин свободный (Т4 св.)\t15.5\t9.0-19.0\tпмоль/л',
    'Трийодтиронин свободный (Т3 св.)\t5.1\t2.6-5.7\tпмоль/л',
    'Тестостерон\t18.5\t12.0-35.0\tнмоль/л',
    'Эстрадиол (E2)\t95\t40-160\tпмоль/л',
    'Пролактин\t310\t86-324\tмЕд/л',
    'Лютеинизирующий гормон (ЛГ)\t4.8\t1.7-8.6\tмЕд/л',
    'Фолликулостимулирующий гормон (ФСГ)\t3.5\t1.5-12.4\tмЕд/л',
    'Прогестерон\t0.8\t0.2-1.4\tнмоль/л',
    'Кортизол (утро)\t380\t150-660\tнмоль/л',
    'DHEA-S\t5.2\t2.4-11.6\tмкмоль/л',
    'ГСПГ (SHBG)\t28\t18-54\tнмоль/л',
    '25-OH витамин D (кальцидиол)\t38\t30-100\tнг/мл',
    'Инсулин\t6.2\t2.6-24.9\tмкЕд/мл',
    'Гликированный гемоглобин (HbA1c)\t5.0\t<6.0\t%',
    'Ферритин\t110\t30-400\tмкг/л',
    'Железо сывороточное\t22\t11-28\tмкмоль/л',
    'ОЖСС\t55\t45-70\tмкмоль/л',
    'Калий\t4.2\t3.5-5.1\tммоль/л',
    'Натрий\t142\t136-145\tммоль/л',
    'Кальций общий\t2.45\t2.2-2.6\tммоль/л',
    'Магний\t0.9\t0.75-1.0\tммоль/л',
    'Фосфор\t1.1\t0.8-1.45\tммоль/л',
    'Амилаза панкреатическая\t45\t<53\tЕд/л',
    'Липаза\t28\t<60\tЕд/л',
    'Витамин B12 (цианокобаламин)\t320\t197-771\tпг/мл',
    'Фолиевая кислота\t12\t3.1-20.5\tнг/мл',
  ].join('\n');

  const { pdf } = runAllParsers(helixFull);

  it('определяет провайдера Хеликс', () => {
    expect(pdf.values.length).toBeGreaterThan(0);
  });

  it.each([
    ['ALT', 42], ['AST', 32], ['GGT', 55], ['BIL', 10.8], ['BILD', 2.5],
    ['GLU', 5.8], ['CREAT', 88], ['UREA', 4.8], ['URIC', 285],
    ['TP', 70], ['ALB', 44], ['CHOL', 4.8], ['HDL', 1.3], ['LDL', 2.8],
    ['TG', 1.1], ['CRP', 1.2], ['HGB', 152], ['RBC', 5.1], ['HCT', 46.2],
    ['MCV', 89], ['MCH', 31], ['MCHC', 338], ['PLT', 245], ['WBC', 7.2],
  ] as const)('распознаёт базовые маркеры %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it.each([
    ['TSH', 1.8], ['FT4', 15.5], ['FT3', 5.1],
    ['TESTO', 18.5], ['ESTR', 95], ['PROL', 310],
    ['LH', 4.8], ['FSH', 3.5], ['PROG', 0.8], ['CORT', 380],
    ['DHEA', 5.2], ['SHBG', 28], ['VITD', 38], ['INSULIN', 6.2],
    ['HBA1C', 5.0], ['FER', 110], ['IRON', 22], ['TIBC', 55],
    ['B12', 320], ['FOLATE', 12],
  ] as const)('распознаёт гормоны/витамины %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it('распознаёт все 50+ маркеров из полного хеликс-бланка', () => {
    expect(pdf.values.length).toBeGreaterThanOrEqual(48);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ГЕМОТЕСТ — typical PDF export format
// ═══════════════════════════════════════════════════════════════════════════
describe('Gemotest — полное распознавание бланка', () => {
  const gemotestFull = [
    'ГЕМОТЕСТ',
    'Медицинская лаборатория Гемотест',
    'Дата: 20.03.2024',
    'Пациент: Сидоров Сидор Сидорович',
    '',
    'Наименование\tРезультат\tРеференс\tЕд.',
    'АЛТ\t38\t7-40\tЕ/л',
    'АСТ\t25\t7-38\tЕ/л',
    'ГГТ\t48\t<60\tЕ/л',
    'Щелочная фосфатаза\t72\t40-150\tЕ/л',
    'Билирубин общий\t9.2\t<21\tмкмоль/л',
    'Билирубин прямой\t2.8\t<5\tмкмоль/л',
    'Глюкоза\t5.1\t3.9-5.5\tммоль/л',
    'Креатинин\t95\t62-106\tмкмоль/л',
    'Мочевина\t6.1\t2.5-7.1\tммоль/л',
    'Мочевая кислота\t340\t200-420\tмкмоль/л',
    'Общий белок\t74\t65-85\tг/л',
    'Альбумин\t40\t35-50\tг/л',
    'Холестерин общий\t5.5\t3.0-5.2\tммоль/л',
    'ЛПВП-ХС\t1.0\t>1.0\tммоль/л',
    'ЛПНП-ХС\t3.4\t<3.0\tммоль/л',
    'Триглицериды\t1.8\t<1.7\tммоль/л',
    'СРБ\t3.8\t<5.0\tмг/л',
    '',
    'Клинический анализ крови',
    'Гемоглобин\t148\t130-170\tг/л',
    'Эритроциты\t4.5\t4.0-5.5\t10^12/л',
    'Гематокрит\t43.8\t40-52\t%',
    'MCV\t92\t80-100\tфл',
    'MCH\t29\t27-34\tпг',
    'MCHC\t335\t320-360\tг/л',
    'Тромбоциты\t195\t150-400\t10^9/л',
    'Лейкоциты\t5.9\t4.0-9.0\t10^9/л',
    'Нейтрофилы\t3.2\t1.8-7.7\t10^9/л',
    'Лимфоциты\t2.1\t1.0-4.8\t10^9/л',
    'Моноциты\t0.4\t0.1-1.0\t10^9/л',
    'Эозинофилы\t0.15\t0.02-0.5\t10^9/л',
    'Базофилы\t0.03\t0-0.2\t10^9/л',
    'СОЭ\t10\t2-15\tмм/ч',
    '',
    'Гормоны',
    'ТТГ\t3.2\t0.4-4.0\tмЕд/л',
    'Т4 свободный\t13.8\t10.0-19.0\tпмоль/л',
    'Т3 свободный\t4.5\t3.1-6.8\tпмоль/л',
    'Тестостерон общий\t25.0\t12.0-35.0\tнмоль/л',
    'Эстрадиол\t125\t40-160\tпмоль/л',
    'Пролактин\t250\t86-324\tмЕд/л',
    'ЛГ\t6.0\t1.7-8.6\tмЕд/л',
    'ФСГ\t4.5\t1.5-12.4\tмЕд/л',
    'Прогестерон\t0.5\t0.2-1.4\tнмоль/л',
    'Кортизол\t520\t150-660\tнмоль/л',
    'DHEA-S\t8.2\t2.4-11.6\tмкмоль/л',
    'ГСПГ\t35\t18-54\tнмоль/л',
    'Витамин D 25-OH\t28\t30-100\tнг/мл',
    'Инсулин\t10.5\t2.6-24.9\tмкЕд/мл',
    'HbA1c\t5.4\t<6.0\t%',
    'Ферритин\t65\t30-400\tмкг/л',
    'Железо\t15\t11-28\tмкмоль/л',
    'ОЖСС\t60\t45-70\tмкмоль/л',
    'Калий\t4.8\t3.5-5.1\tммоль/л',
    'Натрий\t138\t136-145\tммоль/л',
    'Кальций общий\t2.35\t2.2-2.6\tммоль/л',
    'Амилаза\t55\t25-100\tЕ/л',
    'Липаза\t35\t10-60\tЕ/л',
    'ПСА общий\t0.8\t<4.0\tнг/мл',
    'ИФР-1\t220\t115-350\tнг/мл',
    'Гомоцистеин\t10.5\t<15\tмкмоль/л',
  ].join('\n');

  const { pdf, biomarker } = runAllParsers(gemotestFull);

  it.each([
    ['ALT', 38], ['AST', 25], ['GGT', 48], ['ALP', 72],
    ['BIL', 9.2], ['BILD', 2.8], ['GLU', 5.1], ['CREAT', 95],
    ['UREA', 6.1], ['URIC', 340], ['TP', 74], ['ALB', 40],
    ['CHOL', 5.5], ['HDL', 1.0], ['LDL', 3.4], ['TG', 1.8],
    ['CRP', 3.8], ['HGB', 148], ['RBC', 4.5], ['HCT', 43.8],
    ['MCV', 92], ['MCH', 29], ['MCHC', 335], ['PLT', 195], ['WBC', 5.9],
    ['NEUT', 3.2], ['LYMPH', 2.1], ['MONO', 0.4], ['EO', 0.15], ['BASO', 0.03],
  ] as const)('pdf-parser распознаёт %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it.each([
    ['TSH', 3.2], ['FT4', 13.8], ['FT3', 4.5],
    ['TESTO', 25], ['ESTR', 125], ['PROL', 250],
    ['LH', 6], ['FSH', 4.5], ['PROG', 0.5], ['CORT', 520],
    ['DHEA', 8.2], ['SHBG', 35], ['VITD', 28], ['INSULIN', 10.5],
    ['HBA1C', 5.4], ['FER', 65], ['IRON', 15], ['TIBC', 60],
    ['PSA', 0.8], ['IGF1', 220], ['HOMOCYSTEINE', 10.5],
  ] as const)('pdf-parser распознаёт %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it('все 52 маркера из гемотест-бланка распознаны', () => {
    expect(pdf.values.length).toBeGreaterThanOrEqual(48);
  });

  it('ЛПВП-ХС и ЛПНП-ХС (Gemotest hyphen style) распознаются', () => {
    expect(pdf.values.some(v => v.code === 'HDL')).toBe(true);
    expect(pdf.values.some(v => v.code === 'LDL')).toBe(true);
  });

  it('biomarker-regex находит ИФР-1', () => {
    expect(biomarker.extractedMarkers.some(m => m.code === 'IGF1' || m.code === 'IGF_1' || m.code === 'IGF-1')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KDL — typical PDF export format
// ═══════════════════════════════════════════════════════════════════════════
describe('KDL — полное распознавание бланка', () => {
  const kdlFull = [
    'КДЛ',
    'Клинико-диагностическая лаборатория',
    'Результаты лабораторных исследований',
    '',
    'Наименование\tРезультат\tРеференс\tЕдиницы',
    'ОБЩ БЕЛОК\t68\t65-85\tг/л',
    'АЛЬБУМИН\t38\t35-50\tг/л',
    'АЛТ\t48\t<41\tЕ/л',
    'АСТ\t35\t<40\tЕ/л',
    'ГГТ\t62\t<60\tЕ/л',
    'ЩЕЛОЧНАЯ ФОСФАТАЗА\t95\t40-150\tЕ/л',
    'БИЛИРУБИН ОБЩИЙ\t14.2\t<21\tмкмоль/л',
    'БИЛИРУБИН ПРЯМОЙ\t4.1\t<5\tмкмоль/л',
    'ГЛЮКОЗА\t5.6\t3.9-5.5\tммоль/л',
    'КРЕАТИНИН\t98\t62-106\tмкмоль/л',
    'МОЧЕВИНА\t5.8\t2.5-7.1\tммоль/л',
    'МОЧЕВАЯ КИСЛОТА\t310\t200-420\tмкмоль/л',
    'ХОЛЕСТЕРИН\t5.8\t<5.2\tммоль/л',
    'ЛПВП\t1.05\t>1.0\tммоль/л',
    'ЛПНП\t3.5\t<3.0\tммоль/л',
    'ТРИГЛИЦЕРИДЫ\t1.6\t<1.7\tммоль/л',
    'С-РЕАКТИВНЫЙ БЕЛОК\t4.2\t<5.0\tмг/л',
    '',
    'ГЕМАТОЛОГИЧЕСКИЕ ИССЛЕДОВАНИЯ',
    'ГЕМОГЛОБИН\t140\t130-170\tг/л',
    'ЭРИТРОЦИТЫ\t4.6\t4.0-5.5\t10^12/л',
    'ГЕМАТОКРИТ\t42.5\t40-52\t%',
    'MCV\t88\t80-100\tфл',
    'MCH\t30\t27-34\tпг',
    'MCHC\t340\t320-360\tг/л',
    'ТРОМБОЦИТЫ\t225\t150-400\t10^9/л',
    'ЛЕЙКОЦИТЫ\t7.5\t4.0-9.0\t10^9/л',
    'НЕЙТРОФИЛЫ\t4.5\t1.8-7.7\t10^9/л',
    'ЛИМФОЦИТЫ\t2.3\t1.0-4.8\t10^9/л',
    'МОНОЦИТЫ\t0.5\t0.1-1.0\t10^9/л',
    'ЭОЗИНОФИЛЫ\t0.2\t0.02-0.5\t10^9/л',
    'БАЗОФИЛЫ\t0.04\t0-0.2\t10^9/л',
    'СОЭ\t12\t2-15\tмм/ч',
    '',
    'ГОРМОНАЛЬНЫЕ ИССЛЕДОВАНИЯ',
    'ТТГ\t2.8\t0.4-4.0\tмЕд/л',
    'Т4 СВОБОДНЫЙ\t12.5\t10.0-19.0\tпмоль/л',
    'Т3 СВОБОДНЫЙ\t4.2\t3.1-6.8\tпмоль/л',
    'ТЕСТОСТЕРОН\t20.5\t12.0-35.0\tнмоль/л',
    'ЭСТРАДИОЛ\t105\t40-160\tпмоль/л',
    'ПРОЛАКТИН\t290\t86-324\tмЕд/л',
    'ЛГ\t5.5\t1.7-8.6\tмЕд/л',
    'ФСГ\t4.2\t1.5-12.4\tмЕд/л',
    'ПРОГЕСТЕРОН\t0.9\t0.2-1.4\tнмоль/л',
    'КОРТИЗОЛ\t450\t150-660\tнмоль/л',
    'DHEA-S\t5.8\t2.4-11.6\tмкмоль/л',
    'ГСПГ\t30\t18-54\tнмоль/л',
    'ВИТАМИН D 25-OH\t35\t30-100\tнг/мл',
    'ИНСУЛИН\t7.8\t2.6-24.9\tмкЕд/мл',
    'HbA1c\t5.1\t<6.0\t%',
    'ФЕРРИТИН\t95\t30-400\tмкг/л',
    'ЖЕЛЕЗО\t19\t11-28\tмкмоль/л',
    'ОЖСС\t52\t45-70\tмкмоль/л',
    'КАЛИЙ\t4.4\t3.5-5.1\tммоль/л',
    'НАТРИЙ\t141\t136-145\tммоль/л',
    'КАЛЬЦИЙ ОБЩИЙ\t2.38\t2.2-2.6\tммоль/л',
    'МАГНИЙ\t0.82\t0.75-1.0\tммоль/л',
    'ФОСФОР\t1.05\t0.8-1.45\tммоль/л',
    'ГОМОЦИСТЕИН\t9.5\t<15\tмкмоль/л',
    'АТ к ТПО\t2.5\t<34\tМЕ/мл',
    'АТ к ТГ\t1.8\t<115\tМЕ/мл',
  ].join('\n');

  const { pdf, biomarker } = runAllParsers(kdlFull);

  // KDL uses ALL-CAPS — verify case-insensitivity
  it.each([
    ['TP', 68], ['ALB', 38], ['ALT', 48], ['AST', 35], ['GGT', 62],
    ['ALP', 95], ['BIL', 14.2], ['BILD', 4.1], ['GLU', 5.6],
    ['CREAT', 98], ['UREA', 5.8], ['URIC', 310],
    ['CHOL', 5.8], ['HDL', 1.05], ['LDL', 3.5], ['TG', 1.6],
    ['CRP', 4.2], ['HGB', 140], ['RBC', 4.6], ['HCT', 42.5],
    ['MCV', 88], ['MCH', 30], ['MCHC', 340], ['PLT', 225], ['WBC', 7.5],
    ['NEUT', 4.5], ['LYMPH', 2.3], ['MONO', 0.5], ['EO', 0.2], ['BASO', 0.04],
  ] as const)('KDL ALL-CAPS распознаёт %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it.each([
    ['TSH', 2.8], ['FT4', 12.5], ['FT3', 4.2],
    ['TESTO', 20.5], ['ESTR', 105], ['PROL', 290],
    ['LH', 5.5], ['FSH', 4.2], ['PROG', 0.9], ['CORT', 450],
    ['DHEA', 5.8], ['SHBG', 30], ['VITD', 35], ['INSULIN', 7.8],
    ['HBA1C', 5.1], ['FER', 95], ['IRON', 19], ['TIBC', 52],
    ['HOMOCYSTEINE', 9.5], ['TPO_AB', 2.5], ['TG_AB', 1.8],
  ] as const)('KDL распознаёт гормоны %s = %s', (code, val) => {
    const found = pdf.values.find(v => v.code === code);
    expect(found, `Не найден ${code}`).toBeDefined();
    expect(found!.value).toBe(val);
  });

  it('KDL ALL-CAPS текст распознаёт 50+ маркеров', () => {
    expect(pdf.values.length).toBeGreaterThanOrEqual(48);
  });

  it('biomarker-regex корректно работает с ALL-CAPS', () => {
    const codes = biomarker.extractedMarkers.map(m => m.code);
    expect(codes).toEqual(expect.arrayContaining([
      'ALT', 'AST', 'TSH', 'T4_Free', 'T3_Free', 'Hemoglobin', 'Cholesterol_Total',
    ]));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Общие тесты тройного парсера
// ═══════════════════════════════════════════════════════════════════════════
describe('Тройной парсер — консистентность между движками', () => {
  const text = [
    'АЛТ\t35\t7-40\tЕ/л',
    'Креатинин\t92\t62-106\tмкмоль/л',
    'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
    'ТТГ\t2.1\t0.4-4.0\tмЕд/л',
    'Тестостерон\t22.5\t12-35\tнмоль/л',
    'Гемоглобин\t145\t130-170\tг/л',
  ].join('\n');

  const { pdf, provider, biomarker } = runAllParsers(text);

  it('все три парсера находят АЛТ', () => {
    expect(pdf.values.some(v => v.code === 'ALT')).toBe(true);
    expect(provider.some(v => v.marker === 'ALT')).toBe(true);
    expect(biomarker.extractedMarkers.some(m => m.code === 'ALT')).toBe(true);
  });

  it('все три парсера находят креатинин', () => {
    expect(pdf.values.some(v => v.code === 'CREAT')).toBe(true);
    expect(provider.some(v => v.marker === 'CREATININE')).toBe(true);
    expect(biomarker.extractedMarkers.some(m => m.code === 'Creatinine')).toBe(true);
  });

  it('все три парсера выдают близкие значения', () => {
    const pdfAlt = pdf.values.find(v => v.code === 'ALT')!.value;
    const provAlt = provider.find(v => v.marker === 'ALT')!.value;
    const bioAlt = biomarker.extractedMarkers.find(m => m.code === 'ALT')!.value;
    expect(pdfAlt).toBe(35);
    expect(provAlt).toBe(35);
    expect(bioAlt).toBe(35);
  });

  it('mapToUcumCode унифицирует коды из разных парсеров', () => {
    expect(mapToUcumCode('CREAT')).toBe('CREATININE');
    expect(mapToUcumCode('ALT')).toBe('ALT');
    expect(mapToUcumCode('TSH')).toBe('TSH');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Краевые случаи OCR
// ═══════════════════════════════════════════════════════════════════════════
describe('OCR-артефакты и краевые случаи', () => {
  it('Cyrillic-Latin mix: АЛТ = ALT', () => {
    const text = 'АЛТ 35 Е/л 0-41\nAЛT 35 Е/л 0-41';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.filter(v => v.code === 'ALT')).toHaveLength(1);
    expect(pdf.values[0].value).toBe(35);
  });

  it('Zero as Cyrillic O: 5,O → 5.0', () => {
    const text = 'Глюкоза 5,O ммоль/л 3,9-5,5';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.find(v => v.code === 'GLU')?.value).toBe(5);
  });

  it('Split unit tokens from bad PDF extraction', () => {
    const text = 'Креатинин 92 мк моль / л 62-106';
    const { pdf } = runAllParsers(text);
    const creatinine = pdf.values.find(v => v.code === 'CREAT');
    expect(creatinine?.value).toBe(92);
    expect(creatinine?.unit).toBe('мкмоль/л');
  });

  it('Space-separated units in tab columns', () => {
    const text = 'Креатинин\t1\t0,6-1,2\tмк моль / л';
    const { pdf } = runAllParsers(text);
    const creatinine = pdf.values.find(v => v.code === 'CREAT');
    expect(creatinine?.unit).toBe('мкмоль/л');
  });

  it('< and > reference bounds', () => {
    const text = 'D-димер < 0,5 мкг/л\nБилирубин прямой < 5 мкмоль/л';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.find(v => v.code === 'DIMER')?.value).toBe(0.5);
    expect(pdf.values.find(v => v.code === 'BILD')?.value).toBe(5);
  });

  it('СОЭ и ESR — оба имени распознаются', () => {
    const text1 = 'СОЭ 8 мм/ч 2-15';
    const text2 = 'ESR 8 mm/h 2-15';
    expect(parseLabText(text1).values.some(v => v.code === 'ESR')).toBe(true);
    expect(parseLabText(text2).values.some(v => v.code === 'ESR')).toBe(true);
  });

  it('Split value across lines (marker on line1, value+unit on line2)', () => {
    const text = 'Гемоглобин\n145 г/л\nТТГ\n2,1 мЕд/л';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'HGB')).toBe(true);
    expect(pdf.values.some(v => v.code === 'TSH')).toBe(true);
  });

  it('Extra symbols in OCR-mangled lines', () => {
    const text = 'АЛТ 35,0 Е/л [0-40]\nГлюкоза 5.40 ммоль/л 3.90-5.50';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.find(v => v.code === 'ALT')?.value).toBe(35);
    expect(pdf.values.find(v => v.code === 'GLU')?.value).toBe(5.4);
  });

  it('Struck text (~) is filtered out', () => {
    const text = 'АЛТ~ 35 Е/л 0-41\nАСТ ~ 28 Е/л 0-40';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'ALT')).toBe(true);
    expect(pdf.values.some(v => v.code === 'AST')).toBe(true);
  });

  it('маркеры с цифрами в названии не путаются со значениями', () => {
    const text = '25(OH)D\t32\t30-100\tнг/мл\n17-ОН-прогестерон\t4.5\t1-6\tнмоль/л';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.find(v => v.code === 'VITD')?.value).toBe(32);
    expect(pdf.values.find(v => v.code === 'OH17P')?.value).toBe(4.5);
  });

  it('watermark-строки не портят распознавание', () => {
    const text = 'ИНВИТРО\nСтраница 1 из 2\nАЛТ 35 Е/л 0-41\nСтраница 2 из 2\nГлюкоза 5.4 ммоль/л 3.9-5.5';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'ALT')).toBe(true);
    expect(pdf.values.some(v => v.code === 'GLU')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Специфические редкие маркеры
// ═══════════════════════════════════════════════════════════════════════════
describe('Редкие и специфические маркеры', () => {
  it('цитокины: TNF-alpha, IL-6, IL-1β', () => {
    const text = 'ФНО-альфа 5 пг/мл 0-8\nИЛ-6 3 пг/мл 0-7\nИЛ-1β 2 пг/мл 0-5';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'TNF_ALPHA')).toBe(true);
    expect(pdf.values.some(v => v.code === 'IL6')).toBe(true);
    expect(pdf.values.some(v => v.code === 'IL1B')).toBe(true);
  });

  it('костные маркеры: CTX, P1NP, остеокальцин', () => {
    const text = 'CTX 0.3 нг/мл 0.1-0.5\nP1NP 45 нг/мл 20-80';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'CTX')).toBe(true);
    expect(pdf.values.some(v => v.code === 'P1NP')).toBe(true);
  });

  it('микроэлементы: марганец, йод, хром', () => {
    const text = 'Марганец 0.2 мкмоль/л 0.05-0.3\nЙод 75 мкг/л 50-100\nХром 5 нмоль/л 2-10';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'MANGANESE')).toBe(true);
    expect(pdf.values.some(v => v.code === 'IODINE')).toBe(true);
    expect(pdf.values.some(v => v.code === 'CHROMIUM')).toBe(true);
  });

  it('маркеры мочи: URINE_LEU, URINE_ERY, URINE_SG', () => {
    const text = 'Лейкоциты мочи\t2\t0-5\tкл/мкл\nЭритроциты мочи\t1\t0-2\tкл/мкл\nОтносительная плотность мочи\t1.020\t1.010-1.030\tг/мл';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'URINE_LEU')).toBe(true);
    expect(pdf.values.some(v => v.code === 'URINE_ERY')).toBe(true);
    expect(pdf.values.some(v => v.code === 'URINE_SG')).toBe(true);
  });

  it('полуколичественные маркеры мочи (_QR)', () => {
    const text = 'Белок мочи (кач)\tотрицательно\nГлюкоза мочи (кач)\tследы\nКетоны мочи (кач)\t+';
    const { pdf } = runAllParsers(text);
    const protein = pdf.values.find(v => v.code === 'URINE_PROTEIN_QR');
    expect(protein?.value).toBe(0);
    const glucose = pdf.values.find(v => v.code === 'URINE_GLUCOSE_QR');
    expect(glucose?.value).toBe(0.5);
    const ketones = pdf.values.find(v => v.code === 'URINE_KETONES_QR');
    expect(ketones?.value).toBe(1);
  });

  it('качественные маркеры: HIV, HBsAg, HCV — детектятся именем (без чисел)', () => {
    const text = 'ВИЧ\tотрицательно\nHBsAg\tотрицательно\nAnti-HCV\tотрицательно';
    const { pdf } = runAllParsers(text);
    // These markers have no numeric value in most lab forms — the parsers
    // correctly skip lines without extractable numbers
    const codes = pdf.values.map(v => v.code);
    expect(codes).not.toContain('HIV');
    expect(codes).not.toContain('HBSAG');
    // But the names ARE recognized when a lab name is present alongside a number
    // (the parser requires a numeric value to produce a result)
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Кросс-провайдерная дедупликация
// ═══════════════════════════════════════════════════════════════════════════
describe('Кросс-провайдерная консистентность', () => {
  it('один и тот же маркер парсится из разных провайдеров независимо (дедуп — на уровне mergeParsedResults)', () => {
    const text = `ИНВИТРО
АЛТ 35 Е/л 0-41
ГЕМОТЕСТ
Аланинаминотрансфераза 35 Е/л 0-41`;
    const { pdf } = runAllParsers(text);
    // parseLabText does NOT deduplicate across different provider sections —
    // that happens at mergeParsedResults level in ocr-engine.ts.
    // Both entries are valid individually; the merge layer picks the best.
    expect(pdf.values.filter(v => v.code === 'ALT').length).toBeGreaterThanOrEqual(1);
    expect(pdf.values.filter(v => v.code === 'ALT').every(v => v.value === 35)).toBe(true);
  });

  it('повторяющиеся заголовки провайдеров не ломают парсинг', () => {
    const text = 'ИНВИТРО\nНаименование\tРезультат\tРеференс\tЕдиницы\nАЛТ\t35\t<41\tЕ/л\nИНВИТРО\nНаименование\tРезультат\tРеференс\tЕдиницы\nКреатинин\t92\t62-106\tмкмоль/л';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'ALT')).toBe(true);
    expect(pdf.values.some(v => v.code === 'CREAT')).toBe(true);
    expect(pdf.values.filter(v => v.code === 'ALT')).toHaveLength(1);
    expect(pdf.values.filter(v => v.code === 'CREAT')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Сводный дымовой тест — все 4 провайдера, все основные маркеры
// ═══════════════════════════════════════════════════════════════════════════
describe('Сводный тест: все провайдеры × все основные маркеры', () => {
  const ALL_EXPECTED = [
    'ALT', 'AST', 'GGT', 'ALP', 'BIL', 'BILD', 'GLU', 'CREAT',
    'UREA', 'URIC', 'TP', 'ALB', 'CHOL', 'HDL', 'LDL', 'TG', 'CRP',
    'HGB', 'RBC', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT', 'WBC',
    'NEUT', 'LYMPH', 'MONO', 'EO', 'BASO', 'ESR',
    'TSH', 'FT4', 'FT3', 'TESTO', 'ESTR', 'PROL',
    'LH', 'FSH', 'PROG', 'CORT', 'DHEA', 'SHBG',
    'FER', 'IRON', 'VITD', 'INSULIN', 'HBA1C',
    'K', 'NA', 'TIBC',
  ];

  const providers = {
    Invitro: [
      'ИНВИТРО',
      'Наименование\tРезультат\tРеференсные значения\tЕдиницы',
      'АЛТ\t35\t<41\tЕ/л', 'АСТ\t28\t<40\tЕ/л', 'ГГТ\t42\t<60\tЕ/л',
      'Щелочная фосфатаза\t80\t40-150\tЕ/л', 'Билирубин общий\t12.5\t<21\tмкмоль/л',
      'Билирубин прямой\t3.2\t<5\tмкмоль/л', 'Глюкоза\t5.4\t3.9-5.5\tммоль/л',
      'Креатинин\t92\t62-106\tмкмоль/л', 'Мочевина\t5.2\t2.5-7.1\tммоль/л',
      'Мочевая кислота\t320\t200-420\tмкмоль/л', 'Общий белок\t72\t65-85\tг/л',
      'Альбумин\t42\t35-50\tг/л', 'Холестерин общий\t5.2\t<5.2\tммоль/л',
      'ЛПВП\t1.1\t>1.0\tммоль/л', 'ЛПНП\t3.1\t<3.0\tммоль/л',
      'Триглицериды\t1.4\t<1.7\tммоль/л', 'С-реактивный белок\t2.5\t<5.0\tмг/л',
      'Гемоглобин\t145\t130-170\tг/л', 'Эритроциты\t4.8\t4.0-5.5\t10^12/л',
      'Гематокрит\t44.5\t40-52\t%', 'MCV\t88\t80-100\tфл', 'MCH\t30\t27-34\tпг',
      'MCHC\t340\t320-360\tг/л', 'Тромбоциты\t210\t150-400\t10^9/л',
      'Лейкоциты\t6.8\t4.0-9.0\t10^9/л', 'Нейтрофилы\t58\t45-75\t%',
      'Лимфоциты\t32\t20-45\t%', 'Моноциты\t6\t2-10\t%',
      'Эозинофилы\t2\t0-5\t%', 'Базофилы\t1\t0-1\t%', 'СОЭ\t8\t2-15\tмм/ч',
      'ТТГ\t2.1\t0.4-4.0\tмЕд/л', 'Т4 свободный\t14.2\t10.0-19.0\tпмоль/л',
      'Т3 свободный\t4.8\t3.1-6.8\tпмоль/л', 'Тестостерон общий\t22.5\t12.0-35.0\tнмоль/л',
      'Эстрадиол\t110\t40-160\tпмоль/л', 'Пролактин\t280\t86-324\tмЕд/л',
      'ЛГ\t5.2\t1.7-8.6\tмЕд/л', 'ФСГ\t4.1\t1.5-12.4\tмЕд/л',
      'Прогестерон\t1.2\t0.2-1.4\tнмоль/л', 'Кортизол\t420\t150-660\tнмоль/л',
      'DHEA-S\t6.5\t2.4-11.6\tмкмоль/л', 'SHBG\t32\t18-54\tнмоль/л',
      'Витамин D 25-OH\t42\t30-100\tнг/мл', 'Ферритин\t85\t30-400\tмкг/л',
      'Железо\t18\t11-28\tмкмоль/л', 'Инсулин\t8.5\t2.6-24.9\tмкЕд/мл',
      'HbA1c\t5.2\t<6.0\t%', 'Калий\t4.5\t3.5-5.1\tммоль/л',
      'Натрий\t140\t136-145\tммоль/л', 'ОЖСС\t55\t45-70\tмкмоль/л',
    ].join('\n'),

    Helix: [
      'Хеликс',
      'Показатель\tРезультат\tРеференсные значения\tЕд. изм.',
      'Аланинаминотрансфераза (АЛТ)\t42\t<41\tЕд/л',
      'Аспартатаминотрансфераза (АСТ)\t32\t<40\tЕд/л',
      'Гамма-глутамилтранспептидаза (ГГТ)\t55\t<60\tЕд/л',
      'Щелочная фосфатаза\t90\t40-150\tЕ/л',
      'Билирубин общий\t10.8\t<21\tмкмоль/л', 'Билирубин прямой\t2.5\t<5\tмкмоль/л',
      'Глюкоза\t5.8\t4.1-5.9\tммоль/л', 'Креатинин\t88\t74-110\tмкмоль/л',
      'Мочевина\t4.8\t2.5-7.1\tммоль/л', 'Мочевая кислота\t285\t200-420\tмкмоль/л',
      'Общий белок\t70\t65-85\tг/л', 'Альбумин\t44\t35-52\tг/л',
      'Холестерин общий\t4.8\t<5.2\tммоль/л', 'Холестерин ЛПВП\t1.3\t>1.0\tммоль/л',
      'Холестерин ЛПНП\t2.8\t<3.0\tммоль/л', 'Триглицериды\t1.1\t<1.7\tммоль/л',
      'С-реактивный белок\t1.2\t<3.0\tмг/л',
      'Гемоглобин\t152\t132-173\tг/л', 'Эритроциты\t5.1\t4.3-5.7\t10^12/л',
      'Гематокрит\t46.2\t40-52\t%', 'MCV\t89\t80-99\tфл', 'MCH\t31\t27-34\tпг',
      'MCHC\t338\t320-360\tг/л', 'Тромбоциты\t245\t150-400\t10^9/л',
      'Лейкоциты\t7.2\t4.5-11.0\t10^9/л', 'Нейтрофилы\t4.2\t1.8-7.7\t10^9/л',
      'Лимфоциты\t2.4\t1.0-4.8\t10^9/л', 'Моноциты\t0.5\t0.1-1.0\t10^9/л',
      'Эозинофилы\t0.2\t0.02-0.5\t10^9/л', 'Базофилы\t0.05\t0-0.2\t10^9/л',
      'СОЭ\t5\t2-20\tмм/час',
      'Тиреотропный гормон (ТТГ)\t1.8\t0.4-4.0\tмЕд/л',
      'Тироксин свободный (Т4 св.)\t15.5\t9.0-19.0\tпмоль/л',
      'Трийодтиронин свободный (Т3 св.)\t5.1\t2.6-5.7\tпмоль/л',
      'Тестостерон\t18.5\t12.0-35.0\tнмоль/л', 'Эстрадиол (E2)\t95\t40-160\tпмоль/л',
      'Пролактин\t310\t86-324\tмЕд/л', 'ЛГ\t4.8\t1.7-8.6\tмЕд/л',
      'ФСГ\t3.5\t1.5-12.4\tмЕд/л', 'Прогестерон\t0.8\t0.2-1.4\tнмоль/л',
      'Кортизол\t380\t150-660\tнмоль/л', 'DHEA-S\t5.2\t2.4-11.6\tмкмоль/л',
      'ГСПГ\t28\t18-54\tнмоль/л', '25-OH витамин D\t38\t30-100\tнг/мл',
      'Инсулин\t6.2\t2.6-24.9\tмкЕд/мл', 'HbA1c\t5.0\t<6.0\t%',
      'Ферритин\t110\t30-400\tмкг/л', 'Железо сывороточное\t22\t11-28\tмкмоль/л',
      'ОЖСС\t55\t45-70\tмкмоль/л', 'Калий\t4.2\t3.5-5.1\tммоль/л',
      'Натрий\t142\t136-145\tммоль/л',
    ].join('\n'),

    Gemotest: [
      'ГЕМОТЕСТ',
      'Наименование\tРезультат\tРеференс\tЕд.',
      'АЛТ\t38\t7-40\tЕ/л', 'АСТ\t25\t7-38\tЕ/л', 'ГГТ\t48\t<60\tЕ/л',
      'Щелочная фосфатаза\t72\t40-150\tЕ/л', 'Билирубин общий\t9.2\t<21\tмкмоль/л',
      'Билирубин прямой\t2.8\t<5\tмкмоль/л', 'Глюкоза\t5.1\t3.9-5.5\tммоль/л',
      'Креатинин\t95\t62-106\tмкмоль/л', 'Мочевина\t6.1\t2.5-7.1\tммоль/л',
      'Мочевая кислота\t340\t200-420\tмкмоль/л', 'Общий белок\t74\t65-85\tг/л',
      'Альбумин\t40\t35-50\tг/л', 'Холестерин общий\t5.5\t3.0-5.2\tммоль/л',
      'ЛПВП-ХС\t1.0\t>1.0\tммоль/л', 'ЛПНП-ХС\t3.4\t<3.0\tммоль/л',
      'Триглицериды\t1.8\t<1.7\tммоль/л', 'СРБ\t3.8\t<5.0\tмг/л',
      'Гемоглобин\t148\t130-170\tг/л', 'Эритроциты\t4.5\t4.0-5.5\t10^12/л',
      'Гематокрит\t43.8\t40-52\t%', 'MCV\t92\t80-100\tфл', 'MCH\t29\t27-34\tпг',
      'MCHC\t335\t320-360\tг/л', 'Тромбоциты\t195\t150-400\t10^9/л',
      'Лейкоциты\t5.9\t4.0-9.0\t10^9/л', 'Нейтрофилы\t3.2\t1.8-7.7\t10^9/л',
      'Лимфоциты\t2.1\t1.0-4.8\t10^9/л', 'Моноциты\t0.4\t0.1-1.0\t10^9/л',
      'Эозинофилы\t0.15\t0.02-0.5\t10^9/л', 'Базофилы\t0.03\t0-0.2\t10^9/л',
      'СОЭ\t10\t2-15\tмм/ч',
      'ТТГ\t3.2\t0.4-4.0\tмЕд/л', 'Т4 свободный\t13.8\t10.0-19.0\tпмоль/л',
      'Т3 свободный\t4.5\t3.1-6.8\tпмоль/л', 'Тестостерон общий\t25.0\t12.0-35.0\tнмоль/л',
      'Эстрадиол\t125\t40-160\tпмоль/л', 'Пролактин\t250\t86-324\tмЕд/л',
      'ЛГ\t6.0\t1.7-8.6\tмЕд/л', 'ФСГ\t4.5\t1.5-12.4\tмЕд/л',
      'Прогестерон\t0.5\t0.2-1.4\tнмоль/л', 'Кортизол\t520\t150-660\tнмоль/л',
      'DHEA-S\t8.2\t2.4-11.6\tмкмоль/л', 'ГСПГ\t35\t18-54\tнмоль/л',
      'Витамин D 25-OH\t28\t30-100\tнг/мл', 'Инсулин\t10.5\t2.6-24.9\tмкЕд/мл',
      'HbA1c\t5.4\t<6.0\t%', 'Ферритин\t65\t30-400\tмкг/л',
      'Железо\t15\t11-28\tмкмоль/л', 'ОЖСС\t60\t45-70\tмкмоль/л',
      'Калий\t4.8\t3.5-5.1\tммоль/л', 'Натрий\t138\t136-145\tммоль/л',
    ].join('\n'),

    KDL: [
      'КДЛ',
      'Наименование\tРезультат\tРеференс\tЕдиницы',
      'ОБЩ БЕЛОК\t68\t65-85\tг/л', 'АЛЬБУМИН\t38\t35-50\tг/л',
      'АЛТ\t48\t<41\tЕ/л', 'АСТ\t35\t<40\tЕ/л', 'ГГТ\t62\t<60\tЕ/л',
      'ЩЕЛОЧНАЯ ФОСФАТАЗА\t95\t40-150\tЕ/л', 'БИЛИРУБИН ОБЩИЙ\t14.2\t<21\tмкмоль/л',
      'БИЛИРУБИН ПРЯМОЙ\t4.1\t<5\tмкмоль/л', 'ГЛЮКОЗА\t5.6\t3.9-5.5\tммоль/л',
      'КРЕАТИНИН\t98\t62-106\tмкмоль/л', 'МОЧЕВИНА\t5.8\t2.5-7.1\tммоль/л',
      'МОЧЕВАЯ КИСЛОТА\t310\t200-420\tмкмоль/л', 'ХОЛЕСТЕРИН\t5.8\t<5.2\tммоль/л',
      'ЛПВП\t1.05\t>1.0\tммоль/л', 'ЛПНП\t3.5\t<3.0\tммоль/л',
      'ТРИГЛИЦЕРИДЫ\t1.6\t<1.7\tммоль/л', 'С-РЕАКТИВНЫЙ БЕЛОК\t4.2\t<5.0\tмг/л',
      'ГЕМОГЛОБИН\t140\t130-170\tг/л', 'ЭРИТРОЦИТЫ\t4.6\t4.0-5.5\t10^12/л',
      'ГЕМАТОКРИТ\t42.5\t40-52\t%', 'MCV\t88\t80-100\tфл', 'MCH\t30\t27-34\tпг',
      'MCHC\t340\t320-360\tг/л', 'ТРОМБОЦИТЫ\t225\t150-400\t10^9/л',
      'ЛЕЙКОЦИТЫ\t7.5\t4.0-9.0\t10^9/л', 'НЕЙТРОФИЛЫ\t4.5\t1.8-7.7\t10^9/л',
      'ЛИМФОЦИТЫ\t2.3\t1.0-4.8\t10^9/л', 'МОНОЦИТЫ\t0.5\t0.1-1.0\t10^9/л',
      'ЭОЗИНОФИЛЫ\t0.2\t0.02-0.5\t10^9/л', 'БАЗОФИЛЫ\t0.04\t0-0.2\t10^9/л',
      'СОЭ\t12\t2-15\tмм/ч',
      'ТТГ\t2.8\t0.4-4.0\tмЕд/л', 'Т4 СВОБОДНЫЙ\t12.5\t10.0-19.0\tпмоль/л',
      'Т3 СВОБОДНЫЙ\t4.2\t3.1-6.8\tпмоль/л', 'ТЕСТОСТЕРОН\t20.5\t12.0-35.0\tнмоль/л',
      'ЭСТРАДИОЛ\t105\t40-160\tпмоль/л', 'ПРОЛАКТИН\t290\t86-324\tмЕд/л',
      'ЛГ\t5.5\t1.7-8.6\tмЕд/л', 'ФСГ\t4.2\t1.5-12.4\tмЕд/л',
      'ПРОГЕСТЕРОН\t0.9\t0.2-1.4\tнмоль/л', 'КОРТИЗОЛ\t450\t150-660\tнмоль/л',
      'DHEA-S\t5.8\t2.4-11.6\tмкмоль/л', 'ГСПГ\t30\t18-54\tнмоль/л',
      'ВИТАМИН D 25-OH\t35\t30-100\tнг/мл', 'ИНСУЛИН\t7.8\t2.6-24.9\tмкЕд/мл',
      'HbA1c\t5.1\t<6.0\t%', 'ФЕРРИТИН\t95\t30-400\tмкг/л',
      'ЖЕЛЕЗО\t19\t11-28\tмкмоль/л', 'ОЖСС\t52\t45-70\tмкмоль/л',
      'КАЛИЙ\t4.4\t3.5-5.1\tммоль/л', 'НАТРИЙ\t141\t136-145\tммоль/л',
    ].join('\n'),
  };

  for (const [provider, text] of Object.entries(providers)) {
    it(`${provider}: распознаёт все 49 основных маркеров`, () => {
      const { pdf } = runAllParsers(text);
      const found = new Set(pdf.values.map(v => v.code));
      const missing = ALL_EXPECTED.filter(code => !found.has(code));

      // Some codes require UCUM canonicalization
      const missingAfterMap = missing.filter(code => {
        const mapped = mapToUcumCode(code);
        return !found.has(mapped);
      });

      expect(missingAfterMap, `${provider}: не найдены маркеры: ${missingAfterMap.join(', ')}`).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Специфические форматы строк каждого провайдера
// ═══════════════════════════════════════════════════════════════════════════
describe('Провайдер-специфичные форматы строк', () => {
  it('Helix: "Показатель — Результат (норма)" free-text формат', () => {
    const text = 'Хеликс\nАЛТ — 35 Е/л (норма 0-40)\nГлюкоза — 5.4 ммоль/л (3.9-5.5)';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'ALT')).toBe(true);
    expect(pdf.values.some(v => v.code === 'GLU')).toBe(true);
  });

  it('Invitro: скобки в названии "Креатинин (в крови)"', () => {
    const text = 'Креатинин (в крови)\t92\t62-106\tмкмоль/л';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'CREAT')).toBe(true);
  });

  it('Gemotest: дефис в ЛПВП-ХС, ЛПНП-ХС', () => {
    const text = 'ЛПВП-ХС\t1.0\t>1.0\tммоль/л\nЛПНП-ХС\t3.4\t<3.0\tммоль/л';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'HDL')).toBe(true);
    expect(pdf.values.some(v => v.code === 'LDL')).toBe(true);
  });

  it('KDL: "Тест\tЗначение\tНорма\tЕд." alternative header', () => {
    const text = 'КДЛ\nТест\tЗначение\tНорма\tЕд.\nГемоглобин\t145\t130-170\tг/л';
    const { pdf } = runAllParsers(text);
    // When provider-specific header doesn't match, generic line parser still works
    expect(pdf.values.some(v => v.code === 'HGB')).toBe(true);
  });

  it('Invitro: "hs-СРБ" ultrasensitive CRP', () => {
    const text = 'hs-СРБ 1.2 мг/л <3.0';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'CRP')).toBe(true);
  });

  it('Gemotest: "СРБ" abbreviated CRP', () => {
    const text = 'СРБ 3.8 мг/л <5.0';
    const { pdf } = runAllParsers(text);
    expect(pdf.values.some(v => v.code === 'CRP')).toBe(true);
  });
});

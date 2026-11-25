/**
 * lab-reference-presets.ts — референсы лабораторий РФ для ручного ввода анализов.
 *
 * Зачем: бланк главнее расчёта. Одна и та же цифра судится по-разному в разных
 * лабораториях (магний 0.66–1.07 и 0.75–1.0 — обе нормы, но разных лет и наборов),
 * поэтому у человека должен быть выбор источника границ:
 *   1) норма приложения (`UCUM_MAP` / `getLabNorm`) — как было;
 *   2) пресет лаборатории — только там, где число взято со страницы этой
 *      лаборатории и записаны код теста и URL (ни одного «примерно»);
 *   3) границы из бланка — два числа, которые человек переписал из своей распечатки.
 *
 * Пресеты намеренно неполные: пустой пресет честнее выдуманного числа. Если для
 * лаборатории чисел нет, интерфейс говорит «пресетов нет — введите границы из
 * бланка», а не подставляет норму приложения под именем лаборатории.
 *
 * Числа (взяты 2026-11-25 со страниц лаборатории, проверяемые цитаты — в `source`):
 *  - ПТГ: «19–110 лет 12–88 пг/мл» — helix.ru/kb/item/08-033
 *  - ОЖСС: «45,3 – 77,1 мкмоль/л» — helix.ru/kb/item/06-018
 *  - Трансферрин: «2 – 3,6 г/л» — helix.ru/kb/item/06-040
 *  - Калий: «3,5–5,1 ммоль/л» — helix.ru/kb/item/06-064
 *  - Кальций общий: «18–60 лет 2,15 – 2,5 ммоль/л» — helix.ru/kb/item/06-020
 *
 *  Пресеты КДЛ, CMD и ИНВИТРО добавлены с их собственных страниц тестов:
 *  цитата и URL стоят в каждой строке. Страница теста ИНВИТРО рисуется на клиенте,
 *  поэтому строки её таблицы референсов читаются из того же сайта запросом
 *  `/golk/tests/api/v1/tests/<uuid>?cityID=<город>` — источник тот же, что видит
 *  человек в браузере. Где лаборатория печатает одну границу («< 5 мг/л») или
 *  режет норму по полу/фазе, пресета нет: одна граница — не интервал.
 */

import { ucumKey } from '../core/constants';
import { tierMarkerKey } from './lab-tier-ranges';

/** Лаборатории, для которых заведён хотя бы один пресет. */
export type LabId = 'helix' | 'invitro' | 'kdl' | 'cmd';

/** Источник границ, выбранный на поле бланка. */
export type RefSource = 'app' | 'blank' | LabId;

export interface LabSourceInfo {
  id: LabId;
  label: string;
  /** Что человек увидит, если для этой лаборатории чисел нет. */
  note: string;
}

export const LAB_SOURCES: LabSourceInfo[] = [
  { id: 'helix', label: 'Хеликс', note: 'пресеты по страницам helix.ru' },
  { id: 'invitro', label: 'ИНВИТРО', note: 'пресеты по страницам invitro.ru' },
  { id: 'kdl', label: 'КДЛ', note: 'пресеты по страницам kdlmed.ru' },
  { id: 'cmd', label: 'CMD', note: 'пресеты по страницам cmd-online.ru' },
];

export interface LabPresetRow {
  /** Нижняя граница референса в единице `unit`. */
  lln: number;
  /** Верхняя граница референса в единице `unit`. */
  uln: number;
  /** Единица, в которой напечатаны границы. */
  unit: string;
  /** Код теста и цитата страницы — печатается рядом с выбором. */
  source: string;
  sourceUrl: string;
  /** Ограничение применимости (возраст, пол), если числа не общие. */
  note?: string;
}

export const LAB_REFERENCE_PRESETS: Record<LabId, Record<string, LabPresetRow>> = {
  helix: {
    // Код каталога — `PARATHYROID` (15–65 пг/мл). Бланки печатают «ПТГ/PTH»,
    // а норма приложения от пресета отличается: Хеликс для взрослых 19–110 лет
    // даёт 12–88 пг/мл. Хеликс выбран потому, что его границы шире и он покрывает
    // верх, который приложение обрезало бы как «выше нормы».
    PARATHYROID: {
      lln: 12,
      uln: 88,
      unit: 'pg/mL',
      source: 'Хеликс 08-033 · «19–110 лет 12–88 пг/мл»',
      sourceUrl: 'https://helix.ru/kb/item/08-033',
      note: 'взрослые 19–110 лет',
    },
    TIBC: {
      lln: 45.3,
      uln: 77.1,
      unit: 'umol/L',
      source: 'Хеликс 06-018 · «Референсные значения: 45,3 – 77,1 мкмоль/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-018',
    },
    TRANSFERRIN: {
      lln: 2,
      uln: 3.6,
      unit: 'g/L',
      source: 'Хеликс 06-040 · «Референсные значения: 2 – 3,6 г/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-040',
    },
    POTASSIUM: {
      lln: 3.5,
      uln: 5.1,
      unit: 'mmol/L',
      source: 'Хеликс 06-064 · «Референсные значения: 3,5–5,1 ммоль/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-064',
    },
    CALCIUM: {
      lln: 2.15,
      uln: 2.5,
      unit: 'mmol/L',
      source: 'Хеликс 06-020 · «18–60 лет 2,15 – 2,5 ммоль/л»',
      sourceUrl: 'https://helix.ru/kb/item/06-020',
      note: '18–60 лет; 60–90 лет верх 2,55',
    },
  },
  invitro: {
    POTASSIUM: {
      lln: 3.5,
      uln: 5.1,
      unit: 'mmol/L',
      source: 'ИНВИТРО 2920 Калий · «> 14 лет 3,5 - 5,1»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/2571/2920/',
      note: '> 14 лет',
    },
    MAGNESIUM: {
      lln: 0.66,
      uln: 1.07,
      unit: 'mmol/L',
      source: 'ИНВИТРО 2921 Магний · «> 20 лет 0,66 - 1,07»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/2571/2921/',
      note: '> 20 лет',
    },
    CALCIUM: {
      lln: 2.1,
      uln: 2.55,
      unit: 'mmol/L',
      source: 'ИНВИТРО 2962 Кальций общий · «12–60 лет 2,10–2,55»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/2571/2962/',
      note: '12–60 лет',
    },
    PHOSPHORUS: {
      lln: 0.74,
      uln: 1.52,
      unit: 'mmol/L',
      source: 'ИНВИТРО 2922 Фосфор неорганический · «> 19 лет оба 0,74-1,52»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/2571/2922/',
      note: '> 19 лет',
    },
    ALP: {
      lln: 40,
      uln: 150,
      unit: 'U/L',
      source: 'ИНВИТРО 2234 Фосфатаза щёлочная · «>19 лет 40-150»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/486/2234/',
      note: '> 19 лет; женщины > 15 лет — те же 40-150',
    },
    BIL: {
      lln: 3.4,
      uln: 20.5,
      unit: 'umol/L',
      source: 'ИНВИТРО 2219 Билирубин общий · «Взрослые и дети (кроме периода новорожденности): 3,4-20,5 мкмоль/л»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/484/2219/',
      note: 'вне периода новорождённости',
    },
    UREA: {
      lln: 2.1,
      uln: 7.1,
      unit: 'mmol/L',
      source: 'ИНВИТРО 2210 Мочевина · «18 - 60 лет 2,1 – 7,1»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/2368/2210/',
      note: '18–60 лет',
    },
    GLU: {
      lln: 4.1,
      uln: 6.0,
      unit: 'mmol/L',
      source: 'ИНВИТРО 2212 Глюкоза · «старше 14 лет 4,1 - 6,0»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/481/2212/',
      note: 'старше 14 лет',
    },
    TSH: {
      lln: 0.4,
      uln: 4.0,
      unit: 'mIU/L',
      source: 'ИНВИТРО 2322 ТТГ · «> 19 лет 0,4 - 4,0»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/629/2322/',
      note: '> 19 лет; в бланке ИНВИТРО — мМЕ/л',
    },
    FT4: {
      lln: 9.0,
      uln: 19.05,
      unit: 'pmol/L',
      source: 'ИНВИТРО 2324 Т4 свободный · «>19 лет 9.00 – 19.05»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/629/2324/',
      note: '> 19 лет',
    },
    FT3: {
      lln: 3.0,
      uln: 5.6,
      unit: 'pmol/L',
      source: 'ИНВИТРО 2326 Т3 свободный · «оба старше 19 лет 3,0 – 5,6»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/629/2326/',
      note: '> 19 лет',
    },
    B12: {
      lln: 187,
      uln: 883,
      unit: 'pg/mL',
      source: 'ИНВИТРО 2248 Витамин В12 · «Референсные значения: 187-883 пг/мл»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/5145/2248/',
    },
    FOL: {
      lln: 3.0,
      uln: 20.5,
      unit: 'ng/mL',
      source: 'ИНВИТРО 2249 Фолиевая кислота · «Референсные значения: 3,0-20,5 нг/мл»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/5145/2249/',
    },
    VITD: {
      lln: 30,
      uln: 100,
      unit: 'ng/mL',
      source: 'ИНВИТРО 2849 25-OH витамин D · «30-100 – адекватный уровень»',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/5146/2849/',
      note: 'адекватный уровень (РАЭ); > 100 — возможен токсический эффект',
    },
    WBC: {
      lln: 4.5,
      uln: 11.0,
      unit: '10^9/L',
      source: 'ИНВИТРО 2852 Общий анализ крови · «16 лет – 120 лет 4,50 – 11,0» (тыс/мкл = 10^9/л)',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/156/2852/',
      note: '16–120 лет',
    },
    PLT: {
      lln: 150,
      uln: 400,
      unit: '10^9/L',
      source: 'ИНВИТРО 2852 Общий анализ крови · «6 лет - 120 лет 150 - 400» (тыс/мкл = 10^9/л)',
      sourceUrl: 'https://www.invitro.ru/analizes/for-doctors/156/2852/',
      note: '6–120 лет',
    },
  },
  kdl: {
    POTASSIUM: {
      lln: 3.5,
      uln: 5.1,
      unit: 'mmol/L',
      source: 'КДЛ Калий · «Референсная концентрация — 3,5–5,1 ммоль/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/makro-i-mikroelementy/kaliy-v-syivorotke',
    },
    MAGNESIUM: {
      lln: 0.66,
      uln: 1.07,
      unit: 'mmol/L',
      source: 'КДЛ Магний · «> 20 лет 0,66 - 1,07 ммоль/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/makro-i-mikroelementy/magniy-v-syivorotke',
      note: '> 20 лет',
    },
    CALCIUM: {
      lln: 2.15,
      uln: 2.5,
      unit: 'mmol/L',
      source: 'КДЛ Кальций · «18 - 60 лет 2,15 - 2,5 ммоль/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/makro-i-mikroelementy/kaltsiy-v-syivorotke',
      note: '18–60 лет',
    },
    PHOSPHORUS: {
      lln: 0.81,
      uln: 1.45,
      unit: 'mmol/L',
      source: 'КДЛ Фосфор · «> 12 лет 0,81 - 1,45 ммоль/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/makro-i-mikroelementy/fosfor-v-syivorotke',
      note: '> 12 лет',
    },
    BIL: {
      lln: 3.5,
      uln: 21,
      unit: 'umol/L',
      source: 'КДЛ Билирубин общий · «Больше 6 дней 3,5 - 21 мкмоль/л»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/pigmentnyy-obmen/bilirubin-obshhiy',
      note: 'старше 6 дней',
    },
    GLU: {
      lln: 4.1,
      uln: 5.9,
      unit: 'mmol/L',
      source: 'КДЛ Глюкоза в плазме · «Больше 14 лет 4,1 - 5,9 ммоль/л»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/uglevodnyy-obmen/glyukoza-v-plazme',
      note: '> 14 лет',
    },
    HbA1c: {
      lln: 4.8,
      uln: 5.9,
      unit: '%',
      source: 'КДЛ Гликированный гемоглобин · «Референсный диапазон — 4,8–5,9 %»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/klinicheskie-issledovaniya/glikirovannyiy-gemoglobin-hba-1c',
    },
    FT4: {
      lln: 12.0,
      uln: 22.0,
      unit: 'pmol/L',
      source: 'КДЛ Т4 свободный · «> 20 лет 12,0 - 22,0 пмоль/л»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/gormony/tiroksin-svobodnyiy-t4-svobodnyiy',
      note: '> 20 лет',
    },
    FT3: {
      lln: 3.1,
      uln: 6.8,
      unit: 'pmol/L',
      source: 'КДЛ Т3 свободный · «Референсная концентрация — 3,1–6,8 пмоль/л»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/gormony/triyodtironin-svobodnyiy-t3-svobodnyiy',
    },
    T4: {
      lln: 66,
      uln: 181,
      unit: 'nmol/L',
      source: 'КДЛ Т4 общий · «> 20 лет 66 - 181 нмоль/л»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/gormony/tiroksin-obshhiy-t4',
      note: '> 20 лет',
    },
    TIBC: {
      lln: 45.3,
      uln: 77.1,
      unit: 'umol/L',
      source: 'КДЛ ОЖСС · «Референсная концентрация — 45,3–77,1 мкмоль/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/obmen-zheleza/zhelezosvyazyivayushhaya-sposobnost-syivor',
    },
    TRANSFERRIN: {
      lln: 2,
      uln: 3.6,
      unit: 'g/L',
      source: 'КДЛ Трансферрин · «Референсная концентрация — 2–3,6 г/л»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/obmen-zheleza/transferrin',
    },
    B12: {
      lln: 191,
      uln: 663,
      unit: 'pg/mL',
      source: 'КДЛ Витамин B12 · «Референсная концентрация — 191–663 пг/мл»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/vitaminy/vitamin-b12-tsianokobalamin',
    },
    VITD: {
      lln: 30,
      uln: 70,
      unit: 'ng/mL',
      source: 'КДЛ Витамин D 25-OH · «Референсная концентрация — 30–70 нг/мл»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/vitaminy/vitamin-d-25-gidroksi-kaltsiferol',
    },
    CRP: {
      lln: 0,
      uln: 5,
      unit: 'mg/L',
      source: 'КДЛ С-реактивный белок · «Референсная концентрация — 0–5 мг/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/spetsificheskie-belki-krovi/c-reaktivnyiy-belok-kolichestvenno-meto',
    },
    TROPONIN_I: {
      lln: 0,
      uln: 1,
      unit: 'ng/mL',
      source: 'КДЛ Тропонин I · «Референсная концентрация — 0–1 нг/мл»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/kardiomarkyery/troponin-i',
    },
    NT_PROBNP: {
      lln: 0,
      uln: 125,
      unit: 'pg/mL',
      source: 'КДЛ NT-proBNP · «0 - 75 лет 0 - 125 пг/мл»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/biokhimiya/kardiomarkyery/nt-probnp-kolichestvenno',
      note: '0–75 лет; для > 75 лет верх 450',
    },
    PARATHYROID: {
      lln: 9.5,
      uln: 75,
      unit: 'pg/mL',
      source: 'КДЛ ПТГ интактный · «23-70 лет 9,5 - 75 пг/мл»',
      sourceUrl: 'https://www.kdlmed.ru/analizy/issledovaniya-krovi/gormony/paratireoidnyiy-gormon-intaktnyiy',
      note: '23–70 лет',
    },
    WBC: {
      lln: 4,
      uln: 10,
      unit: '10^9/L',
      source: 'КДЛ Общий анализ крови · «Больше 16 лет 4 - 10 *10^9/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/klinicheskie-issledovaniya/klinicheskiy-analiz-krovi-s-leykotsita',
      note: '> 16 лет',
    },
    PLT: {
      lln: 180,
      uln: 320,
      unit: '10^9/L',
      source: 'КДЛ Общий анализ крови · «Больше 15 лет 180 - 320 *10^9/л»',
      sourceUrl:
        'https://www.kdlmed.ru/analizy/issledovaniya-krovi/klinicheskie-issledovaniya/klinicheskiy-analiz-krovi-s-leykotsita',
      note: '> 15 лет',
    },
  },
  cmd: {
    POTASSIUM: {
      lln: 3.5,
      uln: 5.1,
      unit: 'mmol/L',
      source: 'CMD Калий · «Референтный интервал: 3,5 – 5,1 ммоль/л»',
      sourceUrl: 'https://www.cmd-online.ru/vracham/spravochnik-vracha/kaliy/',
    },
    GLU: {
      lln: 4.0,
      uln: 6.1,
      unit: 'mmol/L',
      source: 'CMD Глюкоза в крови · «Норма Натощак … плазма венозная 4,0–6,1»',
      sourceUrl: 'https://www.cmd-online.ru/vracham/spravochnik-vracha/glyukoza-v-krovi/',
      note: 'натощак, плазма венозной крови',
    },
    WBC: {
      lln: 4.5,
      uln: 11.0,
      unit: '10^9/L',
      source: 'CMD Лейкоциты · «Референтный интервал: 4,5–11,0 109/л»',
      sourceUrl: 'https://www.cmd-online.ru/vracham/spravochnik-vracha/leykotsity/',
    },
    PLT: {
      lln: 150,
      uln: 350,
      unit: '10^9/L',
      source: 'CMD Тромбоциты · «Референтный интервал 150–350*10 9 /л»',
      sourceUrl: 'https://www.cmd-online.ru/vracham/spravochnik-vracha/kolichestvo-trombotsitov-plt/',
    },
    RETICULOCYTES: {
      lln: 0.2,
      uln: 1,
      unit: '%',
      source: 'CMD Ретикулоциты · «Референтный интервал: 0,2–1 %»',
      sourceUrl: 'https://www.cmd-online.ru/vracham/spravochnik-vracha/retikulotsity/',
    },
  },
};

/**
 * Написание бланка → код каталога, когда коды расходятся.
 *
 * `PTH` — так подписано поле формы и так печатают бланки, а в каталоге запись
 * называется `PARATHYROID`. Без перевода выбор пресета на поле «PTH» молча
 * отвечал бы «пресета нет», хотя число есть.
 */
const PRESET_CODE_ALIAS: Record<string, string> = { PTH: 'PARATHYROID' };

/** Лаборатории, у которых есть хотя бы один пресет (для списка выбора). */
export function labsWithPresets(): LabId[] {
  return (Object.keys(LAB_REFERENCE_PRESETS) as LabId[]).filter(
    (id) => Object.keys(LAB_REFERENCE_PRESETS[id]).length > 0,
  );
}

/** Пресет лаборатории для кода маркера; `null` — пресета нет. */
export function labPreset(lab: LabId | null | undefined, code: string): LabPresetRow | null {
  if (!lab) return null;
  const table = LAB_REFERENCE_PRESETS[lab];
  if (!table) return null;
  // Человек вводит код так, как он напечатан в бланке: «K», «ОЖСС», «PTH».
  // Пресеты подписаны канонами каталога (`POTASSIUM`), поэтому написание
  // приводится тем же правилом, что и каталог: `ucumKey` — точное совпадение,
  // затем верхний регистр, затем регистронезависимый поиск. Свой перебор
  // регистров здесь недопустим: ключ `HbA1c` смешанного написания против
  // `HBA1C` не совпадал, и пресет КДЛ «молча не находился» на собственном коде
  // бланка (нашло ревью прохода 209).
  const raw = String(code || '').trim();
  if (!raw) return null;
  const canon = PRESET_CODE_ALIAS[raw.toUpperCase()] ?? ucumKey(raw) ?? raw.toUpperCase();
  return table[canon] ?? table[tierMarkerKey(canon)] ?? null;
}

/**
 * Единицы считаются одной величиной, если совпадают после нормализации записи
 * (`µmol/L` = `umol/L` = `мкмоль/л`). Отдельная копия правила не нужна: интерфейс
 * сравнивает то же, что и чтение бланка.
 */
function unitKey(u: string): string {
  return String(u || '')
    .toLowerCase()
    .replace(/μ|µ/g, 'u')
    .replace(/мкмоль\/л/g, 'umol/l')
    .replace(/ммоль\/л/g, 'mmol/l')
    .replace(/г\/л/g, 'g/l')
    .replace(/пг\/мл/g, 'pg/ml')
    .replace(/\s+/g, '');
}

export type PresetCheck =
  { ok: true; lln: number; uln: number; unit: string; source: string; note?: string } | { ok: false; reason: string };

/**
 * Можно ли применить пресет к введённому значению.
 *
 * Единица введённого числа — часть данных: пресет в другой единице не пересчитывается
 * молча. Нет единицы — пресет её и подставит (это лучше, чем гадать).
 */
export function presetForEntry(code: string, lab: LabId | null | undefined, unit: string): PresetCheck {
  const preset = labPreset(lab, code);
  if (!preset) {
    const source = LAB_SOURCES.find((s) => s.id === lab);
    return {
      ok: false,
      reason: source
        ? `пресета ${source.label} для кода ${String(code || '').toUpperCase()} нет — введите границы из бланка`
        : 'пресета нет — введите границы из бланка',
    };
  }
  const entered = unitKey(unit);
  if (entered && entered !== unitKey(preset.unit)) {
    return {
      ok: false,
      reason: `единица бланка (${unit}) не совпадает с единицей пресета (${preset.unit}) — введите границы из бланка`,
    };
  }
  return {
    ok: true,
    lln: preset.lln,
    uln: preset.uln,
    unit: preset.unit,
    source: preset.source,
    note: preset.note,
  };
}

export type BlankRange = { ok: true; refLow: number; refHigh: number } | { ok: false; reason: string };

/**
 * Границы, переписанные из бланка. Интервал — это два числа: одна граница не
 * интервал, и «нижней нет» нельзя подменять нулём.
 */
export function blankRange(lo: string, hi: string): BlankRange {
  const parse = (v: string): number | null => {
    const t = String(v ?? '')
      .trim()
      .replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const l = parse(lo);
  const h = parse(hi);
  if (l === null && h === null) return { ok: false, reason: 'введите обе границы из бланка' };
  if (l === null || h === null) return { ok: false, reason: 'нужны обе границы: нижняя и верхняя' };
  if (!(l < h)) return { ok: false, reason: 'нижняя граница должна быть меньше верхней' };
  return { ok: true, refLow: l, refHigh: h };
}

/** Подпись выбранного источника для карточки анализа. */
export function refSourceLabel(source: RefSource, code: string): string {
  if (source === 'app') return 'норма приложения';
  if (source === 'blank') return 'границы из бланка';
  const preset = labPreset(source, code);
  const lab = LAB_SOURCES.find((s) => s.id === source);
  return preset ? `${lab?.label ?? source} · ${preset.source}` : `${lab?.label ?? source} (пресета нет)`;
}

import type { LabPoint } from '../core/types';
import { normalizedRatio, interpretScale } from '../core/labs-mapping';
import { labStorageCode } from '../core/lab-storage-code';
import { labMechanismIndex, type LabMechanismIndexRead, type LabMechanismSkip } from './lab-index-model';

export interface LabIndices {
  inflammation: number | null;
  metabolism: number | null;
  thyroid: number | null;
  lipids: number | null;
  neuroToxicity: number | null;
  homaIR: number | null;
  hepaticStress: number | null;
  renalStress: number | null;
}

export interface LabIndexMarker {
  code: string;
  name: string;
  value: number;
  /** Доля нормы (0..1) — для индексов, которые считаются по норме. */
  ratio: number | null;
  /** Вес в формуле индекса; у индексов главной модели весов нет. */
  weight?: number;
}

export interface LabIndexDetail {
  /** `null` — ни один маркер индекса не измерен; показатель не выдумывается. */
  value: number | null;
  label: string;
  interpretation: string;
  mechanism: string;
  /** Сколько маркеров индекса реально вошло в расчёт. */
  measured: number;
  /** Сколько маркеров индексу нужно. */
  total: number;
  markers: LabIndexMarker[];
  /** Записи, которые не пошли в расчёт (чужая единица, недоказанная граница). */
  skipped?: LabMechanismSkip[];
  /** Механизмы главной модели, по которым посчитан индекс. */
  modelMechanisms?: string[];
}

export interface LabIndicesInterpretation {
  inflammation: string;
  metabolism: string;
  thyroid: string;
  lipids: string;
  neuroToxicity: string;
  homaIR: string;
  hepaticStress: string;
  renalStress: string;
}

function latestByCode(entries: LabPoint[], codes: string[]): LabPoint | null {
  const set = new Set(codes.map((c) => c.toUpperCase()));
  const filtered = entries.filter((e) => set.has(e.code.toUpperCase()));
  if (!filtered.length) return null;
  return filtered.sort((a, b) => b.date.localeCompare(a.date))[0];
}

/**
 * Доля нормы у записи, пригодной для индекса (проход 149).
 *
 * Нет записи — `null`, а не `0`: раньше отсутствующий CRP давал 0 и индекс
 * «Воспаление 0%» читался как «в норме», хотя маркер не сдавали. Обрезанное
 * число («<5», «>1000») тоже `null`: индекс — непрерывная величина, и из
 * границы её не вывести; такой маркер называется отдельно в счётчике
 * «не учтено», но не превращается в ноль и не выдаёт себя за измерение.
 */
function ratioFrom(entries: LabPoint[], codes: string[], sex?: 'male' | 'female'): number | null {
  const point = latestByCode(entries, codes);
  if (!point) return null;
  if (point.bound) return null;
  return normalizedRatio(point.code, point.value, point.unit, undefined, sex);
}

function rawValue(entries: LabPoint[], codes: string[]): LabPoint | null {
  return latestByCode(entries, codes);
}

/**
 * Взвешенное среднее по измеренным маркерам.
 *
 * Вес нормируется на сумму весов присутствующих маркеров: раньше отсутствующий
 * маркер просто вычитался из суммы (то есть считался идеально нормальным), а
 * теперь индекс строится только из того, что измерено. Нет ни одного — `null`.
 */
function weighted(parts: { r: number | null; w: number }[], cap?: number): number | null {
  const present = parts.filter((p): p is { r: number; w: number } => p.r !== null);
  if (!present.length) return null;
  const wSum = present.reduce((s, p) => s + p.w, 0);
  if (wSum <= 0) return null;
  const value = present.reduce((s, p) => s + p.r * p.w, 0) / wSum;
  return cap === undefined ? value : Math.min(cap, value);
}

/** Обратный маркер (HDL, СКФ, общий белок): доля «плохого» = 1 − доля нормы. */
const inverted = (r: number | null): number | null => (r === null ? null : 1 - r);

/**
 * Три индекса считает главная механизм-модель, а не своя формула (проход 194).
 *
 * «Воспаление», «стресс печени» и «стресс почек» держали свои веса: СРБ 0.6 +
 * ферритин 0.4; АЛТ 0.3 + АСТ 0.25 + ГГТ 0.2 + билирубин 0.15 + ЩФ 0.1. Те же
 * анализы модель судила ступенями (`cns2`, `liv1`/`liv2`, `ren1`), и числа
 * расходились: нормальный АЛТ 30 при ВГН 40 давал долю 0.667 («Проблемы»), а
 * модель по нему же — ступень 0. Теперь источник один — `labMechanismIndex`, и
 * шкала одна: доля = ступень/3, то есть 0 / 0.333 / 0.667 / 1 (m0…m3).
 *
 * Остальные индексы (метаболизм, щитовидная, липиды, нейротоксичность, HOMA)
 * остаются долями нормы: одноимённого механизма в модели у них нет, а вес
 * считается только по измеренным маркерам.
 */
export function computeLabIndices(entries: LabPoint[], sex?: 'male' | 'female'): LabIndices {
  const rf = (codes: string[]) => ratioFrom(entries, codes, sex);
  const crp = rf(['CRP']);
  const glucose = rf(['GLU', 'GLUCOSE']);
  const hba1c = rf(['HbA1c', 'HBA1C']);
  const tsh = rf(['TSH']);
  const ft4 = rf(['FT4']);
  const ft3 = rf(['FT3']);
  const ldl = rf(['LDL']);
  const hdl = rf(['HDL']);
  const tg = rf(['TG']);
  const alt = rf(['ALT', 'GPT']);
  const prolactin = rf(['PROLACTIN', 'PRL']);
  const cortisol = rf(['CORTISOL']);
  const homocysteine = rf(['HOMOCYSTEINE']);

  // Модельные индексы: ступень даёт `getMiLabStep` (внутри `labMechanismIndex`),
  // здесь — только её шкала.
  const liver = labMechanismIndex(entries, ['liv1', 'liv2'], sex);
  const inflammation = labMechanismIndex(entries, ['cns2'], sex);
  const renal = labMechanismIndex(entries, ['ren1'], sex);

  // HOMA-IR = глюкоза(ммоль/л) × инсулин(мкЕд/мл) / 22.5 (P0: раньше делили на
  // 2025 → ×90 занижение). Проход 149: только когда измерены ОБЕ половины пары
  // и обе — точные числа. Фолбэк «глюкоза*0.7 + HbA1c*0.3» убран: это был не
  // HOMA, а другой показатель, подписанный как инсулинорезистентность.
  const insPoint = rawValue(entries, ['INSULIN', 'INS']);
  const gluPoint = rawValue(entries, ['GLU', 'GLUCOSE']);
  const homaIR =
    insPoint && gluPoint && !insPoint.bound && !gluPoint.bound && insPoint.value > 0 && gluPoint.value > 0
      ? Math.min(1, (insPoint.value * gluPoint.value) / 22.5 / 5)
      : null;

  return {
    inflammation: inflammation.share,
    metabolism: weighted([{ r: glucose, w: 0.5 }, { r: hba1c, w: 0.5 }]),
    thyroid: weighted([{ r: tsh, w: 0.4 }, { r: ft4, w: 0.3 }, { r: ft3, w: 0.3 }]),
    lipids: weighted([{ r: ldl, w: 0.5 }, { r: tg, w: 0.3 }, { r: inverted(hdl), w: 0.2 }]),
    neuroToxicity: weighted(
      [
        { r: prolactin, w: 0.20 },
        { r: cortisol, w: 0.20 },
        { r: tsh === null ? null : tsh > 0.5 ? tsh : 0, w: 0.15 },
        { r: crp, w: 0.15 },
        { r: homocysteine, w: 0.15 },
        { r: alt, w: 0.15 },
      ],
      1,
    ),
    homaIR,
    hepaticStress: liver.share,
    renalStress: renal.share,
  };
}

/** Подпись показателя; без данных — «Нет данных», а не «Отлично» по нулю. */
function scaleOrNull(value: number | null): string {
  return value === null ? 'Нет данных' : interpretScale(value);
}

function homaLabel(value: number | null): string {
  if (value === null) return 'Нет данных';
  return value < 0.2 ? 'Отличная чувствительность' : value < 0.4 ? 'Нормальная' : value < 0.6 ? 'Умеренная резистентность' : value < 0.8 ? 'Выраженная резистентность' : 'Критическая резистентность';
}

export function computeLabIndexDetails(entries: LabPoint[], sex?: 'male' | 'female'): Record<string, LabIndexDetail> {
  const indices = computeLabIndices(entries, sex);
  const mk = (code: string[], w: number): LabIndexMarker => {
    const point = latestByCode(entries, code);
    const ratio = point && !point.bound ? normalizedRatio(point.code, point.value, point.unit, undefined, sex) : null;
    return { ratio, code: point?.code ?? code[0], name: point?.code ?? code[0], value: point?.value ?? 0, weight: w };
  };
  const count = (markers: { ratio: number | null }[]) => ({
    measured: markers.filter((m) => m.ratio !== null).length,
    total: markers.length,
  });
  // HOMA-IR считается ровно по двум числам (инсулин и глюкоза), а HbA1c в списке
  // маркеров участвует только как контекст — счётчик «учтено» идёт по паре.
  const exact = (codes: string[]) => {
    const point = latestByCode(entries, codes);
    return point && !point.bound ? point : null;
  };
  const homaMeasured = (exact(['INSULIN', 'INS']) ? 1 : 0) + (exact(['GLU', 'GLUCOSE']) ? 1 : 0);

  // Маркеры модельных индексов — из таблицы модели (`MECH_LAB_MARKERS`), а не из
  // локального списка: иначе карточка назовёт не тот набор, по которому считала.
  // Проход 194: коды там — канон склада, а серия может прийти под алиасом
  // (`BILIRUBIN_TOTAL`, `CREAT`), поэтому точку ищем по коду склада.
  const canonEntries = entries.map((p) => ({ ...p, code: labStorageCode(p.code || p.name || '') }));
  const modelMarkers = (read: LabMechanismIndexRead): LabIndexMarker[] =>
    read.markers.map((code) => {
      const point = latestByCode(canonEntries, [code]);
      const ratio = point && !point.bound ? normalizedRatio(point.code, point.value, point.unit, undefined, sex) : null;
      return { code, name: point?.code ?? code, value: point?.value ?? 0, ratio };
    });

  const liver = labMechanismIndex(entries, ['liv1', 'liv2'], sex);
  const inflammation = labMechanismIndex(entries, ['cns2'], sex);
  const renal = labMechanismIndex(entries, ['ren1'], sex);

  const metabolismMarkers = [mk(['GLU', 'GLUCOSE'], 0.5), mk(['HbA1c', 'HBA1C'], 0.5)];
  const thyroidMarkers = [mk(['TSH'], 0.4), mk(['FT4'], 0.3), mk(['FT3'], 0.3)];
  const lipidMarkers = [mk(['LDL'], 0.5), mk(['TG'], 0.3), mk(['HDL'], 0.2)];
  const neuroMarkers = [mk(['PROLACTIN', 'PRL'], 0.20), mk(['CORTISOL'], 0.20), mk(['TSH'], 0.15), mk(['CRP'], 0.15), mk(['HOMOCYSTEINE'], 0.15), mk(['ALT', 'GPT'], 0.15)];
  const homaMarkers = [mk(['INSULIN', 'INS'], 0.5), mk(['GLU', 'GLUCOSE'], 0.3), mk(['HbA1c', 'HBA1C'], 0.2)];

  return {
    inflammation: {
      value: indices.inflammation,
      measured: inflammation.measured,
      total: inflammation.total,
      label: 'Воспаление',
      interpretation: scaleOrNull(indices.inflammation),
      mechanism: 'Главная модель, механизм cns2 (системное воспаление и окислительный стресс): СРБ, гомоцистеин, ИЛ-6, ФНО-α, ферритин. Ступень — худшая из измеренных; шкала индекса — та же ступень (0 / 33 / 67 / 100 %). Ферритин — острофазовый белок: при воспалении он завышен независимо от запасов железа.',
      markers: modelMarkers(inflammation),
      skipped: inflammation.skipped,
      modelMechanisms: ['cns2'],
    },
    metabolism: {
      value: indices.metabolism,
      ...count(metabolismMarkers),
      label: 'Метаболизм',
      interpretation: scaleOrNull(indices.metabolism),
      mechanism: 'Глюкоза → гликемическая нагрузка → инсулиновый ответ → липогенез. HbA1c → неферментативное гликозилирование → повреждение сосудов (AGE). Комбинация отражает инсулинорезистентность и метаболический риск.',
      markers: metabolismMarkers,
    },
    thyroid: {
      value: indices.thyroid,
      ...count(thyroidMarkers),
      label: 'Тиреоидный',
      interpretation: scaleOrNull(indices.thyroid),
      mechanism: 'TSH → стимуляция щитовидной железы → T4/T3 продукция. FT4 → периферическая конверсия в FT3 → регуляция метаболизма. Отклонения влияют на BMR, липолиз, белковый синтез и нейромедиаторы.',
      markers: thyroidMarkers,
    },
    lipids: {
      value: indices.lipids,
      ...count(lipidMarkers),
      label: 'Липидный',
      interpretation: scaleOrNull(indices.lipids),
      mechanism: 'LDL → окисление → пенистые клетки → атеросклероз. ТГ → печени VLDL → эндотелиальная дисфункция. HDL → обратный транспорт холестерина → защита сосудов. Комбинация определяет кардиоваскулярный риск.',
      markers: lipidMarkers,
    },
    neuroToxicity: {
      value: indices.neuroToxicity,
      ...count(neuroMarkers),
      label: 'Нейротоксичность',
      interpretation: scaleOrNull(indices.neuroToxicity),
      mechanism: 'Пролактин ↑ → дофаминовая деконструкция → гиперпролактинемия подавляет дофаминергическую передачу. Кортизол ↑ → ГАМК-угнетение + глиальная активация + гиппокампальная атрофия. TSH отклонение → нейровоспаление через цитокиновый каскад. CRP → NF-κB → нейровоспаление. Гомоцистеин → эндотелиальная дисфункция церебральных сосудов + эксайтотоксичность через NMDA. ALT ↑ → системная интоксикация → гематоэнцефалический барьер проницаемость.',
      markers: neuroMarkers,
    },
    homaIR: {
      value: indices.homaIR,
      measured: homaMeasured,
      total: 2,
      label: 'HOMA-IR',
      interpretation: homaLabel(indices.homaIR),
      mechanism: 'HOMA-IR = Инсулин (мкЕд/мл) × Глюкоза (ммоль/л) / 22.5. Отражает инсулинорезистентность → гиперинсулинемия → липогенез → висцеральный жир → метаболический синдром. Высокий HOMA-IR коррелирует с кардиоваскулярным риском и прогрессированием атеросклероза.',
      markers: homaMarkers,
    },
    hepaticStress: {
      value: indices.hepaticStress,
      measured: liver.measured,
      total: liver.total,
      label: 'Гепатический стресс',
      interpretation: scaleOrNull(indices.hepaticStress),
      mechanism: 'Главная модель, два печёночных механизма: liv1 (АЛТ/АСТ — ВГН своего пола, затем 2× и 3× ВГН) и liv2 (ГГТ — те же кратные; билирубин — ВГН и ×2.3/×3.5). Берётся худшая ступень; шкала индекса — ступень/3.',
      markers: modelMarkers(liver),
      skipped: liver.skipped,
      modelMechanisms: ['liv1', 'liv2'],
    },
    renalStress: {
      value: indices.renalStress,
      measured: renal.measured,
      total: renal.total,
      label: 'Почечный стресс',
      interpretation: scaleOrNull(indices.renalStress),
      mechanism: 'Главная модель, механизм ren1: СКФ (90/60/30 мл/мин), креатинин (ВГН/130/200), мочевина (8/12/20), мочевая кислота (ступени UA_STAGE_ULN по полу). Худшая ступень; шкала индекса — ступень/3.',
      markers: modelMarkers(renal),
      skipped: renal.skipped,
      modelMechanisms: ['ren1'],
    },
  };
}

export function interpretLabIndices(indices: LabIndices): LabIndicesInterpretation {
  return {
    inflammation: scaleOrNull(indices.inflammation),
    metabolism: scaleOrNull(indices.metabolism),
    thyroid: scaleOrNull(indices.thyroid),
    lipids: scaleOrNull(indices.lipids),
    neuroToxicity: scaleOrNull(indices.neuroToxicity),
    homaIR: homaLabel(indices.homaIR),
    hepaticStress: scaleOrNull(indices.hepaticStress),
    renalStress: scaleOrNull(indices.renalStress),
  };
}

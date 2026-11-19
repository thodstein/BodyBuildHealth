import type { LabPoint } from '../core/types';
import { normalizedRatio, interpretScale } from '../core/labs-mapping';

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

export interface LabIndexDetail {
  /** `null` — ни один маркер индекса не измерен; показатель не выдумывается. */
  value: number | null;
  label: string;
  interpretation: string;
  mechanism: string;
  /** Сколько маркеров индекса реально вошло в расчёт. */
  measured: number;
  /** Сколько маркеров индексу нужно (вес > 0 в формуле). */
  total: number;
  markers: { code: string; name: string; value: number; weight: number; ratio: number | null }[];
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

export function computeLabIndices(entries: LabPoint[], sex?: 'male' | 'female'): LabIndices {
  const rf = (codes: string[]) => ratioFrom(entries, codes, sex);
  const crp = rf(['CRP']);
  const ferritin = rf(['FERRITIN']);
  const glucose = rf(['GLU', 'GLUCOSE']);
  const hba1c = rf(['HbA1c', 'HBA1C']);
  const tsh = rf(['TSH']);
  const ft4 = rf(['FT4']);
  const ft3 = rf(['FT3']);
  const ldl = rf(['LDL']);
  const hdl = rf(['HDL']);
  const tg = rf(['TG']);

  const alt = rf(['ALT', 'GPT']);
  const ast = rf(['AST', 'GOT']);
  const ggt = rf(['GGT']);
  const bilirubin = rf(['BILIRUBIN_TOTAL', 'BIL_T']);
  const alp = rf(['ALP']);

  const creatinine = rf(['CREATININE']);
  const bun = rf(['BUN']);
  const egfr = rf(['EGFR']);
  const protein_total = rf(['PROTEIN_TOTAL']);

  const prolactin = rf(['PROLACTIN', 'PRL']);
  const cortisol = rf(['CORTISOL']);
  const homocysteine = rf(['HOMOCYSTEINE']);

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
    inflammation: weighted([{ r: crp, w: 0.6 }, { r: ferritin, w: 0.4 }]),
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
    hepaticStress: weighted(
      [
        { r: alt, w: 0.3 },
        { r: ast, w: 0.25 },
        { r: ggt, w: 0.2 },
        { r: bilirubin, w: 0.15 },
        { r: alp, w: 0.1 },
      ],
      1,
    ),
    renalStress: weighted(
      [
        { r: creatinine, w: 0.35 },
        { r: bun, w: 0.25 },
        { r: inverted(egfr), w: 0.25 },
        { r: inverted(protein_total), w: 0.15 },
      ],
      1,
    ),
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
  const mk = (code: string[], w: number) => {
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

  const inflammationMarkers = [mk(['CRP'], 0.6), mk(['FERRITIN'], 0.4)];
  const metabolismMarkers = [mk(['GLU', 'GLUCOSE'], 0.5), mk(['HbA1c', 'HBA1C'], 0.5)];
  const thyroidMarkers = [mk(['TSH'], 0.4), mk(['FT4'], 0.3), mk(['FT3'], 0.3)];
  const lipidMarkers = [mk(['LDL'], 0.5), mk(['TG'], 0.3), mk(['HDL'], 0.2)];
  const neuroMarkers = [mk(['PROLACTIN', 'PRL'], 0.20), mk(['CORTISOL'], 0.20), mk(['TSH'], 0.15), mk(['CRP'], 0.15), mk(['HOMOCYSTEINE'], 0.15), mk(['ALT', 'GPT'], 0.15)];
  const homaMarkers = [mk(['INSULIN', 'INS'], 0.5), mk(['GLU', 'GLUCOSE'], 0.3), mk(['HbA1c', 'HBA1C'], 0.2)];
  const hepaticMarkers = [mk(['ALT', 'GPT'], 0.3), mk(['AST', 'GOT'], 0.25), mk(['GGT'], 0.2), mk(['BILIRUBIN_TOTAL', 'BIL_T'], 0.15), mk(['ALP'], 0.1)];
  const renalMarkers = [mk(['CREATININE'], 0.35), mk(['BUN'], 0.25), mk(['EGFR'], 0.25), mk(['PROTEIN_TOTAL'], 0.15)];

  return {
    inflammation: {
      value: indices.inflammation,
      ...count(inflammationMarkers),
      label: 'Воспаление',
      interpretation: scaleOrNull(indices.inflammation),
      mechanism: 'CRP → NF-κB-каскад → системная воспалительная реакция. Ферритин → острофазовый белок → макрофагальная активация. Хроническое воспаление повреждает эндотелий и ускоряет атерогенез.',
      markers: inflammationMarkers,
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
      ...count(hepaticMarkers),
      label: 'Гепатический стресс',
      interpretation: scaleOrNull(indices.hepaticStress),
      mechanism: 'ALT/AST → цитолиз гепатоцитов → утечка трансаминаз. GGT → холестаз и окислительный стресс. Билирубин → нарушение конъюгации и экскреции. ALP → холестаз / нарушение желчеоттока. Комбинация отражает степень повреждения печени.',
      markers: hepaticMarkers,
    },
    renalStress: {
      value: indices.renalStress,
      ...count(renalMarkers),
      label: 'Почечный стресс',
      interpretation: scaleOrNull(indices.renalStress),
      mechanism: 'Креатинин → снижение СКФ → накопление продуктов метаболизма. Мочевина → нарушение экскреции азотистых шлаков. eGFR → скорость клубочковой фильтрации. Общий белок → онкотическое давление → отёки при протеинурии.',
      markers: renalMarkers,
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

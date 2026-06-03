import type { LabPoint } from '../core/types';
import { normalizedRatio, interpretScale } from '../core/labs-mapping';

export interface LabIndices {
  inflammation: number;
  metabolism: number;
  thyroid: number;
  lipids: number;
  neuroToxicity: number;
  homaIR: number;
  hepaticStress: number;
  renalStress: number;
}

export interface LabIndexDetail {
  value: number;
  label: string;
  interpretation: string;
  mechanism: string;
  markers: { code: string; name: string; value: number; weight: number; ratio: number }[];
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

function ratioFrom(entries: LabPoint[], codes: string[]): number {
  const point = latestByCode(entries, codes);
  if (!point) return 0;
  return normalizedRatio(point.code, point.value, point.unit) ?? 0;
}

function rawValue(entries: LabPoint[], codes: string[]): number | null {
  const point = latestByCode(entries, codes);
  if (!point) return null;
  return point.value;
}

function weightedRatio(entries: LabPoint[], codes: string[], weight: number): { ratio: number; code: string; name: string; value: number; weight: number } {
  const point = latestByCode(entries, codes);
  if (!point) return { ratio: 0, code: codes[0], name: codes[0], value: 0, weight };
  const r = normalizedRatio(point.code, point.value, point.unit) ?? 0;
  return { ratio: r, code: point.code, name: point.code, value: point.value, weight };
}

export function computeLabIndices(entries: LabPoint[]): LabIndices {
  const crp = ratioFrom(entries, ['CRP']);
  const ferritin = ratioFrom(entries, ['FERRITIN']);
  const glucose = ratioFrom(entries, ['GLU', 'GLUCOSE']);
  const hba1c = ratioFrom(entries, ['HbA1c', 'HBA1C']);
  const tsh = ratioFrom(entries, ['TSH']);
  const ft4 = ratioFrom(entries, ['FT4']);
  const ft3 = ratioFrom(entries, ['FT3']);
  const ldl = ratioFrom(entries, ['LDL']);
  const hdl = ratioFrom(entries, ['HDL']);
  const tg = ratioFrom(entries, ['TG']);

  const alt = ratioFrom(entries, ['ALT', 'GPT']);
  const ast = ratioFrom(entries, ['AST', 'GOT']);
  const ggt = ratioFrom(entries, ['GGT']);
  const bilirubin = ratioFrom(entries, ['BILIRUBIN_TOTAL', 'BIL_T']);
  const alp = ratioFrom(entries, ['ALP']);

  const creatinine = ratioFrom(entries, ['CREATININE']);
  const bun = ratioFrom(entries, ['BUN']);
  const egfr = ratioFrom(entries, ['EGFR']);
  const protein_total = ratioFrom(entries, ['PROTEIN_TOTAL']);

  const prolactin = ratioFrom(entries, ['PROLACTIN', 'PRL']);
  const cortisol = ratioFrom(entries, ['CORTISOL']);
  const homocysteine = ratioFrom(entries, ['HOMOCYSTEINE']);
  const ins = ratioFrom(entries, ['INSULIN', 'INS']);

  return {
    inflammation: crp * 0.6 + ferritin * 0.4,
    metabolism: glucose * 0.5 + hba1c * 0.5,
    thyroid: tsh * 0.4 + ft4 * 0.3 + ft3 * 0.3,
    lipids: ldl * 0.5 + tg * 0.3 + (1 - hdl) * 0.2,
    neuroToxicity: Math.min(1,
      prolactin * 0.20 +
      cortisol * 0.20 +
      (tsh > 0.5 ? tsh * 0.15 : 0) +
      crp * 0.15 +
      homocysteine * 0.15 +
      alt * 0.15
    ),
    homaIR: (ins > 0 && glucose > 0)
      ? Math.min(1, (rawValue(entries, ['INSULIN', 'INS']) ?? 0) * (rawValue(entries, ['GLU', 'GLUCOSE']) ?? 0) / 405 / 5)
      : glucose * 0.7 + hba1c * 0.3,
    hepaticStress: Math.min(1,
      alt * 0.3 +
      ast * 0.25 +
      ggt * 0.2 +
      bilirubin * 0.15 +
      alp * 0.1
    ),
    renalStress: Math.min(1,
      creatinine * 0.35 +
      bun * 0.25 +
      (1 - egfr) * 0.25 +
      (1 - protein_total) * 0.15
    ),
  };
}

export function computeLabIndexDetails(entries: LabPoint[]): Record<string, LabIndexDetail> {
  const indices = computeLabIndices(entries);
  const mk = (code: string[], w: number) => weightedRatio(entries, code, w);

  return {
    inflammation: {
      value: indices.inflammation,
      label: 'Воспаление',
      interpretation: interpretScale(indices.inflammation),
      mechanism: 'CRP → NF-κB-каскад → системная воспалительная реакция. Ферритин → острофазовый белок → макрофагальная активация. Хроническое воспаление повреждает эндотелий и ускоряет атерогенез.',
      markers: [mk(['CRP'], 0.6), mk(['FERRITIN'], 0.4)],
    },
    metabolism: {
      value: indices.metabolism,
      label: 'Метаболизм',
      interpretation: interpretScale(indices.metabolism),
      mechanism: 'Глюкоза → гликемическая нагрузка → инсулиновый ответ → липогенез. HbA1c → неферментативное гликозилирование → повреждение сосудов (AGE). Комбинация отражает инсулинорезистентность и метаболический риск.',
      markers: [mk(['GLU', 'GLUCOSE'], 0.5), mk(['HbA1c', 'HBA1C'], 0.5)],
    },
    thyroid: {
      value: indices.thyroid,
      label: 'Тиреоидный',
      interpretation: interpretScale(indices.thyroid),
      mechanism: 'TSH → стимуляция щитовидной железы → T4/T3 продукция. FT4 → периферическая конверсия в FT3 → регуляция метаболизма. Отклонения влияют на BMR, липолиз, белковый синтез и нейромедиаторы.',
      markers: [mk(['TSH'], 0.4), mk(['FT4'], 0.3), mk(['FT3'], 0.3)],
    },
    lipids: {
      value: indices.lipids,
      label: 'Липидный',
      interpretation: interpretScale(indices.lipids),
      mechanism: 'LDL → окисление → пенистые клетки → атеросклероз. ТГ → печени VLDL → эндотелиальная дисфункция. HDL → обратный транспорт холестерина → защита сосудов. Комбинация определяет кардиоваскулярный риск.',
      markers: [mk(['LDL'], 0.5), mk(['TG'], 0.3), mk(['HDL'], 0.2)],
    },
    neuroToxicity: {
      value: indices.neuroToxicity,
      label: 'Нейротоксичность',
      interpretation: interpretScale(indices.neuroToxicity),
      mechanism: 'Пролактин ↑ → дофаминовая деконструкция → гиперпролактинемия подавляет дофаминергическую передачу. Кортизол ↑ → ГАМК-угнетение + глиальная активация + гиппокампальная атрофия. TSH отклонение → нейровоспаление через цитокиновый каскад. CRP → NF-κB → нейровоспаление. Гомоцистеин → эндотелиальная дисфункция церебральных сосудов + эксайтотоксичность через NMDA. ALT ↑ → системная интоксикация → гематоэнцефалический барьер проницаемость.',
      markers: [mk(['PROLACTIN', 'PRL'], 0.20), mk(['CORTISOL'], 0.20), mk(['TSH'], 0.15), mk(['CRP'], 0.15), mk(['HOMOCYSTEINE'], 0.15), mk(['ALT', 'GPT'], 0.15)],
    },
    homaIR: {
      value: indices.homaIR,
      label: 'HOMA-IR',
      interpretation: indices.homaIR < 0.2 ? 'Отличная чувствительность' : indices.homaIR < 0.4 ? 'Нормальная' : indices.homaIR < 0.6 ? 'Умеренная резистентность' : indices.homaIR < 0.8 ? 'Выраженная резистентность' : 'Критическая резистентность',
      mechanism: 'HOMA-IR = Инсулин (мкЕд/мл) × Глюкоза (ммоль/л) / 22.5. Отражает инсулинорезистентность → гиперинсулинемия → липогенез → висцеральный жир → метаболический синдром. Высокий HOMA-IR коррелирует с кардиоваскулярным риском и прогрессированием атеросклероза.',
      markers: [mk(['INSULIN', 'INS'], 0.5), mk(['GLU', 'GLUCOSE'], 0.3), mk(['HbA1c', 'HBA1C'], 0.2)],
    },
    hepaticStress: {
      value: indices.hepaticStress,
      label: 'Гепатический стресс',
      interpretation: interpretScale(indices.hepaticStress),
      mechanism: 'ALT/AST → цитолиз гепатоцитов → утечка трансаминаз. GGT → холестаз и окислительный стресс. Билирубин → нарушение конъюгации и экскреции. ALP → холестаз / нарушение желчеоттока. Комбинация отражает степень повреждения печени.',
      markers: [mk(['ALT', 'GPT'], 0.3), mk(['AST', 'GOT'], 0.25), mk(['GGT'], 0.2), mk(['BILIRUBIN_TOTAL', 'BIL_T'], 0.15), mk(['ALP'], 0.1)],
    },
    renalStress: {
      value: indices.renalStress,
      label: 'Почечный стресс',
      interpretation: interpretScale(indices.renalStress),
      mechanism: 'Креатинин → снижение СКФ → накопление продуктов метаболизма. Мочевина → нарушение экскреции азотистых шлаков. eGFR → скорость клубочковой фильтрации. Общий белок → онкотическое давление → отёки при протеинурии.',
      markers: [mk(['CREATININE'], 0.35), mk(['BUN'], 0.25), mk(['EGFR'], 0.25), mk(['PROTEIN_TOTAL'], 0.15)],
    },
  };
}

export function interpretLabIndices(indices: LabIndices): LabIndicesInterpretation {
  return {
    inflammation: interpretScale(indices.inflammation),
    metabolism: interpretScale(indices.metabolism),
    thyroid: interpretScale(indices.thyroid),
    lipids: interpretScale(indices.lipids),
    neuroToxicity: interpretScale(indices.neuroToxicity),
    homaIR: indices.homaIR < 0.2 ? 'Отличная чувствительность' : indices.homaIR < 0.4 ? 'Нормальная' : indices.homaIR < 0.6 ? 'Умеренная резистентность' : indices.homaIR < 0.8 ? 'Выраженная резистентность' : 'Критическая резистентность',
    hepaticStress: interpretScale(indices.hepaticStress),
    renalStress: interpretScale(indices.renalStress),
  };
}
import { CourseEntry } from '../core/types';
import { localIsoDate } from '../core/local-date';
import { PHARMA_DB } from '../core/constants';

export interface PCTProtocolItem {
  drug: string;
  substanceId: string;
  dose: string;
  doseValue: string;
  doseUnit: string;
  durationWeeks: number;
  startDayOffset: number;
  startWeek: number;
  endWeek: number;
  class: string;
  timing: string;
  frequency: string;
  scheme?: string;
}

export interface PCTSchedule {
  startDate: string;
  taperWeeks: { week: number; drugId: string; dosePercent: number; note: string }[];
  pctStartWeek: number;
  pctProtocol: PCTProtocolItem[];
  supportStack: { id: string; name: string; dose: string; durationWeeks: number }[];
  warnings: string[];
}

export interface PCTOptions {
  pctDurationWeeks?: number;
  includeHCG?: boolean;
  hcgDose?: number;
  hcgFrequencyPerWeek?: number;
  clomipheneStartDose?: number;
  clomipheneTaperDose?: number;
  tamoxifenDose?: number;
  includeTamoxifen?: boolean;
  supportStackDurationWeeks?: number;
}

function getHalfLifeHours(drugId: string): number {
  return PHARMA_DB[drugId]?.pk.halfLifeHours || 168;
}

function daysToClear(halfLifeHours: number): number {
  return Math.ceil((halfLifeHours * 5) / 24);
}

export function generatePCTPlan(
  course: CourseEntry[],
  lastCourseWeek: number,
  options: PCTOptions = {}
): PCTSchedule {
  const {
    pctDurationWeeks = 4,
    includeHCG = true,
    hcgDose = 500,
    hcgFrequencyPerWeek = 2,
    clomipheneStartDose = 50,
    clomipheneTaperDose = 25,
    tamoxifenDose = 20,
    includeTamoxifen = false,
    supportStackDurationWeeks = 6,
  } = options;

  const warnings: string[] = [];
  const activeDrugs = course.filter(c => c.endWeek >= lastCourseWeek);
  if (activeDrugs.length === 0) return { startDate: localIsoDate(), taperWeeks: [], pctStartWeek: course.length + 4, pctProtocol: [], supportStack: [], warnings: ['Нет активных препаратов для ПКТ'] };
  const maxClearanceDays = Math.max(...activeDrugs.map(d => daysToClear(getHalfLifeHours(d.substanceId))));
  const pctStartOffset = Math.ceil(maxClearanceDays / 7);
  const pctStartWeek = lastCourseWeek + pctStartOffset;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + pctStartOffset * 7);

  const taperWeeks: { week: number; drugId: string; dosePercent: number; note: string }[] = [];
  for (let w = Math.max(0, lastCourseWeek - 3); w <= lastCourseWeek; w++) {
    const pct = Math.max(10, 100 - ((w - Math.max(0, lastCourseWeek - 3)) * 25));
    activeDrugs.forEach(d => {
      taperWeeks.push({ week: w, drugId: d.substanceId, dosePercent: pct, note: `Снижение ${d.substanceId} до ${pct}%` });
    });
  }

  const pctProtocol: PCTProtocolItem[] = [];
  const halfDuration = Math.ceil(pctDurationWeeks / 2);

  pctProtocol.push({
    drug: 'clomi', substanceId: 'clomi',
    dose: `${clomipheneStartDose} мг/день`, doseValue: String(clomipheneStartDose), doseUnit: 'мг/день',
    durationWeeks: halfDuration, startDayOffset: 0, startWeek: pctStartWeek, endWeek: pctStartWeek + halfDuration,
    class: 'pct_serm', timing: 'Ежедневно', frequency: '1 раз/день'
  });

  pctProtocol.push({
    drug: 'clomi', substanceId: 'clomi',
    dose: `${clomipheneTaperDose} мг/день`, doseValue: String(clomipheneTaperDose), doseUnit: 'мг/день',
    durationWeeks: pctDurationWeeks - halfDuration, startDayOffset: halfDuration * 7, startWeek: pctStartWeek + halfDuration, endWeek: pctStartWeek + pctDurationWeeks,
    class: 'pct_serm', timing: 'Ежедневно', frequency: '1 раз/день'
  });

  if (includeHCG) {
    pctProtocol.push({
      drug: 'hcg', substanceId: 'hcg',
      dose: `${hcgDose} МЕ ${hcgFrequencyPerWeek}×/нед`, doseValue: String(hcgDose), doseUnit: `МЕ ${hcgFrequencyPerWeek}×/нед`,
      durationWeeks: 4, startDayOffset: 0, startWeek: pctStartWeek, endWeek: pctStartWeek + 4,
      class: 'pct_gonadotropin', timing: `${hcgFrequencyPerWeek} раза/нед`, frequency: `${hcgFrequencyPerWeek} раза/нед`,
      scheme: '3/1 (3 нед приема, 1 нед отдых)'
    });
  }

  if (includeTamoxifen) {
    pctProtocol.push({
      drug: 'tamoxifen', substanceId: 'tamoxifen',
      dose: `${tamoxifenDose} мг/день`, doseValue: String(tamoxifenDose), doseUnit: 'мг/день',
      durationWeeks: pctDurationWeeks, startDayOffset: 0, startWeek: pctStartWeek, endWeek: pctStartWeek + pctDurationWeeks,
      class: 'pct_serm', timing: 'Ежедневно', frequency: '1 раз/день'
    });
  }

  const supportStack = [
    { id: 'tudca', name: 'TUDCA', dose: '250-500 мг/день', durationWeeks: supportStackDurationWeeks },
    { id: 'omega3', name: 'Омега-3', dose: '2-3 г/день', durationWeeks: supportStackDurationWeeks + 2 },
    { id: 'magnesium', name: 'Магний бисглицинат', dose: '400 мг/вечер', durationWeeks: supportStackDurationWeeks },
    { id: 'nac', name: 'NAC', dose: '1200 мг/день', durationWeeks: Math.max(4, supportStackDurationWeeks - 2) }
  ];

  const longOrals = course.filter(c => PHARMA_DB[c.substanceId]?.pd.hepatotoxicity >= 2 && (c.endWeek - c.startWeek) > 8);
  if (longOrals.length) warnings.push(`⚠️ Длительный приём оралов (${longOrals.map(o=>o.substanceId).join(', ')}). Усиленный контроль печени.`);

  const highE2 = activeDrugs.some(d => PHARMA_DB[d.substanceId]?.pd.aromatization > 0.8);
  if (highE2) warnings.push('⚠️ Высокая ароматизация. Рассмотреть добавление ИА в ПКТ.');

  if (includeHCG) {
    warnings.push('⚠️ HCG: не использовать дольше 4 нед — риск десенситизации ЛГ-рецепторов и гинекомастии.');
  }
  warnings.push('⚠️ Кломифен: при нарушении зрения/тромбоэмболии — отмена, консультация врача.');
  warnings.push('⚠️ Оральные ААС отменяются раньше инъекционных (за 1-2 нед до старта ПКТ).');

  return {
    startDate: localIsoDate(startDate),
    taperWeeks,
    pctStartWeek,
    pctProtocol,
    supportStack,
    warnings
  };
}

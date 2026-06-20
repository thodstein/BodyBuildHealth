import { CourseEntry } from '../core/types';
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
}

export interface PCTSchedule {
  startDate: string;
  taperWeeks: { week: number; drugId: string; dosePercent: number; note: string }[];
  pctStartWeek: number;
  pctProtocol: PCTProtocolItem[];
  supportStack: { id: string; name: string; dose: string; durationWeeks: number }[];
  warnings: string[];
}

function getHalfLifeHours(drugId: string): number {
  return PHARMA_DB[drugId]?.pk.halfLifeHours || 168;
}

function daysToClear(halfLifeHours: number): number {
  return Math.ceil((halfLifeHours * 5) / 24);
}

export function generatePCTPlan(course: CourseEntry[], lastCourseWeek: number): PCTSchedule {
  const warnings: string[] = [];
  const activeDrugs = course.filter(c => c.endWeek >= lastCourseWeek);
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

  const pctProtocol: PCTProtocolItem[] = [
    { drug: 'clomi', substanceId: 'clomi', dose: '50 мг/день', doseValue: '50', doseUnit: 'мг/день', durationWeeks: 2, startDayOffset: 0, startWeek: pctStartWeek, endWeek: pctStartWeek + 2, class: 'pct_serm', timing: 'Ежедневно', frequency: '1 раз/день' },
    { drug: 'clomi', substanceId: 'clomi', dose: '25 мг/день', doseValue: '25', doseUnit: 'мг/день', durationWeeks: 2, startDayOffset: 14, startWeek: pctStartWeek + 2, endWeek: pctStartWeek + 4, class: 'pct_serm', timing: 'Ежедневно', frequency: '1 раз/день' },
    { drug: 'hcg', substanceId: 'hcg', dose: '500 МЕ 2×/нед', doseValue: '500', doseUnit: 'МЕ 2×/нед', durationWeeks: 3, startDayOffset: 0, startWeek: pctStartWeek, endWeek: pctStartWeek + 3, class: 'pct_gonadotropin', timing: '2 раза/нед', frequency: '2 раза/нед' }
  ];

  const supportStack = [
    { id: 'tudca', name: 'TUDCA', dose: '1000 мг/день', durationWeeks: 6 },
    { id: 'omega3', name: 'Омега-3', dose: '2-3 г/день', durationWeeks: 8 },
    { id: 'magnesium', name: 'Магний бисглицинат', dose: '400 мг/вечер', durationWeeks: 6 },
    { id: 'nac', name: 'NAC', dose: '1200 мг/день', durationWeeks: 4 }
  ];

  const longOrals = course.filter(c => PHARMA_DB[c.substanceId]?.pd.hepatotoxicity >= 2 && (c.endWeek - c.startWeek) > 8);
  if (longOrals.length) warnings.push(`⚠️ Длительный приём оралов (${longOrals.map(o=>o.substanceId).join(', ')}). Усиленный контроль печени.`);
  
  const highE2 = activeDrugs.some(d => PHARMA_DB[d.substanceId]?.pd.aromatization > 0.8);
  if (highE2) warnings.push('⚠️ Высокая ароматизация. Рассмотреть добавление ИА в ПКТ.');

  return {
    startDate: startDate.toISOString().slice(0, 10),
    taperWeeks,
    pctStartWeek,
    pctProtocol,
    supportStack,
    warnings
  };
}
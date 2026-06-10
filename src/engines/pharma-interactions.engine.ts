import { CourseEntry } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';

export interface InteractionAlert {
  type: 'warning' | 'critical' | 'info';
  drugs: string[];
  mechanism: string;
  recommendation: string;
}

export function checkDrugInteractions(course: CourseEntry[]): InteractionAlert[] {
  const activeIds = new Set(course.map(c => c.substanceId));
  const alerts: InteractionAlert[] = [];

  // 1. Тренболон + Нандролон (прогестиновая синергия → сильное подавление, риск эректильной дисфункции)
  const hasTren = activeIds.has('tren_acet') || activeIds.has('tren_enan') || Array.from(activeIds).some(id => id.includes('tren'));
  const hasNand = activeIds.has('npp') || activeIds.has('deca') || activeIds.has('nandrolone') || Array.from(activeIds).some(id => id.includes('nand'));
  if (hasTren && hasNand) {
    alerts.push({
      type: 'critical',
      drugs: ['trenbolone', 'nandrolone'],
      mechanism: 'Синергетическое прогестиновое действие → сильное подавление ЛГ/ФСГ, риск пролактина.',
      recommendation: 'Контроль PRL каждые 2 нед. При >20 нг/мл добавить каберголин 0.25мг 2р/нед.'
    });
  }

  // 2. Оральные 17-α + Высокие дозы Тестостерона (печень)
  const orals = course.filter(c => PHARMA_DB[c.substanceId]?.pd.hepatotoxicity >= 2);
  const highTest = course.some(c => (c.substanceId.startsWith('test_') && c.doseValue > 500));
  if (orals.length && highTest) {
    alerts.push({
      type: 'warning',
      drugs: [...orals.map(o => o.substanceId), 'testosterone'],
      mechanism: 'Усиленная нагрузка на печень (17-α + ароматизация в E2).',
      recommendation: 'Добавить TUDCA 1000мг + NAC 1200мг. Контроль ALT/AST каждые 2 недели.'
    });
  }

  // 3. SARMs + Ингибиторы ароматазы (риск чрезмерного подавления E2)
  const sarms = course.filter(c => c.substanceId.startsWith('ostarine') || c.substanceId.startsWith('lgd') || c.substanceId.startsWith('rad'));
  if (sarms.length > 0 && (activeIds.has('anastro') || activeIds.has('letrozole'))) {
    alerts.push({
      type: 'warning',
      drugs: [...sarms.map(s => s.substanceId), 'ai'],
      mechanism: 'SARMs уже умеренно снижают Э2. ИА могут уронить Э2 ниже LLN → боли в суставах, либидо ↓.',
      recommendation: 'Использовать ИА только при Э2 > 40 пг/мл или симптомах гиперэстрогении.'
    });
  }

  // 4. Инсулин + SARMs/Оралы (гипогликемический риск)
  const insulin = course.some(c => c.substanceId.startsWith('ins_'));
  if (insulin && (orals.length || sarms.length)) {
    alerts.push({
      type: 'critical',
      drugs: ['insulin', ...orals.map(o=>o.substanceId)],
      mechanism: 'Повышенный риск гипогликемии + нагрузка на поджелудочную.',
      recommendation: 'Контроль глюкозы натощак и после еды. Держать быстрые углеводы под рукой.'
    });
  }

  return alerts;
}
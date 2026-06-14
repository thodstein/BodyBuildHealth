import { CourseEntry } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';

export interface InteractionAlert {
  type: 'warning' | 'critical' | 'info';
  drugs: string[];
  mechanism: string;
  recommendation: string;
}

export function checkDrugInteractions(course: CourseEntry[]): InteractionAlert[] {
  if (!course || !Array.isArray(course) || !course.length) return [];
  const validCourse = course.filter(Boolean);
  const activeIds = new Set(validCourse.map(c => c.substanceId));
  const alerts: InteractionAlert[] = [];

  // Safe version of Array.from(activeIds).some(id => id?.includes(...))
  const idsArr = Array.from(activeIds).filter(id => typeof id === 'string');

  // 1. Тренболон + Нандролон (прогестиновая синергия → сильное подавление, риск эректильной дисфункции)
  const hasTren = idsArr.some(id => id.includes('tren'));
  const hasNand = idsArr.some(id => id.includes('nand'));
  if (hasTren && hasNand) {
    alerts.push({
      type: 'critical',
      drugs: ['trenbolone', 'nandrolone'],
      mechanism: 'Синергетическое прогестиновое действие → сильное подавление ЛГ/ФСГ, риск пролактина.',
      recommendation: 'Контроль PRL каждые 2 нед. При >20 нг/мл добавить каберголин 0.25мг 2р/нед.'
    });
  }

  // 2. Оральные 17-α + Высокие дозы Тестостерона (печень)
  const orals = validCourse.filter(c => PHARMA_DB[c.substanceId]?.pd?.hepatotoxicity >= 2);
  const highTest = validCourse.some(c => (c?.substanceId || '').startsWith('test_') && c.doseValue > 500);
  if (orals.length && highTest) {
    alerts.push({
      type: 'warning',
      drugs: [...orals.map(o => o.substanceId), 'testosterone'],
      mechanism: 'Усиленная нагрузка на печень (17-α + ароматизация в E2).',
      recommendation: 'Добавить TUDCA 1000мг + NAC 1200мг. Контроль ALT/AST каждые 2 недели.'
    });
  }

  // 3. SARMs + Ингибиторы ароматазы (риск чрезмерного подавления E2)
  const sarms = validCourse.filter(c => c.substanceId.startsWith('ostarine') || c.substanceId.startsWith('lgd') || c.substanceId.startsWith('rad'));
  if (sarms.length > 0 && (idsArr.some(id => id === 'anastro' || id === 'letrozole' || id.includes('anastro') || id.includes('letrozole')))) {
    alerts.push({
      type: 'warning',
      drugs: [...sarms.map(s => s.substanceId), 'ai'],
      mechanism: 'SARMs уже умеренно снижают Э2. ИА могут уронить Э2 ниже LLN → боли в суставах, либидо ↓.',
      recommendation: 'Использовать ИА только при Э2 > 40 пг/мл или симптомах гиперэстрогении.'
    });
  }

  // 4. Инсулин + SARMs/Оралы (гипогликемический риск)
  const insulin = validCourse.some(c => c.substanceId.startsWith('ins_'));
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
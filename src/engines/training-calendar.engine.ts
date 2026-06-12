/**
 * Training Calendar + Water Tracking + Export Engine
 *
 * Training Calendar: monthly/daily planned vs actual workout tracking
 * Water Tracker: daily goals, hourly logging, trends, reminders
 * Export Engine: JSON/CSV exports, PDF report generation (HTML-based)
 * Lab Analysis Engine: automatic interpretation of lab results
 *
 * @module training-calendar-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CalendarDay {
  date: string;
  dayOfWeek: number;     // 0=Mon..6=Sun
  isTrainingDay: boolean;
  plannedFocus: string;
  plannedExercises: number;
  plannedDuration: number;
  actualCompleted: boolean;
  actualDuration: number;
  actualVolume: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  weekNumber: number;
  mesocyclePhase: string;
}

export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarDay[][];
  totalPlannedSessions: number;
  totalCompleted: number;
  totalVolume: number;
  compliance: number; // %
}

export interface WaterLog {
  date: string;
  hourlyLogs: { hour: number; amountMl: number }[];
  totalMl: number;
  goalMl: number;
  percentComplete: number;
}

export interface WaterStats {
  today: WaterLog;
  weekAvg: number;
  monthAvg: number;
  bestDay: { date: string; amount: number };
  streak: number; // days meeting goal
  trend: number;  // % change vs last week
}

export interface LabInterpretation {
  marker: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: 'low' | 'normal' | 'high' | 'critical_low' | 'critical_high';
  severity: number; // 0-100
  interpretation: string;
  recommendations: string[];
  relatedConditions: string[];
  drugAssociations: string[];
}

export interface LabPanel {
  name: string;
  date: string;
  interpretations: LabInterpretation[];
  overallStatus: 'optimal' | 'good' | 'warning' | 'critical';
  overallScore: number; // 0-100
}

export interface ExportReport {
  title: string;
  generatedAt: string;
  sections: {
    heading: string;
    content: string;
    type: 'text' | 'table' | 'chart' | 'summary';
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Training Calendar Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateCalendarMonth(
  year: number, month: number,
  plannedSessions: { date: string; focus: string; exercises: number; duration: number }[],
  actualSessions: { date: string; completed: boolean; duration: number; volume: number }[],
): CalendarMonth {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  // Find first day of month (0=Sun..6=Sat, convert to 0=Mon)
  let firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1; // Convert to Mon=0

  // Fill blank days before month start
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push({
      date: '', dayOfWeek: i, isTrainingDay: false, plannedFocus: '',
      plannedExercises: 0, plannedDuration: 0, actualCompleted: false,
      actualDuration: 0, actualVolume: 0, isToday: false, isPast: false, isFuture: true,
      weekNumber: 0, mesocyclePhase: '',
    });
  }

  let totalPlanned = 0, totalCompleted = 0, totalVolume = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const planned = plannedSessions.find(s => s.date === dateStr);
    const actual = actualSessions.find(s => s.date === dateStr);

    const dayOfWeek = (firstDay + day - 1) % 7;
    if (planned) totalPlanned++;
    if (actual?.completed) { totalCompleted++; totalVolume += actual.volume || 0; }

    const calendarDay: CalendarDay = {
      date: dateStr,
      dayOfWeek,
      isTrainingDay: !!planned,
      plannedFocus: planned?.focus || '',
      plannedExercises: planned?.exercises || 0,
      plannedDuration: planned?.duration || 0,
      actualCompleted: actual?.completed || false,
      actualDuration: actual?.duration || 0,
      actualVolume: actual?.volume || 0,
      isToday: dateStr === today,
      isPast: dateStr < today,
      isFuture: dateStr > today,
      weekNumber: Math.ceil(day / 7),
      mesocyclePhase: '',
    };

    currentWeek.push(calendarDay);

    if (currentWeek.length === 7 || day === daysInMonth) {
      // Fill remaining days
      while (currentWeek.length < 7) {
        currentWeek.push({
          date: '', dayOfWeek: currentWeek.length, isTrainingDay: false,
          plannedFocus: '', plannedExercises: 0, plannedDuration: 0,
          actualCompleted: false, actualDuration: 0, actualVolume: 0,
          isToday: false, isPast: false, isFuture: true,
          weekNumber: 0, mesocyclePhase: '',
        });
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  return {
    year, month,
    weeks,
    totalPlannedSessions: totalPlanned,
    totalCompleted,
    totalVolume,
    compliance: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0,
  };
}

/** Get training day names (Mon-Fri = training, Sat-Sun = optional) */
export function getDayTrainingFocus(dayOfWeek: number, split: string): string {
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  if (split === 'ppl') {
    return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Отдых'][dayOfWeek];
  }
  if (split === 'upper_lower') {
    return ['Верх', 'Низ', 'Отдых', 'Верх', 'Низ', 'Отдых', 'Отдых'][dayOfWeek];
  }
  if (split === 'fullbody') {
    return ['FBW A', 'Отдых', 'FBW B', 'Отдых', 'FBW C', 'Отдых', 'Отдых'][dayOfWeek];
  }
  return ['Тренировка', 'Тренировка', 'Отдых', 'Тренировка', 'Тренировка', 'Отдых', 'Отдых'][dayOfWeek];
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Water & Hydration Tracker
// ═══════════════════════════════════════════════════════════════════════════

import { loadWaterLog, addWater } from './nutrition-tracker.engine';

export function getTodayWaterLog(goalMl: number = 3000): WaterLog {
  const today = new Date().toISOString().slice(0, 10);
  const entries = loadWaterLog();
  const todayEntry = entries.find(e => e.date === today);
  const total = todayEntry?.amountMl || 0;

  // Generate hourly dummy log (simplified)
  const hourlyLogs: WaterLog['hourlyLogs'] = [];
  const hour = new Date().getHours();
  const perHour = total / Math.max(1, hour - 6);

  for (let h = 7; h <= Math.min(23, hour); h++) {
    hourlyLogs.push({ hour: h, amountMl: Math.round(perHour) });
  }

  return {
    date: today,
    hourlyLogs,
    totalMl: total,
    goalMl,
    percentComplete: Math.round(Math.min(100, (total / goalMl) * 100)),
  };
}

export function getWaterStats(): WaterStats {
  const entries = loadWaterLog();
  const today = new Date().toISOString().slice(0, 10);

  // Today
  const todayEntry = entries.find(e => e.date === today) || { date: today, amountMl: 0 };
  const todayLog: WaterLog = {
    date: today, hourlyLogs: [], totalMl: todayEntry.amountMl,
    goalMl: 3000, percentComplete: Math.round((todayEntry.amountMl / 3000) * 100),
  };

  // Week avg
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weekEntries = entries.filter(e => e.date >= weekAgo);
  const weekAvg = weekEntries.length > 0
    ? Math.round(weekEntries.reduce((s, e) => s + e.amountMl, 0) / weekEntries.length)
    : 0;

  // Month avg
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const monthEntries = entries.filter(e => e.date >= monthAgo);
  const monthAvg = monthEntries.length > 0
    ? Math.round(monthEntries.reduce((s, e) => s + e.amountMl, 0) / monthEntries.length)
    : 0;

  // Best day
  const sorted = [...entries].sort((a, b) => b.amountMl - a.amountMl);
  const bestDay = sorted.length > 0
    ? { date: sorted[0].date, amount: sorted[0].amountMl }
    : { date: today, amount: 0 };

  // Streak
  let streak = 0;
  const dates = [...new Set(entries.map(e => e.date))].sort().reverse();
  for (const d of dates) {
    const entry = entries.find(e => e.date === d);
    if (entry && entry.amountMl >= 2500) streak++;
    else break;
  }

  // Trend
  const prevWeek = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const prevWeekEntries = entries.filter(e => e.date >= prevWeek && e.date < weekAgo);
  const prevAvg = prevWeekEntries.length > 0
    ? prevWeekEntries.reduce((s, e) => s + e.amountMl, 0) / prevWeekEntries.length
    : weekAvg;
  const trend = prevAvg > 0 ? Math.round(((weekAvg - prevAvg) / prevAvg) * 100) : 0;

  return { today: todayLog, weekAvg, monthAvg, bestDay, streak, trend };
}

/** Quick add water in a single call */
export function quickAddWater(amountMl: number): number {
  addWater(amountMl);
  return getTodayWaterLog().totalMl;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Lab Analysis Engine
// ═══════════════════════════════════════════════════════════════════════════

const LAB_REFERENCE_DB: Record<string, { name: string; unit: string; low: number; high: number; criticalLow: number; criticalHigh: number }> = {
  ALT: { name: 'АЛТ', unit: 'U/L', low: 7, high: 40, criticalLow: 3, criticalHigh: 120 },
  AST: { name: 'АСТ', unit: 'U/L', low: 7, high: 40, criticalLow: 3, criticalHigh: 120 },
  GGT: { name: 'ГГТ', unit: 'U/L', low: 10, high: 60, criticalLow: 5, criticalHigh: 150 },
  ALP: { name: 'ЩФ', unit: 'U/L', low: 40, high: 130, criticalLow: 20, criticalHigh: 300 },
  Bilirubin_Total: { name: 'Билирубин общий', unit: 'мкмоль/л', low: 3, high: 21, criticalLow: 1, criticalHigh: 50 },
  Bilirubin_Direct: { name: 'Билирубин прямой', unit: 'мкмоль/л', low: 0, high: 5, criticalLow: 0, criticalHigh: 15 },
  Creatinine: { name: 'Креатинин', unit: 'мкмоль/л', low: 62, high: 106, criticalLow: 30, criticalHigh: 200 },
  Urea: { name: 'Мочевина', unit: 'ммоль/л', low: 2.5, high: 8.3, criticalLow: 1.5, criticalHigh: 15 },
  Uric_Acid: { name: 'Мочевая кислота', unit: 'мкмоль/л', low: 200, high: 420, criticalLow: 120, criticalHigh: 600 },
  Glucose: { name: 'Глюкоза', unit: 'ммоль/л', low: 3.9, high: 6.1, criticalLow: 2.8, criticalHigh: 11 },
  HbA1c: { name: 'HbA1c', unit: '%', low: 4.0, high: 5.7, criticalLow: 3.5, criticalHigh: 8.0 },
  Cholesterol_Total: { name: 'Холестерин общий', unit: 'ммоль/л', low: 3.0, high: 5.2, criticalLow: 2.0, criticalHigh: 8.0 },
  HDL: { name: 'ЛПВП', unit: 'ммоль/л', low: 1.0, high: 1.6, criticalLow: 0.6, criticalHigh: 3.0 },
  LDL: { name: 'ЛПНП', unit: 'ммоль/л', low: 1.5, high: 3.0, criticalLow: 0.8, criticalHigh: 5.0 },
  Triglycerides: { name: 'Триглицериды', unit: 'ммоль/л', low: 0.5, high: 1.7, criticalLow: 0.3, criticalHigh: 5.0 },
  TSH: { name: 'ТТГ', unit: 'мМЕ/л', low: 0.4, high: 4.0, criticalLow: 0.1, criticalHigh: 10 },
  T4_free: { name: 'Т4 своб.', unit: 'пмоль/л', low: 10, high: 22, criticalLow: 5, criticalHigh: 35 },
  T3_free: { name: 'Т3 своб.', unit: 'пмоль/л', low: 3.5, high: 6.5, criticalLow: 2, criticalHigh: 10 },
  Testosterone_Total: { name: 'Тестостерон', unit: 'нмоль/л', low: 8.9, high: 29, criticalLow: 3, criticalHigh: 52 },
  Estradiol: { name: 'Эстрадиол', unit: 'пмоль/л', low: 40, high: 160, criticalLow: 15, criticalHigh: 300 },
  Prolactin: { name: 'Пролактин', unit: 'мМЕ/л', low: 86, high: 324, criticalLow: 50, criticalHigh: 500 },
  LH: { name: 'ЛГ', unit: 'МЕ/л', low: 1.7, high: 8.6, criticalLow: 0.5, criticalHigh: 15 },
  FSH: { name: 'ФСГ', unit: 'МЕ/л', low: 1.5, high: 12.4, criticalLow: 0.3, criticalHigh: 20 },
  SHBG: { name: 'ГСПГ', unit: 'нмоль/л', low: 18, high: 54, criticalLow: 5, criticalHigh: 100 },
  PSA: { name: 'ПСА', unit: 'нг/мл', low: 0, high: 4.0, criticalLow: 0, criticalHigh: 10 },
  Hematocrit: { name: 'Гематокрит', unit: '%', low: 39, high: 51, criticalLow: 30, criticalHigh: 56 },
  Hemoglobin: { name: 'Гемоглобин', unit: 'г/л', low: 130, high: 170, criticalLow: 100, criticalHigh: 200 },
  Ferritin: { name: 'Ферритин', unit: 'нг/мл', low: 30, high: 400, criticalLow: 10, criticalHigh: 800 },
  hsCRP: { name: 'hs-CRP', unit: 'мг/л', low: 0, high: 3, criticalLow: 0, criticalHigh: 10 },
  Cystatin_C: { name: 'Цистатин С', unit: 'мг/л', low: 0.5, high: 1.2, criticalLow: 0.3, criticalHigh: 2.5 },
  eGFR: { name: 'СКФ', unit: 'мл/мин', low: 90, high: 120, criticalLow: 60, criticalHigh: 150 },
};

const INTERPRETATION_DB: Record<string, { high: string; low: string; drugs: string[]; conditions: string[] }> = {
  ALT: {
    high: 'Повышение АЛТ указывает на повреждение гепатоцитов (цитолиз). При ААС — 17α-алкилированные стероиды, гепатотоксичные препараты.',
    low: 'Низкий АЛТ — редкость, может указывать на дефицит B6.',
    drugs: ['Метандростенолон', 'Станозолол', 'Оксиметолон', 'Халотестин'],
    conditions: ['Гепатит', 'Жировой гепатоз', 'Холестаз'],
  },
  AST: {
    high: 'Повышение АСТ вместе с АЛТ — гепатоцитолиз. Изолированное повышение — мышечное повреждение.',
    low: 'Редко. Может быть при дефиците B6.',
    drugs: ['Метандростенолон', 'Станозолол', 'Оксиметолон'],
    conditions: ['Гепатит', 'Рабдомиолиз', 'Инфаркт миокарда'],
  },
  Creatinine: {
    high: 'Повышение креатинина — снижение СКФ. При ААС — FSGS, гиперфильтрация, обезвоживание. Креатин-добавки ложно завышают.',
    low: 'Низкий — низкая мышечная масса или гиперфильтрация.',
    drugs: ['Тренболон', 'Все ААС (через FSGS)'],
    conditions: ['FSGS', 'ХПН', 'Обезвоживание'],
  },
  Hematocrit: {
    high: 'HCT >51% — эритроцитоз от ААС. Риск тромбоза. >54% — флеботомия показана.',
    low: 'Анемия или гемодилюция (задержка жидкости от ГР/эстрогенов).',
    drugs: ['Болденон', 'Тестостерон', 'Оксиметолон'],
    conditions: ['Эритроцитоз', 'Тромбоз', 'Гипервязкость'],
  },
  HDL: {
    high: 'Высокий ЛПВП — кардиопротективный. Отлично.',
    low: 'Снижение ЛПВП — стандартный эффект ААС через печёночную липазу. Риск атеросклероза.',
    drugs: ['Все 17α-алкилированные', 'Мастерон', 'Тренболон'],
    conditions: ['Атеросклероз', 'Дислипидемия'],
  },
  LDL: {
    high: 'Повышение ЛПНП — атерогенный сдвиг. Стандартно для оральных ААС.',
    low: 'Нормально. Очень низкий — редкость.',
    drugs: ['Все 17α-алкилированные', 'Мастерон', 'Провирон'],
    conditions: ['Атеросклероз', 'ИБС'],
  },
  Testosterone_Total: {
    high: 'Суперфизиологические уровни — экзогенный тестостерон. Ожидаемо на курсе.',
    low: 'Подавление оси HPTA. Гипогонадизм. Требуется ПКТ.',
    drugs: ['Все ААС (подавление)', 'Тестостерон (повышение)'],
    conditions: ['Гипогонадизм', 'Азооспермия'],
  },
  Estradiol: {
    high: 'Избыточная ароматизация тестостерона. Риск гинекомастии, задержки воды, гипертензии.',
    low: 'Обвал E2 — non-aromatizable ААС + передоз ИА. Суставы, либидо, нейропротекция.',
    drugs: ['Тестостерон', 'Болденон', 'Метандростенолон'],
    conditions: ['Гинекомастия', 'Задержка жидкости'],
  },
  Prolactin: {
    high: 'Гиперпролактинемия — 19-nor ААС (тренболон, нандролон). Галакторея, либидо ↓.',
    low: 'Обычно не клинически значимо.',
    drugs: ['Тренболон', 'Нандролон', 'Пептиды GHRP'],
    conditions: ['Гинекомастия', 'Галакторея', 'ЭД'],
  },
  TSH: {
    high: 'Гипотиреоз. ГР подавляет TSH. Проверить T4 своб.',
    low: 'Гипертиреоз. Редко на ААС.',
    drugs: ['Гормон Роста', 'Тренболон'],
    conditions: ['Гипотиреоз'],
  },
};

export function interpretLabValue(
  code: string, value: number,
): LabInterpretation | null {
  const ref = LAB_REFERENCE_DB[code];
  if (!ref) return null;

  let status: LabInterpretation['status'] = 'normal';
  let severity = 0;
  let interpretation = '';
  const recs: string[] = [];

  if (value > ref.criticalHigh) {
    status = 'critical_high';
    severity = 90;
  } else if (value > ref.high) {
    status = 'high';
    severity = Math.round(((value - ref.high) / (ref.criticalHigh - ref.high)) * 50 + 20);
  } else if (value < ref.criticalLow) {
    status = 'critical_low';
    severity = 90;
  } else if (value < ref.low) {
    status = 'low';
    severity = Math.round(((ref.low - value) / (ref.low - ref.criticalLow)) * 50 + 20);
  }

  const interp = INTERPRETATION_DB[code];
  if (interp) {
    interpretation = status === 'high' || status === 'critical_high' ? interp.high : interp.low || '';
    if (status === 'critical_high' || status === 'high') {
      recs.push('Повторите анализ через 2 недели');
      if (code === 'Hematocrit' && value > 52) recs.push('Флеботомия / сдача крови');
      if (code === 'ALT' || code === 'AST') recs.push('Добавьте TUDCA 500-1000 мг + NAC 1200 мг');
      if (code === 'LDL' || code === 'HDL') recs.push('Омега-3 4-6 г/день + Цитрусовый бергамот');
      if (code === 'Estradiol' && value > 200) recs.push('Рассмотрите ИА (анастрозол 0.25-0.5 мг 2×/нед)');
    }
  }

  return {
    marker: code,
    value,
    unit: ref.unit,
    referenceRange: `${ref.low}-${ref.high}`,
    status,
    severity: Math.min(100, severity),
    interpretation: interpretation || (status === 'high' ? 'Выше нормы' : status === 'low' ? 'Ниже нормы' : 'В норме'),
    recommendations: recs,
    relatedConditions: interp?.conditions || [],
    drugAssociations: interp?.drugs || [],
  };
}

export function analyzeLabPanel(values: { code: string; value: number }[], panelName: string, date: string): LabPanel {
  const interpretations = values
    .map(v => interpretLabValue(v.code, v.value))
    .filter((v): v is LabInterpretation => v !== null);

  const criticalCount = interpretations.filter(i => i.status === 'critical_high' || i.status === 'critical_low').length;
  const abnormalCount = interpretations.filter(i => i.status !== 'normal').length;

  let overallStatus: LabPanel['overallStatus'] = 'optimal';
  if (criticalCount > 2) overallStatus = 'critical';
  else if (criticalCount > 0) overallStatus = 'warning';
  else if (abnormalCount > 3) overallStatus = 'warning';
  else if (abnormalCount > 0) overallStatus = 'good';

  const overallScore = Math.round(100 - criticalCount * 15 - (abnormalCount - criticalCount) * 5);

  return { name: panelName, date, interpretations, overallStatus, overallScore };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Export Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateHealthReport(
  profile: { name: string; age: number; weight: number },
  labPanels: LabPanel[],
  stats: { totalSessions: number; bestLifts: Record<string, any>; streak: number },
): ExportReport {
  const sections: ExportReport['sections'] = [];

  sections.push({
    heading: 'Профиль пациента',
    content: `Имя: ${profile.name}\nВозраст: ${profile.age}\nВес: ${profile.weight} кг`,
    type: 'text',
  });

  sections.push({
    heading: 'Тренировочная статистика',
    content: `Всего тренировок: ${stats.totalSessions}\nСерия: ${stats.streak} дней\n` +
      Object.entries(stats.bestLifts || {}).map(([k, v]: [string, any]) => `${k}: ${v.weight}кг ×${v.reps}`).join('\n'),
    type: 'summary',
  });

  for (const panel of labPanels) {
    const rows = panel.interpretations.map(i =>
      `| ${i.marker} | ${i.value} ${i.unit} | ${i.referenceRange} | ${i.status} | ${i.interpretation} |`
    );
    sections.push({
      heading: `Лаб-панель: ${panel.name} (${panel.date}) — Статус: ${panel.overallStatus}`,
      content: `| Маркер | Значение | Референс | Статус | Интерпретация |\n${rows.join('\n')}`,
      type: 'table',
    });
  }

  return { title: 'Health Engine — Отчёт о здоровье', generatedAt: new Date().toISOString(), sections };
}

export function exportToJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function exportWorkoutsToCSV(): string {
  // Simple inline CSV generation from localStorage
  try {
    const sessions = JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]');
    let csv = 'Date,Exercise,Set,Weight,Reps,RPE,RIR\n';
    for (const sess of sessions) {
      for (const ex of sess.exercises || []) {
        for (const set of ex.sets || []) {
          csv += `${sess.date},${ex.exerciseName},${set.setNumber},${set.weightKg},${set.reps},${set.rpe},${set.rir}\n`;
        }
      }
    }
    return csv;
  } catch { return 'No data'; }
}

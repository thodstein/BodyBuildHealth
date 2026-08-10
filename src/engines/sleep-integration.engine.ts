/**
 * Sleep Data Integration Engine
 * Интегрирует данные сна с тренировками, препаратами и другими факторами
 */

import { SleepEntry } from './sleep-correlation.engine';

/**
 * Получает даты тренировок из localStorage
 */
export function getTrainingDatesFromStorage(days: number = 30): string[] {
  try {
    // Проверяем разные возможные ключи для хранения тренировок
    const possibleKeys = ['he_workout_log_v2'];
    const trainingDates: string[] = [];

    for (const key of possibleKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        const entries = JSON.parse(data);
        if (Array.isArray(entries)) {
          entries.forEach((entry: any) => {
            if (entry.date) {
              trainingDates.push(entry.date);
            }
          });
        }
      }
    }

    // Если не нашли в localStorage, проверяем indexedDB (если используется)
    // Возвращаем уникальные даты за последние N дней
    const uniqueDates = [...new Set(trainingDates)];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return uniqueDates.filter(date => {
      const d = new Date(date);
      return d >= cutoffDate;
    }).sort();
  } catch (error) {
    console.error('Error loading training dates:', error);
    return [];
  }
}

/**
 * Получает данные о приёме препаратов из localStorage
 */
export function getSupplementIntakeFromStorage(days: number = 30): { date: string; substance: string; dose: string }[] {
  try {
    const possibleKeys = ['he_supplement_diary', 'he_pharma_diary', 'he_injection_diary'];
    const intake: { date: string; substance: string; dose: string }[] = [];

    for (const key of possibleKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        const entries = JSON.parse(data);
        if (Array.isArray(entries)) {
          entries.forEach((entry: any) => {
            if (entry.date && entry.substance) {
              intake.push({
                date: entry.date,
                substance: entry.substance,
                dose: entry.dose || ''
              });
            }
          });
        }
      }
    }

    // Фильтруем за последние N дней
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return intake.filter(item => {
      const d = new Date(item.date);
      return d >= cutoffDate;
    }).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error loading supplement intake:', error);
    return [];
  }
}

/**
 * Анализирует влияние конкретных препаратов на сон
 */
export function analyzePEDImpactOnSleep(
  sleepDiary: SleepEntry[],
  supplementIntake: { date: string; substance: string; dose: string }[]
): { substance: string; avgQualityChange: number; avgLatencyChange: number; sampleSize: number }[] {
  const results: { substance: string; avgQualityChange: number; avgLatencyChange: number; sampleSize: number }[] = [];

  // Группируем приём препаратов по веществам
  const substanceGroups: { [key: string]: { with: SleepEntry[]; without: SleepEntry[] } } = {};

  supplementIntake.forEach(intake => {
    if (!substanceGroups[intake.substance]) {
      substanceGroups[intake.substance] = { with: [], without: [] };
    }
  });

  // Для каждого препарата находим дни с ним и без
  sleepDiary.forEach(entry => {
    const dateStr = entry.date;
    const substancesOnDate = supplementIntake
      .filter(intake => intake.date === dateStr)
      .map(intake => intake.substance);

    substancesOnDate.forEach(substance => {
      if (substanceGroups[substance]) {
        substanceGroups[substance].with.push(entry);
      }
    });

    // Добавляем в "without" для всех препаратов, которых не было в этот день
    Object.keys(substanceGroups).forEach(substance => {
      if (!substancesOnDate.includes(substance)) {
        substanceGroups[substance].without.push(entry);
      }
    });
  });

  // Рассчитываем влияние для каждого препарата
  Object.keys(substanceGroups).forEach(substance => {
    const { with: withDrug, without: withoutDrug } = substanceGroups[substance];

    if (withDrug.length >= 3 && withoutDrug.length >= 3) {
      const avgQualityWith = withDrug.reduce((sum, e) => sum + e.quality, 0) / withDrug.length;
      const avgQualityWithout = withoutDrug.reduce((sum, e) => sum + e.quality, 0) / withoutDrug.length;
      const avgLatencyWith = withDrug.filter(e => e.latency).length > 0
        ? withDrug.filter(e => e.latency).reduce((sum, e) => sum + (e.latency || 0), 0) / withDrug.filter(e => e.latency).length
        : 0;
      const avgLatencyWithout = withoutDrug.filter(e => e.latency).length > 0
        ? withoutDrug.filter(e => e.latency).reduce((sum, e) => sum + (e.latency || 0), 0) / withoutDrug.filter(e => e.latency).length
        : 0;

      results.push({
        substance,
        avgQualityChange: Math.round((avgQualityWith - avgQualityWithout) * 10) / 10,
        avgLatencyChange: Math.round((avgLatencyWith - avgLatencyWithout) * 10) / 10,
        sampleSize: withDrug.length
      });
    }
  });

  return results.sort((a, b) => Math.abs(b.avgQualityChange) - Math.abs(a.avgQualityChange));
}

/**
 * Генерирует умные уведомления о гигиене сна
 */
export function generateSleepHygieneNotifications(sleepDiary: SleepEntry[]): string[] {
  const notifications: string[] = [];
  const recent = sleepDiary.slice(0, 7); // последние 7 дней

  if (recent.length < 3) return notifications;

  const avgLatency = recent.filter(e => e.latency).length > 0
    ? recent.filter(e => e.latency).reduce((sum, e) => sum + (e.latency || 0), 0) / recent.filter(e => e.latency).length
    : 0;

  const avgScreenTime = recent.filter(e => e.screenTime).length > 0
    ? recent.filter(e => e.screenTime).reduce((sum, e) => sum + (e.screenTime || 0), 0) / recent.filter(e => e.screenTime).length
    : 0;

  const alcoholDays = recent.filter(e => e.alcohol).length;
  const lateCaffeineDays = recent.filter(e => e.caffeineCutoff && e.caffeineCutoff > '14:00').length;
  const avgStress = recent.filter(e => e.stressLevel).length > 0
    ? recent.filter(e => e.stressLevel).reduce((sum, e) => sum + (e.stressLevel || 0), 0) / recent.filter(e => e.stressLevel).length
    : 0;

  // Уведомления
  if (avgLatency > 30) {
    notifications.push('🕐 В последние дни долгое засыпание. Попробуйте: тёплый душ, чтение, без экранов за час до сна');
  }

  if (avgScreenTime > 60) {
    notifications.push('📱 Много времени перед экраном. Синий свет подавляет мелатонин. Используйте режим "Ночь" или очки с янтарными линзами');
  }

  if (alcoholDays >= 3) {
    notifications.push('🍷 Частый алкоголь влияет на качество сна. Алкоголь снижает REM-фазу. Ограничьте до 1-2 раз в неделю');
  }

  if (lateCaffeineDays >= 3) {
    notifications.push('☕ Поздний кофеин мешает засыпанию. Период полувыведения кофеина 5-6 часов. Последний кофе — до 14:00');
  }

  if (avgStress >= 7) {
    notifications.push('😰 Высокий стресс мешает сну. Попробуйте: дыхательные практики, медитация, магний перед сном');
  }

  // Проверка регулярности
  const bedtimes = recent.map(e => e.bedtime).filter(Boolean);
  const uniqueBedtimes = [...new Set(bedtimes)];
  if (uniqueBedtimes.length > 3) {
    notifications.push('⏰ Нерегулярное время отхода ко сну. Старайтесь ложиться в одно время ±30 минут для настройки циркадных ритмов');
  }

  return notifications;
}

/**
 * Создаёт отчёт о сне в формате для PDF экспорта
 */
export function generateSleepReport(
  sleepDiary: SleepEntry[],
  goals: { targetHours: number; targetQuality: number }
): string {
  if (sleepDiary.length === 0) return 'Нет данных о сне';

  const recent = sleepDiary.slice(0, 30); // последние 30 дней
  const avgHours = recent.reduce((sum, e) => sum + e.hours, 0) / recent.length;
  const avgQuality = recent.reduce((sum, e) => sum + e.quality, 0) / recent.length;
  const avgLatency = recent.filter(e => e.latency).length > 0
    ? recent.filter(e => e.latency).reduce((sum, e) => sum + (e.latency || 0), 0) / recent.filter(e => e.latency).length
    : 0;

  const report = [
    '=== ОТЧЁТ О КАЧЕСТВЕ СНА ===',
    '',
    `Период: ${recent[recent.length - 1]?.date} — ${recent[0]?.date}`,
    `Записей: ${recent.length}`,
    '',
    '--- СРЕДНИЕ ПОКАЗАТЕЛИ ---',
    `Часы сна: ${avgHours.toFixed(1)} ч (цель: ${goals.targetHours} ч)`,
    `Качество: ${avgQuality.toFixed(1)}/5 (цель: ${goals.targetQuality}/5)`,
    avgLatency > 0 ? `Латентность: ${avgLatency.toFixed(0)} мин` : null,
    '',
    '--- ОЦЕНКА ---',
    avgHours >= goals.targetHours && avgQuality >= goals.targetQuality
      ? '✅ Цели достигнуты! Отличная работа!'
      : '⚠️ Требуется улучшение',
    '',
    '--- РЕКОМЕНДАЦИИ ---',
    ...generateSleepHygieneNotifications(recent),
    '',
    'Отчёт сгенерирован автоматически.'
  ].filter(Boolean);

  return report.join('\n');
}

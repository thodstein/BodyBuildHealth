import { useEffect, useState } from 'react';
import { BPEntry } from '../../../../../core/bp-hr-data';

export interface BPAlert {
  id: string;
  type: 'crisis' | 'high' | 'trend_up' | 'missed_measurement' | 'medication_reminder';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
}

interface UseBPAlertsOptions {
  entries: BPEntry[];
  medicationTaken?: boolean;
  lastMeasurementDate?: string;
}

export function useBPAlerts({ entries, medicationTaken, lastMeasurementDate }: UseBPAlertsOptions): [BPAlert[], (id: string) => void] {
  const [alerts, setAlerts] = useState<BPAlert[]>([]);

  useEffect(() => {
    const newAlerts: BPAlert[] = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Crisis alert (latest reading)
    if (entries.length > 0) {
      const latest = entries[0];
      if (latest.systolic >= 180 || latest.diastolic >= 120) {
        newAlerts.push({
          id: `crisis-${latest.date}`,
          type: 'crisis',
          severity: 'critical',
          title: '🚨 КРИЗИС АД',
          message: `Последнее измерение ${latest.systolic}/${latest.diastolic} — немедленно обратитесь к врачу!`,
          timestamp: latest.date,
          dismissed: false,
        });
      } else if (latest.systolic >= 160 || latest.diastolic >= 100) {
        newAlerts.push({
          id: `high-${latest.date}`,
          type: 'high',
          severity: 'warning',
          title: '⚠️ Высокое АД',
          message: `Последнее измерение ${latest.systolic}/${latest.diastolic} выше целевого уровня`,
          timestamp: latest.date,
          dismissed: false,
        });
      }
    }

    // 2. Trend alert (3 consecutive increases)
    if (entries.length >= 3) {
      const recent3 = entries.slice(0, 3);
      const trendUp = recent3.every((entry, i) => 
        i === 0 || (entry.systolic > recent3[i - 1].systolic)
      );
      if (trendUp && recent3[0].systolic - recent3[2].systolic > 10) {
        newAlerts.push({
          id: `trend-${today}`,
          type: 'trend_up',
          severity: 'warning',
          title: '📈 Тренд вверх',
          message: `АД растёт 3 измерения подряд (+${recent3[0].systolic - recent3[2].systolic} мм рт.ст.)`,
          timestamp: today,
          dismissed: false,
        });
      }
    }

    // 3. Missed measurement (no measurement today)
    if (lastMeasurementDate !== today) {
      const lastDate = new Date(lastMeasurementDate || '1970-01-01');
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 1) {
        newAlerts.push({
          id: `missed-${today}`,
          type: 'missed_measurement',
          severity: 'info',
          title: '📅 Пропущено измерение',
          message: `Сегодня ещё не было измерения АД. Последнее: ${lastMeasurementDate || 'нет данных'}`,
          timestamp: today,
          dismissed: false,
        });
      }
    }

    // 4. Medication reminder (if medication was expected but not taken)
    if (entries.length > 0 && entries[0].medicationTaken === false) {
      const latest = entries[0];
      if (latest.systolic >= 140 || latest.diastolic >= 90) {
        newAlerts.push({
          id: `med-${latest.date}`,
          type: 'medication_reminder',
          severity: 'info',
          title: '💊 Напоминание о лекарствах',
          message: `АД повышено (${latest.systolic}/${latest.diastolic}), рекомендован приём назначенных препаратов`,
          timestamp: latest.date,
          dismissed: false,
        });
      }
    }

    setAlerts(newAlerts);
  }, [entries, medicationTaken, lastMeasurementDate]);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  return [alerts, dismissAlert] as const;
}

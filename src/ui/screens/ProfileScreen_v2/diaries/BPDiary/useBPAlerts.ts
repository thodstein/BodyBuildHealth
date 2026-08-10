import { useEffect, useState, useCallback } from 'react';
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

const DISMISSED_KEY = 'he_bp_alerts_dismissed';

function loadDismissed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(raw) ? new Set(raw) : new Set();
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>): void {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch {}
}

export function useBPAlerts({ entries, medicationTaken, lastMeasurementDate }: UseBPAlertsOptions): [BPAlert[], (id: string) => void] {
  const [alerts, setAlerts] = useState<BPAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(loadDismissed);

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
          dismissed: dismissedIds.has(`crisis-${latest.date}`),
        });
      } else if (latest.systolic >= 160 || latest.diastolic >= 100) {
        newAlerts.push({
          id: `high-${latest.date}`,
          type: 'high',
          severity: 'warning',
          title: '⚠️ Высокое АД',
          message: `Последнее измерение ${latest.systolic}/${latest.diastolic} выше целевого уровня`,
          timestamp: latest.date,
          dismissed: dismissedIds.has(`high-${latest.date}`),
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
        const id = `trend-${today}`;
        newAlerts.push({
          id,
          type: 'trend_up',
          severity: 'warning',
          title: '📈 Тренд вверх',
          message: `АД растёт 3 измерения подряд (+${recent3[0].systolic - recent3[2].systolic} мм рт.ст.)`,
          timestamp: today,
          dismissed: dismissedIds.has(id),
        });
      }
    }

    // 3. Missed measurement (no measurement today)
    if (lastMeasurementDate !== today) {
      const lastDate = new Date(lastMeasurementDate || '1970-01-01');
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 1) {
        const id = `missed-${today}`;
        newAlerts.push({
          id,
          type: 'missed_measurement',
          severity: 'info',
          title: '📅 Пропущено измерение',
          message: `Сегодня ещё не было измерения АД. Последнее: ${lastMeasurementDate || 'нет данных'}`,
          timestamp: today,
          dismissed: dismissedIds.has(id),
        });
      }
    }

    // 4. Medication reminder (if medication was expected but not taken)
    if (entries.length > 0 && entries[0].medicationTaken === false) {
      const latest = entries[0];
      if (latest.systolic >= 140 || latest.diastolic >= 90) {
        const id = `med-${latest.date}`;
        newAlerts.push({
          id,
          type: 'medication_reminder',
          severity: 'info',
          title: '💊 Напоминание о лекарствах',
          message: `АД повышено (${latest.systolic}/${latest.diastolic}), рекомендован приём назначенных препаратов`,
          timestamp: latest.date,
          dismissed: dismissedIds.has(id),
        });
      }
    }

    setAlerts(newAlerts);
  }, [entries, medicationTaken, lastMeasurementDate, dismissedIds]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  return [alerts, dismissAlert] as const;
}

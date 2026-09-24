/**
 * arm-table.engine.ts — бюджетирование table time (как cardio engine).
 * Кузнецов VIII: ≥50% тренировок — стол. + периодизация Кузнецова 3/2/1.
 */
import type { ArmWeek } from './arm-types';

export type TableWeekKind = 'moderate' | 'heavy' | 'stress';

export function tableWeekKind(week: number, totalWeeks: number): TableWeekKind {
  const safeWeeks = Number.isFinite(totalWeeks) && totalWeeks > 0 ? Math.floor(totalWeeks) : 6;
  const cycleLength = safeWeeks < 6 ? Math.max(1, safeWeeks) : 6;
  const pos = (week - 1) % cycleLength;
  if (cycleLength < 6) {
    if (cycleLength <= 3) return pos === 0 ? 'moderate' : pos === 1 ? 'heavy' : 'stress';
    const moderateCount = Math.max(1, Math.floor(cycleLength * 0.5));
    const heavyCount = Math.max(1, Math.floor(cycleLength / 3));
    if (pos < moderateCount) return 'moderate';
    if (pos < moderateCount + heavyCount) return 'heavy';
    return 'stress';
  }
  if (pos < 3) return 'moderate';
  if (pos < 5) return 'heavy';
  return 'stress';
}

export function tableWeekParams(kind: TableWeekKind): { intensityPct: string; holdSeconds: string; stressNote: string } {
  if (kind === 'moderate') return { intensityPct: '50–75%', holdSeconds: '1–3 мин (40–60%)', stressNote: 'Умеренная' };
  if (kind === 'heavy') return { intensityPct: '75–100%', holdSeconds: '10с–1 мин', stressNote: 'Тяжёлая' };
  return { intensityPct: '100–125%', holdSeconds: '5–10с', stressNote: 'Стрессовая' };
}

export interface TableTimeSummary {
  tableSessions: number;
  totalSessions: number;
  tableSessionShare: number;
  tableMinutes: number | null;
  tableMinutesShare: number | null;
  targetRatio: number;
  targetMet: boolean;
}

export function tableTimeSummary(weeks: ArmWeek[], targetRatio = 0): TableTimeSummary {
  let tableSessions = 0;
  let totalSessions = 0;
  let tableMinutes = 0;
  let totalMinutes = 0;
  let durationsKnown = true;
  for (const wk of weeks) {
    for (const session of wk.sessions) {
      totalSessions += 1;
      if (session.tableTime) tableSessions += 1;
      const duration = Number(session.durationMin);
      if (Number.isFinite(duration) && duration > 0) {
        totalMinutes += duration;
        if (session.tableTime) tableMinutes += duration;
      } else {
        durationsKnown = false;
      }
    }
  }
  const tableSessionShare = totalSessions > 0 ? tableSessions / totalSessions : 0;
  const knownMinutes = durationsKnown ? totalMinutes : null;
  const knownTableMinutes = durationsKnown ? tableMinutes : null;
  const tableMinutesShare = knownMinutes && knownTableMinutes != null && knownMinutes > 0
    ? knownTableMinutes / knownMinutes
    : null;
  return {
    tableSessions,
    totalSessions,
    tableSessionShare,
    tableMinutes: knownTableMinutes,
    tableMinutesShare,
    targetRatio,
    targetMet: tableSessionShare >= targetRatio,
  };
}

export function tableTimeBudget(weeks: ArmWeek[], targetRatio: number): { week: number; kind: TableWeekKind; tableSessions: number; totalSessions: number; ratio: number; tableSessionShare: number; tableMinutes: number | null; tableMinutesShare: number | null; targetRatio: number; targetMet: boolean }[] {
  return weeks.map(wk => {
    const tableSessions = wk.sessions.filter(s => s.tableTime).length;
    const totalSessions = wk.sessions.length;
    const ratio = totalSessions > 0 ? tableSessions / totalSessions : 0;
    const durationsKnown = totalSessions > 0 && wk.sessions.every(s => Number.isFinite(Number(s.durationMin)) && Number(s.durationMin) > 0);
    const totalMinutes = durationsKnown ? wk.sessions.reduce((sum, s) => sum + Number(s.durationMin), 0) : null;
    const tableMinutes = durationsKnown ? wk.sessions.filter(s => s.tableTime).reduce((sum, s) => sum + Number(s.durationMin), 0) : null;
    const tableMinutesShare = totalMinutes && tableMinutes != null ? tableMinutes / totalMinutes : null;
    const kind = tableWeekKind(wk.week, weeks.length);
    return { week: wk.week, kind, tableSessions, totalSessions, ratio, tableSessionShare: ratio, tableMinutes, tableMinutesShare, targetRatio, targetMet: ratio >= targetRatio };
  });
}

export function isTableExercise(ex: { isTable?: boolean; substitutionGroup?: string; name?: string }): boolean {
  if (ex.isTable) return true;
  const sg = (ex.substitutionGroup || '').toLowerCase();
  if (sg.includes('pronation') || sg.includes('supination')) return true;
  if (sg === 'cup_iso') return true;
  const n = (ex.name || '').toLowerCase();
  if (n.includes('стол') || n.includes('table') || n.includes('hook') || n.includes('lat_drag')) return true;
  return false;
}

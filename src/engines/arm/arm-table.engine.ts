/**
 * arm-table.engine.ts — бюджетирование table time (как cardio engine).
 * Кузнецов VIII: ≥50% тренировок — стол. + периодизация Кузнецова 3/2/1.
 */
import type { ArmWeek } from './arm-types';

export type TableWeekKind = 'moderate' | 'heavy' | 'stress';

export function tableWeekKind(week: number, totalWeeks: number): TableWeekKind {
  // 3 умеренные : 2 тяжёлые : 1 стрессовая (цикл 6 нед), затем повтор
  const pos = (week - 1) % 6;
  if (pos < 3) return 'moderate';
  if (pos < 5) return 'heavy';
  return 'stress';
}

export function tableWeekParams(kind: TableWeekKind): { intensityPct: string; holdSeconds: string; stressNote: string } {
  if (kind === 'moderate') return { intensityPct: '50–75%', holdSeconds: '1–3 мин (40–60%)', stressNote: 'Умеренная' };
  if (kind === 'heavy') return { intensityPct: '75–100%', holdSeconds: '10с–1 мин', stressNote: 'Тяжёлая' };
  return { intensityPct: '100–125%', holdSeconds: '5–10с', stressNote: 'Стрессовая' };
}

export function tableTimeBudget(weeks: ArmWeek[], targetRatio: number): { week: number; kind: TableWeekKind; tableSessions: number; totalSessions: number; ratio: number }[] {
  return weeks.map(wk => {
    const tableSessions = wk.sessions.filter(s => s.tableTime).length;
    const totalSessions = wk.sessions.length;
    const ratio = totalSessions > 0 ? tableSessions / totalSessions : 0;
    const kind = tableWeekKind(wk.week, weeks.length);
    return { week: wk.week, kind, tableSessions, totalSessions, ratio };
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

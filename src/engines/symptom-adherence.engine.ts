/**
 * symptom-adherence.engine.ts — Трекер приёма решений
 *
 * Отмечает приём назначенных веществ, связывает с динамикой симптома.
 * localStorage: he_symptom_adherence + he_symptom_intake_log
 */
import { getSymptomHistory, updateSymptomToday, getSymptomDiary } from './symptom-diary.engine';

export interface SubstanceAssignment {
  id: string;                    // уникальный id записи
  symptomId: string;             // какой симптом
  substanceId: string;           // какой препарат (catalog id)
  substanceName: string;         // название для отображения
  dose: string;                  // дозировка
  dateStarted: string;           // YYYY-MM-DD
  dateEnded?: string;            // YYYY-MM-DD (если отменили)
  status: 'active' | 'stopped' | 'completed';
}

export interface IntakeLog {
  date: string;                  // YYYY-MM-DD
  assignmentId: string;
  taken: boolean;                // принял?
  dose?: string;                 // фактическая доза
  note?: string;
}

export interface SymptomAdherenceStats {
  assignments: SubstanceAssignment[];
  /** Процент приёма за последние 7 дней */
  adherence7d: number;
  /** Какие дозы пропущены сегодня */
  missedToday: SubstanceAssignment[];
  /** active assignments */
  activeCount: number;
}

const ASSIGNMENTS_KEY = 'he_symptom_assignments';
const INTAKE_KEY = 'he_symptom_intake_log';

// ─── Assignments ───

export function getAssignments(): SubstanceAssignment[] {
  try { return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || '[]'); }
  catch { return []; }
}

export function addAssignment(
  symptomId: string, substanceId: string, substanceName: string, dose: string
): SubstanceAssignment {
  const list = getAssignments();
  const entry: SubstanceAssignment = {
    id: `${substanceId}_${Date.now()}`,
    symptomId, substanceId, substanceName, dose,
    dateStarted: new Date().toISOString().slice(0, 10),
    status: 'active',
  };
  list.push(entry);
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(list));
  return entry;
}

export function stopAssignment(id: string): void {
  const list = getAssignments();
  const idx = list.findIndex((a) => a.id === id);
  if (idx >= 0) {
    list[idx].status = 'stopped';
    list[idx].dateEnded = new Date().toISOString().slice(0, 10);
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(list));
  }
}

export function getActiveAssignments(): SubstanceAssignment[] {
  return getAssignments().filter((a) => a.status === 'active');
}

export function getAssignmentsForSymptom(symptomId: string): SubstanceAssignment[] {
  return getAssignments().filter((a) => a.symptomId === symptomId);
}

// ─── Intake log ───

export function getIntakeLog(): IntakeLog[] {
  try { return JSON.parse(localStorage.getItem(INTAKE_KEY) || '[]'); }
  catch { return []; }
}

export function markIntake(assignmentId: string, taken: boolean, dose?: string): void {
  const log = getIntakeLog();
  const today = new Date().toISOString().slice(0, 10);
  const existing = log.findIndex((l) => l.assignmentId === assignmentId && l.date === today);
  const entry: IntakeLog = { date: today, assignmentId, taken, dose };
  if (existing >= 0) {
    log[existing] = entry;
  } else {
    log.push(entry);
  }
  localStorage.setItem(INTAKE_KEY, JSON.stringify(log));
}

export function getTodayIntakes(): IntakeLog[] {
  const today = new Date().toISOString().slice(0, 10);
  return getIntakeLog().filter((l) => l.date === today);
}

/** Получить adherence-статистику */
export function getAdherenceStats(): SymptomAdherenceStats {
  const assignments = getAssignments();
  const active = assignments.filter((a) => a.status === 'active');
  const log = getIntakeLog();

  // Adherence за 7 дней
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weekLogs = log.filter((l) => l.date >= weekAgo && active.some((a) => a.id === l.assignmentId));
  const totalDoses = weekLogs.length;
  const takenDoses = weekLogs.filter((l) => l.taken).length;
  const adherence7d = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 100;

  const today = new Date().toISOString().slice(0, 10);
  const todayIntakeIds = log.filter((l) => l.date === today && l.taken).map((l) => l.assignmentId);
  const missedToday = active.filter((a) => !todayIntakeIds.includes(a.id));

  return { assignments, adherence7d, missedToday, activeCount: active.length };
}

/** Связать приём с динамикой симптома: данные для графика */
export function getSymptomVsAdherenceData(symptomId: string): {
  dates: string[];
  severity: (number | null)[];
  adherencePct: (number | null)[];
} {
  const diary = getSymptomDiary();
  const assignments = getAssignmentsForSymptom(symptomId);
  const intakeLog = getIntakeLog();
  const activeIds = assignments.filter((a) => a.status === 'active').map((a) => a.id);

  const dates: string[] = [];
  const severity: (number | null)[] = [];
  const adherencePct: (number | null)[] = [];

  for (const day of diary) {
    const entry = day.entries.find((e) => e.symptomId === symptomId);
    if (!entry) continue;
    dates.push(day.date);

    severity.push(entry.severity);

    // % приёма в этот день
    const dayLogs = intakeLog.filter(
      (l) => l.date === day.date && activeIds.includes(l.assignmentId)
    );
    if (dayLogs.length > 0) {
      const pct = Math.round((dayLogs.filter((l) => l.taken).length / dayLogs.length) * 100);
      adherencePct.push(pct);
    } else {
      adherencePct.push(null);
    }
  }

  return { dates, severity, adherencePct };
}

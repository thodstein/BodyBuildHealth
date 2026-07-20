// ════════════════════════════════════════════════════════════════════════════
//  SUPPLEMENT COMPLIANCE ENGINE — Календарь приёма БАДов + график комплаенса
//  Читает симптом-адхеренс (symptom-adherence.engine) и строит календарь приёма
// ════════════════════════════════════════════════════════════════════════════

export interface ComplianceDay {
  date: string;
  total: number;
  taken: number;
  missed: number;
  adherence: number; // 0-100%
  details: { substance: string; taken: boolean }[];
}

export interface ComplianceWeek {
  startDate: string;
  endDate: string;
  days: ComplianceDay[];
  overallAdherence: number;
  totalAssigned: number;
  totalTaken: number;
  totalMissed: number;
  bestDay: ComplianceDay | null;
  worstDay: ComplianceDay | null;
  streak: number; // consecutive days with 100% adherence
}

export interface ComplianceSummary {
  weeks: ComplianceWeek[];
  overall7d: number;
  overall30d: number;
  streak: number;
  bestWeek: ComplianceWeek | null;
  today: ComplianceDay | null;
  activeSubstances: { id: string; name: string; dose: string; startedAt: string; adherence7d: number }[];
}

// ────────────────── STORAGE KEYS ──────────────────

const ASSIGNMENTS_KEY = 'he_symptom_assignments';
const INTAKE_KEY = 'he_symptom_intake_log';

interface StoredAssignment {
  id: string;
  symptomId: string;
  substanceId: string;
  substanceName: string;
  dose: string;
  dateStarted: string;
  dateEnded?: string;
  status: 'active' | 'stopped' | 'completed';
}

interface StoredIntake {
  date: string;
  assignmentId: string;
  taken: boolean;
  dose?: string;
  note?: string;
}

function getAssignments(): StoredAssignment[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getIntakes(): StoredIntake[] {
  try {
    const raw = localStorage.getItem(INTAKE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ────────────────── COMPLIANCE CALCULATION ──────────────────

export function computeCompliance(daysBack: number = 30): ComplianceSummary {
  const assignments = getAssignments().filter(a => a.status === 'active');
  const intakes = getIntakes();
  const now = new Date();
  const todayStr = formatDate(now);

  const weeks: ComplianceWeek[] = [];
  const todayIntakes = intakes.filter(i => i.date === todayStr);
  const todayActive = assignments.filter(a => !a.dateEnded || a.dateEnded >= todayStr);

  const todayDetails = todayActive.map(a => ({
    substance: a.substanceName || a.substanceId,
    taken: todayIntakes.some(i => i.assignmentId === a.id && i.taken),
  }));
  const todayTaken = todayDetails.filter(d => d.taken).length;

  const today: ComplianceDay = {
    date: todayStr,
    total: todayActive.length,
    taken: todayTaken,
    missed: todayActive.length - todayTaken,
    adherence: todayActive.length ? Math.round((todayTaken / todayActive.length) * 100) : 0,
    details: todayDetails,
  };

  // Build weekly data
  const allDays: ComplianceDay[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const dayIntakes = intakes.filter(inTake => inTake.date === dateStr);
    const active = assignments.filter(a => {
      if (a.dateEnded && a.dateEnded < dateStr) return false;
      return a.dateStarted <= dateStr;
    });

    const details = active.map(a => ({
      substance: a.substanceName || a.substanceId,
      taken: dayIntakes.some(inTake => inTake.assignmentId === a.id && inTake.taken),
    }));
    const dayTaken = details.filter(dd => dd.taken).length;

    allDays.push({
      date: dateStr,
      total: active.length,
      taken: dayTaken,
      missed: active.length - dayTaken,
      adherence: active.length ? Math.round((dayTaken / active.length) * 100) : active.length === 0 ? 100 : 0,
      details,
    });
  }

  // Group into weeks
  for (let w = 0; w < allDays.length; w += 7) {
    const weekDays = allDays.slice(w, Math.min(w + 7, allDays.length));
    const totalAssigned = weekDays.reduce((s, d) => s + d.total, 0);
    const totalTaken = weekDays.reduce((s, d) => s + d.taken, 0);
    const overallAdherence = totalAssigned ? Math.round((totalTaken / totalAssigned) * 100) : 100;

    weeks.push({
      startDate: weekDays[0].date,
      endDate: weekDays[weekDays.length - 1].date,
      days: weekDays,
      overallAdherence,
      totalAssigned,
      totalTaken,
      totalMissed: totalAssigned - totalTaken,
      bestDay: weekDays.reduce((best, d) => d.adherence > (best?.adherence ?? -1) ? d : best, null as ComplianceDay | null),
      worstDay: weekDays.reduce((worst, d) => d.adherence < (worst?.adherence ?? 101) ? d : worst, null as ComplianceDay | null),
      streak: computeStreak({ ...today, date: weekDays[weekDays.length - 1].date }, allDays),
    });
  }

  // 7d and 30d adherence
  const last7d = allDays.slice(-7);
  const total7d = last7d.reduce((s, d) => s + d.total, 0);
  const taken7d = last7d.reduce((s, d) => s + d.taken, 0);
  const overall7d = total7d ? Math.round((taken7d / total7d) * 100) : 0;

  const total30d = allDays.reduce((s, d) => s + d.total, 0);
  const taken30d = allDays.reduce((s, d) => s + d.taken, 0);
  const overall30d = total30d ? Math.round((taken30d / total30d) * 100) : 0;

  // Streak
  const streak = computeStreak(today, allDays);

  const activeSubstances = assignments.filter(a => a.status === 'active').map(a => {
    const aIntakes = intakes.filter(i => i.assignmentId === a.id);
    const last7Intakes = aIntakes.filter(i => {
      const intakeDate = new Date(i.date);
      const diff = (now.getTime() - intakeDate.getTime()) / (24 * 3600 * 1000);
      return diff <= 7;
    });
    const taken7 = last7Intakes.filter(i => i.taken).length;
    return {
      id: a.substanceId,
      name: a.substanceName || a.substanceId,
      dose: a.dose || '',
      startedAt: a.dateStarted,
      adherence7d: Math.round((taken7 / Math.min(7, Math.max(1, last7Intakes.length))) * 100),
    };
  });

  return {
    weeks,
    overall7d,
    overall30d,
    streak,
    bestWeek: weeks.reduce((b, w) => w.overallAdherence > (b?.overallAdherence ?? -1) ? w : b, null as ComplianceWeek | null),
    today,
    activeSubstances,
  };
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStreak(today: ComplianceDay, allDays: ComplianceDay[]): number {
  let streak = 0;
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i].adherence >= 100) streak++;
    else break;
  }
  return streak;
}

export function getComplianceWeekLabel(w: ComplianceWeek): string {
  const s = new Date(w.startDate);
  const e = new Date(w.endDate);
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}-${e.getDate()} ${months[e.getMonth()]}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} - ${e.getDate()} ${months[e.getMonth()]}`;
}

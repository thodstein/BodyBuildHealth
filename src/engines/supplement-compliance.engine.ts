// ════════════════════════════════════════════════════════════════════════════
//  SUPPLEMENT COMPLIANCE ENGINE — Календарь приёма БАДов + график комплаенса
//  Читает he_support_diary (основной дневник приёма из SupportDiaryView)
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
  streak: number; // consecutive days with adherence >= 80%
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

const DIARY_KEY = 'he_support_diary';

interface DiaryEntry {
  date: string;
  substances: Record<string, { taken: boolean; dose?: string; timeSlot?: string; sideEffects?: string[] }>;
  notes?: string;
  complianceNotes?: string;
  mood?: number;
}

function loadDiary(): DiaryEntry[] {
  try { return JSON.parse(localStorage.getItem(DIARY_KEY) || '[]'); } catch { return []; }
}

/** Получить список всех веществ, которые когда-либо встречались в дневнике */
function getAllSubstanceIds(diary: DiaryEntry[]): string[] {
  const ids = new Set<string>();
  for (const entry of diary) {
    for (const id of Object.keys(entry.substances)) ids.add(id);
  }
  return Array.from(ids);
}

/** Получить дозировку вещества из первой записи в дневнике */
function getDoseForSubstance(diary: DiaryEntry[], subId: string): string {
  for (const entry of diary) {
    const s = entry.substances[subId];
    if (s?.dose) return s.dose;
  }
  return '';
}

/** Получить дату первого приёма вещества */
function getStartDateForSubstance(diary: DiaryEntry[], subId: string): string {
  for (const entry of diary) {
    if (entry.substances[subId]) return entry.date;
  }
  return '';
}

// ────────────────── COMPLIANCE CALCULATION ──────────────────

/**
 * Вычислить комплаенс из he_support_diary.
 * @param daysBack - период анализа (по умолчанию 30 дней)
 * @param planSubs - список плановых веществ (из SUPPORT_LEVELS). Если пуст, используются все встречавшиеся вещества.
 */
export function computeCompliance(daysBack: number = 30, planSubs?: string[]): ComplianceSummary {
  const diary = loadDiary();
  const now = new Date();
  const todayStr = formatDateLocal(now);

  // Определяем список отслеживаемых веществ
  const subIds = planSubs && planSubs.length > 0 ? planSubs : getAllSubstanceIds(diary);
  const subIdSet = new Set(subIds);

  // Сегодня
  const todayEntry = diary.find(e => e.date === todayStr);
  const todayDetails = subIds.map(id => ({
    substance: id,
    taken: todayEntry?.substances[id]?.taken ?? false,
  }));
  const todayTaken = todayDetails.filter(d => d.taken).length;

  const today: ComplianceDay = {
    date: todayStr,
    total: subIds.length,
    taken: todayTaken,
    missed: subIds.length - todayTaken,
    adherence: subIds.length > 0 ? Math.round((todayTaken / subIds.length) * 100) : 0,
    details: todayDetails,
  };

  // Build daily data for the last `daysBack` days
  const allDays: ComplianceDay[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateLocal(d);
    const entry = diary.find(e => e.date === dateStr);

    const details = subIds.map(id => ({
      substance: id,
      taken: entry?.substances[id]?.taken ?? false,
    }));
    const dayTaken = details.filter(dd => dd.taken).length;

    allDays.push({
      date: dateStr,
      total: subIds.length,
      taken: dayTaken,
      missed: subIds.length - dayTaken,
      adherence: subIds.length > 0 ? Math.round((dayTaken / subIds.length) * 100) : 0,
      details,
    });
  }

  // Group into weeks
  const weeks: ComplianceWeek[] = [];
  for (let w = 0; w < allDays.length; w += 7) {
    const weekDays = allDays.slice(w, Math.min(w + 7, allDays.length));
    const totalAssigned = weekDays.reduce((s, d) => s + d.total, 0);
    const totalTaken = weekDays.reduce((s, d) => s + d.taken, 0);
    const overallAdherence = totalAssigned > 0 ? Math.round((totalTaken / totalAssigned) * 100) : 0;

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
      streak: computeStreak(allDays, weekDays[weekDays.length - 1].date),
    });
  }

  // 7d and 30d adherence
  const last7d = allDays.slice(-7);
  const total7d = last7d.reduce((s, d) => s + d.total, 0);
  const taken7d = last7d.reduce((s, d) => s + d.taken, 0);
  const overall7d = total7d > 0 ? Math.round((taken7d / total7d) * 100) : 0;

  const total30d = allDays.reduce((s, d) => s + d.total, 0);
  const taken30d = allDays.reduce((s, d) => s + d.taken, 0);
  const overall30d = total30d > 0 ? Math.round((taken30d / total30d) * 100) : 0;

  // Streak: consecutive days with adherence >= 80%
  const streak = computeStreak(allDays, todayStr);

  // Per-substance adherence (7d)
  const activeSubstances = subIds.map(id => {
    let taken7 = 0;
    let total7 = 0;
    for (const d of allDays.slice(-7)) {
      total7++;
      if (d.details.some(dd => dd.substance === id && dd.taken)) taken7++;
    }
    return {
      id,
      name: id,
      dose: getDoseForSubstance(diary, id),
      startedAt: getStartDateForSubstance(diary, id),
      adherence7d: total7 > 0 ? Math.round((taken7 / total7) * 100) : 0,
    };
  });

  return {
    weeks,
    overall7d,
    overall30d,
    streak,
    bestWeek: weeks.reduce((b: ComplianceWeek | null, w: ComplianceWeek) => w.overallAdherence > (b?.overallAdherence ?? -1) ? w : b, null as ComplianceWeek | null),
    today,
    activeSubstances,
  };
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeStreak(allDays: ComplianceDay[], fromDate: string): number {
  const fromIdx = allDays.findIndex(d => d.date === fromDate);
  if (fromIdx < 0) return 0;
  let streak = 0;
  for (let i = fromIdx; i >= 0; i--) {
    if (allDays[i].adherence >= 80) streak++;
    else break;
  }
  return streak;
}

export function getComplianceWeekLabel(w: ComplianceWeek): string {
  const s = new Date(w.startDate + 'T00:00:00');
  const e = new Date(w.endDate + 'T00:00:00');
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}-${e.getDate()} ${months[e.getMonth()]}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} - ${e.getDate()} ${months[e.getMonth()]}`;
}

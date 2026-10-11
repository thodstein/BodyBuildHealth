/**
 * pl-season-pro.engine.ts — PRO-довесок ПЛ-авто: сезонный ICS, недельная сверка
 * «план vs факт», интенсивностная и дрейф-подсказки.
 *
 * Закрывает остаток аудита Oct 2026 (docs/PL-AUTO-PRO-AUDIT-2026-10.md §5):
 *  1. Сезонный календарь (.ics) из единого реестра стартов — раньше ICS был
 *     только у тапер-плана/макроцикла, сезон выгружался без дат;
 *  2. Недельный отчёт «план vs факт» (дневник → недели плана): выполнение,
 *     частичное/пропущенное, честный no-data;
 *  3. Подсказка «перейди на авторегуляцию»: факт тяжелее плана (RPE ≥9.5)
 *     несколько сессий подряд (Cowley JSCR 2025: фикс. %1PM к 4–5 подходу
 *     дрейфует к фактическим 85–90%);
 *  4. Интенсивностная подсказка: RIR ≤1 на основных подходах ≈ близко к отказу —
 *     для силы держи velocity loss 10–20% (Zhang 2023 / Jukic 2023). Если в
 *     дневник записаны фактические скорости подходов — подсказка считается по
 *     ФАКТУ потери скорости, иначе (估算) по плановому RIR.
 *  5. Разбивка «план vs факт» по дням/упражнениям недели (plWeeklyComplianceByDays).
 *  6. Экспорт отчёта «план vs факт» в CSV/HTML (buildPLComplianceCsv/Html).
 *
 * Даты: календарные значения — через канон `core/local-date` (UTC-toISOString
 * вечером в UTC+3…+12 даёт «вчера»; ценз: date-canon-census).
 *
 * Все функции чистые (без UI/storage), вход не мутируется.
 */
import type { LMSBuildOutput, LMSPlanWeek } from './lms-builder.engine';
import { dateFromWeeksToStart } from './pl-meet-registry.engine';
import type { WorkoutLog } from '../../core/types';
import { localIsoDate } from '../../core/local-date';
import { norm } from '../norm';

// ---------- Сезонный ICS ----------

export interface PLSeasonIcsMeet {
  id: string;
  name: string;
  weeksToStart: number;
  /** ISO-дата старта (если задана в реестре) — приоритетнее weeksToStart. */
  date?: string;
  priority?: 'A' | 'B' | 'C';
}

export interface PLSeasonIcsOptions {
  /** «Сегодня» (ISO) — база недель без своих дат. */
  todayIso: string;
  /** Дата начала сезона (ISO) — для недель без weekStart/weekEnd. */
  seasonStart?: string;
  /** Название соревнования в SUMMARY (по умолчанию сам name). */
  withPeakWeeks?: boolean;
  /**
   * Добавить VEVENT на каждую тренировочную сессию сезона (раунд 3, §5-bis п.4).
   * Дни цикла раскладываются ПОЗИЦИОННО от weekStart + индекс дня: СРЦ-цикл не
   * хранит weekday (дни — порядок тренировок в неделе), поэтому при реальном
   * расписании пользователь сдвигает события в календаре. Недели без дат
   * пропускаются честно, как и записи пик-блоков.
   */
  withTrainingSessions?: boolean;
}

function icsEscape(value: string): string {
  return value.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

/** ISO (YYYY-MM-DD) → ICS-дата (YYYYMMDD). */
export function isoToIcsDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}`;
}

/** ICS-дата + 1 день (DTEND эксклюзивен по стандарту). */
function icsDatePlusOne(ics: string): string | null {
  if (!/^\d{8}$/.test(ics)) return null;
  const d = new Date(Number(ics.slice(0, 4)), Number(ics.slice(4, 6)) - 1, Number(ics.slice(6, 8)) + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function isoPlusDays(iso: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Короткая метка недели блока (для SUMMARY календаря). */
function weekLabel(w: LMSPlanWeek): string {
  if (w.meetWeek) return `🏁 Старт (нед ${w.week})`;
  if (w.mockMeet) return `🎯 Mock meet (нед ${w.week})`;
  if (w.postMeet) return `🔄 Пост-старт (нед ${w.week})`;
  if (w.taperWeek) return `📉 Тапер (нед ${w.week})`;
  if (w.rampWeek) return `📈 Вход в пик (нед ${w.week})`;
  return `Тренировка (нед ${w.week})`;
}

/**
 * Календарь ПЛ-сезона (.ics): соревнования + размеченные недели пик-блоков.
 * Недели без дат (`weekStart/weekEnd`) пропускаются ЧЕСТНО — даты не выдумываются.
 * Для событий используются всеполдневые DATE-события (как buildMacroIcs).
 */
export function buildPLSeasonIcs(
  weeks: LMSBuildOutput['weeks'],
  meets: PLSeasonIcsMeet[],
  opts: PLSeasonIcsOptions,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BodyBuildHealth//PLSeason//RU',
    'CALSCALE:GREGORIAN',
  ];
  const push = (summary: string, startIso: string, endIsoExclusive: string, description?: string) => {
    const ds = isoToIcsDate(startIso);
    const de = isoToIcsDate(endIsoExclusive);
    if (!ds || !de) return;
    lines.push(
      'BEGIN:VEVENT',
      `SUMMARY:${icsEscape(summary)}`,
      `DTSTART;VALUE=DATE:${ds}`,
      `DTEND;VALUE=DATE:${de}`,
      ...(description ? [`DESCRIPTION:${icsEscape(description)}`] : []),
      'END:VEVENT',
    );
  };

  // 1) Недели пик-блоков, у которых ЕСТЬ даты (appendPLTaperWeeks/dateWeeksBackward).
  if (opts.withPeakWeeks !== false) {
    for (const w of weeks ?? []) {
      const isPeak = w.meetWeek || w.mockMeet || w.postMeet || w.taperWeek || w.rampWeek;
      if (!isPeak) continue;
      const start = w.weekStart;
      const end = w.weekEnd ?? (start ? isoPlusDays(start, 6) : null);
      if (!start || !end) continue; // честно: без разметки дат события нет
      push(weekLabel(w), start, isoPlusDays(end, 1) ?? end, w.taperNote ?? undefined);
    }
  }

  // 2) Соревнования: явная дата реестра, иначе «today + (N−1)×7» (контракт недель).
  for (const m of meets ?? []) {
    const date = (m.date && /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? m.date : null)
      ?? dateFromWeeksToStart(m.weeksToStart, opts.todayIso);
    if (!date) continue;
    const priority = m.priority ? ` [${m.priority}]` : '';
    push(`🏁 ${m.name}${priority}`, date, isoPlusDays(date, 1) ?? date, `ПЛ-сезон: старт недели ${Math.max(1, Math.round(m.weeksToStart))}`);
  }

  // 3) Тренировочные сессии сезона (опция): VEVENT на каждый день каждой недели,
  //    у которой известна дата начала (weekStart или seasonStart + (N−1)×7).
  if (opts.withTrainingSessions) {
    for (const w of weeks ?? []) {
      const start = w.weekStart
        ?? (opts.seasonStart ? isoPlusDays(opts.seasonStart, (Math.max(1, w.week) - 1) * 7) : null);
      if (!start) continue; // честно: без даты события нет
      w.days.forEach((day, di) => {
        const dayIso = isoPlusDays(start, di);
        if (!dayIso) return;
        const linesEx = (day.exercises ?? [])
          .filter(e => !/^(отдых|тест\s*:)/i.test((e.name || '').trim()))
          .map(e => {
            const sets = (e.workSets ?? []).map(ws => `${ws.sets}×${ws.reps} @${Math.round(ws.weight)}кг`).join(' + ');
            return `${e.name}: ${sets}`;
          });
        if (linesEx.length === 0) return;
        const tag = weekLabel(w).replace(/ \(нед \d+\)$/, '');
        push(
          `🏋 Н${w.week} Д${di + 1} — ${tag}`,
          dayIso,
          isoPlusDays(dayIso, 1) ?? dayIso,
          linesEx.join('\n'),
        );
      });
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Скачивание .ics (APK — нативный мост, web — Blob). Возвращает текст для тоста. */
export function plSeasonIcsFilename(suffix = 'pl-season'): string {
  // Канон календарной даты: UTC-toISOString вечером даёт «вчера» (date-canon-census).
  return `${suffix}-${localIsoDate()}.ics`;
}

// ═══════════════ Недельная сверка «план vs факт» ══════════════════════════════

export interface PLWeekCompliance {
  week: number;
  plannedSets: number;
  plannedReps: number;
  plannedTonnage: number;
  factSets: number;
  factTonnage: number;
  /** Доля выполненных сетов (fact/planned), 0..1+ */
  setsPct: number;
  status: 'upcoming' | 'done' | 'partial' | 'missed';
  /** Заметка (например «нет сессий в дневнике за неделю»). */
  note?: string;
}

export interface PLComplianceResult {
  weeks: PLWeekCompliance[];
  /** Прошедшие недели (выполненные/частичные/пропущенные). */
  past: PLWeekCompliance[];
  /** Средний процент выполнения по прошедшим неделям (0..1). */
  overallPct: number;
  notes: string[];
  /** Есть ли вообще данные дневника (без них отчёт честно пуст). */
  hasDiary: boolean;
}

const ton = (weight: number, reps: number, sets: number) => (Number(weight) || 0) * (Number(reps) || 0) * (Number(sets) || 0);

/**
 * Сверка недель плана с фактом дневника. Группировка сессий — по `weekNumber`
 * записи упражнения (fallback: `weekNumber` тренировки). Недели без факта и без
 * дат считаются «missed», ТОЛЬКО если неделя уже прошла (по weekStart или выше
 * текущей недели плана — иначе «upcoming»).
 */
export function plWeeklyCompliance(
  plan: LMSBuildOutput,
  sessions: WorkoutLog[],
  opts?: { todayIso?: string; currentWeek?: number },
): PLComplianceResult {
  const notes: string[] = [];
  const hasDiary = Array.isArray(sessions) && sessions.length > 0;
  // Факт по неделям: ключ — weekNumber записи/тренировки.
  const factByWeek = new Map<number, { sets: number; tonnage: number }>();
  for (const wl of sessions ?? []) {
    for (const ex of wl.exercises ?? []) {
      const wkNum = Number(ex.weekNumber ?? wl.weekNumber ?? 0);
      if (!(wkNum >= 1)) continue;
      const cur = factByWeek.get(wkNum) ?? { sets: 0, tonnage: 0 };
      // StrengthLogEntry.sets[] — это ОДИН массив подходов (вес/повторы/RPE на каждый),
      // поля «количество» у подхода нет: один элемент = один подход.
      for (const s of ex.sets ?? []) {
        cur.sets += 1;
        cur.tonnage += ton(s.weight, s.reps, 1);
      }
      factByWeek.set(wkNum, cur);
    }
  }

  const todayIso = opts?.todayIso ?? localIsoDate();
  const weeks: PLWeekCompliance[] = (plan?.weeks ?? []).map(w => {
    let plannedSets = 0, plannedReps = 0, plannedTonnage = 0;
    for (const d of w.days) for (const e of d.exercises) {
      if (/^(отдых|тест\s*:)/i.test((e.name || '').trim())) continue; // служебные строки
      for (const ws of e.workSets) {
        plannedSets += ws.sets;
        plannedReps += ws.reps * ws.sets;
        plannedTonnage += ton(ws.weight, ws.reps, ws.sets);
      }
    }
    const fact = factByWeek.get(w.week) ?? { sets: 0, tonnage: 0 };
    const setsPct = plannedSets > 0 ? fact.sets / plannedSets : 0;
    let status: PLWeekCompliance['status'];
    if (fact.sets === 0) {
      // Неделя «в прошлом»? Даты разметки приоритетнее номера: неделя началась
      // раньше сегодня — иначе неделя плана впереди.
      const started = w.weekStart ? w.weekStart <= todayIso : (opts?.currentWeek != null ? w.week <= opts.currentWeek : true);
      status = started ? 'missed' : 'upcoming';
    } else if (setsPct >= 0.999) status = 'done';
    else status = 'partial';
    const note = fact.sets === 0 && status === 'missed' ? 'нет сессий дневника с этой неделей плана' : undefined;
    return { week: w.week, plannedSets, plannedReps, plannedTonnage: Math.round(plannedTonnage), factSets: fact.sets, factTonnage: Math.round(fact.tonnage), setsPct, status, note };
  });

  const past = weeks.filter(w => w.status !== 'upcoming');
  const overallPct = past.length > 0
    ? past.reduce((s, w) => s + w.setsPct, 0) / past.length
    : 0;
  if (!hasDiary) notes.push('Дневник тренировок пуст — сверка «план vs факт» невозможна.');
  else if (past.length === 0) notes.push('В дневнике нет недель этого плана — отметь weekNumber в записях или дождитесь первой недели.');
  else {
    const missed = past.filter(w => w.status === 'missed').length;
    if (missed > 0) notes.push(`Пропущено недель: ${missed} из ${past.length} прошедших.`);
  }
  return { weeks, past, overallPct, notes, hasDiary };
}

// ═══════════ Разбивка «план vs факт» по дням/упражнениям (раунд 3, §5-bis п.3) ══

export interface PLExerciseCompliance {
  name: string;
  plannedSets: number;
  factSets: number;
  status: 'done' | 'partial' | 'missed';
}

export interface PLDayCompliance {
  /** 1-based номер дня внутри недели плана. */
  day: number;
  plannedSets: number;
  factSets: number;
  /** Доля выполненных сетов дня (fact/planned), 0..1+ */
  setsPct: number;
  exercises: PLExerciseCompliance[];
  status: 'upcoming' | 'done' | 'partial' | 'missed';
}

export interface PLWeekDaysCompliance {
  week: number;
  days: PLDayCompliance[];
  plannedSets: number;
  factSets: number;
}

export interface PLDaysComplianceResult {
  weeks: PLWeekDaysCompliance[];
  notes: string[];
  hasDiary: boolean;
}

const isServiceExercise = (name: string) => /^(отдых|тест\s*:)/i.test((name || '').trim());

/**
 * Сверка плана с фактом ДНЯМИ: какие упражнения дня не выполнены.
 *
 * Сессия дневника матчится к дню плана по имени упражнения (norm): упражнение
 * дневника закрашивает ПЕРВЫЙ день недели плана, где оно запланировано (детерминизм).
 * Недели без факта и без дат — «missed»/«upcoming» по той же логике, что и
 * plWeeklyCompliance (даты разметки приоритетнее номера).
 */
export function plWeeklyComplianceByDays(
  plan: LMSBuildOutput,
  sessions: WorkoutLog[],
  opts?: { todayIso?: string; currentWeek?: number },
): PLDaysComplianceResult {
  const notes: string[] = [];
  const hasDiary = Array.isArray(sessions) && sessions.length > 0;
  const todayIso = opts?.todayIso ?? localIsoDate();

  // Факт по неделям: имя упражнения (norm) → число подходов дневника.
  const factByWeek = new Map<number, Map<string, number>>();
  for (const wl of sessions ?? []) {
    for (const ex of wl.exercises ?? []) {
      const key = plNameKey(ex.exerciseName || '');
      if (!key) continue;
      const wkNum = Number(ex.weekNumber ?? wl.weekNumber ?? 0);
      if (!(wkNum >= 1)) continue;
      const byName = factByWeek.get(wkNum) ?? new Map<string, number>();
      byName.set(key, (byName.get(key) ?? 0) + (ex.sets ?? []).length);
      factByWeek.set(wkNum, byName);
    }
  }

  const weekStarted = (w: LMSPlanWeek): boolean =>
    w.weekStart ? w.weekStart <= todayIso : (opts?.currentWeek != null ? w.week <= opts.currentWeek : true);

  const weeks: PLWeekDaysCompliance[] = (plan?.weeks ?? []).map(w => {
    const fact = factByWeek.get(w.week) ?? new Map<string, number>();
    const started = weekStarted(w);
    // Закрепляем факт имени за ПЕРВЫМ днём недели, где оно запланировано:
    // ПЛ-циклы повторяют основное движение в разные дни — один подход дневника
    // не может закрашивать оба дня (иначе «выполнение» удваивается).
    const assignedDay = new Map<string, number>();
    w.days.forEach((d, di) => {
      for (const e of d.exercises ?? []) {
        if (isServiceExercise(e.name || '')) continue;
        const key = plNameKey(e.name || '');
        if (key && !assignedDay.has(key)) assignedDay.set(key, di);
      }
    });
      const days: PLDayCompliance[] = w.days.map((d, di) => {
        const planned = (d.exercises ?? []).filter(e => !isServiceExercise(e.name || ''));
        // Факт, закреплённый за ЭТИМ днём (первый день, где запланировано имя).
        const dayFact = new Map<string, number>();
        for (const [key, sets] of fact) if (assignedDay.get(key) === di) dayFact.set(key, sets);
        let plannedSets = 0;
        for (const e of planned) {
          for (const ws of e.workSets ?? []) plannedSets += ws.sets;
        }
        const factSets = [...dayFact.values()].reduce((a, b) => a + b, 0);
        const perName = new Map<string, { plannedSets: number; factSets: number }>();
        for (const e of planned) {
          const key = plNameKey(e.name || '');
          const p = perName.get(key) ?? { plannedSets: 0, factSets: 0 };
          for (const ws of e.workSets ?? []) p.plannedSets += ws.sets;
          if (!perName.has(key)) p.factSets = dayFact.get(key) ?? 0;
          perName.set(key, p);
        }
      const exercises: PLExerciseCompliance[] = [];
      for (const e of planned) {
        const key = plNameKey(e.name || '');
        const agg = perName.get(key);
        if (!agg || exercises.some(x => plNameKey(x.name) === key)) continue; // одно имя — одна строка
        const status: PLExerciseCompliance['status'] = agg.factSets === 0 ? 'missed' : agg.factSets >= agg.plannedSets ? 'done' : 'partial';
        exercises.push({ name: e.name, plannedSets: agg.plannedSets, factSets: agg.factSets, status });
      }
      const setsPct = plannedSets > 0 ? factSets / plannedSets : 0;
      const status: PLDayCompliance['status'] = factSets === 0
        ? (started ? 'missed' : 'upcoming')
        : setsPct >= 0.999 ? 'done' : 'partial';
      return { day: di + 1, plannedSets, factSets, setsPct, exercises, status };
    });

    return {
      week: w.week,
      days,
      plannedSets: days.reduce((s, d) => s + d.plannedSets, 0),
      factSets: days.reduce((s, d) => s + d.factSets, 0),
    };
  });

  if (!hasDiary) notes.push('Дневник тренировок пуст — разбивка по дням невозможна.');
  else if (weeks.every(w => w.factSets === 0)) notes.push('В дневнике нет недель этого плана — отметьте weekNumber в записях.');
  return { weeks, notes, hasDiary };
}

// ═════════════ Дрейф % плана (факт тяжелее плана) ═════════════════════════════

export interface PLDriftWarning {
  name: string;
  sessions: number;
  avgFactRpe: number;
  note: string;
}

/**
 * Упражнения, где факт устойчиво тяжелее плана (RPE ≥9.5 в 2+ подряд сессиях):
 * фиксированный %1PM не адаптирован — совет перейти на авторегуляцию.
 * Cowley JSCR 2025: при %1PM-предписании к 4–5 подходу фактическая
 * интенсивность уходит к 85–90% вместо запланированных 70%.
 */
export function planFactDriftWarnings(
  sessions: WorkoutLog[],
  opts?: { minSessions?: number; rpeThreshold?: number },
): PLDriftWarning[] {
  const minSessions = Math.max(2, opts?.minSessions ?? 3);
  const rpeThreshold = opts?.rpeThreshold ?? 9.5;
  const byName = new Map<string, { rpes: number[] }>();
  for (const wl of sessions ?? []) {
    for (const ex of wl.exercises ?? []) {
      const name = (ex.exerciseName || '').trim();
      if (!name) continue;
      const sets = ex.sets ?? [];
      if (sets.length === 0) continue;
      // Самый тяжёлый сет записи — верхний подход ближе к отказу.
      let worst = 0;
      for (const s of sets) if (Number(s.rpe ?? 0) > worst) worst = Number(s.rpe ?? 0);
      if (worst <= 0) continue;
      const cur = byName.get(name) ?? { rpes: [] };
      cur.rpes.push(worst);
      byName.set(name, cur);
    }
  }
  const out: PLDriftWarning[] = [];
  for (const [name, agg] of byName) {
    const rpes = agg.rpes.slice(-minSessions); // последние сессии
    if (rpes.length < minSessions) continue;
    if (!rpes.every(r => r >= rpeThreshold)) continue;
    const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    out.push({
      name,
      sessions: rpes.length,
      avgFactRpe: Math.round(avg * 10) / 10,
      note: `факт RPE ${avg.toFixed(1)} в ${rpes.length} сессиях подряд — план тяжелее спортсмена; перейдите на авторегуляцию (RIR/скорость)`,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

/** Подсказка из дрейфа — одна строка для rationale/UI. */
export function driftWarningLine(warnings: PLDriftWarning[]): string {
  if (warnings.length === 0) return '';
  return `⚠ План тяжелее факта: ${warnings.slice(0, 3).map(w => `${w.name} (RPE ${w.avgFactRpe}×${w.sessions})`).join(', ')} — фиксированный % ПМ дрейфует (Cowley 2025), используйте авторегуляцию.`;
}

// ---------- Интенсивностная подсказка (velocity load) ----------

export interface PLIntensityAdvisory {
  /** Доля основных подходов с RIR ≤1 (0..1). */
  nearFailureShare: number;
  mainSets: number;
  nearFailureSets: number;
  advisory: string;
  /** Источник оценки: факт скоростей дневника или плановый RIR. */
  source: 'diary-velocity' | 'plan-rir';
  /** Факт потери скорости из дневника (если передан дневник и есть записи). */
  fact?: PLVelocityFact;
}

/**
 * Насколько план упирается в отказ: доля подходов основных движений с RIR ≤1.
 * Для максимальной силы полезно, но velocity loss держат 10–20% (Zhang 2023,
 * Jukic 2023): высокая доля ближних к отказу подходов = потеря скорости 1ПМ.
 *
 * Если передан дневник И в нём есть фактические скорости — оценка идёт по ФАКТУ
 * (`source: 'diary-velocity'`), иначе по плановому RIR (`'plan-rir'`).
 */
export function plIntensityAdvisory(plan: LMSBuildOutput, opts?: { sessions?: WorkoutLog[] }): PLIntensityAdvisory {
  const fact = plVelocityLossFact(opts?.sessions ?? []);
  if (fact.avgLossPct != null && fact.sessions > 0) {
    // Фактический VL: порог силы 20% (Zhang/Jukic), выше 30% — стоп-зона.
    const advisory = fact.avgLossPct > 30
      ? `Потеря скорости по факту дневника: ${fact.avgLossPct}% в среднем (${fact.sessions} сессий) — стоп-зона: штанга замедляется сильнее 30%, оставьте 1–2 повтора в запасе (velocity loss ≤20%).`
      : fact.avgLossPct > 20
        ? `Потеря скорости по факту дневника: ${fact.avgLossPct}% в среднем (${fact.sessions} сессий) — выше коридора 10–20% для силы (Zhang 2023), снижайте вес или срезайте повторы.`
        : '';
    return {
      nearFailureShare: 0, mainSets: 0, nearFailureSets: 0,
      advisory, source: 'diary-velocity', fact,
    };
  }
  let mainSets = 0, near = 0;
  for (const w of plan?.weeks ?? []) {
    if (w.deload || w.taperWeek || w.meetWeek || w.mockMeet || w.postMeet) continue; // разгрузочные недели не считаем
    for (const d of w.days) for (const e of d.exercises) {
      if (/^(отдых|тест\s*:)/i.test((e.name || '').trim())) continue;
      const isMain = e.load === 'Тяжелая' || e.load === 'main';
      if (!isMain) continue;
      for (const ws of e.workSets) {
        mainSets += ws.sets;
        if (ws.rir <= 1) near += ws.sets;
      }
    }
  }
  const share = mainSets > 0 ? near / mainSets : 0;
  const advisory = mainSets === 0
    ? ''
    : share > 0.5
      ? 'Основные подходы чаще всего в RIR ≤1 — для силы держите velocity loss 10–20% (Zhang 2023): высокая близость к отказу замедляет штангу и снимает прирост 1ПМ.'
      : share > 0.3
        ? 'Часть основных подходов в RIR ≤1 — следите за скоростью штанги (velocity loss ≤20% на силовых блоках).'
        : '';
  return { nearFailureShare: Math.round(share * 1000) / 1000, mainSets, nearFailureSets: near, advisory, source: 'plan-rir' };
}

/** Нормализованное имя — общий помощник (экспорт для UI-сверки). */
export function plNameKey(name: string): string {
  return norm(name);
}

// ═══════════ Экспорт отчёта «план vs факт» в CSV/HTML (раунд 3, §5-bis п.5) ═════

/** Ячейка CSV без формульной инъекции (=,+,-,@ в начале — формула Excel/Sheets). */
function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function htmlEsc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface PLComplianceExportInput {
  result: PLComplianceResult;
  /** Разбивка по дням (если посчитана) — секция CSV/HTML. */
  days?: PLDaysComplianceResult;
  drift?: PLDriftWarning[];
  advisory?: PLIntensityAdvisory;
  title?: string;
}

/**
 * CSV отчёта «план vs факт»: недели (+ опц. дни и упражнения), дрейф и
 * интенсивностная подсказка. Разделитель `;` (Excel РФ), BOM не добавляем —
 * выгрузчик PL оборачивает строку по месту использования.
 */
export function buildPLComplianceCsv(input: PLComplianceExportInput): string {
  const rows: string[] = [];
  const push = (...cells: unknown[]) => rows.push(cells.map(csvCell).join(';'));
  push('Тип', 'Объект', 'План (сетов)', 'Факт (сетов)', 'Выполнение %', 'Статус', 'Примечание');
  for (const w of input.result.weeks) {
    push('Неделя', `Нед ${w.week}`, w.plannedSets, w.factSets, Math.round(w.setsPct * 100), w.status, w.note ?? '');
  }
  for (const wk of input.days?.weeks ?? []) {
    for (const d of wk.days) {
      push('День', `Нед ${wk.week} Д${d.day}`, d.plannedSets, d.factSets, Math.round(d.setsPct * 100), d.status, '');
      for (const e of d.exercises) {
        push('Упражнение', `Нед ${wk.week} Д${d.day} · ${e.name}`, e.plannedSets, e.factSets,
          e.plannedSets > 0 ? Math.round((e.factSets / e.plannedSets) * 100) : 0, e.status, '');
      }
    }
  }
  for (const d of input.drift ?? []) {
    push('Дрейф', d.name, 0, 0, 0, 'дрейф', `${d.note} (RPE ${d.avgFactRpe} × ${d.sessions})`);
  }
  if (input.advisory?.advisory) {
    push('Интенсивность', input.advisory.source === 'diary-velocity' ? 'velocity loss (факт)' : 'RIR ≤1 (план)',
      input.advisory.mainSets, input.advisory.nearFailureSets,
      Math.round(input.advisory.nearFailureShare * 100), 'совет', input.advisory.advisory);
  }
  return rows.join('\r\n');
}

/**
 * HTML-отчёт «план vs факт» (печать/файл тренеру): недели, опц. дни с
 * упражнениями, дрейф, подсказка. Все пользовательские строки экранированы (XSS).
 */
export function buildPLComplianceHtml(input: PLComplianceExportInput): string {
  const title = input.title ?? 'ПЛ-авто: план vs факт';
  const statusColor = (s: string) => s === 'done' ? '#16a34a' : s === 'partial' ? '#d97706' : s === 'missed' ? '#dc2626' : '#71717a';
  const statusRu = (s: string) => s === 'done' ? 'выполнено' : s === 'partial' ? 'частично' : s === 'missed' ? 'пропущено' : 'впереди';
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const weekRows = input.result.weeks.map(w =>
    `<tr><td>Нед ${w.week}</td><td>${w.plannedSets}</td><td>${w.factSets}</td><td>${pct(w.setsPct)}</td>` +
    `<td style="color:${statusColor(w.status)};font-weight:700">${statusRu(w.status)}</td><td>${htmlEsc(w.note ?? '')}</td></tr>`).join('');
  let daysHtml = '';
  if (input.days) {
    const dayBlocks = input.days.weeks.map(wk => wk.days.map(d => {
      const exRows = d.exercises.map(e =>
        `<li style="color:${statusColor(e.status)}">${htmlEsc(e.name)}: ${e.factSets}/${e.plannedSets} сетов — ${statusRu(e.status)}</li>`).join('');
      return `<div style="margin:4px 0 8px"><b>Нед ${wk.week} · день ${d.day}</b> — ${d.factSets}/${d.plannedSets} сетов (${pct(d.setsPct)}, ${statusRu(d.status)})` +
        (exRows ? `<ul style="margin:4px 0 0 16px;padding:0">${exRows}</ul>` : '') + '</div>';
    }).join('')).join('');
    daysHtml = `<h3>Разбивка по дням</h3>${dayBlocks || '<p>Нет данных.</p>'}`;
  }
  const driftHtml = (input.drift ?? []).length > 0
    ? `<h3>Дрейф плана</h3><ul>${(input.drift ?? []).map(d => `<li>${htmlEsc(d.name)}: ${htmlEsc(d.note)}</li>`).join('')}</ul>`
    : '';
  const advHtml = input.advisory?.advisory
    ? `<h3>Интенсивность (${input.advisory.source === 'diary-velocity' ? 'факт скорости дневника' : 'плановый RIR'})</h3><p>${htmlEsc(input.advisory.advisory)}</p>`
    : '';
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${htmlEsc(title)}</title></head>
<body style="font-family:system-ui,sans-serif;color:#18181b;max-width:760px;margin:0 auto;padding:16px">
<h2 style="margin:0 0 4px">${htmlEsc(title)}</h2>
<p style="margin:0 0 12px;color:#52525b">Выполнение: <b>${pct(input.result.overallPct)}</b> сетов плана по ${input.result.past.length} прошедн. нед.</p>
<h3>Недели</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
<tr style="background:#f4f4f5"><th>Неделя</th><th>План, сетов</th><th>Факт, сетов</th><th>%</th><th>Статус</th><th>Примечание</th></tr>
${weekRows}</table>
${input.result.notes.length > 0 ? `<p style="color:#b45309">${input.result.notes.map(n => htmlEsc(n)).join('<br>')}</p>` : ''}
${daysHtml}${driftHtml}${advHtml}
</body></html>`;
}

// ═══════════ Фактическая потеря скорости из дневника (раунд 3, §5-bis п.2) ══════

export interface PLVelocityFactExercise {
  name: string;
  /** Сессий с ≥2 записанными скоростями (участвуют в статистике). */
  sessions: number;
  /** Средняя потеря скорости (best→last) по сессиям, %. */
  avgLossPct: number;
  worstLossPct: number;
  bestVelocity: number;
  lastVelocity: number;
}

export interface PLVelocityFact {
  exercises: PLVelocityFactExercise[];
  /** Средняя потеря по всем учтённым сессиям (%), null — нет данных. */
  avgLossPct: number | null;
  sessions: number;
}

/**
 * Потеря скорости ПО ФАКТУ дневника: SessionPlayer пишет скорость каждого
 * подхода (`velocity`, м/с) в `StrengthLogEntry.sets[]`; сессия = одна запись
 * упражнения за дату. Для силы полезен коридор 10–20% (Zhang 2023 / Jukic 2023):
 * выше — скорость 1ПМ падает, отказ «съедает» прирост.
 */
export function plVelocityLossFact(sessions: WorkoutLog[], opts?: { minSets?: number }): PLVelocityFact {
  const minSets = Math.max(2, opts?.minSets ?? 2);
  const byName = new Map<string, { losses: number[]; best: number; last: number }>();
  for (const wl of sessions ?? []) {
    for (const ex of wl.exercises ?? []) {
      const name = (ex.exerciseName || '').trim();
      const vels = (ex.sets ?? []).map(s => Number(s.velocity ?? 0)).filter(v => v > 0);
      if (!name || vels.length < minSets) continue;
      const best = Math.max(...vels);
      const last = vels[vels.length - 1];
      if (best <= 0) continue;
      const lossPct = Math.round(((best - last) / best) * 1000) / 10;
      const cur = byName.get(name) ?? { losses: [], best, last };
      cur.losses.push(lossPct);
      if (best > cur.best) cur.best = best;
      if (cur.losses.length === 1 || last < cur.last) cur.last = last;
      byName.set(name, cur);
    }
  }
  const exercises: PLVelocityFactExercise[] = [];
  let allLosses = 0, allCount = 0;
  for (const [name, agg] of byName) {
    const recent = agg.losses.slice(-5); // последние сессии упражнения
    const avg = Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 10) / 10;
    exercises.push({
      name,
      sessions: recent.length,
      avgLossPct: avg,
      worstLossPct: Math.max(...recent),
      bestVelocity: Math.round(agg.best * 100) / 100,
      lastVelocity: Math.round(agg.last * 100) / 100,
    });
    allLosses += recent.reduce((a, b) => a + b, 0);
    allCount += recent.length;
  }
  return {
    exercises: exercises.sort((a, b) => b.avgLossPct - a.avgLossPct || a.name.localeCompare(b.name)),
    avgLossPct: allCount > 0 ? Math.round((allLosses / allCount) * 10) / 10 : null,
    sessions: allCount,
  };
}

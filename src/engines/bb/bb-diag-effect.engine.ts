/**
 * bb-diag-effect.engine.ts — BB-G-04: «эффект коррекции через 4–6 недель».
 *
 * Зачем: PRO/HUB обещали видеть, сработала ли вставка коррекций из хаба, а не
 * только снимки скрининга. Раньше пользователь сравнивал «глазами» и по памяти:
 * план уже переписан, исходных цифр по зоне нигде нет.
 *
 * Решение:
 *  - при вставке коррекций хаб пишет запись `{ date, zones }` в журнал
 *    `he_bb_diag_injections` (кап 10 последних);
 *  - эффект считается по ФАКТУ дневника: прямые сеты/нед по зоне за 28 дней ДО
 *    вставки против сets/нед за период ПОСЛЕ (нормировка на недели, чтобы
 *    три недели не сравнивались с четырьмя);
 *  - пока не прошло 4 недель — честное «не срок» с датой перепроверки, а не
 *    «эффекта нет»; после 6 недель — пометка, что это уже не эффект одной
 *    вставки (наложились другие изменения).
 *
 * Границы знания: дневник знает только прямые сеты и группу упражнения, поэтому
 * эффект оценивается в сетах/нед и подписан именно так — без «+X кг» и
 * процентов гипертрофии, которых у нас нет.
 */

export interface DiagInjection {
  /** Локальная дата ISO yyyy-mm-dd. */
  date: string;
  /** Зоны, в которые вставлялись коррекции (могут быть гранулярными). */
  zones: string[];
}

export const DIAG_INJECTIONS_KEY = 'he_bb_diag_injections';
export const DIAG_INJECTIONS_MAX = 10;

const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const cleanInjection = (v: unknown): DiagInjection | null => {
  const e = v as DiagInjection;
  if (!e || typeof e !== 'object' || !isIsoDate(e.date)) return null;
  const zones = Array.isArray(e.zones) ? e.zones.map(String).filter(Boolean) : [];
  return { date: e.date, zones: [...new Set(zones)] };
};

/** Прочитать журнал (битые записи отбрасываются, порядок — по дате). */
export function readDiagInjections(): DiagInjection[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DIAG_INJECTIONS_KEY) : null;
    if (!raw) return [];
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    return j
      .map(cleanInjection)
      .filter((e): e is DiagInjection => !!e)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-DIAG_INJECTIONS_MAX);
  } catch { return []; }
}

/**
 * Добавить запись о вставке. Дедуп по дате+набору зон: повторное нажатие
 * «вставить» в тот же день не должно изображать две коррекции.
 */
export function logDiagInjection(
  entry: DiagInjection | null | undefined,
  max: number = DIAG_INJECTIONS_MAX,
): DiagInjection[] {
  const list = readDiagInjections();
  const clean = cleanInjection(entry);
  if (!clean) return list;
  const key = `${clean.date}|${clean.zones.slice().sort().join(',')}`;
  const next = [...list.filter((e) => `${e.date}|${e.zones.slice().sort().join(',')}` !== key), clean]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-Math.max(1, max));
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DIAG_INJECTIONS_KEY, JSON.stringify(next));
  } catch { /* нет места — журнал не критичен, план важнее */ }
  return next;
}

export type CorrectionEffectStatus = 'no_injection' | 'too_early' | 'window' | 'late';

export interface CorrectionEffectRow {
  zone: string;
  /** Прямые сеты/нед до вставки (28-дневное окно). */
  setsBeforeWeekly: number | null;
  /** Прямые сеты/нед после вставки (нормировано на прошедшие недели). */
  setsAfterWeekly: number | null;
  /** Изменение в % (null, если одна из сторон не измерена). */
  deltaPct: number | null;
  verdict: 'improved' | 'flat' | 'worse' | 'pending';
  text: string;
}

export interface CorrectionEffectView {
  status: CorrectionEffectStatus;
  injectionDate: string | null;
  zones: string[];
  /** Сколько недель прошло с вставки (null без вставки). */
  weeks: number | null;
  rows: CorrectionEffectRow[];
  /** Готовая честная строка для UI/экспорта. */
  text: string;
  /** Когда перепроверять (конец 4-й / 6-й недели), ISO или null. */
  checkDate: string | null;
}

export interface CorrectionEffectInput {
  injections: DiagInjection[] | null | undefined;
  /** Сессии дневника (date + exercises[].muscleGroup/name + sets). */
  sessions: Array<{ date: string; exercises?: Array<{ muscleGroup?: string; muscle?: string; sets?: unknown }> }> | null | undefined;
  /** Сегодняшняя дата ISO (передаётся, чтобы движок был чистым). */
  today: string;
  /** Нижняя граница окна оценки (по умолчанию 4 нед). */
  minWeeks?: number;
  /** Верхняя граница окна оценки (по умолчанию 6 нед). */
  maxWeeks?: number;
  /** Порог значимости изменения объёма в % (по умолчанию 10). */
  thresholdPct?: number;
}

const DAY_MS = 24 * 3600 * 1000;

const toMs = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0).getTime();
  return Number.isFinite(t) ? t : null;
};

const isoOf = (t: number): string => {
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const muscleOf = (ex: { muscleGroup?: string; muscle?: string }): string => {
  const raw = String(ex?.muscleGroup || ex?.muscle || '').toLowerCase();
  return raw;
};

const setsOf = (ex: { sets?: unknown }): number => {
  if (Array.isArray(ex?.sets)) return ex.sets.length;
  const n = Number(ex?.sets);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

/** Сумма прямых сетов по зоне в окне [from, to) — в сетах/нед. */
function weeklySetsInWindow(
  sessions: Array<{ date: string; exercises?: Array<{ muscleGroup?: string; muscle?: string; sets?: unknown }> }>,
  zone: string,
  fromMs: number,
  untilMs: number,
): { weekly: number | null; weeks: number } {
  // Имена параметров не toMs/timeToMs: иначе параметр затеняет хелпер toMs,
  // и цикл падает на «toMs is not a function» (поймано тестом).
  const weeks = Math.max(0, (untilMs - fromMs) / (7 * DAY_MS));
  if (weeks <= 0) return { weekly: null, weeks: 0 };
  const z = zone.toLowerCase();
  const zBase = z.split('_')[0];
  let total = 0;
  let seen = false;
  for (const s of sessions) {
    const t = toMs(s?.date || '');
    if (t == null || t < fromMs || t >= untilMs) continue;
    for (const ex of s.exercises || []) {
      const m = muscleOf(ex);
      if (!m) continue;
      // Гранулярная зона ('chest_upper') не приходит из дневника: сравниваем по
      // родительской группе, но подписываем исходной зоной.
      const hit = m === z || m === zBase || z.startsWith(m) || m.startsWith(zBase);
      if (!hit) continue;
      const n = setsOf(ex);
      if (n > 0) { total += n; seen = true; }
    }
  }
  if (!seen) return { weekly: null, weeks };
  return { weekly: Math.round((total / weeks) * 10) / 10, weeks };
}

const fmt = (v: number | null): string => (v == null ? '—' : String(v));

/**
 * Собрать «эффект коррекции» по последней вставке из журнала.
 * Без вставки — status='no_injection' (панель не рисует пустых нулей).
 */
export function buildCorrectionEffect(input: CorrectionEffectInput): CorrectionEffectView {
  const minWeeks = Math.max(1, Number(input.minWeeks) || 4);
  const maxWeeks = Math.max(minWeeks, Number(input.maxWeeks) || 6);
  const threshold = Math.abs(Number(input.thresholdPct) || 10);
  const todayMs = toMs(input.today) ?? Date.now();
  const injections = (input.injections || [])
    .map(cleanInjection)
    .filter((e): e is DiagInjection => !!e)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = injections.length > 0 ? injections[injections.length - 1] : null;

  if (!last) {
    return {
      status: 'no_injection',
      injectionDate: null,
      zones: [],
      weeks: null,
      rows: [],
      text: 'Эффект коррекции: вставок из хаба ещё не было — сравнивать не с чем',
      checkDate: null,
    };
  }

  const injMs = toMs(last.date);
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  const weeks = injMs == null ? 0 : Math.max(0, Math.round(((todayMs - injMs) / (7 * DAY_MS)) * 10) / 10);
  const checkMs = injMs == null ? null : injMs + minWeeks * 7 * DAY_MS;

  const rows: CorrectionEffectRow[] = last.zones.map((zone) => {
    const before = injMs == null ? null : weeklySetsInWindow(sessions, zone, injMs - 28 * DAY_MS, injMs);
    const after = injMs == null ? null : weeklySetsInWindow(sessions, zone, injMs, todayMs);
    const deltaPct = before?.weekly != null && after?.weekly != null && before.weekly > 0
      ? Math.round(((after.weekly - before.weekly) / before.weekly) * 100)
      : null;
    let verdict: CorrectionEffectRow['verdict'] = 'pending';
    if (weeks >= minWeeks && deltaPct != null) {
      if (deltaPct >= threshold) verdict = 'improved';
      else if (deltaPct <= -threshold) verdict = 'worse';
      else verdict = 'flat';
    }
    const verdictRu = verdict === 'improved' ? 'рост объёма'
      : verdict === 'worse' ? 'объём упал'
        : verdict === 'flat' ? 'без изменений'
          : 'ждём окно оценки';
    const text = before?.weekly == null
      ? `${zone}: до вставки нет данных дневника за 4 нед`
      : after?.weekly == null
        ? `${zone}: ${fmt(before.weekly)} сет/нед до вставки — после данных ещё нет`
        : `${zone}: ${fmt(before.weekly)} → ${fmt(after.weekly)} сет/нед (${deltaPct != null && deltaPct > 0 ? '+' : ''}${deltaPct ?? '—'}%) · ${verdictRu}`;
    return {
      zone,
      setsBeforeWeekly: before?.weekly ?? null,
      setsAfterWeekly: after?.weekly ?? null,
      deltaPct,
      verdict,
      text,
    };
  });

  if (weeks < minWeeks) {
    return {
      status: 'too_early',
      injectionDate: last.date,
      zones: last.zones,
      weeks,
      rows,
      text: `Эффект коррекции: прошло ${weeks} нед из ${minWeeks} — оценим в окне ${minWeeks}–${maxWeeks} нед${checkMs ? ` (с ${isoOf(checkMs)})` : ''}`,
      checkDate: checkMs ? isoOf(checkMs) : null,
    };
  }

  const improved = rows.filter((r) => r.verdict === 'improved').length;
  const worse = rows.filter((r) => r.verdict === 'worse').length;
  const measured = rows.filter((r) => r.verdict !== 'pending').length;
  const headline = measured === 0
    ? `Эффект коррекции: ${weeks} нед прошло, но дневника в окне нет — данных для вывода нет`
    : `Эффект коррекции за ${weeks} нед: ${improved} улучшилось · ${worse} хуже · ${measured - improved - worse} без изменений`;

  if (weeks > maxWeeks) {
    return {
      status: 'late',
      injectionDate: last.date,
      zones: last.zones,
      weeks,
      rows,
      text: `${headline} · прошло >${maxWeeks} нед — это уже не эффект одной вставки, обнови диагностику`,
      checkDate: checkMs ? isoOf(checkMs) : null,
    };
  }

  return {
    status: 'window',
    injectionDate: last.date,
    zones: last.zones,
    weeks,
    rows,
    text: headline,
    checkDate: checkMs ? isoOf(checkMs) : null,
  };
}

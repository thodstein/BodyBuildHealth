/**
 * intelligence-wellness.engine.ts — ежедневный wellness-опросник и его тренд (E7).
 *
 * Что это: 5 ежедневных пунктов (качество сна, болезненность, настроение, энергия, стресс)
 * как ВСПОМОГАТЕЛЬНЫЙ сигнал. Международные консенсусы (Saw 2016, Gabbett 2019) сходятся в
 * одном: единого валидированного опросника для выявления перетренированности НЕТ — такие шкалы
 * используются как операционное соглашение внутри команды, а не как тест.
 *
 * Границы честности:
 *  - Светофор — «операционное соглашение, не валидированный тест».
 *  - Никаких «диагнозов перетренированности» (Meeusen 2013): вывод = «N сигналов из M за 7 дней».
 *  - Болезнь/температура — отдельный явный флаг: при нём оценка нагрузки не выполняется вовсе
 *    (решение о тренировке при болезни — врача, не калькулятора).
 */

export const WELLNESS_ITEMS = ['sleepQuality', 'soreness', 'mood', 'energy', 'stressLevel'] as const;
export type WellnessItem = typeof WELLNESS_ITEMS[number];

export interface WellnessItemMeta { key: WellnessItem; label: string; /** true = меньше = лучше (инвертируется в 0–100). */
  inverted: boolean; question: string; }

export const WELLNESS_META: Record<WellnessItem, WellnessItemMeta> = {
  sleepQuality: { key: 'sleepQuality', label: 'Качество сна', inverted: false, question: '1 — очень плохо, 5 — отлично' },
  soreness: { key: 'soreness', label: 'Болезненность', inverted: true, question: '1 — нет, 5 — очень сильная' },
  mood: { key: 'mood', label: 'Настроение', inverted: false, question: '1 — плохое, 5 — отличное' },
  energy: { key: 'energy', label: 'Энергия', inverted: false, question: '1 — нет, 5 — полная' },
  stressLevel: { key: 'stressLevel', label: 'Стресс', inverted: true, question: '1 — нет, 5 — запредельный' },
};

export const WELLNESS_SCALE_MAX = 5;
/** Порог «плохого» ответа по пункту: 1–2 из 5 = тревожный сигнал, 3+ = норма. */
export const WELLNESS_ITEM_ALARM = 2;

export const WELLNESS_PROTOCOL_NOTE =
  'Wellness-светофор — операционное соглашение, НЕ валидированный тест: единого опросника для выявления перетренированности в науке не существует (Saw 2016, Gabbett 2019).';

export const WELLNESS_NO_DIAGNOSIS_NOTE =
  'Вывод здесь один: сколько тревожных сигналов за 7 дней. Диагнозов перетренированности этот инструмент не ставит (Meeusen 2013).';

export const WELLNESS_ILLNESS_NOTE =
  'Отмечена болезнь/температура: нагрузка не оценивается. Решение о тренировке при болезни принимает врач.';

export const TEMP_ALARM_C = 37.5;

export interface WellnessEntry {
  date: string;
  sleepQuality?: number;
  soreness?: number;
  mood?: number;
  energy?: number;
  stressLevel?: number;
  /** Болезнь/температура — отдельный флаг, а не «плохой день». */
  illness?: boolean;
  tempC?: number;
  note?: string;
}

export type WellnessZone = 'green' | 'yellow' | 'red' | 'illness' | 'no_data';

export interface WellnessReport {
  referenceDate: string;
  /** Заполненность журнала за 7 дней. */
  daysLogged: number;
  itemsFilled: number;
  itemsTotal: number;
  /** «N сигналов из M» — тревожные ответы за 7 дней. */
  alarmSignals: number;
  /** Светофор по доле «хороших» ответов (0–100). */
  score: number | null;
  zone: WellnessZone;
  signals: string[];
  illness: boolean;
  blocking: false;
  note: string;
  trend7: { date: string; score: number | null }[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const clampScore = (v: number) => Math.max(0, Math.min(100, v));

function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 0–100 «хорошо» по одному пункту (инвертированные разворачиваются). */
export function itemScore(item: WellnessItem, value: number): number | null {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 1 || v > WELLNESS_SCALE_MAX) return null;
  const norm = Math.round(((v - 1) / (WELLNESS_SCALE_MAX - 1)) * 100);
  return WELLNESS_META[item].inverted ? 100 - norm : norm;
}

const isAlarm = (item: WellnessItem, value: number) =>
  WELLNESS_META[item].inverted ? Number(value) >= 4 : Number(value) <= WELLNESS_ITEM_ALARM;

/** Температура/болезнь по любой записи окна. */
export function wellnessIllnessInWindow(entries: WellnessEntry[], from: string, to: string): boolean {
  return (entries ?? []).some(e => {
    if (!e || !DATE_RE.test(String(e.date))) return false;
    if (e.date < from || e.date > to) return false;
    if (e.illness === true) return true;
    const t = Number(e.tempC);
    return Number.isFinite(t) && t >= TEMP_ALARM_C;
  });
}

export function wellnessReport(entries: WellnessEntry[], referenceDate?: string): WellnessReport {
  const clean = (entries ?? []).filter(e => e && DATE_RE.test(String(e.date)));
  const sorted = [...clean].sort((a, b) => a.date < b.date ? -1 : 1);
  const ref = referenceDate || (sorted.length ? sorted[sorted.length - 1].date : '');
  const from7 = ref ? addDays(ref, -6) : '';
  const to7 = ref;
  const week = sorted.filter(e => ref && e.date >= from7 && e.date <= to7);

  const illness = ref ? wellnessIllnessInWindow(sorted, from7, to7) : false;
  const prevWeek = sorted.filter(e => ref && e.date >= addDays(ref, -13) && e.date < from7);

  const evaluate = (rows: WellnessEntry[]) => {
    let filled = 0, alarms = 0, sum = 0;
    for (const e of rows) for (const item of WELLNESS_ITEMS) {
      const s = itemScore(item, (e as any)[item] as number);
      if (s == null) continue;
      filled++; sum += s;
      if (isAlarm(item, (e as any)[item] as number)) alarms++;
    }
    return { filled, alarms, score: filled > 0 ? Math.round(sum / filled) : null };
  };

  const cur = evaluate(week);
  const prev = evaluate(prevWeek);
  const trend7 = [...week].map(e => {
    const one = evaluate([e]);
    return { date: e.date, score: one.score };
  });

  const signals: string[] = [];
  let zone: WellnessZone = 'no_data';
  if (illness) {
    zone = 'illness';
    signals.push(WELLNESS_ILLNESS_NOTE);
  } else if (cur.score != null) {
    if (cur.score >= 80) zone = 'green';
    else if (cur.score >= 60) zone = 'yellow';
    else zone = 'red';
    signals.push(`За 7 дней: ${cur.alarms} тревожных сигналов из ${cur.filled} заполненных пунктов.`);
    if (prev.score != null) {
      const d = cur.score - prev.score;
      if (d <= -10) signals.push(`К прошлой неделе: −${Math.abs(d)} пунктов.`);
      else if (d >= 10) signals.push(`К прошлой неделе: +${d} пунктов.`);
      else signals.push('К прошлой неделе: без изменений.');
    } else {
      signals.push('Прошлой недели нет в журнале — сравнение не выполняется.');
    }
    if (week.length < 3) signals.push(`Дней с отметками: ${week.length} из 7 — вердикт ориентировочный.`);
  } else {
    signals.push('Нет ни одной отметки wellness — светофор не считается.');
  }

  return {
    referenceDate: ref, daysLogged: week.length, itemsFilled: cur.filled,
    itemsTotal: week.length * WELLNESS_ITEMS.length, alarmSignals: cur.alarms,
    score: cur.score, zone, signals, illness, blocking: false,
    trend7,
    note: `${WELLNESS_PROTOCOL_NOTE} ${WELLNESS_NO_DIAGNOSIS_NOTE}`,
  };
}

const KEY = 'he_intelligence_wellness_v1';
const MAX_ENTRIES = 120;

function safeParse(raw: string | null): WellnessEntry[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    const out: WellnessEntry[] = [];
    for (const e of p) {
      if (!e || !DATE_RE.test(String(e.date))) continue;
      const clean: WellnessEntry = { date: e.date };
      for (const item of WELLNESS_ITEMS) {
        const v = Number((e as any)[item]);
        if (Number.isFinite(v) && v >= 1 && v <= WELLNESS_SCALE_MAX) (clean as any)[item] = v;
      }
      if (e.illness === true) clean.illness = true;
      const t = Number(e.tempC);
      if (Number.isFinite(t) && t >= 34 && t <= 43) clean.tempC = t;
      const n = String(e.note ?? '').trim().slice(0, 200);
      if (n) clean.note = n;
      out.push(clean);
    }
    return out;
  } catch { return []; }
}

export function loadWellness(): WellnessEntry[] {
  try { return safeParse(localStorage.getItem(KEY)); } catch { return []; }
}

/** Upsert по дате (один день = одна запись), дедуп и cap. */
export function saveWellness(entry: WellnessEntry): WellnessEntry[] {
  const date = String(entry?.date ?? '');
  if (!DATE_RE.test(date)) return loadWellness();
  const rest = loadWellness().filter(e => e.date !== date);
  const probe = safeParse(JSON.stringify([{ ...entry, date }]));
  const clean = probe[0] ?? { date };
  const merged = [...rest, clean].sort((a, b) => a.date < b.date ? -1 : 1).slice(-MAX_ENTRIES);
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* квота — не теряем факт в памяти */ }
  return merged;
}

export function clearWellness(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

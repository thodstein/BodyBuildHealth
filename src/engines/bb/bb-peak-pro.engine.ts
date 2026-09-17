/**
 * bb-peak-pro.engine.ts — PRO-4: ПРО-СЛОЙ ведения пик-недели и шоу-дня.
 *
 * Чистый слой ПОВЕРХ bb-contest-prep.engine (канонический план не меняется —
 * только импорт типов/функций), по прецеденту bb-show-coach.engine:
 *  - 📓 Монитор пик-недели: ежедневные чек-ины (вес/вода/Na/углеводы/визуал/
 *    самочувствие) → адгеренс к плану, вес-трейс с ожиданием гликоген-воды,
 *    тренд-советы по 2–3 дням (Homer 2024: решения по тренду, не по точке;
 *    Escalante 2021: trial-runs обязательны, stable-дефолт).
 *  - ⏱ Часовое расписание дня пик-недели (D-6…D-1): приёмы/вода/Na/тренировка/
 *    позы/сон (детерминированно, из PeakWeekDayPlan).
 *  - 🚑 Экстренная карточка шоу-дня: 6 сценариев harm-reduction (гипогликемия,
 *    гипонатриемия, судороги, обморок, боль в груди, ЖКТ) + контакт.
 *  - 🏁 Серия шоу: окна taper/пик-недели по каждому шоу + overreach-неделя
 *    (Escalante: планировать заранее; два полных пика подряд — запрещены).
 *  - 👩 Женский контур: фаза цикла на дату шоу и трактовка воды
 *    (Carmichael 2021: вода тела ↑ фолликул→лютеал; White 2011: пик
 *    субъективной задержки — 1-й день менструации; Sci Rep 2026: сила
 *    минимальна в late-luteal).
 *  - 🧪 Лабы-чекпоинт: дедлайны анализов от даты шоу + дата последних.
 *  - 🔄 Пост-шоу фидбэк: факт-вес vs цель regain 10–15%/1–6 мес (Buechel 2026,
 *    scoping review PMC9364707: +1% массы/нед как ориентир).
 *
 * Хранение — localStorage-ключи (кап + санитизация; битый стор → дефолт):
 *  - he_prep_peak_days_v1 — { [planId]: PeakDayEntry[] } (кап 14/план)
 *  - he_prep_emergency_v1 — контакт { name, phone }
 *  - he_prep_labs_v1 — { [planId]: ISO-дата последних анализов }
 */
import {
  type BBContestPrepPlan,
  type PeakWeekDayPlan,
  configFromPlan,
  buildPeakWeek,
  isoToday,
  isoAddDays,
  isoDiffDays,
} from './bb-contest-prep.engine';

// ═══════════════════════════════════════════════════════════════════════════
// 📓 Монитор пик-недели
// ═══════════════════════════════════════════════════════════════════════════

export type PeakDayVisual = 'flat' | 'ontrack' | 'full' | 'spill';

export interface PeakDayEntry {
  date: string;              // ISO yyyy-mm-dd (ключ дня)
  weightKg?: number | null;
  waterLiters?: number | null;
  sodiumMg?: number | null;
  carbsG?: number | null;
  visual?: PeakDayVisual | null;
  wellbeing?: number | null; // 1..5 (5 — отлично)
  note?: string;
  at: string;                // ISO timestamp записи
}

export const PEAK_MONITOR_KEY = 'he_prep_peak_days_v1';
export const PEAK_MONITOR_CAP = 14;

export const PEAK_MONITOR_DISCLAIMER =
  'Решения пик-недели — по тренду 2–3 дней, не по одной точке: вес это вода/гликоген, не жир. ' +
  'Дефолт — стабильные вода и натрий; модуляция — только после trial-прогона. Не заменяет тренера/врача.';

interface PeakMonitorStore { [planId: string]: PeakDayEntry[] }

const VISUALS: PeakDayVisual[] = ['flat', 'ontrack', 'full', 'spill'];

function readPeakStore(): PeakMonitorStore {
  try {
    const raw = localStorage.getItem(PEAK_MONITOR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PeakMonitorStore;
  } catch { return {}; }
}

function writePeakStore(store: PeakMonitorStore): boolean {
  try { localStorage.setItem(PEAK_MONITOR_KEY, JSON.stringify(store)); return true; } catch { return false; }
}

const numOrNull = (v: unknown, lo: number, hi: number): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const strOrUndef = (v: unknown, cap: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, cap) : undefined;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Санитизация записи дня (мусор → null; поля клампятся). */
export function sanitizePeakDayEntry(raw: unknown): PeakDayEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const date = typeof r.date === 'string' && ISO_DATE_RE.test(r.date) ? r.date : null;
  if (!date) return null;
  const visual = VISUALS.includes(r.visual as PeakDayVisual) ? (r.visual as PeakDayVisual) : null;
  const wellbeingRaw = numOrNull(r.wellbeing, 1, 5);
  return {
    date,
    weightKg: numOrNull(r.weightKg, 25, 250),
    waterLiters: numOrNull(r.waterLiters, 0, 12),
    sodiumMg: numOrNull(r.sodiumMg, 0, 15000),
    carbsG: numOrNull(r.carbsG, 0, 2000),
    visual,
    wellbeing: wellbeingRaw != null ? Math.round(wellbeingRaw) : null,
    note: strOrUndef(r.note, 200),
    at: typeof r.at === 'string' && r.at ? r.at.slice(0, 40) : new Date().toISOString(),
  };
}

/** Журнал монитора по плану (сортирован по дате ASC, кап 14 новейших). */
export function loadPeakWeekLog(planId: string): PeakDayEntry[] {
  if (!planId) return [];
  const store = readPeakStore();
  const arr = Array.isArray(store[planId]) ? store[planId] : [];
  const clean = arr.map(sanitizePeakDayEntry).filter((e): e is PeakDayEntry => e != null);
  return clean.sort((a, b) => a.date.localeCompare(b.date)).slice(-PEAK_MONITOR_CAP);
}

/** Сохранить запись дня (merge по дате; повторная запись того же дня заменяет). */
export function savePeakWeekEntry(planId: string, entry: PeakDayEntry): boolean {
  if (!planId) return false;
  const clean = sanitizePeakDayEntry(entry);
  if (!clean) return false;
  const store = readPeakStore();
  const arr = Array.isArray(store[planId]) ? store[planId].map(sanitizePeakDayEntry).filter((e): e is PeakDayEntry => e != null) : [];
  const next = [...arr.filter(e => e.date !== clean.date), clean]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-PEAK_MONITOR_CAP);
  store[planId] = next;
  return writePeakStore(store);
}

/** Удалить запись конкретного дня. */
export function removePeakWeekEntry(planId: string, date: string): boolean {
  if (!planId || !ISO_DATE_RE.test(date)) return false;
  const store = readPeakStore();
  const arr = Array.isArray(store[planId]) ? store[planId].map(sanitizePeakDayEntry).filter((e): e is PeakDayEntry => e != null) : [];
  store[planId] = arr.filter(e => e.date !== date);
  return writePeakStore(store);
}

/** Дни пик-недели плана (7 дней с датами; вне настроек → []). */
export function peakWeekDaysForPlan(plan: BBContestPrepPlan): PeakWeekDayPlan[] {
  try {
    return plan ? buildPeakWeek(configFromPlan(plan), plan.peakWeek?.carbDoseGPerKg != null ? { carbDoseGPerKg: plan.peakWeek.carbDoseGPerKg } : undefined) : [];
  } catch { return []; }
}

/** День пик-недели для даты: { dayIndex 1..7, label 'D-6'…'шоу-день', day }. */
export function peakDayForDate(
  plan: BBContestPrepPlan,
  dateIso: string,
): { dayIndex: number; label: string; day: PeakWeekDayPlan } | null {
  if (!plan || !ISO_DATE_RE.test(dateIso)) return null;
  const day = peakWeekDaysForPlan(plan).find(d => d.date === dateIso);
  if (!day) return null;
  return { dayIndex: day.day, label: day.phase === 'show' ? 'шоу-день' : `D-${7 - day.day}`, day };
}

export interface PeakAdherenceRow {
  date: string;
  dayIndex: number;
  label: string;
  phaseLabel: string;
  plan: { waterL: number; sodiumMg: number; carbsG: number };
  fact: { waterL: number | null; sodiumMg: number | null; carbsG: number | null; weightKg: number | null };
  flags: string[];
}

export interface PeakAdherenceResult {
  rows: PeakAdherenceRow[];
  loggedDays: number;
  waterPct: number | null;
  sodiumPct: number | null;
  carbsPct: number | null;
  flags: string[];
}

/**
 * Адгеренс пик-недели: план (buildPeakWeek) vs факт-чек-ины. Принимает план ИЛИ
 * готовый массив дней (UI часто держит уже построенные дни пик-недели).
 * Флаги: under_water (<70% плана), over_water (>150%), over_sodium (>150%),
 * under_carbs (<70% на load/peak днях).
 */
export function peakWeekAdherence(
  planOrDays: BBContestPrepPlan | PeakWeekDayPlan[],
  entries: PeakDayEntry[],
): PeakAdherenceResult {
  const days = Array.isArray(planOrDays) ? planOrDays : peakWeekDaysForPlan(planOrDays);
  const byDate = new Map((entries || []).filter(Boolean).map(e => [e.date, e]));
  const rows: PeakAdherenceRow[] = [];
  const allFlags = new Set<string>();
  let logged = 0;
  for (const d of days) {
    const e = byDate.get(d.date);
    const fact = {
      waterL: e?.waterLiters ?? null,
      sodiumMg: e?.sodiumMg ?? null,
      carbsG: e?.carbsG ?? null,
      weightKg: e?.weightKg ?? null,
    };
    const flags: string[] = [];
    if (e && (fact.waterL != null || fact.sodiumMg != null || fact.carbsG != null || fact.weightKg != null)) {
      logged++;
      if (fact.waterL != null) {
        const pct = fact.waterL / Math.max(0.1, d.waterLiters);
        if (pct < 0.7) flags.push('under_water');
        else if (pct > 1.5) flags.push('over_water');
      }
      if (fact.sodiumMg != null && fact.sodiumMg > Math.max(100, d.sodiumMg) * 1.5) flags.push('over_sodium');
      const isLoadLike = d.phase.startsWith('load') || d.phase === 'peak' || d.phase === 'peak_2';
      if (isLoadLike && fact.carbsG != null && fact.carbsG < Math.max(50, d.carbsG) * 0.7) flags.push('under_carbs');
    }
    for (const f of flags) allFlags.add(f);
    rows.push({
      date: d.date,
      dayIndex: d.day,
      label: d.phase === 'show' ? 'шоу-день' : `D-${7 - d.day}`,
      phaseLabel: d.phaseLabel,
      plan: { waterL: d.waterLiters, sodiumMg: d.sodiumMg, carbsG: d.carbsG },
      fact,
      flags,
    });
  }
  const avgPct = (pick: (r: PeakAdherenceRow) => { fact: number | null; plan: number }): number | null => {
    const vals = rows
      .map(r => pick(r))
      .filter(x => x.fact != null && x.plan > 0)
      .map(x => (x.fact as number) / x.plan);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };
  return {
    rows,
    loggedDays: logged,
    waterPct: avgPct(r => ({ fact: r.fact.waterL, plan: r.plan.waterL })),
    sodiumPct: avgPct(r => ({ fact: r.fact.sodiumMg, plan: r.plan.sodiumMg })),
    carbsPct: avgPct(r => ({ fact: r.fact.carbsG, plan: r.plan.carbsG })),
    flags: [...allFlags],
  };
}

export interface PeakWeightTrace {
  points: Array<{ date: string; weightKg: number; deltaKg: number | null }>;
  totalDeltaKg: number | null;
  maxDailyDropPct: number | null;
  flags: string[];
  expected: string;
}

/** Вес-трейс пик-недели: дельты, максимальная дневная просадка, ожидание гликоген-воды. */
export function peakWeekWeightTrace(entries: PeakDayEntry[]): PeakWeightTrace {
  const pts = (entries || [])
    .filter(e => e && e.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e, i, arr) => {
      const prev = i > 0 ? (arr[i - 1].weightKg as number) : null;
      return { date: e.date, weightKg: e.weightKg as number, deltaKg: prev != null ? Math.round(((e.weightKg as number) - prev) * 10) / 10 : null };
    });
  const totalDeltaKg = pts.length >= 2 ? Math.round((pts[pts.length - 1].weightKg - pts[0].weightKg) * 10) / 10 : null;
  let maxDrop: number | null = null;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1].weightKg;
    const delta = pts[i].weightKg - prev;
    if (delta < 0 && prev > 0) {
      const pct = Math.abs(delta) / prev * 100;
      if (maxDrop == null || pct > maxDrop) maxDrop = pct;
    }
  }
  const flags: string[] = [];
  if (pts.length < 2) flags.push('no_data');
  if (maxDrop != null && maxDrop > 1.5) flags.push('drop_during_week');
  return {
    points: pts,
    totalDeltaKg,
    maxDailyDropPct: maxDrop != null ? Math.round(maxDrop * 10) / 10 : null,
    flags,
    expected: 'На загрузке вес растёт на 0.5–1.5% (гликоген удерживает 2.7–3 г воды на 1 г). Резкая просадка (>1.5%/день) — это вода/недолив, не жир: верните воду к плану, оценивайте тренд 2–3 дней.',
  };
}

export interface PeakTrendAdvice {
  status: 'no_data' | 'on_track' | 'flat' | 'spill' | 'weight_drop';
  advice: string[];
}

/** Тренд-совет по последним 2–3 чек-инам (визуал приоритетнее веса). */
export function peakWeekTrendAdvice(entries: PeakDayEntry[]): PeakTrendAdvice {
  const clean = (entries || []).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  if (!clean.length) {
    return {
      status: 'no_data',
      advice: ['Записывайте утренний чек-ин (вес + визуал) — решения пик-недели принимаются по тренду, не по одной точке.'],
    };
  }
  const visuals = clean.filter(e => e.visual).slice(-3);
  if (visuals.length >= 2) {
    const a = visuals[visuals.length - 2].visual;
    const b = visuals[visuals.length - 1].visual;
    if (a === 'flat' && b === 'flat') {
      return {
        status: 'flat',
        advice: [
          'Два дня «плоско»: первое, что проверяем — ВОДА (недолив — главная причина плоскости), затем недобор углеводов в загрузке и сон.',
          'Не обнуляйте воду и натрий — это усилит плоскость и судороги. Одна переменная за раз (правило Escalante).',
        ],
      };
    }
    if ((a === 'spill' || a === 'full') && b === 'spill') {
      return {
        status: 'spill',
        advice: [
          'Два дня «расплывает»: проверьте натрий факт vs план (>150% — частая причина) и капните остаток загрузки — без обвалов.',
          'Вода/натрий не до нуля. При отёке с одышкой/спутанностью — это не «форма», а врач (см. экстренную карточку).',
        ],
      };
    }
  }
  const trace = peakWeekWeightTrace(clean);
  if (trace.maxDailyDropPct != null && trace.maxDailyDropPct > 1.5) {
    return {
      status: 'weight_drop',
      advice: [
        `Просадка веса до ${trace.maxDailyDropPct}%/день: риск недолива/недоеда. Верните воду и углеводы к плану — не урезайте сильнее.`,
        'Оценивайте среднее за 2–3 дня: одиночные колебания воды ничего не говорят о жире.',
      ],
    };
  }
  if (clean.length === 1) {
    return {
      status: 'on_track',
      advice: ['Первая точка записана. Решение принимаем после 2–3 точек — пока следуйте плану.'],
    };
  }
  return {
    status: 'on_track',
    advice: ['Тренд в коридоре — не меняйте работающий протокол (одна переменная за раз).', 'Продолжайте утренние чек-ины до шоу-дня.'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ⏱ Часовое расписание дня пик-недели
// ═══════════════════════════════════════════════════════════════════════════

export interface PeakTimelineItem { time: string; action: string; detail: string }

/**
 * Детерминированное расписание дня D-6…D-1 по часам (шоу-день → buildShowTimeline).
 * Подъём 07:00 (настраивается), 6 малых приёмов каждые ~2.5 ч, вода по приёмам,
 * Na с едой, тренировка/позы из дня плана, последняя вода и сон.
 */
export function buildPeakDayTimeline(
  day: PeakWeekDayPlan,
  opts?: { wakeHour?: number; mealCount?: number },
): { items: PeakTimelineItem[]; note: string } {
  if (!day) return { items: [], note: '' };
  if (day.phase === 'show') {
    return {
      items: [],
      note: 'Шоу-день: используйте таймлайн шоу-дня (подъём → грим → backstage → памп → выход) — он строится отдельным блоком.',
    };
  }
  const wake = Math.max(4, Math.min(10, Number(opts?.wakeHour) || 7));
  const meals = Math.max(3, Math.min(8, Math.round(opts?.mealCount || 6)));
  const pad = (h: number): string => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  const waterMl = Math.max(0, Math.round(day.waterLiters * 1000));
  const perMealMl = Math.round(waterMl / meals / 10) * 10;
  const naPerMeal = Math.round(day.sodiumMg / meals);
  const items: PeakTimelineItem[] = [];
  items.push({
    time: pad(wake),
    action: 'Подъём · взвешивание',
    detail: `Запись в монитор пик-недели (${day.phaseLabel}). Сравнивайте со вчера и планом — не с «идеалом».`,
  });
  const step = 2.5;
  for (let i = 0; i < meals; i++) {
    const t = wake + 0.5 + i * step;
    items.push({
      time: pad(t),
      action: `Приём ${i + 1}${i === meals - 1 ? ' (последний)' : ''} · вода ${perMealMl} мл`,
      detail: `Натрий с едой ~${naPerMeal} мг. ${i === meals - 1 ? 'Малоклетчаточный, лёгкий — не есть «на будущее».' : `Всего вода ${day.waterLiters} л за день, распределённо.`}`,
    });
  }
  if (day.training && day.training.type !== 'Отдых' && day.training.minutes > 0) {
    items.push({
      time: '16:00',
      action: `Тренировка: ${day.training.type} · ${day.training.minutes} мин`,
      detail: day.training.details.join(' ') || 'Памп без отказа, без новых упражнений — сохранение тонуса.',
    });
  }
  if (day.posingMinutes > 0) {
    items.push({ time: '19:00', action: `Позирование ${day.posingMinutes} мин`, detail: 'Комфортный темп, без отказов; фото/видео — сравнить с предыдущим днём.' });
  }
  items.push({
    time: pad(Math.min(21.5, wake + 0.5 + (meals - 1) * step + 0.5)),
    action: 'Последняя вода дня',
    detail: 'Малые глотки при жажде. НЕ обнулять воду (обезвоживание = плоскость и судороги; Floor-ы плана сохраняются).',
  });
  items.push({ time: '22:30', action: `Сон ${day.sleepHours} ч`, detail: 'Кофеин/экраны убрать за 2 ч. Стабильное время сна важнее «добить форму».' });
  items.sort((a, b) => a.time.localeCompare(b.time));
  return { items, note: `Клетчатка ≤${day.fiberMaxG} г · калий ${day.potassiumMg} мг · сон ${day.sleepHours} ч. Приёмы малые — так стабильнее ЖКТ и вода в мышце.` };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚑 Экстренная карточка шоу-дня
// ═══════════════════════════════════════════════════════════════════════════

export interface EmergencyScenario {
  id: string;
  title: string;
  signs: string[];
  do: string[];
  dont: string[];
  call: string;
}

/** Harm-reduction протоколы шоу-дня (без назначений препаратов/доз). */
export const SHOW_DAY_EMERGENCY: EmergencyScenario[] = [
  {
    id: 'hypo',
    title: 'Гипогликемия (низкий сахар)',
    signs: ['Дрожь, холодный пот', 'Внезапная слабость, голод', 'Спутанность, раздражительность'],
    do: ['Дать 15–20 г быстрых углеводов (сок/сахар/мёд)', 'Повторить замер состояния через 15 минут', 'Посидеть, не уходить одному'],
    dont: ['Не выходить на сцену при спутанности', 'Не «добивать» памп-тренировкой'],
    call: 'Если не легчает после 2 подходов или состояние повторяется — врач/скорая.',
  },
  {
    id: 'hyponatremia',
    title: 'Гипонатриемия (опаснее всего)',
    signs: ['Сильная головная боль', 'Тошнота/рвота', 'Спутанность, невнятная речь', 'Отёк, судороги'],
    do: ['НЕМЕДЛЕННО прекратить воду', 'Усадить, не оставлять одного', 'Срочно к врачу (это неотложное состояние)'],
    dont: ['НЕ пытаться «самому досолить» и догонять электролиты на глаз', 'Не продолжать позинг/выход'],
    call: 'Скорая немедленно — при спутанности/судорогах счёт на минуты.',
  },
  {
    id: 'cramps',
    title: 'Судороги мышц',
    signs: ['Сведение стопы/голени', 'Болезненные спазмы после нагрузки', 'Тремор'],
    do: ['Прекратить нагрузку, мягко растянуть', 'Электролитный напиток по плану подготовки', 'Тепло, удобное положение'],
    dont: ['Не продолжать на «силе воли»', 'Не новые препараты/дозы'],
    call: 'Если судороги генерализованные или не проходят 10–15 минут — врач.',
  },
  {
    id: 'faint',
    title: 'Обморок / предобморок',
    signs: ['Потемнение в глазах, шум в ушах', 'Бледность, дурнота', 'Потеря сознания'],
    do: ['Усадить/уложить, ноги выше уровня головы', 'Прохладное место, доступ воздуха', 'Быстрые углеводы при голоде'],
    dont: ['Не вставать резко сразу', 'Не продолжать позинг до полного восстановления'],
    call: 'Если сознание не возвращается >1 минуты или повторяется — скорая.',
  },
  {
    id: 'chest',
    title: 'Боль в груди / аритмия / одышка',
    signs: ['Давящая боль, отдаёт в руку/челюсть', 'Перебои ритма, сильное сердцебиение', 'Одышка в покое'],
    do: ['Немедленно остановить всё', 'Сесть/полулежа, расстегнуть одежду', 'Срочно медицинская помощь'],
    dont: ['Не «переждать» и не выходить на сцену', 'Не стимуляторы/энергетики'],
    call: 'Скорая немедленно — сердечные симптомы на дефиците/препаратах не терпят.',
  },
  {
    id: 'gi',
    title: 'ЖКТ: рвота/диарея в шоу-день',
    signs: ['Тошнота, рвота', 'Диарея, спазмы', 'Признаки обезвоживания (сухость, слабость)'],
    do: ['Малые частые глотки электролитов', 'Оценить: знаком ли продукт (не экспериментировать в шоу-день)', 'При продолжении — врач'],
    dont: ['Не есть незнакомую еду «как в подготовке»', 'Не обезболиваться и не глушить симптом неизвестными препаратами'],
    call: 'Если не проходит за 1–2 часа или есть кровь/температура — врач.',
  },
];

export const EMERGENCY_CONTACT_KEY = 'he_prep_emergency_v1';

export interface EmergencyContact { name: string; phone: string; note?: string }

export function loadEmergencyContact(): EmergencyContact | null {
  try {
    const raw = localStorage.getItem(EMERGENCY_CONTACT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const name = strOrUndef(parsed?.name, 60);
    const phone = strOrUndef(parsed?.phone, 30);
    if (!name && !phone) return null;
    return { name: name ?? '', phone: phone ?? '', note: strOrUndef(parsed?.note, 120) };
  } catch { return null; }
}

export function saveEmergencyContact(contact: EmergencyContact | null): boolean {
  try {
    const c = contact ? sanitizeEmergencyContact(contact) : null;
    if (!c) { localStorage.removeItem(EMERGENCY_CONTACT_KEY); return true; }
    localStorage.setItem(EMERGENCY_CONTACT_KEY, JSON.stringify(c));
    return true;
  } catch { return false; }
}

export function sanitizeEmergencyContact(raw: unknown): EmergencyContact | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = strOrUndef(r.name, 60);
  const phone = strOrUndef(r.phone, 30);
  if (!name && !phone) return null;
  return { name: name ?? '', phone: phone ?? '', note: strOrUndef(r.note, 120) };
}

/** Строки экстренной карточки для печати/копирования (XSS-escape делает вызывающий). */
export function emergencyLines(): string[] {
  const c = loadEmergencyContact();
  const lines: string[] = [];
  lines.push(c ? `Контакт: ${c.name || '—'} · ${c.phone || '—'}${c.note ? ` (${c.note})` : ''}` : 'Контакт не указан — заполните экстренный контакт.');
  for (const s of SHOW_DAY_EMERGENCY) {
    lines.push(`${s.title}: ${s.signs.join(', ')} → ${s.do[0]} · ${s.call}`);
  }
  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏁 Серия шоу (multi-show)
// ═══════════════════════════════════════════════════════════════════════════

export interface ShowSequenceInput {
  id: string;
  name: string;
  date?: string;
  priority?: 'A' | 'B' | 'C';
}

export interface ShowSequenceWindow {
  showId: string;
  name: string;
  date: string;
  priority: 'A' | 'B' | 'C';
  taperWeeks: number;
  taperStartDate: string;
  peakWeekStartDate: string;
  note: string;
}

export interface ShowSequencePlan {
  windows: ShowSequenceWindow[];
  overreachDate: string | null;
  overreachNote: string | null;
  warnings: string[];
}

/**
 * Окна серии шоу: taper (taperWeeks) + пик-неделя на каждое шоу с датой;
 * overreach-неделя перед основным тапером. Второе шоу в коротком окне (<4 нед)
 * — только проверенные (trial) моды: полный второй пик не планируется.
 */
export function showSequencePlan(
  shows: ShowSequenceInput[],
  opts?: { taperWeeks?: number },
): ShowSequencePlan {
  const warnings: string[] = [];
  const dated = (shows || [])
    .filter((s): s is ShowSequenceInput & { date: string } => !!s && typeof s.date === 'string' && ISO_DATE_RE.test(s.date))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.priority ?? 'C').localeCompare(b.priority ?? 'C'));
  if (!shows?.length) return { windows: [], overreachDate: null, overreachNote: null, warnings: ['Нет соревнований — серия шоу не рассчитывается.'] };
  if (!dated.length) return { windows: [], overreachDate: null, overreachNote: null, warnings: ['У соревнований не указаны даты — окна taper/пика не рассчитать.'] };
  const aCount = dated.filter(s => (s.priority ?? 'C') === 'A').length;
  if (aCount > 1) warnings.push('Больше одного шоу приоритета A: главным считается первое по дате — остальные ведите как B (иначе два полных пика).');
  const baseTaper = Math.max(1, Math.min(4, Math.round(opts?.taperWeeks ?? 2)));
  const windows: ShowSequenceWindow[] = dated.map((s, i) => {
    const isMain = (s.priority ?? 'C') === 'A' ? dated.findIndex(x => (x.priority ?? 'C') === 'A') === i : i === 0;
    const gapPrev = i > 0 ? isoDiffDays(dated[i - 1].date, s.date) : null;
    const shortWindow = gapPrev != null && gapPrev < 28;
    const taperWeeks = i === 0 ? baseTaper : Math.max(1, shortWindow ? 1 : baseTaper - 1);
    const taperStartDate = isoAddDays(s.date, -(taperWeeks + 1) * 7);
    const note = i === 0
      ? `Основное шоу: taper ${taperWeeks} нед + пик-неделя (${(s.priority ?? 'C')}).`
      : shortWindow
        ? `Второе шоу через ${gapPrev} дн: только проверенные (trial) моды, taper ${taperWeeks} нед — без второй полной загрузки.`
        : `Следующее шоу: taper ${taperWeeks} нед (сохранение формы после первого).`;
    if (shortWindow) warnings.push(`Между «${dated[i - 1].name}» и «${s.name}» всего ${gapPrev} дн (<4 нед) — второй пик только по проверенному trial-протоколу.`);
    return {
      showId: s.id,
      name: s.name,
      date: s.date,
      priority: s.priority ?? 'C',
      taperWeeks,
      taperStartDate,
      peakWeekStartDate: isoAddDays(s.date, -6),
      note: isMain && i === 0 ? `🎯 ${note}` : note,
    };
  });
  const main = windows[0];
  const overreachDate = main ? isoAddDays(main.taperStartDate, -7) : null;
  const second = windows[1];
  const overreachNote = overreachDate && (!second || isoDiffDays(overreachDate, second.date) >= 28)
    ? `Overreach-неделя: с ${overreachDate} (объём +10–15%, одна неделя) — затем тапер основного шоу.`
    : overreachDate
      ? `Overreach пропущен: между шоу <4 нед — добавка объёма перед тапером не окупается.`
      : null;
  return { windows, overreachDate, overreachNote, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════
// 👩 Женский пик-контур
// ═══════════════════════════════════════════════════════════════════════════

export interface FemalePeakNote { severity: 'ok' | 'info' | 'warn'; text: string }

export interface FemalePeakGuidance {
  showCycleDay: number | null;
  showPhase: 'flow' | 'follicular' | 'ovulation' | 'luteal' | 'late_luteal' | null;
  notes: FemalePeakNote[];
}

/** Фаза цикла по дню (28-дн модель; индивидуальная длина клампится 21–35). */
export function cyclePhaseForDay(cycleDay: number, cycleLen = 28): FemalePeakGuidance['showPhase'] {
  if (!Number.isFinite(cycleDay) || cycleDay < 1) return null;
  const len = Math.max(21, Math.min(35, Math.round(cycleLen || 28)));
  const d = ((Math.round(cycleDay) - 1) % len) + 1;
  if (d <= 5) return 'flow';
  if (d >= 13 && d <= 15) return 'ovulation';
  if (d > (len - 6)) return 'late_luteal';
  if (d >= 16) return 'luteal';
  return 'follicular';
}

/**
 * Женский пик-контур: фаза цикла на дату шоу + трактовка воды/энергии.
 * White 2011 (пик субъективной задержки — 1-й день менструации),
 * Carmichael 2021 (вода тела ↑ фолликул→лютеал), Sci Rep 2026 (сила ↓ late-luteal).
 */
export function femalePeakGuidance(
  plan: BBContestPrepPlan,
  opts?: { lastPeriodStartIso?: string | null; averageCycleDays?: number | null },
): FemalePeakGuidance {
  if (!plan || plan.sex !== 'female') return { showCycleDay: null, showPhase: null, notes: [] };
  const notes: FemalePeakNote[] = [];
  let showCycleDay: number | null = null;
  let showPhase: FemalePeakGuidance['showPhase'] = null;
  const start = typeof opts?.lastPeriodStartIso === 'string' && ISO_DATE_RE.test(opts.lastPeriodStartIso) ? opts.lastPeriodStartIso : null;
  const cycleLen = Math.max(21, Math.min(35, Math.round(Number(opts?.averageCycleDays) || 28)));
  if (start && plan.showDate && ISO_DATE_RE.test(plan.showDate)) {
    const diff = isoDiffDays(start, plan.showDate);
    showCycleDay = ((diff % cycleLen) + cycleLen) % cycleLen + 1;
    showPhase = cyclePhaseForDay(showCycleDay, cycleLen);
  }
  if (showPhase === 'flow') {
    notes.push({ severity: 'warn', text: 'Шоу попадает в первые дни менструации: субъективная задержка воды максимальна в 1-й день (White 2011), энергия/сон могут быть ниже — оставьте запас времени на шоу-день и не меняйте воду из-за веса.' });
  } else if (showPhase === 'luteal') {
    notes.push({ severity: 'info', text: 'Шоу в лютеиновой фазе: ожидайте +0.5–1 кг воды (Carmichael 2021: общая вода тела ↑ от фолликулярной к лютеиновой). Это не жир — решения по среднему за 7 дней.' });
  } else if (showPhase === 'late_luteal') {
    notes.push({ severity: 'warn', text: 'Поздняя лютеиновая на шоу: сила минимальна в цикле (Sci Rep 2026). Не добавляйте новые нагрузки/объёмы перед сценой — приоритет презентации и сон.' });
  } else if (showPhase === 'ovulation' || showPhase === 'follicular') {
    notes.push({ severity: 'ok', text: 'Шоу в фолликулярной/овуляторной фазе — обычно лучшая сила и самочувствие; вода стабильнее.' });
  } else {
    notes.push({ severity: 'info', text: 'Нет данных цикла (отметьте начало в планировщике): фазу на дату шоу не рассчитать. Тайминг задержки воды индивидуален — ведите чек-ины.' });
  }
  notes.push({ severity: 'info', text: 'BIA/калипер в дни задержки воды завышают % жира на 1–3: не принимайте решений по одной точке (Cumberledge 2018).' });
  notes.push({ severity: 'info', text: 'Ферритин/железо и костное здоровье — в карточке подготовки; при отсутствии цикла >3 мес — к врачу (RED-S/Triad 2025).' });
  return { showCycleDay, showPhase, notes };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧪 Лабы-чекпоинт
// ═══════════════════════════════════════════════════════════════════════════

export const PREP_LABS_KEY = 'he_prep_labs_v1';

export type PrepLabStatus = 'done' | 'soon' | 'overdue' | 'planned' | 'no_data';

export interface PrepLabCheckpointRow {
  id: string;
  label: string;
  deadlineIso: string;
  when: string;
  status: PrepLabStatus;
  detail: string;
}

export interface PrepLabCheckpointResult {
  rows: PrepLabCheckpointRow[];
  lastLabDate: string | null;
  summary: string;
}

const LAB_MILESTONES: Array<{ id: string; label: string; offsetDays: number; detail: string }> = [
  { id: 'baseline', label: 'База (ОАК/липиды/печень/почки/гормоны)', offsetDays: -70, detail: 'До старта подготовки — точка отсчёта и мед-скрин.' },
  { id: 'mid', label: 'Середина (печень/почки/липиды/электролиты)', offsetDays: -35, detail: 'Переносимость дефицита и курса в середине подготовки.' },
  { id: 'final', label: 'Финал (электролиты/почки/ОАК)', offsetDays: -10, detail: 'Перед пик-неделей: особенно вода/натрий и почки.' },
  { id: 'post', label: 'Пост-шоу (гормоны/липиды/ферритин)', offsetDays: 14, detail: 'Восстановление после шоу + контроль оси/липидов.' },
];

/** Чекпоинты анализов от даты шоу + статус по дате последних сданных. */
export function prepLabCheckpoint(
  showDate: string,
  lastLabDateIso?: string | null,
  todayIsoArg?: string,
): PrepLabCheckpointResult {
  const today = todayIsoArg ?? isoToday();
  const last = typeof lastLabDateIso === 'string' && ISO_DATE_RE.test(lastLabDateIso) ? lastLabDateIso : null;
  const rows: PrepLabCheckpointRow[] = [];
  if (!showDate || !ISO_DATE_RE.test(showDate)) {
    return { rows: [], lastLabDate: last, summary: 'Нет даты шоу — чекпоинты анализов не рассчитываются.' };
  }
  for (const m of LAB_MILESTONES) {
    const deadlineIso = isoAddDays(showDate, m.offsetDays);
    let status: PrepLabStatus;
    if (!last) status = 'no_data';
    else if (last >= deadlineIso) status = 'done';
    else if (deadlineIso <= today) status = 'overdue';
    else if (isoDiffDays(today, deadlineIso) <= 7) status = 'soon';
    else status = 'planned';
    const when = m.offsetDays < 0 ? `за ${Math.abs(m.offsetDays)} дн до шоу` : `+${m.offsetDays} дн после шоу`;
    rows.push({ id: m.id, label: m.label, deadlineIso, when, status, detail: m.detail });
  }
  const overdue = rows.filter(r => r.status === 'overdue').length;
  const summary = !last
    ? 'Дата последних анализов не указана — статусы не рассчитаны (укажите дату, чтобы видеть просрочки).'
    : overdue > 0
      ? `Просрочено чекпоинтов: ${overdue}. Анализы не переносят — сдайте до следующей фазы.`
      : 'Чекпоинты анализов закрыты — продолжайте по расписанию фаз.';
  return { rows, lastLabDate: last, summary };
}

export function loadPrepLabsDate(planId: string): string | null {
  try {
    const raw = localStorage.getItem(PREP_LABS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const v = parsed?.[planId];
    return typeof v === 'string' && ISO_DATE_RE.test(v) ? v : null;
  } catch { return null; }
}

export function savePrepLabsDate(planId: string, dateIso: string | null): boolean {
  if (!planId) return false;
  try {
    const raw = localStorage.getItem(PREP_LABS_KEY);
    let parsed: Record<string, unknown> = {};
    try { parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { parsed = {}; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
    if (dateIso && ISO_DATE_RE.test(dateIso)) parsed[planId] = dateIso;
    else delete parsed[planId];
    localStorage.setItem(PREP_LABS_KEY, JSON.stringify(parsed));
    return true;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 Пост-шоу фидбэк (факт vs цель regain)
// ═══════════════════════════════════════════════════════════════════════════

export interface PostShowProgress {
  weeksElapsed: number;
  stageWeightKg: number | null;
  latestWeightKg: number | null;
  actualRegainPct: number | null;
  targetRegainPct: number;
  weeklyRatePct: number | null;
  status: 'not_started' | 'no_data' | 'on_track' | 'faster' | 'slower';
  advice: string;
}

/**
 * Прогресс восстановления после шоу: факт-вес vs ориентир regain 10–15%/1–6 мес
 * (≈1%/нед, кап 12% за окно 12 нед; Buechel 2026, PMC9364707).
 * Вес сцены берётся из последней записи журнала до даты шоу (включительно).
 */
export function postShowRecoveryProgress(
  plan: BBContestPrepPlan,
  weightLog: Array<{ date: string; weight: number }>,
  opts?: { today?: string },
): PostShowProgress {
  const today = opts?.today ?? isoToday();
  if (!plan?.showDate || !ISO_DATE_RE.test(plan.showDate)) {
    return { weeksElapsed: 0, stageWeightKg: null, latestWeightKg: null, actualRegainPct: null, targetRegainPct: 0, weeklyRatePct: null, status: 'no_data', advice: 'Нет даты шоу в плане.' };
  }
  const weeksElapsed = Math.floor(isoDiffDays(plan.showDate, today) / 7);
  if (weeksElapsed < 0) {
    return { weeksElapsed, stageWeightKg: null, latestWeightKg: null, actualRegainPct: null, targetRegainPct: 0, weeklyRatePct: null, status: 'not_started', advice: 'Шоу ещё впереди — прогресс восстановления начнётся после шоу-дня.' };
  }
  const clean = (weightLog || [])
    .filter(w => w && typeof w.date === 'string' && ISO_DATE_RE.test(w.date) && Number.isFinite(Number(w.weight)))
    .map(w => ({ date: w.date, weight: Number(w.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const stage = [...clean].reverse().find(w => w.date <= plan.showDate) ?? null;
  const post = clean.filter(w => w.date > plan.showDate);
  const latest = post.length ? post[post.length - 1] : null;
  const targetRegainPct = Math.min(12, Math.max(0, weeksElapsed)) * 1;
  if (!stage || !latest || stage.weight <= 0) {
    return {
      weeksElapsed,
      stageWeightKg: stage?.weight ?? null,
      latestWeightKg: latest?.weight ?? null,
      actualRegainPct: null,
      targetRegainPct,
      weeklyRatePct: null,
      status: 'no_data',
      advice: 'Записывайте вес: прогресс восстановления считается от веса сцены (запись в журнале веса перед шоу + после).',
    };
  }
  const actualRegainPct = Math.round(((latest.weight - stage.weight) / stage.weight) * 1000) / 10;
  const weeklyRatePct = Math.round((actualRegainPct / Math.max(1, weeksElapsed)) * 100) / 100;
  let status: PostShowProgress['status'];
  let advice: string;
  if (weeklyRatePct < 0.5) {
    status = 'slower';
    advice = `Медленнее цели ${targetRegainPct}% к этой неделе: проверьте adherence калорий по кривой, сон и шаги. Не «догоняйте» скачком — ступени по 75 ккал/нед.`;
  } else if (weeklyRatePct > 1.6) {
    status = 'faster';
    advice = 'Набор быстрее цели (recovery восстановит гормоны и так): удержите текущие калории, следите за сном/голодом. Откатывать калории вниз не нужно.';
  } else {
    status = 'on_track';
    advice = `Восстановление по кривой (~1%/нед): к неделе ${weeksElapsed} цель ${targetRegainPct}%, факт ${actualRegainPct}%. Продолжайте ступени.`;
  }
  return {
    weeksElapsed,
    stageWeightKg: Math.round(stage.weight * 10) / 10,
    latestWeightKg: Math.round(latest.weight * 10) / 10,
    actualRegainPct,
    targetRegainPct,
    weeklyRatePct,
    status,
    advice,
  };
}

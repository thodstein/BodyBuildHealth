/**
 * cardio-tid.engine.ts — TID + Polarization Index + фазированность (Эпик D).
 * Чистые функции, без IO.
 *
 * Литература:
 * - Treff 2019: PI = log10(Z1/Z2 × Z3 × 100); PI > 2 → polarized.
 * - Seiler & Kjerland 2006: POL = 75-80% Z1 + 15-20% Z3 + ~5% Z2.
 * - Silva 2025 (Sports Med): POL vs PYR без разницы VO2/TT в целом; competitive → POL лучше, recreational → PYR.
 * - Cove 2024 (велосипедисты): POL = NP (g 0.42 VO2 обе).
 * - Filipas 2021: PYR→POL за 16 нед +3% VO2max (лучший протокол).
 * - Frontiers 2025: фазовый сдвиг general PYR/POL → specific PYR → pre-comp POL.
 */
import type { CardioCycle, CardioType } from './cardio.engine';
import { maxHrClassic } from './cardio-physiology.engine';

export type TidModel = 'polarized' | 'pyramidal' | 'threshold' | 'other';

/** Маппинг типа сессии в зону TID: recovery/zone2 → Z1, miss → Z2, hiit → Z3. */
export function tidZoneOf(type: CardioType): 1 | 2 | 3 {
  if (type === 'miss') return 2;
  if (type === 'hiit') return 3;
  return 1;
}

export interface TimeInZones {
  z1Min: number;
  z2Min: number;
  z3Min: number;
  totalMin: number;
  pct: { z1: number; z2: number; z3: number };
}

/** Время в зонах по циклу (минуты = durationMin × weeklyFrequency). */
export function timeInZones(cycle: Pick<CardioCycle, 'weeks'>): TimeInZones {
  let z1Min = 0;
  let z2Min = 0;
  let z3Min = 0;
  for (const w of cycle.weeks) {
    for (const s of w.sessions) {
      const min = s.durationMin * s.weeklyFrequency;
      const z = tidZoneOf(s.type);
      if (z === 1) z1Min += min;
      else if (z === 2) z2Min += min;
      else z3Min += min;
    }
  }
  const totalMin = z1Min + z2Min + z3Min;
  const pct = totalMin > 0
    ? { z1: Math.round((z1Min / totalMin) * 1000) / 10, z2: Math.round((z2Min / totalMin) * 1000) / 10, z3: Math.round((z3Min / totalMin) * 1000) / 10 }
    : { z1: 0, z2: 0, z3: 0 };
  return { z1Min, z2Min, z3Min, totalMin, pct };
}

/** Polarization Index (Treff 2019): входы — проценты 0-100, внутри — доли.
 *  PI = log10((z1/z2) × z3доля × 100) = log10(z1/z2 × z3); порог 2.
 *  Пример: 80/5/15 → 2.38 polarized; 80/15/5 → 1.42 pyramidal. */
export function polarizationIndex(z1Pct: number, z2Pct: number, z3Pct: number): number | null {
  const z1 = Number(z1Pct);
  const z2 = Number(z2Pct);
  const z3 = Number(z3Pct);
  if (![z1, z2, z3].every(Number.isFinite) || z1 <= 0 || z3 <= 0) return null;
  if (z2 <= 0) {
    // Z2=0: доля 0.0001 (0.01%) чтобы избежать деления на 0
    const v = Math.log10((z1 / 0.01) * (z3 / 100) * 100);
    return Math.round(v * 100) / 100;
  }
  const v = Math.log10((z1 / z2) * z3);
  return Math.round(v * 100) / 100;
}

/** Классификация TID по PI и распределению. */
export function classifyTid(tiz: TimeInZones): { model: TidModel; pi: number | null; label: string } {
  const pi = polarizationIndex(tiz.pct.z1, tiz.pct.z2, tiz.pct.z3);
  if (tiz.totalMin === 0) return { model: 'other', pi, label: 'Нет объёма' };
  if (pi != null && pi > 2 && tiz.pct.z1 > tiz.pct.z3 && tiz.pct.z3 > tiz.pct.z2) {
    return { model: 'polarized', pi, label: `Polarized (PI ${pi} > 2, Z1>Z3>Z2)` };
  }
  if (tiz.pct.z1 > tiz.pct.z2 && tiz.pct.z2 > tiz.pct.z3 && tiz.pct.z1 >= 60) {
    return { model: 'pyramidal', pi, label: `Pyramidal (Z1>Z2>Z3, PI ${pi ?? '—'})` };
  }
  if (tiz.pct.z2 >= 35) {
    return { model: 'threshold', pi, label: `Threshold (Z2 ${tiz.pct.z2}% ≥ 35%)` };
  }
  return { model: 'other', pi, label: `Смешанное (PI ${pi ?? '—'})` };
}

/** Совет по TID с учётом уровня (Silva: recreational→PYR, competitive→POL; Cove: вело нейтрально). */
export function tidAdvice(
  model: TidModel,
  level: 'beginner' | 'intermediate' | 'advanced',
  sport?: 'run' | 'bike' | 'row' | 'other',
): string {
  if (model === 'polarized' && level === 'beginner') {
    return 'Polarized у новичка: замените часть Z3 на Z2 (pyramidal) — техника и база важнее интенсивности (Silva 2025: recreational → PYR).';
  }
  if (model === 'pyramidal' && level === 'advanced' && sport !== 'bike') {
    return 'Продвинутый + pyramidal: в предсоревновательный блок сдвиньте Z2→Z3 (PYR→POL, Filipas +3% VO2) — поляризация даст пик.';
  }
  if (sport === 'bike' && (model === 'polarized' || model === 'pyramidal')) {
    return 'Вело: POL = PYR по эффекту (Cove 2024) — держите удобную модель, ключ — объём и частота.';
  }
  if (model === 'threshold') {
    return 'Threshold (много Z2): эффективно для техники (плавание), но для бега/вело сдвиньте часть Z2 в Z1 (Seiler 80/20).';
  }
  return 'TID соответствует уровню: держите 75-85% Z1, 5-15% Z2, 10-20% Z3 в зависимости от фазы.';
}

export type SeasonPhase = 'general' | 'specific' | 'precomp' | 'comp';

/** Целевое распределение по фазе сезона (Seiler/Frontiers 2025). */
export function phasedTidTarget(phase: SeasonPhase): { z1: number; z2: number; z3: number; note: string } {
  switch (phase) {
    case 'general':
      return { z1: 85, z2: 8, z3: 7, note: 'General: PYR 85/8/7 — база, митохондрии (Seiler).' };
    case 'specific':
      return { z1: 80, z2: 10, z3: 10, note: 'Specific: PYR 80/10/10 — рост Z3 до 10% (спорт-специфика).' };
    case 'precomp':
      return { z1: 78, z2: 5, z3: 17, note: 'Pre-comp: POL 78/5/17 — Z2 <5%, Z3 15-20% (пик готовности).' };
    case 'comp':
      return { z1: 75, z2: 5, z3: 20, note: 'Comp: POL 75/5/20 — свежесть + интенсивность, объём −40-60%.' };
  }
}

/** Насколько текущий TID далёк от целевого (сумма |Δ|/2, 0-100). */
export function tidDistanceToTarget(tiz: TimeInZones, target: { z1: number; z2: number; z3: number }): number {
  const d = (Math.abs(tiz.pct.z1 - target.z1) + Math.abs(tiz.pct.z2 - target.z2) + Math.abs(tiz.pct.z3 - target.z3)) / 2;
  return Math.round(d * 10) / 10;
}

// ─── Фактический TID (по дневнику, а не по плану) ────────────────────────────
// P1-аудит: весь TID-считался из ТИПА сессии в плане (recovery/zone2→Z1,
// miss→Z2, hiit→Z3). Но дневник хранит ФАКТ: длительность + средний HR.
// План говорил «зона 2, 30 мин», а человек мог отработать 22 мин в Z1
// или 35 мин в Z3 — и распределение типов ≠ распределение по факту.
// Ниже — расчёт по факту (HR → зона через LTHR/ЧССмакс) + честная сверка
// «план vs факт», чтобы видеть расхождение, а не выдавать план за факт.

export interface FactSession {
  date: string;
  type: CardioType;
  durationMin: number;
  avgHr?: number;
  completed?: boolean;
  /** Дисциплина сессии: калибровка пульса у бега и вела разная (Sprint 5.2). */
  sport?: 'run' | 'bike' | 'row' | 'other';
}

/** Границы зон TID в % от референса пульса.
 *  TID — модель ЗОН, а не абсолютных ЧСС: у бегуна Z2 ≈ LT1, у велосипедиста
 *  LT2 (Pollock 2017 / Seiler 2006: LT1 у вело заметно выше). Поэтому пороги
 *  даём по LTHR, а при его отсутствии — по % ЧССмакс с оговоркой в note. */
export const TID_HR_BOUNDS_PCT_LTHR = { z1: [0, 81], z2: [81, 89], z3: [89, 100] } as const;
export const TID_HR_BOUNDS_PCT_MAXHR = { z1: [0, 70], z2: [70, 85], z3: [85, 100] } as const;

export type TidHrBasis = 'lthr' | 'maxhr' | 'none';

export interface TidHrReference {
  lthr?: number;
  maxHr?: number;
  age?: number;
  sex?: 'male' | 'female';
}

/** Зона TID по среднему HR фактической сессии (null — HR нет или вне зоны). */
export function tidZoneOfHr(
  avgHr: number | undefined,
  ref: TidHrReference,
): { zone: 1 | 2 | 3 | null; basis: TidHrBasis; pct: number | null } {
  if (!avgHr || !Number.isFinite(avgHr) || avgHr <= 0) return { zone: null, basis: 'none', pct: null };
  if (ref.lthr && ref.lthr > 0) {
    const pct = (avgHr / ref.lthr) * 100;
    const b = TID_HR_BOUNDS_PCT_LTHR;
    if (pct < b.z1[0]) return { zone: null, basis: 'lthr', pct: Math.round(pct) };
    if (pct < b.z2[0]) return { zone: 1, basis: 'lthr', pct: Math.round(pct) };
    if (pct < b.z3[0]) return { zone: 2, basis: 'lthr', pct: Math.round(pct) };
    return { zone: 3, basis: 'lthr', pct: Math.round(pct) };
  }
  const maxHr = ref.maxHr && ref.maxHr > 0
    ? ref.maxHr
    : (ref.age && ref.age > 0 ? maxHrClassic(ref.age, ref.sex) : 0);
  if (maxHr > 0) {
    const pct = (avgHr / maxHr) * 100;
    const b = TID_HR_BOUNDS_PCT_MAXHR;
    if (pct < b.z1[0]) return { zone: null, basis: 'maxhr', pct: Math.round(pct) };
    if (pct < b.z2[0]) return { zone: 1, basis: 'maxhr', pct: Math.round(pct) };
    if (pct < b.z3[0]) return { zone: 2, basis: 'maxhr', pct: Math.round(pct) };
    return { zone: 3, basis: 'maxhr', pct: Math.round(pct) };
  }
  return { zone: null, basis: 'none', pct: null };
}

/** Фактический TID по дневнику. Сессии без HR идут в `skipped` (честно:
 *  «не знаем» ≠ «зона 1»). Тип сессии НЕ используется как замена HR:
 *  Z1 начинается с 0% референса, поэтому любой валидный HR попадает
 *  в какую-то зону — «фолбэк по типу» был бы мёртвым кодом и ложью. */
export function factTimeInZones(
  log: FactSession[],
  ref: TidHrReference = {},
): TimeInZones & { byHr: number; skipped: number; basis: TidHrBasis; note: string } {
  let z1 = 0, z2 = 0, z3 = 0, byHr = 0, skipped = 0;
  for (const s of log ?? []) {
    if (s.completed === false) continue;
    if (!(s.durationMin > 0)) continue;
    const hr = tidZoneOfHr(s.avgHr, ref);
    if (hr.zone == null) { skipped++; continue; }
    byHr++;
    if (hr.zone === 1) z1 += s.durationMin;
    else if (hr.zone === 2) z2 += s.durationMin;
    else z3 += s.durationMin;
  }
  const total = z1 + z2 + z3;
  const basis: TidHrBasis = byHr > 0 ? (ref.lthr && ref.lthr > 0 ? 'lthr' : 'maxhr') : 'none';
  return {
    z1Min: Math.round(z1), z2Min: Math.round(z2), z3Min: Math.round(z3), totalMin: Math.round(total),
    pct: total > 0
      ? { z1: r1(z1 / total * 100), z2: r1(z2 / total * 100), z3: r1(z3 / total * 100) }
      : { z1: 0, z2: 0, z3: 0 },
    byHr, skipped, basis,
    note: byHr === 0
      ? 'Нет ни одной сессии со средним HR — фактический TID не считаем (план ≠ факт).'
      : skipped > 0
        ? `${byHr} по среднему HR; ${skipped} без HR — вне расчёта.`
        : `${byHr} сессий по среднему HR${basis === 'lthr' ? ' (пороги по LTHR)' : ' (пороги по % ЧССмакс)'}.`,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface TidPlanVsFact {
  planned: TimeInZones;
  fact: TimeInZones & { byHr: number; skipped: number; basis: TidHrBasis; note: string };
  /** |Δ| в п.п. по каждой зоне. */
  delta: { z1: number; z2: number; z3: number };
  /** Сумма |Δ|/2 — общая расходимость плана и факта, 0-100. */
  drift: number;
  comparable: boolean;
  verdict: string;
  /** Спринт 5.2: в дневнике смешаны бег и вело — их зоны несопоставимы. */
  sportsInLog: string[];
  mixed: boolean;
  /**
   * Спринт 5.2 (добивка): разбивка факта ПО ДИСЦИПЛИНАМ. Смешанный лог больше
   * не отбрасывается целиком — видно время по зонам для каждой дисциплины
   * отдельно (это достоверный факт, даже когда сравнение с планом невозможно).
   */
  bySport: TidSportFact[];
  /** Есть ли свой эталон HR хотя бы у одной реальной дисциплины. */
  hasPerSportRef: boolean;
}

/** Факт TID в рамках одной дисциплины. */
export interface TidSportFact {
  sport: string;
  fact: TimeInZones & { byHr: number; skipped: number; basis: TidHrBasis; note: string };
  /** Эталон задан именно для этой дисциплины (а не взят общий). */
  ownRef: boolean;
}

/** Эталоны HR по дисциплинам: у бега и вела РАЗНЫЕ пульсы (свой LTHR). */
export type TidHrRefsBySport = Partial<Record<string, TidHrReference>>;

/**
 * Спринт 5.2 (добивка): пер-спортная калибровка.
 *
 * Смешанный дневник раньше просто признавался «несравнимым», и время по зонам
 * терялось совсем. Теперь факт всегда разбирается по дисциплинам, а сравнение
 * с планом корректно там, где эталон задан для этой дисциплины (`refsBySport`).
 * Числовых порогов не выдумываем: границы зон те же (LTHR / %ЧССмакс) — меняется
 * только ЭТАЛОН, который пользователь измерил для своей дисциплины.
 */
export function tidFactBySport(
  log: FactSession[],
  refsBySport: TidHrRefsBySport = {},
  fallbackRef: TidHrReference = {},
): TidSportFact[] {
  const groups = new Map<string, FactSession[]>();
  for (const s of log ?? []) {
    const key = s.sport ?? 'other';
    const arr = groups.get(key);
    if (arr) arr.push(s); else groups.set(key, [s]);
  }
  const out: TidSportFact[] = [];
  for (const [sport, sessions] of groups) {
    const own = refsBySport[sport];
    const hasOwn = !!own && !!(own.lthr || own.maxHr);
    out.push({ sport, fact: factTimeInZones(sessions, hasOwn ? (own as TidHrReference) : fallbackRef), ownRef: hasOwn });
  }
  // Стабильный порядок: сначала реальные дисциплины, потом legacy «other».
  return out.sort((a, b) =>
    (a.sport === 'other' ? 1 : 0) - (b.sport === 'other' ? 1 : 0) || a.sport.localeCompare(b.sport));
}

/** Честная сверка «план vs факт»: план по типам сессий, факт по HR дневника.
 *  `refsBySport` — эталон HR по дисциплинам (спринт 5.2): при смешанном логе
 *  сравнение корректно только для дисциплины со своим эталоном. */
export function tidPlanVsFact(
  cycle: Pick<CardioCycle, 'weeks'>,
  log: FactSession[],
  ref: TidHrReference = {},
  refsBySport: TidHrRefsBySport = {},
): TidPlanVsFact {
  const planned = timeInZones(cycle);
  const bySport = tidFactBySport(log, refsBySport, ref);
  const fact0 = bySport;
  const sportsInLog = [...new Set((log ?? []).map(s => s.sport ?? 'other'))];
  // «other» — legacy-записи без дисциплины: они не мешают, но и не дают права
  // утверждать, что калибровка одна.
  const realSports = sportsInLog.filter(s => s !== 'other');
  const mixed = realSports.length > 1;
  // Основная дисциплина для сверки: при смешанном — та, у которой есть СВОЙ
  // эталон; иначе единственная реальная; иначе первая доступная.
  const withOwnRef = fact0.filter(s => s.ownRef);
  const primary = (mixed ? withOwnRef[0] : undefined) ?? fact0.find(s => s.sport !== 'other') ?? fact0[0];
  const fact = primary ? primary.fact : factTimeInZones([], ref);
  const delta = {
    z1: r1(Math.abs(planned.pct.z1 - fact.pct.z1)),
    z2: r1(Math.abs(planned.pct.z2 - fact.pct.z2)),
    z3: r1(Math.abs(planned.pct.z3 - fact.pct.z3)),
  };
  const drift = r1((delta.z1 + delta.z2 + delta.z3) / 2);
  const hasPerSportRef = withOwnRef.length > 0;
  const comparable = fact.byHr > 0 && planned.totalMin > 0;
  // Смешанный лог сравним, только если эталон задан именно для этой дисциплины.
  const mixedBlocked = mixed && !primary?.ownRef;
  let verdict: string;
  if (!comparable) {
    verdict = 'Сверка невозможна: нет фактических сессий с HR (план нельзя выдавать за факт).';
  } else if (mixedBlocked) {
    verdict = `В дневнике смешаны дисциплины (${realSports.join(' + ')}) — у них разная калибровка пульса, единый TID некорректен. Разбивка по дисциплинам ниже; задайте свой пульс (LTHR) для каждой, чтобы сравнивать.`;
  } else if (drift <= 5) {
    verdict = mixed
      ? `Факт по «${primary?.sport}» совпадает с планом — распределение по зонам реальное.`
      : 'Факт совпадает с планом — распределение по зонам реальное.';
  } else if (drift <= 12) {
    verdict = `Факт отличается от плана на ${drift} п.п. — норма для ручных и HR-датчиков, следите за Z3.`;
  } else {
    verdict = `Факт расходится с планом на ${drift} п.п. — пересоберите план: ${fact.note}`;
  }
  return { planned, fact, delta, drift, comparable, verdict, sportsInLog, mixed, bySport, hasPerSportRef };
}

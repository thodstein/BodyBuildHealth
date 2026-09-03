/**
 * cardio-field-tests.engine.ts — PRO-калибровка зон по полевым тестам (Эпик A).
 * Приоритет источников: LTHR (Friel 30') > FTP (вело 20') > CP (3/12') > VDOT (Daniels) > talk-test > age.
 * Чистые функции, без IO. Не импортирует cardio.engine runtime (только типы) — без циклов.
 *
 * Литература:
 * - Friel: LTHR = средняя ЧСС последних 20' 30-мин all-out.
 * - Allen & Coggan: FTP = 0.95 × средняя мощность 20' теста.
 * - Monod & Scherrer: CP по двум усилиям (3' и 12').
 * - Strepp 2024: HR недооценивает Z3 в HIIT-shock до 40% — для HIIT предпочтителен power/pace.
 */
import type { HeartZone } from './cardio-physiology.engine';
import { lthrZones, cardioHeartZones, cyclingPowerZones, runningVdot } from './cardio-physiology.engine';

export type FieldTestSource = 'lthr' | 'ftp' | 'cp' | 'vdot' | 'talk' | 'age';

export interface FieldTestInput {
  lthr?: number;
  ftpWatts?: number;
  cpWatts?: number;
  vdot?: number;
  talkZone2Hr?: number;
  age?: number;
  restingHr?: number;
  sex?: 'male' | 'female';
  formula?: 'classic' | 'tanaka' | 'gulati';
}

export interface PersonalZones {
  source: FieldTestSource;
  zones: HeartZone[];
  note: string;
  /** Предупреждение для HIIT: HR неточен, лучше power/pace (Strepp 2024). */
  hiitNote: string | null;
}

/** FTP из 20-мин теста (Allen & Coggan): FTP = 0.95 × P20. */
export function ftpFrom20MinTest(avgPower20Min: number): number | null {
  const p = Number(avgPower20Min);
  if (!Number.isFinite(p) || p < 30 || p > 800) return null;
  return Math.round(p * 0.95);
}

/** Critical Power по двум усилиям: P3 (3') и P12 (12'). CP = (P3×180 − P12×720)/(180−720) упрощённо через работу. */
export function criticalPowerFrom3And12(p3Watts: number, p12Watts: number): number | null {
  const a = Number(p3Watts);
  const b = Number(p12Watts);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 || a <= b) return null;
  if (a > 1000 || b > 1000) return null;
  // W' = (P3−P12) × 180×720/(720−180); CP = P12 − W'/720
  const t1 = 180;
  const t2 = 720;
  const wPrime = ((a - b) * t1 * t2) / (t2 - t1);
  const cp = b - wPrime / t2;
  if (!Number.isFinite(cp) || cp < 30 || cp > 800) return null;
  return Math.round(cp);
}

/** Talk-test: верхняя граница Z2 ≈ ЧСС, при которой речь ещё комфортна (оценка). */
export function talkTestZone2Ceiling(talkHr: number): number | null {
  const v = Math.round(Number(talkHr));
  if (!Number.isFinite(v) || v < 80 || v > 200) return null;
  return v;
}

/** Зоны по talk-test: якорь Z2 ceiling → остальные пропорционально. */
export function zonesFromTalkTest(talkZone2Hr: number): HeartZone[] | null {
  const ceil = talkTestZone2Ceiling(talkZone2Hr);
  if (ceil == null) return null;
  // Z2 = ceil−15..ceil, Z1 ниже, Z3 +10..+25, Z4 +25..+40, Z5 выше
  const mk = (zone: number, label: string, min: number, max: number, purpose: string): HeartZone => ({
    zone, label, rangeMin: 0, rangeMax: 0, bpmMin: min, bpmMax: max, purpose,
  });
  return [
    mk(1, 'Z1 Recovery', Math.max(60, ceil - 35), Math.max(80, ceil - 16), 'Восстановление, разминка (talk-test)'),
    mk(2, 'Z2 Zone 2', Math.max(80, ceil - 15), ceil, 'Аэробная база, липолиз (talk-test)'),
    mk(3, 'Z3 Tempo/MISS', ceil + 1, ceil + 15, 'Темпо (talk-test)'),
    mk(4, 'Z4 Threshold', ceil + 16, ceil + 30, 'Порог (talk-test)'),
    mk(5, 'Z5 VO2max', ceil + 31, ceil + 55, 'Максимум (talk-test)'),
  ];
}

/** Выбор источника зон по приоритету LTHR > FTP(→HR через возраст) > CP > VDOT > talk > age. */
export function personalZones(input: FieldTestInput): PersonalZones | null {
  const hiitNote = 'HIIT: HR запаздывает и занижает Z3 до 40% (Strepp 2024) — контролируйте по мощности/темпу, HR вторичен.';
  if (input.lthr != null && input.lthr >= 80 && input.lthr <= 220) {
    return { source: 'lthr', zones: lthrZones(Math.round(input.lthr)), note: `LTHR ${Math.round(input.lthr)} уд/мин (Friel 30') — самый точный якорь HR-зон.`, hiitNote };
  }
  if (input.ftpWatts != null && input.ftpWatts >= 30 && input.ftpWatts <= 800) {
    // FTP — ватты; HR-зоны строим по возрасту, но помечаем источник ftp
    const zones = input.age != null
      ? cardioHeartZones(input.age, input.restingHr, undefined, input.sex, input.formula)
      : lthrZones(165);
    const power = cyclingPowerZones(Math.round(input.ftpWatts));
    return {
      source: 'ftp',
      zones,
      note: `FTP ${Math.round(input.ftpWatts)} Вт → ватт-зоны Coggan Z2 ${power[1].wattsMin}-${power[1].wattsMax} Вт; HR-зоны по возрасту как вторичные.`,
      hiitNote,
    };
  }
  if (input.cpWatts != null && input.cpWatts >= 30 && input.cpWatts <= 800) {
    const zones = input.age != null
      ? cardioHeartZones(input.age, input.restingHr, undefined, input.sex, input.formula)
      : lthrZones(165);
    return { source: 'cp', zones, note: `CP ${Math.round(input.cpWatts)} Вт (Monod & Scherrer 3'/12') — пороговая мощность; интервалы выше CP — анаэробные.`, hiitNote };
  }
  if (input.vdot != null && input.vdot >= 20 && input.vdot <= 85) {
    const v = runningVdot(5, 25);
    void v;
    const zones = cardioHeartZones(input.age ?? 30, input.restingHr, undefined, input.sex, input.formula);
    return { source: 'vdot', zones, note: `VDOT ${input.vdot} (Daniels) — темповые зоны бега первичны, HR вторичен.`, hiitNote };
  }
  if (input.talkZone2Hr != null) {
    const z = zonesFromTalkTest(input.talkZone2Hr);
    if (z) return { source: 'talk', zones: z, note: `Talk-test: потолок Z2 ${Math.round(input.talkZone2Hr)} уд/мин — зоны оценочные, перепроверьте LTHR-тестом.`, hiitNote };
  }
  if (input.age != null && input.age >= 12 && input.age <= 90) {
    return {
      source: 'age',
      zones: cardioHeartZones(input.age, input.restingHr, undefined, input.sex, input.formula),
      note: 'Возрастные зоны (Karvonen) — оценочные ±10-15 уд/мин; рекомендуются LTHR 30\' или FTP 20\' тесты.',
      hiitNote,
    };
  }
  return null;
}

/** Какой полевой тест рекомендовать по уровню/оборудованию. */
export function recommendFieldTest(level: 'beginner' | 'intermediate' | 'advanced', equipment?: string): string {
  if (equipment === 'cycling') return 'FTP 20\' (разминка 15\' → 20\' all-out → FTP = P20×0.95). Повтор каждые 6-8 нед.';
  if (equipment === 'running') return level === 'beginner'
    ? 'Talk-test + 30\' комфортный бег: потолок Z2 = ЧСС разговорного темпа.'
    : 'LTHR 30\' (Friel): 30\' all-out, средняя ЧСС последних 20\' = LTHR. Или VDOT по контрольным 5 км.';
  return level === 'beginner'
    ? 'Talk-test: комфортный темп 20-30\', зафиксируйте ЧСС — это потолок Z2.'
    : 'LTHR 30\' (универсально): 10\' легко + 30\' максимально ровно, средняя ЧСС последних 20\' = LTHR.';
}

/** Валидация сырого ввода полевого теста. Возвращает warnings (пусто — ок). */
export function validateFieldTestInput(input: FieldTestInput): string[] {
  const w: string[] = [];
  if (input.lthr != null && (input.lthr < 80 || input.lthr > 220)) w.push('LTHR вне 80-220 уд/мин.');
  if (input.ftpWatts != null && (input.ftpWatts < 30 || input.ftpWatts > 800)) w.push('FTP вне 30-800 Вт.');
  if (input.cpWatts != null && (input.cpWatts < 30 || input.cpWatts > 800)) w.push('CP вне 30-800 Вт.');
  if (input.vdot != null && (input.vdot < 20 || input.vdot > 85)) w.push('VDOT вне 20-85.');
  if (input.talkZone2Hr != null && (input.talkZone2Hr < 80 || input.talkZone2Hr > 200)) w.push('Talk-test ЧСС вне 80-200.');
  if (input.age != null && (input.age < 12 || input.age > 90)) w.push('Возраст вне 12-90.');
  return w;
}

// ─── CP по N усилиям (Morton, линейная модель P = CP + W'/t) ───

export interface CpEffort {
  seconds: number;
  watts: number;
}

export interface CpFit {
  cp: number;
  wPrimeKj: number;
  r2: number;
  n: number;
}

/**
 * Critical Power по 2+ усилиям (рекомендуются 3: 3'/7'/12').
 * МНК-регрессия P от 1/t: CP — пересечение, W' — наклон.
 * Возвращает null при <2 валидных усилий или вырожденных данных.
 */
export function criticalPowerFromEfforts(efforts: CpEffort[]): CpFit | null {
  const valid = (efforts ?? []).filter(e => Number.isFinite(e.seconds) && Number.isFinite(e.watts) && e.seconds >= 60 && e.seconds <= 3600 && e.watts >= 30 && e.watts <= 1500);
  if (valid.length < 2) return null;
  const xs = valid.map(e => 1 / e.seconds);
  const ys = valid.map(e => e.watts);
  const n = valid.length;
  // при 2 усилиях требуем убывание мощности с длительностью (иначе max-усилия некорректны)
  if (n === 2) {
    const [a, b] = [...valid].sort((p, q) => p.seconds - q.seconds);
    if (a.watts <= b.watts) return null;
  }
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (ys[i] - meanY); den += (xs[i] - meanX) ** 2; }
  if (!(den > 0)) return null;
  const wPrime = num / den; // Дж (Вт×с)
  const cp = meanY - wPrime * meanX;
  if (!Number.isFinite(cp) || !Number.isFinite(wPrime) || cp < 30 || cp > 800 || wPrime <= 0) return null;
  // R²
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = cp + wPrime * xs[i];
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = ssTot > 0 ? Math.round(Math.max(0, 1 - ssRes / ssTot) * 100) / 100 : 1;
  return { cp: Math.round(cp), wPrimeKj: Math.round((wPrime / 1000) * 10) / 10, r2, n };
}

// ─── Журнал полевых тестов (monthly AeT-контроль, Barsumyan responder) ───

export interface FieldTestLogEntry {
  date: string; // YYYY-MM-DD
  kind: 'lthr30' | 'ftp20' | 'aet60' | 'talk';
  driftPct?: number;
  decouplingPct?: number;
  lthr?: number;
  /** FTP в ваттах (для ftp20 — уже ×0.95 от средней 20'). */
  ftpWatts?: number;
  /** Потолок Z2 talk-test, уд/мин. */
  talkHr?: number;
}

export const FIELD_TEST_LOG_CAP = 24;

/** Чистое добавление замера в журнал (кап 24, сортировка по дате, дедуп по дате+kind). */
export function appendFieldTestLog(log: FieldTestLogEntry[], entry: FieldTestLogEntry): FieldTestLogEntry[] {
  if (!entry || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return log;
  const next = [...(Array.isArray(log) ? log : []).filter(e => !!e && typeof e.date === 'string'), entry]
    .filter((e, i, arr) => arr.findIndex(x => x.date === e.date && x.kind === e.kind) === i)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return next.slice(-FIELD_TEST_LOG_CAP);
}

/** Responder по двум последним AeT-замерам с drift+decoupling (делегирует в durability). */
export function responderFromLog(log: FieldTestLogEntry[]): { responder: boolean | null; note: string } {
  const withMetrics = (Array.isArray(log) ? log : []).filter(e => Number.isFinite(e.driftPct) && Number.isFinite(e.decouplingPct));
  if (withMetrics.length < 2) return { responder: null, note: 'Нужно ≥2 AeT-замеров 60\' с drift+decoupling для классификации.' };
  const prev = withMetrics[withMetrics.length - 2];
  const curr = withMetrics[withMetrics.length - 1];
  const driftBetter = (curr.driftPct as number) < (prev.driftPct as number);
  const decBetter = (curr.decouplingPct as number) < (prev.decouplingPct as number);
  if (driftBetter && decBetter) return { responder: true, note: `Responder (${prev.date} → ${curr.date}): drift и decoupling улучшились.` };
  if (!driftBetter && !decBetter) return { responder: false, note: `Non-responder (${prev.date} → ${curr.date}): проверьте восстановление/объём/железо.` };
  return { responder: false, note: 'Частичный отклик: повторите AeT-тест через 4 нед.' };
}

// ─── Персистентность журнала (localStorage, кап 24) ───

export const FIELD_TEST_LOG_KEY = 'he_cardio_field_tests_v1';

function isLogEntryShape(e: unknown): e is FieldTestLogEntry {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date)
    && (o.kind === 'lthr30' || o.kind === 'ftp20' || o.kind === 'aet60' || o.kind === 'talk');
}

/** Загрузить журнал полевых тестов (валидация формы, сортировка, кап). */
export function loadFieldTestLog(): FieldTestLogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(FIELD_TEST_LOG_KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return v.filter(isLogEntryShape).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-FIELD_TEST_LOG_CAP);
  } catch { return []; }
}

function persistFieldTestLog(log: FieldTestLogEntry[]): void {
  try { localStorage.setItem(FIELD_TEST_LOG_KEY, JSON.stringify(log.slice(-FIELD_TEST_LOG_CAP))); } catch { /* quota — тихо */ }
}

/** Сохранить замер (дедуп по дате+kind через appendFieldTestLog). Возвращает новый журнал. */
export function saveFieldTestLogEntry(entry: FieldTestLogEntry): FieldTestLogEntry[] {
  const next = appendFieldTestLog(loadFieldTestLog(), entry);
  persistFieldTestLog(next);
  return next;
}

/** Удалить замер по дате+kind. Возвращает новый журнал. */
export function removeFieldTestLogEntry(date: string, kind: FieldTestLogEntry['kind']): FieldTestLogEntry[] {
  const next = loadFieldTestLog().filter(e => !(e.date === date && e.kind === kind));
  persistFieldTestLog(next);
  return next;
}

/** Очистить журнал (сброс). */
export function clearFieldTestLog(): void {
  try { localStorage.removeItem(FIELD_TEST_LOG_KEY); } catch { /* ignore */ }
}

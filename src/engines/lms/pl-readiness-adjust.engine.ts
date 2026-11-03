/**
 * pl-readiness-adjust.engine.ts — утренний чек-ин → сегодняшняя тренировка (Фаза 6, п.6).
 *
 * ЧТО ЗДЕСЬ РЕШАЕТСЯ (и чего здесь намеренно НЕТ):
 *  • чек-ин меняет ТОЛЬКО сегодняшнюю сессию: объём подходов, RIR и (в красной
 *    зоне) вес на штанге. Структура недели/плана не переписывается — план остаётся
 *    тем, что обещал спортсмену, а не «пересобирается по самочувствию»;
 *  • чек-ин НИКОГДА не увеличивает нагрузку: хороший сон не даёт +веса. Прогрессию
 *    задаёт план, а не утро — иначе приложение начнёт «догонять» самочувствие и
 *    выведет атлета за MRV;
 *  • пороги — прозрачная эвристика (не медицинская диагностика), каждый штраф
 *    виден в `reasons`, чтобы пользователь мог не согласиться и выключить;
 *  • вчерашний чек-ин не действует сегодня: дата проверяется, иначе «красное»
 *    утро тянуло бы тренировки всю неделю.
 */
import { localIsoDate } from '../../core/local-date';

/** Ключ localStorage с последним чек-ином (аддитивный, читается только на «сегодня»). */
export const PL_CHECKIN_KEY = 'he_pl_checkin';

export interface PLMorningCheckin {
  /** Часов сна (0..14). */
  sleepHours: number;
  /** HRV сегодня / личная база; 1 = норма, 0.8 = на 20 % ниже базы. */
  hrvRatio: number;
  /** Мышечная боль 0..10 (0 = нет). */
  doms: number;
  /** Стресс 0..10 (0 = нет). */
  stress: number;
  /** Утренний вес, кг (опционально — падение веса = недоед/обезвоживание). */
  bodyWeightKg?: number;
  /** Обычный утренний вес, кг — база для оценки падения. */
  baselineWeightKg?: number;
}

export type PLReadinessLevel = 'green' | 'yellow' | 'red';

export interface PLReadinessVerdict {
  /** 0..100 — «сколько ресурса», не «сколько можно поднять». */
  score: number;
  level: PLReadinessLevel;
  /** Множитель ЧИСЛА рабочих подходов (≤ 1). */
  volumeMultiplier: number;
  /** Сдвиг RIR вверх (+1 = на повтор больше в запасе). */
  rirShift: number;
  /** Множитель веса (≤ 1). */
  loadMultiplier: number;
  /** Тренировка без отказа: RIR всех подходов ≥ 1. */
  noFailure: boolean;
  /** Построчные причины штрафа — чтобы решение было объяснимым. */
  reasons: string[];
  /** Что чек-ин НЕ делает (честность для UI). */
  notes: string[];
  summary: string;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

/**
 * Оценка готовности на сегодня. Возвращает готовые модификаторы сессии.
 *
 * Пороги (штрафы к 100):
 *  • сон < 6 ч −25, 6–7 ч −12; HRV < 0.80 −25, 0.80–0.90 −12;
 *  • боль/стресс: −3 за балл выше 3;
 *  • падение веса > 1.5 % от базы −10, > 2.5 % −20.
 * Зоны: ≥ 80 зелёная, 55–79 жёлтая, < 55 красная.
 */
export function evaluatePLReadiness(checkin: PLMorningCheckin): PLReadinessVerdict {
  const sleepHours = clamp(checkin.sleepHours, 0, 14);
  const hrvRatio = clamp(checkin.hrvRatio, 0.3, 3);
  const doms = clamp(checkin.doms, 0, 10);
  const stress = clamp(checkin.stress, 0, 10);

  const reasons: string[] = [];
  let score = 100;

  if (sleepHours < 6) { score -= 25; reasons.push(`Сон ${sleepHours.toFixed(1)} ч < 6 ч (−25)`); }
  else if (sleepHours < 7) { score -= 12; reasons.push(`Сон ${sleepHours.toFixed(1)} ч < 7 ч (−12)`); }

  if (hrvRatio < 0.8) { score -= 25; reasons.push(`HRV ${Math.round(hrvRatio * 100)} % от базы < 80 % (−25)`); }
  else if (hrvRatio < 0.9) { score -= 12; reasons.push(`HRV ${Math.round(hrvRatio * 100)} % от базы < 90 % (−12)`); }

  if (doms > 3) { const p = (doms - 3) * 3; score -= p; reasons.push(`Мышечная боль ${doms}/10 (−${p})`); }
  if (stress > 3) { const p = (stress - 3) * 3; score -= p; reasons.push(`Стресс ${stress}/10 (−${p})`); }

  const bw = checkin.bodyWeightKg;
  const base = checkin.baselineWeightKg;
  let dropPct = 0;
  if (Number.isFinite(bw) && Number.isFinite(base) && (base as number) > 0 && (bw as number) > 0) {
    dropPct = Math.max(0, ((base as number) - (bw as number)) / (base as number)) * 100;
    if (dropPct > 2.5) { score -= 20; reasons.push(`Вес ниже базы на ${dropPct.toFixed(1)} % > 2.5 % (−20)`); }
    else if (dropPct > 1.5) { score -= 10; reasons.push(`Вес ниже базы на ${dropPct.toFixed(1)} % (−10)`); }
  }

  score = Math.round(Math.min(100, Math.max(0, score)));
  const level: PLReadinessLevel = score >= 80 ? 'green' : score >= 55 ? 'yellow' : 'red';

  const notes: string[] = [
    'Чек-ин не поднимает нагрузку: веса растут по прогрессии плана, а не по хорошему сну.',
    'Меняется только сегодняшняя тренировка — структура недели в плане остаётся прежней.',
    'Это ориентир по самочувствию, а не медицинская оценка: при плохом самочувствии лучше снизить нагрузку, чем «дотерпеть».',
  ];
  if (dropPct > 2.5) {
    notes.push('Резкое падение веса — часто обезвоживание/недоед. Проверьте питьё и калории до тренировки; на сгонке к категории чек-ин не заменяет протокол восстановления.');
  }

  const summary = level === 'green'
    ? `Готовность ${score}/100 — зелёная зона: тренировка по плану без изменений.`
    : level === 'yellow'
      ? `Готовность ${score}/100 — жёлтая зона: объём ×${0.85.toFixed(2)}, RIR +1 (на повтор легче).`
      : `Готовность ${score}/100 — красная зона: объём ×${0.6.toFixed(2)}, вес ×${0.95.toFixed(2)}, RIR +2, без отказа.`;

  return {
    score,
    level,
    volumeMultiplier: level === 'green' ? 1 : level === 'yellow' ? 0.85 : 0.6,
    rirShift: level === 'green' ? 0 : level === 'yellow' ? 1 : 2,
    loadMultiplier: level === 'green' ? 1 : level === 'yellow' ? 1 : 0.95,
    noFailure: level === 'red',
    reasons,
    notes,
    summary,
  };
}

export interface PLAdjustableSet {
  weight: number;
  reps: number;
  rir: number;
}

const roundPlate = (w: number): number => Math.round(w / 2.5) * 2.5;

/**
 * Подходы с учётом готовности. Зелёная зона → тот же массив (identity, без копий).
 * Инварианты: вес не растёт, подходов не становится больше, RIR не уменьшается.
 */
export function adjustSetsForReadiness<T extends PLAdjustableSet>(sets: T[], verdict: PLReadinessVerdict): T[] {
  if (!Array.isArray(sets) || sets.length === 0) return sets;
  if (verdict.level === 'green') return sets;

  const keep = Math.max(1, Math.round(sets.length * verdict.volumeMultiplier));
  // Убираем С КОНЦА: в PL последние подходы — дожимы/бэкоффы, первые (топ-сет) важнее.
  const kept = sets.slice(0, keep);

  return kept.map(s => {
    const scaled = verdict.loadMultiplier === 1 ? s.weight : roundPlate(s.weight * verdict.loadMultiplier);
    const weight = Math.min(s.weight, Math.max(0, scaled));
    const rirRaw = (Number.isFinite(s.rir) ? s.rir : 2) + verdict.rirShift;
    const rir = Math.min(6, Math.max(verdict.noFailure ? 1 : 0, rirRaw));
    return { ...s, weight, rir };
  });
}

/**
 * День тренировки с учётом готовности (для плеера). Зелёная зона → тот же массив.
 * Работает по форме `{ targetSets }`, чтобы не тянуть UI-типы в движок.
 */
export function applyReadinessToDay<T extends { targetSets: PLAdjustableSet[] }>(
  exercises: T[],
  verdict: PLReadinessVerdict,
): T[] {
  if (!Array.isArray(exercises) || verdict.level === 'green') return exercises;
  return exercises.map(ex => ({ ...ex, targetSets: adjustSetsForReadiness(ex.targetSets ?? [], verdict) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Хранение: только «сегодняшний» чек-ин имеет силу.
// ─────────────────────────────────────────────────────────────────────────────

type CheckinStorage = { getItem: (k: string) => string | null; setItem?: (k: string, v: string) => void; removeItem?: (k: string) => void };

export interface PLStoredCheckin {
  date: string;
  checkin: PLMorningCheckin;
  verdict: PLReadinessVerdict;
}

/** Прочитать чек-ин, если он за СЕГОДНЯ. Иначе null (вчерашний не действует). */
export function readPLCheckin(storage: CheckinStorage | null | undefined, today: string = localIsoDate()): PLStoredCheckin | null {
  if (!storage) return null;
  let raw: string | null = null;
  try { raw = storage.getItem(PL_CHECKIN_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PLStoredCheckin>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.date !== today) return null;
    if (!parsed.checkin || typeof parsed.checkin !== 'object') return null;
    // Вердикт пересчитываем из чек-ина: сохранённый мог быть от старой версии порогов.
    return { date: today, checkin: parsed.checkin as PLMorningCheckin, verdict: evaluatePLReadiness(parsed.checkin as PLMorningCheckin) };
  } catch { return null; }
}

/** Сохранить чек-ин на дату (по умолчанию — сегодня). */
export function writePLCheckin(
  storage: CheckinStorage | null | undefined,
  checkin: PLMorningCheckin,
  today: string = localIsoDate(),
): PLStoredCheckin | null {
  if (!storage || typeof storage.setItem !== 'function') return null;
  const verdict = evaluatePLReadiness(checkin);
  const record: PLStoredCheckin = { date: today, checkin, verdict };
  try { storage.setItem(PL_CHECKIN_KEY, JSON.stringify(record)); } catch { return null; }
  return record;
}

/** Убрать чек-ин (тренировка снова идёт по плану). */
export function clearPLCheckin(storage: CheckinStorage | null | undefined): void {
  if (!storage || typeof storage.removeItem !== 'function') return;
  try { storage.removeItem(PL_CHECKIN_KEY); } catch { /* ignore */ }
}

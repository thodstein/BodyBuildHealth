/**
 * bb-frequency.ts — ЕДИНЫЙ источник «частота мышцы по ФАКТУ плана».
 *
 * Зачем (итерация K, аудит «обещание = факт»): строка плана
 * «Частота на группу/нед: …» считалась по РАСПИСАНИЮ сплита
 * (`musclesForTag(sessionTag)` в bb-builder) и потому обещала то, чего в плане
 * нет. Замер на матрице 512 планов: 928 расхождений — например `fullbody_3`
 * новичок обещал `biceps=3×`, а прямой работы на бицепс в неделе одна сессия
 * (компаундные тяги дают косвенную нагрузку, прямой сет — нет).
 *
 * Здесь модель «сессия даёт мышце работу», совпадающая с объёмной моделью
 * (`aggregateBBVolume` -> directSets) и с диагностикой недели
 * (`bb-quality-weekly.sessionsWithMuscle`):
 *  - прямые сеты по мышце в сессии (после реклассификации имён: 'shoulders'
 *    раскладывается на пучки delt_*, поэтому)
 *  - пучок delt_X засчитывается и по неклассифицированному остатку 'shoulders',
 *  - ключ 'shoulders' засчитывается по любому из пучков (обратная симметрия),
 *  - сырой тег упражнения — последний фолбэк, если объёмный агрегат молчит.
 *
 * Модуль намеренно НЕ импортирует ни builder, ни specialization: иначе получаем
 * цикл импортов (specialization -> builder). Всё, что нужно, — bb-volume.
 */
import { aggregateBBVolume } from './bb-volume.engine';

/** Префикс строки в `plan.rationale`. Один и тот же при записи и сверке. */
export const FREQUENCY_LINE_PREFIX = 'Частота на группу/нед';

const DELT_BUNDLES = ['delt_front', 'delt_mid', 'delt_rear'] as const;

/** Канонизация алиасов (`chest_upper` -> `chest`). Инжектится вызывающим:
 *  таблица алиасов живёт в bb-builder (`WEAK_TO_MUSCLE`), а импортировать её
 *  сюда нельзя — получим цикл builder -> bb-frequency -> builder. */
export type CanonicalFn = (muscle: string) => string;

/** Сессия даёт мышце ПРЯМУЮ работу? */
export function sessionHasDirectWork(session: any, muscle: string, canonical?: CanonicalFn): boolean {
  const m = String(muscle || '');
  if (!m) return false;
  try {
    const agg = aggregateBBVolume([session]) as Record<string, any>;
    if ((agg[m]?.directSets || 0) > 0) return true;
    if (m === 'shoulders') {
      // Обратная симметрия: 'shoulders' — это сумма пучков (иначе ключ
      // 'shoulders' всегда давал 0 после реклассификации).
      for (const b of DELT_BUNDLES) if ((agg[b]?.directSets || 0) > 0) return true;
    } else if ((DELT_BUNDLES as readonly string[]).includes(m)) {
      // Пучку засчитывается неклассифицированный остаток 'shoulders'.
      if ((agg['shoulders']?.directSets || 0) > 0) return true;
    }
  } catch { /* нет данных — идём в фолбэки */ }
  const keys = new Set<string>(((session?.exercises || []) as any[]).map((e) => String(e?.muscle || '')));
  if (keys.has(m)) return true;
  if (m === 'shoulders') return DELT_BUNDLES.some((b) => keys.has(b));
  // Последний фолбэк — канонизация алиасов: упражнение может быть помечено
  // `chest_upper`, а спрашивают про `chest`.
  if (canonical) {
    const cm = canonical(m);
    if (cm !== m) return keys.has(cm);
    for (const k of keys) if (canonical(k) === cm) return true;
  }
  return false;
}

/** Сколько сессий недели дают мышце прямую работу. */
export function sessionsWithMuscleInWeek(week: any, muscle: string, canonical?: CanonicalFn): number {
  let n = 0;
  for (const s of (week?.sessions || []) as any[]) if (sessionHasDirectWork(s, muscle, canonical)) n++;
  return n;
}

/** Неделя считается «рабочей» для утверждения о частоте (делод/тейпер/пик —
 *  намеренно меньше объёма и не должны занижать обещание). */
export function isFrequencyCountingWeek(week: any): boolean {
  const w: any = week || {};
  if (w.phase === 'deload' || w.deload === true) return false;
  if (w.taperApplied === true || w.taper === true) return false;
  if (w.prepProtocol || w.contestPhase || w.peakWeek) return false;
  return true;
}

export interface MuscleFrequencyFact {
  muscle: string;
  /** Минимум/максимум по рабочим неделям — план может менять акцент по неделям. */
  min: number;
  max: number;
  /** Факт по неделям (только рабочие недели, в порядке плана). */
  perWeek: number[];
}

/**
 * Факт частоты по мышцам плана.
 * `muscles` — какие ключи интересуют (по умолчанию: заявленные планом ключи
 * `muscleFrequency` + `volumeTargets`, чтобы пустое значение было видно как 0×).
 */
export function weeklyFrequencyFacts(
  plan: any,
  opts: { muscles?: string[]; canonical?: CanonicalFn } = {},
): { facts: Record<string, MuscleFrequencyFact>; weeksCounted: number } {
  const weeks = ((plan?.weeks || []) as any[]).filter(isFrequencyCountingWeek);
  const keys = new Set<string>(opts.muscles || []);
  if (!opts.muscles) {
    for (const k of Object.keys(plan?.muscleFrequency || {})) keys.add(k);
    for (const k of Object.keys(plan?.volumeTargets || {})) keys.add(k);
  }
  const facts: Record<string, MuscleFrequencyFact> = {};
  for (const m of keys) {
    const perWeek = weeks.map((w) => sessionsWithMuscleInWeek(w, m, opts.canonical));
    facts[m] = {
      muscle: m,
      min: perWeek.length ? Math.min(...perWeek) : 0,
      max: perWeek.length ? Math.max(...perWeek) : 0,
      perWeek,
    };
  }
  return { facts, weeksCounted: weeks.length };
}

/** `biceps=1-2×` (акцент меняется по неделям) / `chest=2×` (стабильно). */
export function formatFrequencyClaim(facts: Record<string, MuscleFrequencyFact>, order?: string[]): string {
  const keys = order && order.length ? order.filter((k) => facts[k]) : Object.keys(facts);
  const extra = Object.keys(facts).filter((k) => !keys.includes(k)).sort();
  return [...keys, ...extra]
    .map((k) => {
      const f = facts[k];
      return f.min === f.max ? `${k}=${f.max}×` : `${k}=${f.min}-${f.max}×`;
    })
    .join(', ');
}

/**
 * Сверка утверждения о частоте с фактом: строка переписывается (или
 * добавляется), повторный вызов НЕ создаёт дубля — идемпотентность держится на
 * поиске по префиксу.
 *
 * Возвращает, что изменилось (для заметки в rationale/теста).
 */
export function reconcileFrequencyClaim(
  plan: any,
  opts: { canonical?: CanonicalFn } = {},
): {
  changed: boolean;
  factLine: string;
  facts: Record<string, MuscleFrequencyFact>;
  /** Плановая (по расписанию сплита) частота выше фактической. */
  lowerThanPlanned: Array<{ muscle: string; planned: number; factMax: number }>;
} {
  const planned = (plan?.muscleFrequency || {}) as Record<string, number>;
  const { facts, weeksCounted } = weeklyFrequencyFacts(plan, { canonical: opts.canonical });
  if (weeksCounted === 0) return { changed: false, factLine: '', facts, lowerThanPlanned: [] };
  const order = Object.keys(planned);
  const claim = formatFrequencyClaim(facts, order);
  if (!claim) return { changed: false, factLine: '', facts, lowerThanPlanned: [] };
  const line = `${FREQUENCY_LINE_PREFIX} (факт): ${claim}`;
  const rationale: string[] = Array.isArray(plan?.rationale) ? plan.rationale : [];
  const idx = rationale.findIndex((r) => String(r).startsWith(FREQUENCY_LINE_PREFIX));
  const changed = idx === -1 || rationale[idx] !== line;
  if (idx === -1) rationale.push(line);
  else rationale[idx] = line;
  plan.rationale = rationale;
  const lowerThanPlanned = Object.entries(planned)
    .map(([muscle, p]) => ({ muscle, planned: Number(p) || 0, factMax: facts[muscle]?.max ?? 0 }))
    .filter((x) => x.planned > x.factMax);
  return { changed, factLine: line, facts, lowerThanPlanned };
}

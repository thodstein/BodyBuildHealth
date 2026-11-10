/**
 * tz-snapshot.ts — единый контракт снапшота входа механизм-модели.
 *
 * Зачем: калькулятор поддержки клал `he_calc_tz_input` в localStorage прямо
 * во время рендера (`useMemo`), без привязки к составу курса. Вкладка «Риски»
 * 24 часа предпочитала снапшот живым данным — и после изменения курса
 * показывала СТАРЫЙ набор препаратов (P0 аудита 2026-11).
 *
 * Теперь у снапшота есть `sig` — подпись состава курса (id + доза + неделя).
 * Если подпись не совпадает с текущим курсом, снапшот игнорируется.
 * Снапшоты без `sig` (старый формат) принимаются — обратная совместимость.
 */
import type { TzSpecInput } from './risk-engine-tz-spec';
import { resolvePedAlias } from '../data/ped-alias-map';

export const TZ_INPUT_KEY = 'he_calc_tz_input';
export const SUPPORT_RISK_KEY = 'he_support_risk';
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export interface DrugSignatureEntry {
  /** id препарата в любой системе именования (канонизируется внутри). */
  id: string;
  /** доза (мг/нед для ААС, МЕ/сут для GH, Ед/сут для инсулина, мкг для клена/T3). */
  dose: number;
}

/**
 * Подпись состава курса: порядок не важен, дубли не влияют.
 * Намеренно БЕЗ недели/фазы: цель — отсечь снапшот от ДРУГОГО набора
 * препаратов, а не от того же курса на другой неделе.
 */
export function courseSignature(drugs: DrugSignatureEntry[]): string {
  const normalized = [...new Set(drugs
    .map((d) => `${resolvePedAlias(String(d.id || ''))}:${Math.round((Number(d.dose) || 0) * 100) / 100}`)
    .filter((s) => !s.startsWith(':')))];
  return normalized.sort().join('|');
}

export interface CalcSnapshot {
  input: TzSpecInput;
  ts: number;
  sig?: string;
}

/** Записать снапшот. Безопасно в SSR/тестах без localStorage. */
export function writeCalcSnapshot(input: TzSpecInput, sig: string): void {
  try {
    localStorage.setItem(TZ_INPUT_KEY, JSON.stringify({ input, ts: Date.now(), sig }));
  } catch {
    /* storage недоступен — не критично */
  }
}

/**
 * Прочитать снапшот.
 * @param expectedSig — подпись текущего курса; при несовпадении снапшот отвергается.
 */
export function readCalcSnapshot(expectedSig?: string): TzSpecInput | null {
  try {
    const raw = localStorage.getItem(TZ_INPUT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<CalcSnapshot>;
    if (!d?.input) return null;
    if (Date.now() - (d.ts || 0) > SNAPSHOT_TTL_MS) return null;
    // Старый формат (без sig) — принимаем; новый — только при совпадении курса.
    if (d.sig && expectedSig && d.sig !== expectedSig) return null;
    return d.input as TzSpecInput;
  } catch {
    return null;
  }
}

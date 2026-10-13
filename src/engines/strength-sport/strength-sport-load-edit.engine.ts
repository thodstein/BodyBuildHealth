/**
 * strength-sport-load-edit.engine.ts — честный пересчёт % ПМ при правке веса в плане.
 *
 * ЗАЧЕМ (аудит 2026-10): `StrengthSportConstructor.updateEx` пересчитывал `pct`
 * по ЦЕПОЧКЕ ДОГАДОК «id упражнения → чей максимум взять базой»:
 *   log_press/axle_press попадали в ветку `overheadPress || bench || logPress || 60`
 *   — то есть жим лёжа мог стать базой для жима лога;
 *   акссессуары (махи, икры, предплечья) не матчились ни одной веткой → base=100,
 *   и мах 25 кг честно получал «25% ПМ»;
 *   потолка не было вообще: правка веса могла выдать 143% (program-store валидирует
 *   коридор 30–110% и ругается PCT_RANGE), т.е. правка рвала экспорт в ручной режим.
 *
 * А `updateSet` (правка ОДНОГО подхода) не пересчитывал pct вовсе — после смены
 * веса подход продолжал заявлять старый процент.
 *
 * ФИКС: база берётся НЕ из догадки про максимум, а ОТНОСИТЕЛЬНО собственной строки
 * (её текущий вес / её текущий %). Для планов, собранных билдером, это восстанавливает
 * ровно ту базу, которую использовал билдер (округление до 2.5 кг даёт ±1 п.п.),
 * поэтому для основных движений цифры совпадают со старыми, а для случаев, где
 * цепочка врала (лог ← жим лёжа, махи ← 100), результат становится верным.
 * Нет базовой пары (вес/%) — pct остаётся как был: честное «не оценивается»,
 * а не выдуманный процент. Значение клампится в коридор продукта 30–110%, иначе
 * правка рвала бы валидацию экспорта.
 */

import type { StrengthSportSet } from './strength-sport.types';

/** Коридор % ПМ, в котором продукт умеет работать (паритет program-store PCT_RANGE). */
export const PCT_MIN = 30;
export const PCT_MAX = 110;

/** Корректный процент для оценок/валидаторов (program-store: 0.3–1.1 доли = 30–110%). */
export function isSanePct(pct: number | undefined | null): pct is number {
  return typeof pct === 'number' && Number.isFinite(pct) && pct >= PCT_MIN && pct <= PCT_MAX;
}

interface Anchor { weight: number; pct: number }

/**
 * База для относительного пересчёта: первая строка с осмысленным % и весом.
 * Для лестницы (разные % по подходам) берётся первый подходящий — этого достаточно,
 * чтобы сохранить КРИВУЮ нагрузки плана, а не абсолютный максимум атлета.
 */
export function pctAnchorOf(sets: Array<Pick<StrengthSportSet, 'weight' | 'pct'>> | undefined): Anchor | null {
  if (!Array.isArray(sets)) return null;
  for (const s of sets) {
    if (isSanePct(s.pct) && typeof s.weight === 'number' && s.weight > 0) {
      return { weight: s.weight, pct: s.pct };
    }
  }
  return null;
}

/**
 * % ПМ для нового веса. `undefined` = оценивать нечем (не выдумываем).
 * Клампится в [PCT_MIN, PCT_MAX] — иначе правка рвёт валидацию экспорта.
 * Якорь валидируется ЗДЕСЬ тоже (а не только на входе UI): вызов с нереалистичным
 * процентом должен дать «не оценивается», а не молча пересчитанное число.
 */
export function pctForEditedWeight(anchor: Anchor | null | undefined, newWeight: number): number | undefined {
  if (!anchor || !(newWeight > 0)) return undefined;
  if (!isSanePct(anchor.pct) || !(anchor.weight > 0)) return undefined;
  const base = anchor.weight / (anchor.pct / 100);
  if (!Number.isFinite(base) || base <= 0) return undefined;
  const raw = (newWeight / base) * 100;
  return Math.max(PCT_MIN, Math.min(PCT_MAX, Math.round(raw)));
}

/** Пересчёт % одного подхода после правки его веса (undefined = оставить как было). */
export function editedSetPct(set: Pick<StrengthSportSet, 'weight' | 'pct'> | undefined, newWeight: number): number | undefined {
  return pctForEditedWeight(pctAnchorOf(set ? [set] : []), newWeight);
}

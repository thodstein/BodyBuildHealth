/**
 * support-pairs.ts — мост ко ВТОРОМУ реестру взаимодействий (этап E4).
 *
 * В репозитории два реестра, и они не видели друг друга:
 *  - `drug-interactions.ts` (97 правил, severity block/warn/monitor) — читает движок
 *    плана (`checkInteractions` в `support-plan/engine.ts`);
 *  - `support-interactions-db.ts` (`INTERACTIONS_DB`, 265 записей: 98 INT_ + 167 DS_,
 *    type synergy/conflict/caution) — читают калькулятор взаимодействий,
 *    `biostack-safety`, `score-engine`, но не план.
 *
 * Этот адаптер отдаёт пары второго реестра для набора id плана. Правила:
 *  - оба конца обязаны быть в наборе: «висячий» партнёр — не конфликт стека;
 *  - id нормализуются `canonId` (план, lowercase) → `resolveInteractionId`
 *    (реестр, UPPERCASE); префикс `PHARMA_` считается необязательным, потому что
 *    реестр пишет и `TADALAFIL`, и `PHARMA_TADALAFIL`;
 *  - одна пара — одна запись: при дублях выигрывает более строгий тип
 *    (conflict > caution > synergy), затем severity (HIGH > MEDIUM > LOW).
 *    В реестре есть пары с противоположным смыслом, например
 *    `BERBERINE + METFORMIN` (caution и synergy) — молча брать первую нельзя.
 *  - класс-псевдонимы (`ANTICOAGULANTS`, `NITRATES`, …) НЕ разворачиваются:
 *    сопоставление «конкретный препарат → класс» — отдельная таблица, а
 *    угадывание здесь дало бы ложные пары. Классовые правила ведёт
 *    `drug-interactions.ts` (там `CLASS_MAP`), он и остаётся главным контуром.
 */
import { INTERACTIONS_DB, resolveInteractionId } from '../../data/support-interactions-db';
import { canonId } from './shared-constants';

export interface SupportDbPair {
  /** Канонический id пары (UPPERCASE реестра). */
  a: string;
  b: string;
  /** Те же концы в написании плана (lowercase, без `PHARMA_`) — ключи `safetyFlags`. */
  aId: string;
  bId: string;
  type: 'synergy' | 'conflict' | 'caution';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Текст эффекта из реестра — без доз и без новых чисел. */
  description: string;
  /** id записи реестра (для трассировки). */
  sourceId: string;
}

const SEVERITY_RANK: Record<SupportDbPair['severity'], number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const TYPE_RANK: Record<SupportDbPair['type'], number> = { synergy: 1, caution: 2, conflict: 3 };

/** Варианты написания id для реестра: `PHARMA_X` и `X` — один препарат. */
function registryKeys(id: string): string[] {
  const resolved = resolveInteractionId(canonId(id));
  const bare = resolved.replace(/^PHARMA_/, '');
  return [resolved, bare, 'PHARMA_' + bare];
}

/** `effect` в реестре часто код (`MINERAL_COMPETE`), а не фраза: для UI берём `notes`. */
function describe(item: { effect?: string; notes?: string }): string {
  const effect = String(item.effect || '').trim();
  const notes = String(item.notes || '').trim();
  if (notes && (!effect || /^[A-Z0-9_]+$/.test(effect))) return notes;
  return effect || notes;
}

/**
 * Пары второго реестра, где ОБА конца присутствуют в `ids`.
 * Порядок — по строгости (conflict/HIGH первыми), чтобы UI не переставлял.
 */
export function findSupportDbPairs(ids: string[]): SupportDbPair[] {
  if (!ids || ids.length < 2) return [];
  const present = new Set<string>();
  for (const id of ids) for (const key of registryKeys(id)) present.add(key);

  const byPair = new Map<string, SupportDbPair>();
  for (const item of INTERACTIONS_DB) {
    const aKeys = registryKeys(item.substanceA);
    const bKeys = registryKeys(item.substanceB);
    const a = aKeys.find((k) => present.has(k));
    const b = bKeys.find((k) => present.has(k));
    if (!a || !b || a === b) continue;
    const sorted = [a, b].sort();
    const key = sorted.join('|');
    const description = describe(item);
    const candidate: SupportDbPair = {
      a: sorted[0],
      b: sorted[1],
      aId: canonId(sorted[0].replace(/^PHARMA_/, '')),
      bId: canonId(sorted[1].replace(/^PHARMA_/, '')),
      type: item.type,
      severity: item.severity,
      description,
      sourceId: item.id,
    };
    const prev = byPair.get(key);
    if (
      !prev ||
      TYPE_RANK[candidate.type] > TYPE_RANK[prev.type] ||
      (TYPE_RANK[candidate.type] === TYPE_RANK[prev.type] &&
        SEVERITY_RANK[candidate.severity] > SEVERITY_RANK[prev.severity])
    ) {
      byPair.set(key, candidate);
    }
  }

  return [...byPair.values()].sort(
    (x, y) =>
      TYPE_RANK[y.type] - TYPE_RANK[x.type] ||
      SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity] ||
      x.a.localeCompare(y.a),
  );
}

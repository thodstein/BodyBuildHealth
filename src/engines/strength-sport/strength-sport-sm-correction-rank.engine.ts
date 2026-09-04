/**
 * strength-sport-sm-correction-rank.engine.ts — РАНЖИР КОРРЕКЦИЙ СТРОНГМЕНА топ-3 (SM PRO)
 *
 * Для SM-фазы возвращает топ-3 коррекции из SM_WEAKPOINT_CORRECTION с протоколом
 * (3×5 @intensityPct из SM_BIOMECH; carry 3×20м brace 2с) и честным скорингом:
 *  оборудование (+20 match / исключение при mismatch),
 *  мобильность (−15 при спросе голеностопа/плеча против ограничений),
 *  причина (+10 за соответствие: volume→база, technique→пауза/lap, mobility→низкий спрос,
 *  strength→тяги/приседы/hold, grip→хват tri-modal, fatigue→низкая цена усталости).
 * Parity с TA ta-correction-rank (топ-N + фильтры, без SFR — у SM intensityPct + distanceM).
 *
 * Чистый движок. Каталог читается defensively.
 */

import { SM_WEAKPOINT_CORRECTION, SM_BIOMECH, type SMWeakPoint } from './strength-sport-sm-biomechanics.engine';
import type { SMWeakCause } from './strength-sport-sm-weak-cause.engine';
import { TA_CATALOG_SUPPLEMENT } from '../../core/exercise-catalog-ta-supplement';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export interface SMCorrectionProtocol {
  sets: number;
  reps: number | string; // carry — '20м'
  pct: number;
  rir: number;
  tempo: string;
  restSeconds: number;
  distanceM?: number;
}

export interface SMCorrectionCandidate {
  id: string;
  name: string;
  protocol: SMCorrectionProtocol;
  rationale: string;
  score: number;
  cause: SMWeakCause | null;
}

/** Коррекции со спросом голеностопа (дефицит/глубокий сед/пикап). */
const SM_ANKLE_DEMAND = new Set([
  'deficit_pull',
  'pause_squat',
  'front_squat',
  'sandbag_carry',
  'yoke_walk',
  'duck_walk',
]);
/** Коррекции со спросом плеча/оверхеда. */
const SM_OVERHEAD_DEMAND = new Set(['push_press', 'pin_press', 'log_press', 'axle_press', 'viking_press', 'circus_db_press']);

interface CatInfo {
  name?: string;
  equipment?: string;
  difficulty?: string;
  fatigueCost?: number;
  type?: string;
}

function catalogLookup(id: string): CatInfo {
  try {
    const hit = (TA_CATALOG_SUPPLEMENT || []).find((e: unknown) => (e as { id?: string })?.id === id);
    if (hit)
      return {
        name: (hit as { name?: string }).name,
        equipment: (hit as { equipment?: string }).equipment,
        difficulty: (hit as { difficulty?: string }).difficulty,
        fatigueCost: (hit as { fatigueCost?: number }).fatigueCost,
        type: (hit as { type?: string }).type,
      };
  } catch { /* noop */ }
  try {
    const hit = (EXERCISE_CATALOG || []).find((e: unknown) => (e as { id?: string })?.id === id);
    if (hit)
      return {
        name: (hit as { name?: string }).name,
        equipment: (hit as { equipment?: string }).equipment,
        difficulty: (hit as { difficulty?: string }).difficulty,
        fatigueCost: (hit as { fatigueCost?: number }).fatigueCost,
        type: (hit as { type?: string }).type,
      };
  } catch { /* noop */ }
  return {};
}

function prettyName(id: string): string {
  return id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Извлечь id коррекции из строки вида 'Толчковый дип (jerk_dip)' → 'jerk_dip'. */
export function smCorrIdFromLabel(raw: string): string {
  const m = String(raw).match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  return String(raw).split(' ')[0].trim();
}

const SM_FALLBACK_BY_WP: Record<string, string> = {
  log_dip: 'jerk_dip',
  log_drive: 'push_press',
  log_lockout: 'pin_press',
  log_clean: 'rdl',
  yoke_pickup: 'pause_squat',
  yoke_walk: 'sandbag_carry',
  yoke_turn: 'side_plank',
  farmers_pickup: 'deadlift',
  farmers_carry: 'farmers_walk_heavy',
  farmers_grip: 'plate_pinch',
  stone_off_floor: 'deficit_pull',
  stone_lap: 'front_squat',
  stone_load: 'push_press',
  grip_support: 'plate_pinch',
  core_brace: 'sandbag_carry',
  conditioning: 'sled_push_sprint',
};

export interface SMRankOpts {
  level?: string;
  equipment?: string[];
  mobilityRestrictions?: string[];
  cause?: SMWeakCause | null;
}

export function rankCorrectionsForSM(wp: SMWeakPoint, opts: SMRankOpts = {}): SMCorrectionCandidate[] {
  const rawList = (SM_WEAKPOINT_CORRECTION as Record<string, string[]>)[wp] || [];
  const ids = rawList.map(smCorrIdFromLabel).filter((s) => s && !/[А-Яа-я]/.test(s));
  if (ids.length === 0 && SM_FALLBACK_BY_WP[wp]) ids.push(SM_FALLBACK_BY_WP[wp]);
  if (ids.length === 0) return [];
  const bio = (SM_BIOMECH as Record<string, { intensityPct?: number; label?: string; corrections?: string[] }>)[wp];
  const basePct = Math.round(((bio?.intensityPct ?? 0.7) as number) * 100);
  const mob = new Set((opts.mobilityRestrictions || []).map((s) => String(s).toLowerCase()));
  const eqFilter = (opts.equipment || []).map((s) => String(s).toLowerCase()).filter(Boolean);
  const out: SMCorrectionCandidate[] = [];
  const isCarryWp = wp === 'yoke_walk' || wp === 'farmers_carry' || wp === 'yoke_turn' || wp === 'core_brace';

  for (const id of ids) {
    const cat = catalogLookup(id);
    if (eqFilter.length > 0 && cat.equipment) {
      const need = String(cat.equipment).toLowerCase();
      if (need !== 'bodyweight' && !eqFilter.includes(need)) continue;
    }
    let score = 50;
    score += eqFilter.length > 0 ? 20 : 10;
    if (mob.has('ankle') && SM_ANKLE_DEMAND.has(id)) score -= 15;
    if (mob.has('shoulder') && SM_OVERHEAD_DEMAND.has(id)) score -= 15;
    if ((mob.has('hip') || mob.has('lower_back')) && (id.includes('deficit') || id.includes('deadlift'))) score -= 10;
    const cause = opts.cause ?? null;
    if (cause === 'volume' && cat.type === 'compound') score += 10;
    if (cause === 'technique' && /pause|lap|brace|hold|tempo/.test(id)) score += 10;
    if (cause === 'mobility' && !SM_ANKLE_DEMAND.has(id) && !SM_OVERHEAD_DEMAND.has(id)) score += 10;
    if (cause === 'strength' && /pull|squat|deadlift|press|hold|carry/.test(id)) score += 10;
    if (cause === 'grip' && /pinch|grip|hang|hold|hammer|fat/.test(id)) score += 10;
    if (cause === 'fatigue' && (cat.fatigueCost ?? 7) <= 6) score += 10;

    let sets = 3;
    let reps: number | string = isCarryWp || id.includes('carry') || id.includes('walk') ? '20м' : 5;
    let pct = basePct;
    if (cause === 'volume') sets = 4;
    else if (cause === 'strength') {
      sets = 4;
      if (typeof reps === 'number') reps = 4;
      pct = Math.min(90, basePct + 5);
    } else if (cause === 'mobility' || cause === 'fatigue') pct = Math.max(50, basePct - 5);
    const protocol: SMCorrectionProtocol = {
      sets,
      reps,
      pct,
      rir: 2,
      tempo: id.includes('squat') ? '3-1-1-0' : id.includes('carry') || id.includes('walk') ? 'brace 2с — walk' : '2-0-1-0',
      restSeconds: id.includes('carry') || id.includes('walk') ? 180 : 120,
      distanceM: typeof reps === 'string' ? 20 : undefined,
    };
    const rationale = `${bio?.label || wp}: ${cat.name || prettyName(id)} ${sets}×${reps} @${pct}% — ${cause ? `причина ${cause}` : 'техника фазы'}`;
    out.push({ id, name: cat.name || prettyName(id), protocol, rationale, score, cause });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3);
}

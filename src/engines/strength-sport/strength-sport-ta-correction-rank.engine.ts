/**
 * strength-sport-ta-correction-rank.engine.ts — РАНЖИР КОРРЕКЦИЙ ТА топ-3 (E3 PRO-v2)
 *
 * Для WL-фазы возвращает топ-3 коррекции из WL_WEAKPOINT_CORRECTION с протоколом
 * (3×5 @intensityPct из TA_BIOMECH) и честным скорингом:
 *  оборудование (+20 match / исключение при mismatch),
 *  мобильность (−15 при спросе голеностопа/плеча против ограничений),
 *  причина (+10 за соответствие: volume→база, technique→пауза/вис, mobility→низкий спрос,
 *  strength→тяги/приседы, fatigue→низкая цена усталости).
 * Parity с bb bb-correction-rank.engine.ts (топ-N + фильтры, без SFR — у ТА intensityPct).
 *
 * Чистый движок. Каталог читается defensively (id может отсутствовать — fallback по имени).
 */

import { WL_WEAKPOINT_CORRECTION, type WLWeakPoint } from './strength-sport-weakpoint';
import { TA_BIOMECH } from './strength-sport-biomechanics.engine';
import type { TAWeakCause } from './strength-sport-ta-weak-cause.engine';
import { TA_CATALOG_SUPPLEMENT } from '../../core/exercise-catalog-ta-supplement';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export interface TACorrectionProtocol {
  sets: number;
  reps: number;
  pct: number; // % ПМ движения
  rir: number;
  tempo: string;
  restSeconds: number;
}

export interface TACorrectionCandidate {
  id: string;
  name: string;
  protocol: TACorrectionProtocol;
  rationale: string;
  score: number;
  cause: TAWeakCause | null;
}

/** Коррекции со спросом голеностопа (дефицит/глубокий сед/пауза внизу). */
const ANKLE_DEMAND = new Set([
  'deficit_snatch', 'deficit_clean', 'deficit_pull', 'pause_squat', 'front_squat',
  'front_squat_clean_grip', 'overhead_squat_v2', 'pause_snatch', 'pause_clean', 'pause_pull',
  'pause_jerk', 'tempo_squat',
]);
/** Коррекции со спросом плеча/оверхеда. */
const OVERHEAD_DEMAND = new Set([
  'overhead_squat_v2', 'snatch_balance', 'behind_neck_jerk', 'push_press', 'push_jerk',
  'muscle_snatch', 'jerk_recovery',
]);

interface CatInfo { name?: string; equipment?: string; difficulty?: string; fatigueCost?: number; type?: string; }

function catalogLookup(id: string): CatInfo {
  try {
    const hit = (TA_CATALOG_SUPPLEMENT || []).find((e: any) => e?.id === id);
    if (hit) return { name: hit.name, equipment: (hit as any).equipment, difficulty: (hit as any).difficulty, fatigueCost: (hit as any).fatigueCost, type: (hit as any).type };
  } catch { /* noop */ }
  try {
    const hit = (EXERCISE_CATALOG || []).find((e: any) => e?.id === id);
    if (hit) return { name: (hit as any).name, equipment: (hit as any).equipment, difficulty: (hit as any).difficulty, fatigueCost: (hit as any).fatigueCost, type: (hit as any).type };
  } catch { /* noop */ }
  return {};
}

function prettyName(id: string): string {
  return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export interface TARankOpts {
  level?: string;
  equipment?: string[]; // фильтр зала; пусто = весь каталог
  mobilityRestrictions?: string[]; // ankle/hip/shoulder/lower_back
  cause?: TAWeakCause | null;
}

export function rankCorrectionsForTA(wp: WLWeakPoint, opts: TARankOpts = {}): TACorrectionCandidate[] {
  const corrIds = WL_WEAKPOINT_CORRECTION[wp];
  if (!corrIds || corrIds.length === 0) return [];
  const bio = TA_BIOMECH[wp];
  const basePct = Math.round((bio?.intensityPct ?? 0.7) * 100);
  const mob = new Set((opts.mobilityRestrictions || []).map(s => String(s).toLowerCase()));
  const eqFilter = (opts.equipment || []).map(s => String(s).toLowerCase()).filter(Boolean);
  const out: TACorrectionCandidate[] = [];

  for (const id of corrIds) {
    const cat = catalogLookup(id);
    // Оборудование: mismatch → исключение (кроме bodyweight/universal)
    if (eqFilter.length > 0 && cat.equipment) {
      const need = String(cat.equipment).toLowerCase();
      if (need !== 'bodyweight' && !eqFilter.includes(need)) continue;
    }
    let score = 50;
    score += eqFilter.length > 0 ? 20 : 10;
    // Мобильность
    if (mob.has('ankle') && ANKLE_DEMAND.has(id)) score -= 15;
    if (mob.has('shoulder') && OVERHEAD_DEMAND.has(id)) score -= 15;
    if ((mob.has('hip') || mob.has('lower_back')) && (id.includes('deficit') || id.includes('deadlift'))) score -= 10;
    // Причина
    const cause = opts.cause ?? null;
    if (cause === 'volume' && cat.type === 'compound') score += 10;
    if (cause === 'technique' && /pause|hang|block|tempo/.test(id)) score += 10;
    if (cause === 'mobility' && !ANKLE_DEMAND.has(id) && !OVERHEAD_DEMAND.has(id)) score += 10;
    if (cause === 'strength' && /pull|squat|deadlift|press/.test(id)) score += 10;
    if (cause === 'fatigue' && (cat.fatigueCost ?? 7) <= 6) score += 10;

    // Протокол по причине (база 3×5 @intensityPct — протокол инъекции)
    let sets = 3, reps = 5, pct = basePct;
    if (cause === 'volume') { sets = 4; }
    else if (cause === 'strength') { sets = 4; reps = 4; pct = Math.min(90, basePct + 5); }
    else if (cause === 'mobility' || cause === 'fatigue') { pct = Math.max(50, basePct - 5); }
    const protocol: TACorrectionProtocol = { sets, reps, pct, rir: 2, tempo: 'X-0-X-0', restSeconds: 120 };
    const rationale = `${bio?.label || wp}: ${cat.name || prettyName(id)} ${sets}×${reps} @${pct}% — ${cause ? `причина ${cause}` : 'техника фазы'}`;
    out.push({ id, name: cat.name || bio?.corrections?.find(c => String(c).toLowerCase().includes(id.split('_')[0])) || prettyName(id), protocol, rationale, score, cause });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3);
}

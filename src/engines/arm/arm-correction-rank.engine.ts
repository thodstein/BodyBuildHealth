/**
 * arm-correction-rank.engine.ts — ранжир коррекций топ-3 для мёртвой точки (E3 P0).
 * Parity: bb `rankCorrectionsForWeak` (оборудование/мобильность/асимметрия),
 * без SFR — вместо него intensityPct + table/static соответствие + причина.
 */
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { ARM_BIOMECH } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';
import { getArmExerciseById } from '../../core/exercise-catalog-arm';
import type { ArmWeakCause } from './arm-weak-cause.engine';

export interface ArmRankCtx {
  level?: string;
  equipment?: string[];
  mobilityRestrictions?: string[];
  cause?: ArmWeakCause;
  asymPct?: number | null;
  inPlanIds?: string[];
  /** P2: фаза срыва схватки setup/start/mid/pin (как armlift failurePoint). */
  failurePoint?: string | null;
  /** P1-движения: фаза схватки setup/readygo/start/mid/pin — бонус точке своей фазы. */
  matchPhase?: string | null;
}

export interface ArmRankedCorrection {
  id: string;
  name: string;
  score: number;
  reason: string;
}

const EQUIP_SYNONYMS: Record<string, string[]> = {
  cable: ['cable', 'block', 'блок'],
  dumbbell: ['dumbbell', 'гантель'],
  barbell: ['barbell', 'штанга'],
  band: ['band', 'резина', 'эспандер'],
  grip_tool: ['grip_tool', 'grip', 'хват'],
  bodyweight: ['bodyweight', 'свой вес'],
};

function equipmentOk(exEquip: string | undefined, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!exEquip) return true;
  const low = exEquip.toLowerCase();
  return allowed.some((a) => {
    const al = String(a).toLowerCase();
    if (low.includes(al) || al.includes(low)) return true;
    const syns = EQUIP_SYNONYMS[low] || [];
    return syns.some((s) => al.includes(s));
  });
}

function mobilityOk(exId: string, restrictions: string[] | undefined): boolean {
  if (!restrictions || restrictions.length === 0) return true;
  const low = exId.toLowerCase();
  const r = restrictions.map((s) => String(s).toLowerCase());
  if (r.includes('wrist') && (low.includes('wrist_curl') || low.includes('cup'))) return false;
  if (r.includes('elbow') && low.includes('side_press')) return false;
  if (r.includes('shoulder') && low.includes('side_press_table')) return false;
  return true;
}

export function rankCorrectionsForArm(point: ArmWeakPoint, ctx: ArmRankCtx = {}): ArmRankedCorrection[] {
  const corr = ARM_CORRECTIONS[point];
  const bio = ARM_BIOMECH[point];
  if (!corr) return [];
  const inPlan = new Set((ctx.inPlanIds || []).map((s) => String(s).toLowerCase()));
  const out: ArmRankedCorrection[] = [];
  for (const id of corr.exercises) {
    const cat = getArmExerciseById(id);
    const name = cat?.name || id;
    let score = 100;
    const reasons: string[] = [];
    // база: порядок в ARM_CORRECTIONS (топ-1 приоритет)
    const orderIdx = corr.exercises.indexOf(id);
    score -= orderIdx * 4;
    // оборудование
    if (!equipmentOk((cat as any)?.equipment, ctx.equipment)) {
      score -= 40;
      reasons.push('нет оборудования');
    }
    // мобильность
    if (!mobilityOk(id, ctx.mobilityRestrictions)) {
      score -= 30;
      reasons.push('мобильность');
    }
    // уже в плане — деприоритизация (не запрет: ротация допустима)
    if (inPlan.has(id.toLowerCase())) {
      score -= 12;
      reasons.push('уже в плане');
    }
    // причина: fatigue → iso/пульсы/ремень приоритет; strength → heavy/high-torque
    if (ctx.cause === 'fatigue' && /iso|hold|band|strap|pulse/i.test(id + ' ' + name)) {
      score += 8;
      reasons.push('щадящая при усталости');
    }
    if (ctx.cause === 'strength' && /high|heavy|cable|strap/i.test(id)) {
      score += 6;
      reasons.push('силовая');
    }
    if (ctx.cause === 'mobility' && /band|iso|hold/i.test(id)) {
      score += 6;
      reasons.push('мобильная');
    }
    // асимметрия → унилатеральные (гантель/одна рука в имени)
    if (ctx.asymPct != null && ctx.asymPct >= 7 && /dumbbell|one|single|одн/i.test(String((cat as any)?.equipment || '') + ' ' + name)) {
      score += 5;
      reasons.push('унилатеральная');
    }
    // table/static соответствие точке
    if (bio && /cup|pron|sup|back/.test(point) && /belt|strap|table/i.test(id)) {
      score += 3;
      reasons.push('специфика стола');
    }
    // P2+P6: фаза срыва — приоритет точке, чинящей фазу (fixesPhase канон §3.1)
    const fp = String(ctx.failurePoint || '').toLowerCase();
    const fixes = (corr as any).fixesPhase;
    if (fp && Array.isArray(fixes) && fixes.map(String).map((s: string) => s.toLowerCase()).includes(fp)) {
      score += 6;
      reasons.push('чинит фазу срыва');
    }
    // P1-движения: точка своей фазы схватки (без fixesPhase — по канону точек).
    // Локальная карта (без импорта match-phases — ранжир не тянет фазовый движок).
    const mp = String(ctx.matchPhase || '').toLowerCase();
    if (mp === 'setup' || mp === 'readygo' || mp === 'start' || mp === 'mid' || mp === 'pin') {
      const pointPhase: Record<string, string> = {
        contain_fingers: 'setup',
        cup_start: 'start', pron_open: 'start', rising_top: 'start', back_start: 'start',
        cup_hold: 'mid', pron_lock: 'mid', sup_cup: 'mid', sup_drag: 'mid',
        side_mid: 'mid', back_drag: 'mid',
        side_pin: 'pin',
      };
      if (pointPhase[point] === mp) {
        score += 4;
        reasons.push('точка слабой фазы');
      }
    }
    out.push({ id, name, score, reason: reasons.join(', ') || 'топ по точке' });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3);
}

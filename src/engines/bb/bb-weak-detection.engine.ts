/**
 * bb-weak-detection.engine.ts — ББ диагностика отстающих (3 источника, без дублей).
 * Чистые функции, не мутируют план/дневник.
 * Источники: объём-факт vs MEV/MAV, e1RM-тренд из дневника, окружности vs идеал Reeves.
 */
import { getVolumeLandmarks } from '../volume-landmarks.engine';
import { canonicalMuscle } from './bb-specialization.engine';
import { epley1RM } from '../e1rm';
import { trueMuscleOf } from '../movement-pattern';

export interface BBWeakCandidate {
  muscle: string; // канонический EN-ключ
  granular?: string; // гранулярная зона если есть (delt_mid и т.д.)
  reason: string;
  deltaPct: number; // отрицат = отставание
  source: 'volume' | 'e1rm' | 'circumf';
}

function normMuscleKey(m: string): string {
  return canonicalMuscle(String(m || '').toLowerCase().trim());
}

/** Reeves ideal (см) при росте 175см/70кг: грудь 114, плечи ширина 50, талия 76, бедро 60, биц 40, предплечье 32, голень 38, шея 40.
 *  Масштаб по росту: ideal * (height/175). Таблица Sandow/Reeves 5'9" 185lbs.
 */
const REEVES_BASE: Record<string, number> = {
  chest: 114,
  waist: 76,
  hips: 96,
  bicep: 40,
  forearm: 32,
  thigh: 60,
  calf: 38,
  neck: 40,
  shoulderWidth: 50,
};

export function idealReevesCircumference(measure: string, heightCm: number): number {
  const base = REEVES_BASE[measure] ?? 0;
  if (!base || !Number.isFinite(heightCm) || heightCm <= 0) return base;
  return Math.round(base * (heightCm / 175) * 10) / 10;
}

/** 1) Объём-факт vs ориентиры: fact < MEV или fact < 0.7*MAV while others >=MAV → кандидат */
export function detectBBWeakByVolume(
  fact: Record<string, { directSets?: number; effectiveSets?: number }>,
  level: string,
): BBWeakCandidate[] {
  const out: BBWeakCandidate[] = [];
  const muscles = Object.keys(fact);
  if (muscles.length === 0) return out;
  // средний факт других для проверки "while others >= MAV"
  const mavValues: Record<string, number> = {};
  for (const m of muscles) {
    const lm = getVolumeLandmarks(level, m);
    if (lm) mavValues[m] = lm.mav;
  }
  const othersMavAvg = (() => {
    const vals = Object.values(mavValues);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  })();
  const facts = muscles.map(m => fact[m]?.effectiveSets ?? fact[m]?.directSets ?? 0);
  const factAvg = facts.length ? facts.reduce((a, b) => a + b, 0) / facts.length : 0;
  const othersStrong = factAvg >= othersMavAvg * 0.85; // эвристика: средняя группа nær MAV

  for (const m of muscles) {
    const lm = getVolumeLandmarks(level, m);
    if (!lm) continue;
    const sets = fact[m]?.effectiveSets ?? fact[m]?.directSets ?? 0;
    if (sets < lm.mev) {
      const delta = lm.mev > 0 ? Math.round(((sets - lm.mev) / lm.mev) * 100) : -100;
      out.push({ muscle: normMuscleKey(m), reason: `Объём ${sets} < MEV ${lm.mev}`, deltaPct: delta, source: 'volume' });
    } else if (sets < lm.mav * 0.7) {
      // если другие в районе MAV — точно отстающая; иначе тоже кандидат но с пометкой
      const delta = Math.round(((sets - lm.mav) / lm.mav) * 100);
      const reason = othersStrong ? `Объём ${sets} < 70% MAV ${lm.mav} (другие ≥MAV)` : `Объём ${sets} < 70% MAV ${lm.mav}`;
      out.push({ muscle: normMuscleKey(m), reason, deltaPct: delta, source: 'volume' });
    }
  }
  // dedup по канонич
  const seen = new Set<string>();
  const dedup: BBWeakCandidate[] = [];
  for (const c of out) {
    const k = c.muscle;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(c);
  }
  return dedup.sort((a, b) => a.deltaPct - b.deltaPct);
}

/** 2) e1RM-тренд: окна 28д (old 4нед назад vs recent 7д) — как в weak-muscle-detection */
export function detectBBWeakByE1rm(
  sessions: Array<{ date: string; exercises: Array<{ exerciseName?: string; name?: string; muscleGroup?: string; muscle?: string; sets: Array<{ weightKg: number; reps: number; rir?: number }> }> }>,
): BBWeakCandidate[] {
  if (!Array.isArray(sessions) || sessions.length < 4) return [];
  const sorted = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const now = sorted[sorted.length - 1]?.date ? new Date(sorted[sorted.length - 1].date).getTime() : Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const recentFrom = now - 7 * DAY;
  const oldFrom = now - 35 * DAY;
  const oldTo = now - 28 * DAY;

  const byMuscleRecent: Record<string, number[]> = {};
  const byMuscleOld: Record<string, number[]> = {};
  const countRecent: Record<string, number> = {};

  for (const s of sorted) {
    const t = s.date ? new Date(s.date).getTime() : 0;
    if (!t) continue;
    const bucket = t >= recentFrom ? 'recent' : t >= oldFrom && t < oldTo ? 'old' : null;
    if (!bucket) continue;
    for (const ex of s.exercises || []) {
      const rawMuscle = (ex as any).muscleGroup || (ex as any).muscle || trueMuscleOf({ name: (ex as any).exerciseName || (ex as any).name || '', group: (ex as any).muscleGroup } as any) || '';
      const muscle = normMuscleKey(rawMuscle);
      if (!muscle) continue;
      // top e1RM этого упражнения в сессии
      let best = 0;
      for (const st of (ex.sets || []) as any[]) {
        const w = Number(st.weightKg ?? (st as any).weight ?? 0);
        const r = Number(st.reps ?? 0);
        if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) continue;
        const e1 = epley1RM(w, r);
        if (e1 > best) best = e1;
      }
      if (best <= 0) continue;
      if (bucket === 'recent') {
        if (!byMuscleRecent[muscle]) byMuscleRecent[muscle] = [];
        byMuscleRecent[muscle].push(best);
        countRecent[muscle] = (countRecent[muscle] || 0) + 1;
      } else {
        if (!byMuscleOld[muscle]) byMuscleOld[muscle] = [];
        byMuscleOld[muscle].push(best);
      }
    }
  }

  const out: BBWeakCandidate[] = [];
  for (const m of Object.keys(byMuscleRecent)) {
    const oldArr = byMuscleOld[m];
    const recArr = byMuscleRecent[m];
    if (!oldArr || oldArr.length === 0 || recArr.length === 0) continue;
    const oldMax = Math.max(...oldArr);
    const recMax = Math.max(...recArr);
    if (oldMax <= 0) continue;
    const deltaPct = Math.round(((recMax - oldMax) / oldMax) * 1000) / 10;
    if (deltaPct <= -5) {
      out.push({ muscle: m, reason: `e1RM ${recMax.toFixed(1)} vs ${oldMax.toFixed(1)} (${deltaPct}%) — падение`, deltaPct, source: 'e1rm' });
    } else if (deltaPct <= 1 && (countRecent[m] || 0) >= 2) {
      out.push({ muscle: m, reason: `e1RM плато ${deltaPct}% за 28д (≥2 сесс)`, deltaPct, source: 'e1rm' });
    }
  }
  return out.sort((a, b) => a.deltaPct - b.deltaPct);
}

/** 3) Окружности vs идеал Reeves: факт < идеал на ≥10% → weak */
export function detectBBWeakByCircumf(
  meas: Record<string, number | string>,
  heightCm: number,
): BBWeakCandidate[] {
  const out: BBWeakCandidate[] = [];
  const mapMuscleToMeas: Record<string, string[]> = {
    chest: ['chest'],
    back: ['chest'], // спина прокси через грудь (широчайшие)
    shoulders: ['shoulderWidth'],
    biceps: ['bicep', 'bicepL', 'bicepR'],
    triceps: ['bicep', 'bicepL', 'bicepR'],
    quads: ['thigh', 'thighL', 'thighR'],
    hamstrings: ['thigh', 'thighL', 'thighR'],
    glutes: ['hips'],
    calves: ['calf', 'calfL', 'calfR'],
    traps: ['neck'],
    forearms: ['forearm', 'forearmL', 'forearmR'],
  };
  for (const [muscle, keys] of Object.entries(mapMuscleToMeas)) {
    let fact: number | null = null;
    for (const k of keys) {
      const v = meas[k];
      const n = typeof v === 'string' ? parseFloat(v) : Number(v);
      if (Number.isFinite(n) && n > 0) { fact = n; break; }
      // среднее L/R
      if (k === 'bicep' && meas['bicepL'] != null && meas['bicepR'] != null) {
        const l = Number(meas['bicepL']), r = Number(meas['bicepR']);
        if (Number.isFinite(l) && Number.isFinite(r)) { fact = (l + r) / 2; break; }
      }
    }
    if (fact == null) continue;
    // для мышц без прямого идеала — пропустим
    const idealKey = keys[0];
    const ideal = idealReevesCircumference(idealKey, heightCm);
    if (!ideal) continue;
    const deltaPct = Math.round(((fact - ideal) / ideal) * 1000) / 10;
    if (deltaPct <= -10) {
      out.push({ muscle: normMuscleKey(muscle), reason: `Замер ${fact}см vs идеал Reeves ${ideal}см (${deltaPct}%)`, deltaPct, source: 'circumf' });
    }
  }
  const seen = new Set<string>();
  const dedup: BBWeakCandidate[] = [];
  for (const c of out) {
    if (seen.has(c.muscle)) continue;
    seen.add(c.muscle);
    dedup.push(c);
  }
  return dedup.sort((a, b) => a.deltaPct - b.deltaPct);
}

/** Merge 3 источников, приоритет volume > e1rm > circumf, dedup по канонике */
export function mergeBBWeakCandidates(
  a: BBWeakCandidate[],
  b: BBWeakCandidate[],
  c: BBWeakCandidate[],
): BBWeakCandidate[] {
  const all = [...a, ...b, ...c];
  const byMuscle = new Map<string, BBWeakCandidate>();
  for (const cand of all) {
    const key = cand.muscle;
    const prev = byMuscle.get(key);
    if (!prev) byMuscle.set(key, cand);
    else {
      // предпочитаем более отрицательный delta
      if (cand.deltaPct < prev.deltaPct) byMuscle.set(key, cand);
    }
  }
  return Array.from(byMuscle.values()).sort((x, y) => x.deltaPct - y.deltaPct);
}

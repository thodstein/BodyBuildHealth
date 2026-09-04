/**
 * strength-sport-sm-diary.engine.ts — per-exercise e1RM тренд для СТРОНГА (изолированно)
 * Аналогично strength-sport-diary.engine.ts, но ключи стронга: yoke/farmers/stone/log/axle/carry
 * Читает логи дневника и считает тренд 28д (recent 0-28 vs prev 28-56)
 */

export interface DiaryTrendSM {
  lift: string; // yoke | farmers | stone | log | carry | stone_load | grip
  changePct: number;
  recentMax: number;
  prevMax: number;
  plateau?: boolean;
}

function epley(weight: number, reps: number): number {
  if (reps > 5) reps = 5;
  return weight * (1 + reps / 30);
}
function brzycki(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  if (reps > 10) reps = 10;
  return weight * (36 / (37 - reps));
}

function liftKeyForSM(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('yoke')) return 'yoke';
  if (n.includes('farmers') || n.includes('фермер') || n.includes('frame_carry')) return 'farmers';
  if (n.includes('stone') || n.includes('камень') || n.includes('sandbag') || n.includes('lap')) return 'stone';
  if (n.includes('log') || n.includes('лог') || n.includes('axle') || n.includes('viking') || n.includes('circus')) return 'log';
  if (n.includes('carry') || n.includes('husafell') || n.includes('conan') || n.includes('shield') || n.includes('truck') || n.includes('sled')) return 'carry';
  if (n.includes('deadlift') || n.includes('тяга') || n.includes('car_deadlift')) return 'deadlift';
  if (n.includes('grip') || n.includes('хват') || n.includes('pinch')) return 'grip';
  return null;
}

export function buildDiaryTrendSM(logs: any[]): DiaryTrendSM[] | null {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const lifts = ['yoke', 'farmers', 'stone', 'log', 'carry', 'deadlift', 'grip'] as const;
  const out: DiaryTrendSM[] = [];
  for (const lift of lifts) {
    const recentVals: number[] = [];
    const prevVals: number[] = [];
    for (const e of logs) {
      const n: string = String(e.exerciseName || e.name || '').toLowerCase();
      const key = liftKeyForSM(n);
      if (key !== lift) continue;
      if (!Array.isArray(e.sets) || e.sets.length === 0) continue;
      const workSets = (e.sets as any[]).filter((s: any) => !s.isWarmup && Number(s.weight) > 0);
      if (workSets.length === 0) continue;
      const d = String(e.date || '');
      const t = new Date(d).getTime();
      if (!Number.isFinite(t)) continue;
      const maxE1 = Math.max(
        ...workSets.map((s: any) => {
          const w = Number(s.weight) || 0;
          const r = Number(s.reps) || 0;
          // carries: reps=1 distance-based — e1RM = weight (не формула)
          if (key === 'carry' || key === 'yoke' || key === 'farmers') return w;
          // stone/log: reps может быть 1-3 — epley
          return epley(w, r);
        }),
      );
      if (!maxE1 || maxE1 <= 0) continue;
      const diff = now - t;
      if (diff >= 0 && diff <= 28 * dayMs) recentVals.push(maxE1);
      else if (diff > 28 * dayMs && diff <= 56 * dayMs) prevVals.push(maxE1);
    }
    if (recentVals.length && prevVals.length) {
      const maxR = Math.max(...recentVals);
      const maxP = Math.max(...prevVals);
      if (maxP > 0) {
        const changePct = Math.round(((maxR - maxP) / maxP * 100) * 10) / 10;
        const isPlateau = Math.abs(changePct) < 2 && recentVals.length >= 3;
        out.push({ lift, changePct, recentMax: Math.round(maxR), prevMax: Math.round(maxP), plateau: isPlateau } as any);
      }
    }
  }
  return out.length ? out : null;
}

export function loadDiaryLogsSM(): any[] {
  try {
    for (const key of ['he_workout_log', 'he_training_log', 'he_workout_history', 'he_srpe_sessions']) {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {}
  return [];
}

export function getDiaryTrendSM(): DiaryTrendSM[] | null {
  const logs = loadDiaryLogsSM();
  return buildDiaryTrendSM(logs);
}

export function detectSMWeakFromDiary(logs: any[]): Array<{ lift: string; label: string; deltaPct: number }> {
  const trends = buildDiaryTrendSM(logs);
  if (!trends) return [];
  const out: Array<{ lift: string; label: string; deltaPct: number }> = [];
  for (const t of trends) {
    if (t.changePct < -5) out.push({ lift: t.lift, label: `${t.lift} ▼ ${t.changePct}%`, deltaPct: t.changePct });
    else if (Math.abs(t.changePct) < 2 && (t as any).plateau) out.push({ lift: t.lift, label: `${t.lift} плато ${t.changePct}%`, deltaPct: t.changePct });
  }
  return out;
}

/** LVP-e1RM для стронга: при наличии скорости — через LVP, иначе epley/вес (SM PRO). */
export function estimateSME1RM(weight: number, reps: number, velocity?: number | null, eventId?: string): number | null {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  try {
    if (velocity != null && Number.isFinite(velocity) && velocity > 0.15 && eventId) {
      // Динамический импорт избегаем — пробуем общий LVP-стор напрямую через localStorage-кэш
      const keys = ['he_lv_sm_v1', 'he_lv_profile_ss_v1'];
      for (const k of keys) {
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
          if (!raw) continue;
          const all = JSON.parse(raw) as Record<string, { intercept: number; slope: number; valid?: boolean }>;
          const liftKeys = [String(eventId).toLowerCase(), 'yoke_walk', 'farmers_walk', 'stone_load', 'log_press'];
          for (const lk of liftKeys) {
            const prof = all[lk];
            if (prof && Number.isFinite(prof.slope) && prof.slope < 0) {
              const pct = (velocity - prof.intercept) / prof.slope;
              if (Number.isFinite(pct) && pct > 0.3 && pct <= 1.05) return Math.round((weight / pct) * 10) / 10;
            }
          }
        } catch { /* noop */ }
      }
    }
  } catch { /* noop */ }
  const key = String(eventId || '').toLowerCase();
  // carries: e1RM = вес (дистанция-метрика, не формула)
  if (key.includes('carry') || key.includes('yoke') || key.includes('farmer')) return Math.round(weight * 10) / 10;
  // stone/log: только при reps ≤ 3, иначе пропуск (формула врёт на многоповторке)
  if ((key.includes('stone') || key.includes('log') || key.includes('sandbag')) && reps > 3) return null;
  const r = Math.min(reps || 1, 5);
  return Math.round(weight * (1 + r / 30) * 10) / 10;
}

// Кандидат слабых фаз по reps/весу (аналог TA candidateTAWeakPointsFromDiary)
export function candidateSMWeakPointsFromDiary(logs: any[], eventId: string): string[] {
  // Для стронга нет фаз по reps как в ТА, но можно эвристикой: если change < -5 → lap/pickup, если grip fail → grip
  const trends = buildDiaryTrendSM(logs);
  if (!trends) return [];
  const t = trends.find(x => x.lift === eventId || (eventId.includes('yoke') && x.lift === 'yoke') || (eventId.includes('stone') && x.lift === 'stone'));
  if (!t) return [];
  if (t.changePct < -5) {
    if (t.lift === 'stone') return ['stone_lap'];
    if (t.lift === 'yoke') return ['yoke_walk'];
    if (t.lift === 'farmers') return ['farmers_grip'];
    if (t.lift === 'log') return ['log_lockout'];
  }
  if ((t as any).plateau) return ['conditioning'];
  return [];
}

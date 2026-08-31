/**
 * combat-diary.engine.ts — per-group e1RM тренд для единоборств.
 * Для шеи/хвата e1RM считаем условно (вес × (1+reps/30)), для базы — как у strength.
 * Даёт тренд для мезоцикла + ACWR совместимость.
 */

export interface DiaryTrendCB {
  group: string; // neck | grip | legs | push | pull | rotational
  changePct: number;
  recentMax: number;
  prevMax: number;
}

function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

function groupForExercise(nameOrId: string): string | null {
  const n = nameOrId.toLowerCase();
  if (n.includes('neck')) return 'neck';
  if (n.includes('grip') || n.includes('pinch') || n.includes('wrist') || n.includes('farmer') || n.includes('towel') || n.includes('rope')) return 'grip';
  if (n.includes('squat') || n.includes('lunge') || n.includes('rdl') || n.includes('trap_bar') || n.includes('nordic') || n.includes('step_up')) return 'legs';
  if (n.includes('bench') || n.includes('ohp') || n.includes('push_press') || n.includes('landmine_press')) return 'push';
  if (n.includes('row') || n.includes('pullup') || n.includes('pull') || n.includes('face_pull')) return 'pull';
  if (n.includes('landmine') || n.includes('pallof') || n.includes('med_ball') || n.includes('sledge') || n.includes('battle')) return 'rotational';
  if (n.includes('deadbug') || n.includes('hollow') || n.includes('plank') || n.includes('ab_wheel')) return 'core';
  return null;
}

export function buildDiaryTrendCB(logs: any[]): DiaryTrendCB[] | null {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  const now = Date.now();
  const dayMs = 24 * 3600 * 1000;
  const groups = ['neck', 'grip', 'legs', 'push', 'pull', 'rotational'] as const;
  const out: DiaryTrendCB[] = [];
  for (const g of groups) {
    const recent: number[] = [];
    const prev: number[] = [];
    for (const e of logs) {
      const nid: string = String(e.exerciseId || e.exerciseName || e.name || '').toLowerCase();
      const key = groupForExercise(nid);
      if (key !== g) continue;
      if (!Array.isArray(e.sets) || e.sets.length === 0) continue;
      const d = String(e.date || '');
      const t = new Date(d).getTime();
      if (!Number.isFinite(t)) continue;
      const maxE1 = Math.max(...(e.sets as any[]).map((s: any) => {
        const w = Number(s.weight) || 0;
        const r = Number(s.reps) || 0;
        // для bodyweight (pullup) вес 0 → считаем по reps как тоннаж? пропускаем
        if (w === 0) return r; // условный объём
        return epley(w, r);
      }));
      if (!maxE1 || maxE1 <= 0) continue;
      const diff = now - t;
      if (diff >= 0 && diff <= 28 * dayMs) recent.push(maxE1);
      else if (diff > 28 * dayMs && diff <= 56 * dayMs) prev.push(maxE1);
    }
    if (recent.length && prev.length) {
      const maxR = Math.max(...recent);
      const maxP = Math.max(...prev);
      if (maxP > 0) {
        const changePct = Math.round(((maxR - maxP) / maxP * 100) * 10) / 10;
        out.push({ group: g, changePct, recentMax: Math.round(maxR), prevMax: Math.round(maxP) });
      }
    }
  }
  return out.length ? out : null;
}

export function loadDiaryLogsCB(): any[] {
  try {
    const keys = ['he_workout_log','he_training_log','he_workout_history','he_srpe_sessions','he_combined_log','he_strength_log','he_combat_log','he_training_log_v2'];
    for (const key of keys) {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        if (arr.length > 0 && typeof arr[0] === 'object') return arr;
      }
    }
    try {
      const idbMirror = typeof localStorage !== 'undefined' ? localStorage.getItem('he_idb_training_log') : null;
      if (idbMirror) {
        const arr = JSON.parse(idbMirror);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch {}
  } catch {}
  return [];
}

export async function loadDiaryLogsCBAsync(): Promise<any[]> {
  // Пробуем IndexedDB (реальный дневник силы — idb:training_log/workout_log), fallback на LS
  try {
    const { db } = await import('../../core/db');
    try { await db.init(); } catch {}
    const out: any[] = [];
    for (const store of ['training_log','workout_log'] as const) {
      try {
        const recs: any[] = await db.getAll(store);
        if (Array.isArray(recs) && recs.length) {
          for (const r of recs) {
            if (r?.exercises && Array.isArray(r.exercises)) {
              // workout session → разворачиваем каждое упражнение в отдельный лог-энтри
              for (const ex of r.exercises) {
                const sets = ex.sets || ex.workSets || [];
                if (!Array.isArray(sets) || sets.length===0) continue;
                out.push({ date: r.date, exerciseId: ex.id || ex.exerciseId, exerciseName: ex.name || ex.exerciseName, sets });
              }
            } else if (r?.exerciseId || r?.exerciseName) {
              // flat entry
              if (Array.isArray(r.sets) && r.sets.length) out.push(r);
            } else if (r?.date && r?.sets) {
              out.push(r);
            }
          }
        }
      } catch {}
    }
    if (out.length) return out;
  } catch {}
  return loadDiaryLogsCB();
}

export function getDiaryTrendCB(): DiaryTrendCB[] | null {
  const logs = loadDiaryLogsCB();
  return buildDiaryTrendCB(logs);
}

export async function getDiaryTrendCBAsync(): Promise<DiaryTrendCB[] | null> {
  const logs = await loadDiaryLogsCBAsync();
  return buildDiaryTrendCB(logs);
}

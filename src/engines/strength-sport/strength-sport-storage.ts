/**
 * strength-sport-storage.ts — сохранение планов ТА/стронг (изолированно).
 * Миграция v1→v3: старые планы без velocityHistory/distanceM/timeCapS/week.taper → добавляем поля.
 */
import type { StrengthSportPlan } from './strength-sport.types';

const KEY = 'he_strength_sport_plan_v1';
const LIST_KEY = 'he_strength_sport_plans_v1';
const MIGRATED_KEY = 'he_strength_sport_migrated_v3';

function migratePlan(p: any): any {
  if (!p || typeof p !== 'object') return p;
  // v1→v3: ensure inputSnapshot.velocityHistory exists
  if (!p.inputSnapshot) p.inputSnapshot = {};
  if (p.inputSnapshot.velocityHistory === undefined) p.inputSnapshot.velocityHistory = undefined;
  if (p.inputSnapshot.velocityLossPct === undefined) p.inputSnapshot.velocityLossPct = undefined;
  // ensure workSets have distanceM/timeCapS for carries
  if (Array.isArray(p.weeksData)) {
    for (const wk of p.weeksData) {
      if (wk.taper === undefined) wk.taper = false;
      if (wk.phase === undefined) wk.phase = 'accumulation';
      if (Array.isArray(wk.sessions)) for (const sess of wk.sessions) {
        if (Array.isArray(sess.exercises)) for (const ex of sess.exercises) {
          if (!Array.isArray(ex.workSets)) ex.workSets = [];
          for (const ws of ex.workSets) {
            if (ws.distanceM === undefined && ws.timeCapS === undefined) {
              // leave as is — non-carry
            }
            if (ws.pct === undefined) ws.pct = 0;
            if (ws.tempo === undefined) ws.tempo = ex.tempo || '2-0-1-0';
            if (ws.restSeconds === undefined) ws.restSeconds = ex.restSeconds || 120;
          }
          if (ex.sets !== ex.workSets.length) ex.sets = ex.workSets.length;
        }
      }
      if (wk.totalSets === undefined) wk.totalSets = wk.sessions.reduce((a:any,s:any)=> a + s.exercises.reduce((x:any,e:any)=> x + e.sets,0),0);
      if (wk.totalTonnage === undefined) wk.totalTonnage = wk.sessions.reduce((a:any,s:any)=> a + s.exercises.reduce((x:any,e:any)=> x + e.workSets.reduce((q:any,w:any)=> q + w.weight*w.reps,0),0),0);
    }
  }
  if (!Array.isArray(p.rationale)) p.rationale = [];
  if (!p.validation) p.validation = { ok:true, warnings:[], errors:[] };
  return p;
}

export function migrateStrengthSportStorage(): boolean {
  try {
    if (localStorage.getItem(MIGRATED_KEY) === 'v3') return false;
    let migrated = false;
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const m = migratePlan(p);
      if (JSON.stringify(m) !== raw) { localStorage.setItem(KEY, JSON.stringify(m)); migrated = true; }
    }
    const rawList = localStorage.getItem(LIST_KEY);
    if (rawList) {
      const arr = JSON.parse(rawList);
      if (Array.isArray(arr)) {
        const out = arr.map(migratePlan);
        if (JSON.stringify(out) !== rawList) { localStorage.setItem(LIST_KEY, JSON.stringify(out.slice(0,20))); migrated = true; }
      }
    }
    localStorage.setItem(MIGRATED_KEY, 'v3');
    return migrated;
  } catch { try{ localStorage.setItem(MIGRATED_KEY,'v3'); }catch{} return false; }
}

export function saveStrengthSportPlan(plan: StrengthSportPlan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
    const list: StrengthSportPlan[] = loadStrengthSportPlans();
    const idx = list.findIndex(p => p.id === plan.id);
    if (idx >= 0) list[idx] = plan;
    else list.unshift(plan);
    localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export function loadStrengthSportPlan(): StrengthSportPlan | null {
  try {
    migrateStrengthSportStorage();
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migratePlan(JSON.parse(raw)) as StrengthSportPlan;
  } catch { return null; }
}

export function loadStrengthSportPlans(): StrengthSportPlan[] {
  try {
    migrateStrengthSportStorage();
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(migratePlan) : [];
  } catch { return []; }
}

export function removeStrengthSportPlan(id: string): void {
  try {
    const list = loadStrengthSportPlans().filter(p => p.id !== id);
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    const cur = loadStrengthSportPlan();
    if (cur?.id === id) localStorage.removeItem(KEY);
  } catch {}
}

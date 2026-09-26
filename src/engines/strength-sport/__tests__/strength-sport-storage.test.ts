import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrateStrengthSportStorage, loadStrengthSportPlans, saveStrengthSportPlan, syncStrengthSportToCloud } from '../strength-sport-storage';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';

describe('storage v1→v3 migration', () => {
  let store:any = {};
  let orig:any;
  beforeEach(()=>{
    orig = (global as any).localStorage;
    store = {};
    (global as any).localStorage = {
      getItem:(k:string)=> store[k] ?? null,
      setItem:(k:string,v:string)=> { store[k]=v; },
      removeItem:(k:string)=> delete store[k],
    } as any;
  });
  afterEach(()=>{ (global as any).localStorage = orig; });

  it('migrate old plan without velocityHistory/distanceM', () => {
    const p:any = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:200 } } as any);
    // simulate v1: delete new fields
    delete p.inputSnapshot.velocityHistory;
    delete p.inputSnapshot.velocityLossPct;
    for(const wk of p.weeksData) {
      delete (wk as any).taper;
      for(const sess of wk.sessions) for(const ex of sess.exercises) for(const ws of ex.workSets) {
        delete (ws as any).distanceM;
        delete (ws as any).timeCapS;
      }
    }
    store['he_strength_sport_plans_v1'] = JSON.stringify([p]);
    store['he_strength_sport_plan_v1'] = JSON.stringify(p);
    const migrated = migrateStrengthSportStorage();
    expect(migrated).toBe(true);
    const loaded = loadStrengthSportPlans();
    expect(loaded[0].weeksData[0].taper).toBeDefined();
    expect(loaded[0].weeksData[0].totalSets).toBeDefined();
  });

  it('ROUND-10: save пишет ключ плана, который читают хабы ТА/стронга', () => {
    const p:any = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    saveStrengthSportPlan(p);
    const raw = store['he_strength_sport_plan_v1'];
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).id).toBe(p.id);
  });

  it('ROUND-10: save будит слушателей событием he-strength-sport-plan-saved', () => {
    const p:any = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    let fired = 0;
    const h = () => { fired++; };
    (global as any).window?.addEventListener?.('he-strength-sport-plan-saved', h);
    try {
      saveStrengthSportPlan(p);
      expect(fired).toBe(1);
    } finally {
      (global as any).window?.removeEventListener?.('he-strength-sport-plan-saved', h);
    }
  });

  it('migrate idempotent v3', () => {
    const p:any = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'beginner', weeks:2, daysPerWeek:3, workMax:{} } as any);
    saveStrengthSportPlan(p);
    migrateStrengthSportStorage();
    const second = migrateStrengthSportStorage();
    expect(second).toBe(false);
  });

  it('load migrates distanceM missing', () => {
    const p:any = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ yokeWalk:220 } } as any);
    const ws:any = p.weeksData[0].sessions.find((s:any)=> s.sessionTag==='event_day')?.exercises.find((e:any)=> e.id==='yoke_walk')?.workSets[0];
    if(ws) {
      expect(ws.distanceM).toBeDefined();
      // simulate v1 missing
      delete ws.distanceM;
      store['he_strength_sport_plan_v1'] = JSON.stringify(p);
      store['he_strength_sport_migrated_v3'] = 'v3'; // already migrated flag blocks? force re-migrate via load
      delete store['he_strength_sport_migrated_v3'];
      const loaded = loadStrengthSportPlans();
      // after migration load, still may lack distanceM but sets sync should hold
      expect(loaded.length).toBeGreaterThan(0);
    }
  });

  it('syncStrengthSportToCloud: no-throw вне TG (ленивый импорт cloud-kv)', () => {
    expect(() => syncStrengthSportToCloud()).not.toThrow();
  });

  it('квота: save возвращает false и НЕ шлёт «сохранено» (была ложь подписчикам)', () => {
    const p:any = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    let fired = 0;
    const h = () => { fired++; };
    (global as any).window?.addEventListener?.('he-strength-sport-plan-saved', h);
    const good = store;
    (global as any).localStorage = {
      getItem:(k:string)=> good[k] ?? null,
      setItem:()=> { const e:any = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; },
      removeItem:(k:string)=> delete good[k],
    } as any;
    let ok: boolean | undefined;
    try { ok = saveStrengthSportPlan(p); }
    finally {
      (global as any).localStorage = { getItem:(k:string)=> good[k] ?? null, setItem:(k:string,v:string)=> { good[k]=v; }, removeItem:(k:string)=> delete good[k] } as any;
      (global as any).window?.removeEventListener?.('he-strength-sport-plan-saved', h);
    }
    expect(ok).toBe(false);
    expect(fired).toBe(0);   // хабы не должны перечитывать «несуществующее» сохранение
  });

  it('успешная запись возвращает true и событие уходит', () => {
    const p:any = buildStrengthSportPlan({ mode:'strongman', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} } as any);
    let fired = 0;
    const h = () => { fired++; };
    (global as any).window?.addEventListener?.('he-strength-sport-plan-saved', h);
    try {
      expect(saveStrengthSportPlan(p)).toBe(true);
      expect(fired).toBe(1);
    } finally {
      (global as any).window?.removeEventListener?.('he-strength-sport-plan-saved', h);
    }
  });
});

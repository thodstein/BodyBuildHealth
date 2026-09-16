/**
 * bb-contest-prep-unified.test.ts — единый Тапер ББ: версионированный план как источник правды,
 * кросс-синхронизация ББ-авто ↔ питание, миграция legacy.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildBBContestPrepPlan,
  planFromStored,
  serializeBBPrepConfig,
  isoAddDays,
  isoToday,
  type BBContestPrepConfig,
} from '../bb-contest-prep.engine';
import {
  saveContestPrepEverywhere,
  clearContestPrepEverywhere,
  migrateLegacyContestPrepIfNeeded,
  CONTEST_PREP_UPDATED_EVENT,
} from '../bb-contest-prep-sync';
import { getProfile } from '../../../core/profile-manager';

/** Даты динамические: showDate в прошлом валидатор отклоняет («Дата шоу в прошлом»),
 *  хардкод-даты — тайм-бомба (тест падал после 15.09.2026). */
const future = (days: number) => isoAddDays(isoToday(), days);
const SHOW_DEFAULT = future(21);
const SHOW_CROSS = future(30);
const SHOW_PHASES = future(28);
const SHOW_MIGRATE = future(45);
const SHOW_EVENT = future(60);
const SHOW_COMPETITION = future(75);

function cfg(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  const base: BBContestPrepConfig = {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 82,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 1,
    showDate: SHOW_DEFAULT,
    weeksOut: 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
  };
  return { ...base, ...over };
}

describe('Unified taper — версионированный план как источник правды', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it('saveContestPrepEverywhere создаёт версионированный план и зеркало конфига', () => {
    const plan = saveContestPrepEverywhere(cfg(), { source: 'planner', prepWeeks: 10 });
    expect(plan).not.toBeNull();
    expect(plan!.preparation.weeks).toBe(10);
    expect(plan!.taper.weeks).toBe(3);
    // Читается через planFromStored
    const s: any = getProfile().settings as any;
    const loaded = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(plan!.id);
    expect(loaded!.showDate).toBe(SHOW_DEFAULT);
    // Зеркало конфига тоже лежит
    expect(typeof s?.goals?.bbPeakConfig).toBe('string');
  });

  it('питание: сохранение с source=planner делает цели доступными по всем фазам (подготовка/тапер/пик)', async () => {
    const { nutritionTargetsForPrepDate, prepPhaseForDate } = await import('../bb-contest-prep.engine');
    const plan = saveContestPrepEverywhere(cfg({ showDate: SHOW_PHASES, weeksOut: 2 }), { source: 'planner', prepWeeks: 8 });
    expect(plan).not.toBeNull();
    const s: any = getProfile().settings as any;
    const loaded = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal)!;
    const base = { kcal: 3000, proteinG: 180, fatG: 80, carbsG: 350, waterMl: 3000, sodiumMg: 3500 };
    // Дата внутри подготовки (week 2)
    const prepDate = loaded.phases.find(p => p.key === 'preparation')!.dateStart;
    const prepTargets = nutritionTargetsForPrepDate(prepDate, loaded, base);
    expect(prepTargets.kcal).toBeGreaterThan(1200);
    expect(prepTargets.phaseLabel).toContain('Подготовка');
    // Дата внутри тапера
    const taperPhase = loaded.phases.find(p => p.key === 'taper');
    if (taperPhase) {
      const taperTargets = nutritionTargetsForPrepDate(taperPhase.dateStart, loaded, base);
      expect(taperTargets.phaseLabel).toContain('Taper');
    }
    // Дата пик-недели (шоу)
    const peakTargets = nutritionTargetsForPrepDate(loaded.showDate, loaded, base);
    expect(peakTargets.phase).not.toBeNull();
  });

  it('clearContestPrepEverywhere удаляет оба ключа', () => {
    saveContestPrepEverywhere(cfg(), { source: 'bb_auto', prepWeeks: 12 });
    let s: any = getProfile().settings as any;
    expect(s?.goals?.bbContestPrepPlan).toBeTruthy();
    clearContestPrepEverywhere();
    s = (getProfile().settings as any);
    expect(s?.goals?.bbContestPrepPlan).toBeUndefined();
    expect(s?.goals?.bbPeakConfig).toBeUndefined();
    const loaded = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
    expect(loaded).toBeNull();
  });

  it('миграция: голый bbPeakConfig → версионированный план', () => {
    const c = cfg({ showDate: SHOW_MIGRATE, weeksOut: 2 });
    // Ручная запись только конфига (как делало питание до унификации) — напрямую в localStorage
    try {
      localStorage.setItem(
        'he_profile_v2',
        JSON.stringify({ settings: { goals: { bbPeakConfig: serializeBBPrepConfig(c), peakWeek: true, peakShowDay: c.showDate }, personal: { weight: 82, sex: 'male' } } }),
      );
    } catch {}
    let s: any = getProfile().settings as any;
    expect(s?.goals?.bbPeakConfig).toBeTruthy();
    expect(s?.goals?.bbContestPrepPlan).toBeUndefined();
    // planFromStored в памяти уже соберёт план, но не сохранит
    const memPlan = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
    expect(memPlan).not.toBeNull();
    // Миграция должна сохранить его
    const migrated = migrateLegacyContestPrepIfNeeded({ prepWeeks: 12 });
    expect(migrated).not.toBeNull();
    s = (getProfile().settings as any);
    expect(s?.goals?.bbContestPrepPlan).toBeTruthy();
    // Повторная миграция — no-op
    const second = migrateLegacyContestPrepIfNeeded({ prepWeeks: 12 });
    expect(second).toBeNull();
  });

  it('событие CONTEST_PREP_UPDATED_EVENT диспатчится при сохранении', () => {
    let fired = false;
    let detail: any = null;
    const h = (e: Event) => { fired = true; detail = (e as CustomEvent).detail; };
    window.addEventListener(CONTEST_PREP_UPDATED_EVENT as any, h);
    saveContestPrepEverywhere(cfg({ showDate: SHOW_EVENT }), { source: 'planner', prepWeeks: 10 });
    window.removeEventListener(CONTEST_PREP_UPDATED_EVENT as any, h);
    expect(fired).toBe(true);
    expect(detail?.source).toBe('planner');
    expect(detail?.showDate).toBe(SHOW_EVENT);
  });

  it('кросс-синхронизация: питание сохраняет → ББ-авто читает тот же план', () => {
    const planA = saveContestPrepEverywhere(cfg({ showDate: SHOW_CROSS, weeksOut: 3, trainingProtocol: 'bb', carbLoadStrategy: 'front' }), { source: 'planner', prepWeeks: 12 });
    expect(planA).not.toBeNull();
    // Имитация чтения со стороны ББ-авто
    const s: any = getProfile().settings as any;
    const planB = planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
    expect(planB).not.toBeNull();
    expect(planB!.showDate).toBe(SHOW_CROSS);
    expect(planB!.taper.weeks).toBe(3);
    // Специализация и протокол сохраняются в здании пика
    expect(planB!.peakWeek.carbMode).toBe('high'); // front → high
  });

  it('shared editor: весь набор стратегий сохраняется и восстанавливается', () => {
    const full = cfg({
      trainingProtocol: 'classic',
      carbLoadStrategy: 'back',
      waterStrategy: 'classic',
      sodiumStrategy: 'cut_3d',
      preferLowFiberCarbs: true,
      creatineStrategy: 'stop',
      specialization: 'chest',
      competitions: [{ id: 'c1', name: 'Кубок', priority: 'A', date: SHOW_COMPETITION }],
      contraindications: ['kidney'],
      confirmedManipulation: true,
    });
    const plan = saveContestPrepEverywhere(full, { source: 'planner', prepWeeks: 14 });
    expect(plan).not.toBeNull();
    // Конфиг с агрессивными модами при противопоказании → blockedProtocol, но план всё равно строится (с warning)
    expect(plan!.safety.requiresReview).toBe(true);
  });
});

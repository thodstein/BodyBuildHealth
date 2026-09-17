/**
 * bb-taper-pro4-e1.test.ts — PRO-4 Э1 (D1): overlay-путь тапера
 * (applyTrainingTaperToBBPlan) ставит ЕДИНЫЙ контур фаз (contestPhase
 * taper/peak_week) + legacy-нормализация старых разметок.
 * База: стейт после PRO-3 (коммит 257245b6f); overlay-путь SRCBB/Macrocycle
 * раньше давал план без contestPhase → UI-таблица тапера/plan-quality/isMonotonicTaper
 * работали вслепую.
 */
import { describe, it, expect } from 'vitest';
import {
  applyTrainingTaperToBBPlan,
  isMonotonicTaper,
  type BBContestPrepConfig,
} from '../bb-contest-prep.engine';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function baseConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: addDaysIso(todayIso(), 120),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'stable',
    sodiumStrategy: 'stable',
    ...over,
  };
}

/** Синтетический BB-план: n недель × 1 сессия × 1 primary-упражнение (5 сетов). */
function mkPlan(n: number): any {
  const weeks = Array.from({ length: n }, (_, i) => ({
    week: i + 1,
    phase: 'accumulation',
    sessions: [{
      character: 'тяж',
      exercises: [{
        name: 'Жим штанги лёжа',
        muscle: 'chest',
        role: 'primary',
        sets: 5,
        repsRange: [8, 10],
        rir: 3,
        workSets: Array.from({ length: 5 }, () => ({ reps: 8, rir: 3, weight: 100 })),
      }],
    }],
  }));
  return { weeks, rationale: [] };
}

describe('PRO-4 Э1 — контур фаз overlay-пути', () => {
  it('taper-недели несут contestPhase=taper, пик — peak_week', () => {
    const out = applyTrainingTaperToBBPlan(mkPlan(10), baseConfig(), {});
    const weeks = (out as any).weeks;
    expect(weeks[weeks.length - 1].contestPhase).toBe('peak_week');
    expect(weeks[weeks.length - 1].peakWeek).toBe(true);
    const taper = weeks.filter((w: any) => w.contestPhase === 'taper');
    expect(taper.length).toBeGreaterThanOrEqual(1);
    // Маркеры недель не перепутаны: у taper-недель нет peakWeek.
    expect(taper.every((w: any) => w.peakWeek !== true)).toBe(true);
  });

  it('isMonotonicTaper оценивает РЕАЛЬНЫЕ недели (раньше фильтр был пуст)', () => {
    const out = applyTrainingTaperToBBPlan(mkPlan(10), baseConfig(), {});
    const weeks = (out as any).weeks;
    expect(weeks.filter((w: any) => w.contestPhase === 'taper').length).toBeGreaterThan(0);
    expect(isMonotonicTaper(weeks)).toBe(true);
    // Обратная проверка: испорченная кривая (объём растёт) — false.
    const bad = JSON.parse(JSON.stringify(weeks));
    const taper = bad.filter((w: any) => w.contestPhase === 'taper');
    if (taper.length >= 2) {
      taper[taper.length - 1].sessions[0].exercises[0].sets += 2;
      expect(isMonotonicTaper(bad)).toBe(false);
    }
  });

  it('идемпотентность: повторный вызов без force не меняет недели', () => {
    const once = applyTrainingTaperToBBPlan(mkPlan(10), baseConfig(), {});
    const twice = applyTrainingTaperToBBPlan(once as any, baseConfig(), {});
    expect(JSON.stringify((twice as any).weeks)).toBe(JSON.stringify((once as any).weeks));
  });

  it('legacy-нормализация пика: peakWeek=true без contestPhase → peak_week', () => {
    const plan = mkPlan(6);
    plan.weeks[5].peakWeek = true;
    plan.weeks[5].taper = true;
    plan.weeks[5].prepProtocol = 'Пик-неделя: legacy-разметка';
    const out = applyTrainingTaperToBBPlan(plan, baseConfig(), {});
    expect((out as any).weeks[5].contestPhase).toBe('peak_week');
  });

  it('legacy-нормализация тапера: prepProtocol без contestPhase → taper (skip-ветка)', () => {
    const plan = mkPlan(6);
    plan.weeks[4].taper = true;
    plan.weeks[4].prepProtocol = 'ББ-канон — Тапер нед 1 (legacy)';
    const out = applyTrainingTaperToBBPlan(plan, baseConfig(), {});
    expect((out as any).weeks[4].contestPhase).toBe('taper');
  });

  it('делод внутри окна тапера: contestPhase=taper + честная метка разгрузки', () => {
    const plan = mkPlan(6);
    plan.weeks[4].deload = true;
    const out = applyTrainingTaperToBBPlan(plan, baseConfig(), {});
    const w = (out as any).weeks[4];
    expect(w.contestPhase).toBe('taper');
    expect(String(w.prepProtocol)).toMatch(/разгрузка/i);
  });

  it('force-путь не деградирует план: повторные сборки идентичны (Э1b)', () => {
    const once = applyTrainingTaperToBBPlan(mkPlan(10), baseConfig(), {});
    const twice = applyTrainingTaperToBBPlan(once as any, baseConfig(), { force: true });
    // Пик-неделя: база конверсии (peakWeekBase) держит сеты/веса — без ×0.6/×0.8 повторно.
    const pkSessionsOnce = (once as any).weeks[9].sessions.map((s: any) => s.exercises.map((e: any) => ({ sets: e.sets, ws: e.workSets.map((w: any) => w.weight) })));
    const pkSessionsTwice = (twice as any).weeks[9].sessions.map((s: any) => s.exercises.map((e: any) => ({ sets: e.sets, ws: e.workSets.map((w: any) => w.weight) })));
    expect(pkSessionsTwice).toEqual(pkSessionsOnce);
    // И есть хотя бы один рабочий пик-день с упражнениями (не всё «отдых»).
    expect(pkSessionsTwice.some((s: any[]) => s.length > 0)).toBe(true);
    // Taper-недели при force не пересобираются (накопление кривой невозможно).
    expect((twice as any).weeks[8].sessions[0].exercises[0].sets)
      .toBe((once as any).weeks[8].sessions[0].exercises[0].sets);
    expect((twice as any).weeks[9].contestPhase).toBe('peak_week');
  });
});

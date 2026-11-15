/**
 * bb-audit-p1-fixes.test.ts — регрессы на P1-находки аудитов ядра сборки,
 * финализации и валидации BB-плана (аудит 2026-11).
 *
 * Покрыто:
 * - P1-1 (ядро): тоггл «Авто-разгрузка» управляет авто-делодом по ACWR;
 * - P1-2 (ядро): fallback-пул соблюдает политические запреты (эксцентрик-скилл
 *   новичку, становая/жим стоя без явного разрешения);
 * - P1-3 (ядро): гарды оборудования не сравнивают строку со МАССИВОМ снарядов;
 * - P1-1 (валидация): повреждённая deload-неделя даёт issue, а не TypeError;
 * - P1-2 (финализация): упражнения исключённых мышц реально удаляются;
 * - P1-3 (валидация/качество): план без рабочих подходов — не «95/100 ok».
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBBPlan, buildExercisePool } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { buildBBQualityReport } from '../bb-quality-report.engine';
import { scoreVolumeWeek, scoreProWeek } from '../bb-quality-weekly.engine';
import { finalizeBBPlan } from '../bb-finalize.engine';
import { makeInput } from './bb-test-helpers';

const SRPE_KEY = 'he_srpe_sessions';

function clearStorage(): void {
  try { localStorage.clear(); } catch { /* ignore */ }
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Неделя с тяжёлой нагрузкой на фоне лёгкой «хроники» → ACWR > 1.5. */
function seedAcwrDanger(): void {
  const rows: Array<{ date: string; sRPE: number; durationMin: number }> = [];
  for (let i = 28; i >= 8; i -= 2) rows.push({ date: isoDaysAgo(i), sRPE: 6, durationMin: 60 });
  for (let i = 6; i >= 0; i--) rows.push({ date: isoDaysAgo(i), sRPE: 10, durationMin: 120 });
  localStorage.setItem(SRPE_KEY, JSON.stringify(rows));
}

function deloadWeeks(plan: { weeks: Array<{ week: number; phase?: string }> }): number[] {
  return plan.weeks
    .filter(w => String(w.phase || '').toLowerCase() === 'deload')
    .map(w => w.week);
}

const BUILDER_SRC = readFileSync(resolve(__dirname, '..', 'bb-builder.engine.ts'), 'utf8');

describe('P1-1 ядро: тоггл «Авто-разгрузка» управляет авто-делодом по ACWR', () => {
  beforeEach(clearStorage);

  it('autoDeload=false — план не перестраивается по скрытой sRPE-истории', () => {
    const baseline = buildBBPlan(makeInput({ weeks: 8 }));

    seedAcwrDanger();
    const withAcwr = buildBBPlan(makeInput({ weeks: 8, autoDeload: true }));
    const withoutAcwr = buildBBPlan(makeInput({ weeks: 8, autoDeload: false }));

    // Данные действительно дают «опасную» зону — иначе тест был бы пустым.
    expect(withAcwr.rationale.join('\n')).toMatch(/ACWR/);
    expect(deloadWeeks(withAcwr)).not.toEqual(deloadWeeks(baseline));

    // Выключенный тоггл = ровно то, что показано пользователю: ни учащённых
    // делодов, ни предупреждений «включил бы разгрузку».
    expect(deloadWeeks(withoutAcwr)).toEqual(deloadWeeks(baseline));
    expect(withoutAcwr.rationale.join('\n')).not.toMatch(/ACWR/);
  });
});

describe('P1-2 ядро: fallback-пул соблюдает политические запреты', () => {
  const baseOpts = {
    allowExotic: false,
    isPurePull: false,
    excludeIds: [] as string[],
    favoriteIds: [] as string[],
    weakPoints: [] as string[],
    focusGroup: '',
    muscle: 'shoulders',
  };

  it('становая/жим стоя/армейский жим не возвращаются через fallback', () => {
    // sessionTag 'legs' вычищает из основного пула всё «жимовое» → включается
    // fallback (он раньше был без запрета силовых лифтов).
    const pool = buildExercisePool('shoulders', 'primary', {
      ...baseOpts,
      level: 'intermediate',
      roleMuscles: ['shoulders'],
      sessionTag: 'legs',
      equipmentList: [],
      allowStrengthLifts: undefined,
    } as any);
    expect(pool.length).toBeGreaterThan(0);
    const names = pool.map((ex: any) => String(ex.name || '').toLowerCase());
    for (const banned of ['армейский', 'жим стоя', 'швунг', 'становая', 'сумо']) {
      expect(names.some(n => n.includes(banned))).toBe(false);
    }
  });

  it('эксцентрик-скилл (нордик) не возвращается новичку через fallback', () => {
    const pool = buildExercisePool('hamstrings', 'primary', {
      ...baseOpts,
      level: 'beginner',
      roleMuscles: ['hamstrings'],
      sessionTag: '',
      equipmentList: ['bodyweight'],
    } as any);
    const names = pool.map((ex: any) => String(ex.name || '').toLowerCase());
    expect(names.some(n => /нордик|nordic/.test(n))).toBe(false);
  });
});

describe('P1-3 ядро: гарды оборудования не сравнивают строку с массивом', () => {
  it('в билдере не осталось `eqList.includes(e.equipment)` (каталог хранит массив)', () => {
    // Именно вызов в условии гарда (в комментарии упоминание допустимо).
    expect(BUILDER_SRC).not.toMatch(/eqList\??\.includes\((?:e|c)\.equipment\)\)\s*return false/);
  });

  it('гарды используют общее правило equipmentAllows', () => {
    const matches = BUILDER_SRC.match(/!equipmentAllows\(eqList, (?:e|c)\.equipment\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});

describe('P1-1 валидация: повреждённая deload-неделя не роняет validateBBPlan', () => {
  const brokenPlan: any = {
    weeks: [
      { week: 1, sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим лёжа', sets: 3, rir: 2 }] }] },
      { week: 2, phase: 'deload', sessions: [{ day: 1 }] },
      { week: 3, sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим лёжа', sets: 3, rir: 2 }] }] },
    ],
  };

  it('возвращает malformed_session вместо TypeError', () => {
    expect(() => validateBBPlan(brokenPlan)).not.toThrow();
    const result = validateBBPlan(brokenPlan);
    expect(result.issues.some(i => i.code === 'malformed_session')).toBe(true);
  });
});

describe('P1-2 финализация: упражнения исключённых мышц удаляются', () => {
  function planWithChest(): any {
    return {
      pattern: {} as any,
      weeks: [{
        week: 1,
        sessions: [{
          day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Upper',
          exercises: [
            {
              muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж',
              sets: 4, repsRange: [6, 8], rir: 2,
              workSets: Array.from({ length: 4 }, () => ({ reps: 8, rir: 2, weight: 80 })),
            },
            {
              muscle: 'back', name: 'Тяга штанги в наклоне', role: 'accessory', character: 'тяж',
              sets: 3, repsRange: [8, 10], rir: 2,
              workSets: Array.from({ length: 3 }, () => ({ reps: 10, rir: 2, weight: 60 })),
            },
          ],
        }],
      }],
      rotationMuscleVolume: {}, rationale: [],
    };
  }

  for (const reorder of [true, false]) {
    it(`исключённая мышца уходит из плана (reorder=${reorder})`, () => {
      const result = finalizeBBPlan(planWithChest(), { excludedMuscles: ['chest'], level: 'intermediate', reorder });
      const names = result.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.name)));
      expect(names.some(n => /жим/i.test(n))).toBe(false);
      expect(names.length).toBeGreaterThan(0);
      const codes = (result.validation?.issues || []).map(i => i.code);
      expect(codes).not.toContain('excluded_muscle_present');
    });
  }

  it('день не остаётся без основного движения', () => {
    const result = finalizeBBPlan(planWithChest(), { excludedMuscles: ['chest'], level: 'intermediate' });
    const roles = result.weeks[0].sessions[0].exercises.map(e => e.role);
    expect(roles).toContain('primary');
  });
});

describe('P1-3 валидация и качество: пустой план — не «95/100 ok»', () => {
  const emptyPlan: any = { weeks: [{ week: 1, sessions: [{ day: 1, exercises: [] }] }] };

  it('валидатор ставит error no_working_sets', () => {
    const result = validateBBPlan(emptyPlan);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'no_working_sets' && i.level === 'error')).toBe(true);
  });

  it('отчёт качества: score 0 и danger', () => {
    const report = buildBBQualityReport({
      ...emptyPlan,
      validation: { valid: true, issues: [] },
    } as any, {});
    expect(report.score).toBe(0);
    expect(report.riskLevel).toBe('danger');
    expect(report.issues.some(i => i.code === 'no_working_sets')).toBe(true);
  });

  it('недельные шкалы: объём и PRO при нуле сетов равны 0', () => {
    expect(scoreVolumeWeek(emptyPlan, 1).score).toBe(0);
    expect(scoreProWeek(emptyPlan, 1).score).toBe(0);
  });
});

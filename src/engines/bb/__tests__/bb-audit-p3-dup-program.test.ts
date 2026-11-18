/**
 * bb-audit-p3-dup-program.test.ts — аудит 2026-11, P3-3 (ядро, остаток).
 *
 * Програмная ветка (`programToBBPlan`) получала DUP только снаружи — UI накладывал
 * волну после сборки, потому что вход волну не принимал. Значит снимок и replan
 * описывали план БЕЗ методики: «Пересобрать остаток» собирал его заново без DUP.
 *
 * Теперь поле объявлено и волну накладывает сама сборка — до финального снимка.
 */
import { describe, it, expect } from 'vitest';
import { programToBBPlan, cycleTemplateToFullProgram } from '../cycle-to-plan';
import { applyDUPOverlay } from '../bb-dup.engine';
import { getCyclesByDirection } from '../../../data/lms-cycles/lms-cycle-index';

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

const program = () => {
  const c = getCyclesByDirection('bodybuilding').find(x => !x.meta.id.startsWith('embed-'));
  expect(c).toBeDefined();
  return cycleTemplateToFullProgram(c!);
};

const primaries = (plan: any) =>
  plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
    .filter((e: any) => e.role === 'primary');

describe('programToBBPlan читает dupMode: волну накладывает сборка', () => {
  it('метка DUP и rationale появляются в плане', () => {
    const plan = programToBBPlan(program(), {
      workMax: WM, level: 'intermediate', mode: 'adapt', dupMode: 'full_dup',
    });
    expect(plan.rationale.join(' ')).toContain('DUP: full_dup');
    const labelled = primaries(plan).filter((e: any) => String(e.comment || '').includes('[DUP:'));
    expect(labelled.length).toBeGreaterThan(0);
  });

  it('флаг и мышцы доезжают до снимка (replan читает именно его)', () => {
    const plan: any = programToBBPlan(program(), {
      workMax: WM, level: 'intermediate', mode: 'adapt',
      dupMode: 'heavy_light', dupMuscles: ['chest'],
    });
    expect(plan.inputSnapshot?.dupMode).toBe('heavy_light');
    expect(plan.inputSnapshot?.dupMuscles).toEqual(['chest']);
  });

  it('per-muscle: метку получают только primary выбранной мышцы', () => {
    const plan = programToBBPlan(program(), {
      workMax: WM, level: 'intermediate', mode: 'adapt',
      dupMode: 'heavy_light', dupMuscles: ['chest'],
    });
    const labelled = primaries(plan).filter((e: any) => String(e.comment || '').includes('[DUP:'));
    expect(labelled.length).toBeGreaterThan(0);
    for (const ex of labelled) expect(ex.muscle).toBe('chest');
  });

  it('mode=none и новичок волну не получают', () => {
    const none = programToBBPlan(program(), {
      workMax: WM, level: 'intermediate', mode: 'adapt', dupMode: 'none',
    });
    expect(none.rationale.join(' ')).not.toContain('DUP: none');
    expect(primaries(none).some((e: any) => String(e.comment || '').includes('[DUP:'))).toBe(false);

    const beginner = programToBBPlan(program(), {
      workMax: WM, level: 'beginner', mode: 'adapt', dupMode: 'full_dup',
    });
    expect(beginner.rationale.join(' ')).not.toContain('DUP: full_dup');
    expect(primaries(beginner).some((e: any) => String(e.comment || '').includes('[DUP:'))).toBe(false);
  });

  it('повторное наложение из UI безвредно (сборка + внешний оверлей = одна метка)', () => {
    const built = programToBBPlan(program(), {
      workMax: WM, level: 'intermediate', mode: 'adapt', dupMode: 'heavy_light',
    });
    const again = applyDUPOverlay(built as any, { mode: 'heavy_light', cycleDays: 2 });
    const labelled = primaries(again).filter((e: any) => String(e.comment || '').includes('[DUP:'));
    expect(labelled.length).toBeGreaterThan(0);
    // Ни одна метка не задвоилась.
    for (const ex of primaries(again)) {
      const n = (String(ex.comment || '').match(/\[DUP:/g) || []).length;
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});

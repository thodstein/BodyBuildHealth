/**
 * arm-corrective-ui.test.tsx — E3: таб «Коррекция» показывает дозу v2 = вставляемой.
 * Прямой рендер HubCorrectionTab с фейковым H (без маунта всего хаба).
 * Хуки data-arm — через container.querySelector (getByTestId тут нет).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HubCorrectionTab } from '../arm-hub-correction-tab';
import { injectArmCorrections } from '../../../../engines/arm/arm-diagnostics-injection.engine';
import { buildArmPlan } from '../../../../engines/arm/arm-builder.engine';
import { finalizeArmPlan } from '../../../../engines/arm/arm-finalize.engine';
import type { ArmWeakPoint } from '../../../../engines/arm/arm-biomechanics.engine';

beforeEach(() => {
  localStorage.clear();
});

function fakeH(over: Record<string, any> = {}): any {
  const state = {
    weakPoints: ['side_pin'] as ArmWeakPoint[],
    level: 'intermediate',
    failurePoint: '',
    corrWave: '',
    ...(over.state || {}),
  };
  return {
    state,
    setState: over.setState || (() => {}),
    report: {},
    diag: null,
    armCausesP0: { side_pin: { cause: 'strength', confidence: 0.7, evidence: ['Side/Back 40% ref <60%'], fix: 'x' } },
    armTop3P0: { side_pin: [{ id: 'side_belt_table', score: 100, reason: 'топ по точке' }] },
    armSpecP0: null,
    handleInjectP0: () => {},
    hasInjectPrev: false,
    handleRollbackP0: () => {},
    injectMsg: '',
    toggleWeakPoint: () => {},
    trackType: null,
    autoPoint: null,
    mvPhase: null,
    corrV2: { tendonOverload: false, waveWeek: null },
    armPlan: null,
    ...over,
  };
}

const q = (container: HTMLElement, hook: string) => container.querySelector(`[data-arm="${hook}"]`);

describe('arm-corrective-ui E3', () => {
  it('side+strength: строка дозы — v2-guard humerus (не 5×5)', () => {
    const { container } = render(<HubCorrectionTab H={fakeH()} />);
    const line = q(container, 'correction-dose-cause');
    expect(line).toBeTruthy();
    expect(line!.textContent).toContain('humerus');
    expect(line!.textContent).toContain('3×6–6');
    expect(line!.textContent).toContain('без 5×5');
  });
  it('tendon-флаг: строка дозы — v2 tendon, и инъекция даёт те же 2 сета', () => {
    const H = fakeH({
      state: { weakPoints: ['pron_lock'] as ArmWeakPoint[], level: 'intermediate', failurePoint: '', corrWave: '' },
      armCausesP0: { pron_lock: { cause: 'volume', confidence: 0.6, evidence: [], fix: 'x' } },
      armTop3P0: { pron_lock: [{ id: 'pronation_cable', score: 100, reason: '' }] },
      corrV2: { tendonOverload: true, waveWeek: null },
    });
    const { container, unmount } = render(<HubCorrectionTab H={H} />);
    expect(q(container, 'correction-dose-cause')!.textContent).toContain('tendon');
    unmount();
    // паритет: те же флаги в инъекцию
    const p = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'toproll', weeks: 4, gripFocus: 'support' } as any);
    const plan = finalizeArmPlan(p, { level: 'intermediate' });
    const res = injectArmCorrections(plan, ['back_start' as ArmWeakPoint], { tendonOverload: true });
    const inserted = res.plan.weeks[0].sessions.flatMap((s) => s.exercises)
      .filter((e: any) => String(e.rationale || '').startsWith('Коррекция мёртвой точки'));
    expect((inserted[0] as any).sets).toBe(2);
  });
  it('без причины и флагов — строки дозы нет, роли/профилактика/волна есть', () => {
    const H = fakeH({
      state: { weakPoints: ['cup_start'] as ArmWeakPoint[], level: 'intermediate', failurePoint: '', corrWave: '' },
      armCausesP0: {},
      armTop3P0: { cup_start: [{ id: 'wrist_curl_belt', score: 100, reason: 'топ по точке' }] },
    });
    const { container } = render(<HubCorrectionTab H={H} />);
    expect(q(container, 'correction-dose-cause')).toBeNull();
    expect(q(container, 'correction-top3')!.textContent).toContain('стол-ремень');
    expect(q(container, 'correction-prevent')!.textContent).toContain('wrist_ext_bb');
    expect(q(container, 'correction-wave')!.textContent).toContain('Н1');
  });
  it('клик волны Н2 пишет corrWave в стейт', () => {
    const setState = vi.fn();
    render(<HubCorrectionTab H={fakeH({ setState })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Н2 +1' }));
    expect(setState).toHaveBeenCalled();
    const updater = setState.mock.calls[0][0];
    expect(updater({ corrWave: '' })).toEqual({ corrWave: '2' });
  });
});

/**
 * bb-hub-bridge.test.ts — типизированный мост ББ-диагностики (без `as any`).
 *
 * Хаб слал ББ-поля (weakZonesGranular/preferredExerciseIds/exerciseSwap/
 * labDiagnosis/specBlock/...) через `as any`, приём в BbAutoConstructor читал
 * через `(payload.data as any)`. Теперь WeakpointsPayload несёт все ББ-поля —
 * этот тест доказывает roundtrip applyToPlanner → subscribePlannerApply
 * строго по типам (компиляция без кастов = часть проверки).
 */
import { describe, expect, it } from 'vitest';
import { applyToPlanner, subscribePlannerApply, type WeakpointsPayload } from '../../../ui/screens/TrainingScreen_parts/planner-bridge';

describe('BB hub bridge без as any', () => {
  it('weakpoints с ББ-полями доходит до подписчика целиком', () => {
    const seen: unknown[] = [];
    const unsub = subscribePlannerApply(p => { if (p) seen.push(p); });
    const data: WeakpointsPayload = {
      groups: ['glutes'],
      weakPoints: ['glutes'],
      weakZonesGranular: ['glutes'],
      weakMusclesCanonical: ['glutes'],
      preferredExerciseIds: ['hip_thrust'],
      exerciseSwap: { oldId: 'squat_bar', newId: 'hip_thrust' },
      bbDiagScore: 70,
      bbDiagLevel: 'good',
      weakHeads: ['upper_glute'],
      specBlock: { lengthWeeks: 5, donors: [] },
      sleepHours: 7,
    };
    applyToPlanner({ kind: 'weakpoints', label: 'ББ диагностика: glutes', data });
    unsub();
    expect(seen.length).toBeGreaterThan(0);
    const last = (seen[seen.length - 1] as { data: WeakpointsPayload }).data;
    expect(last.weakZonesGranular).toEqual(['glutes']);
    expect(last.preferredExerciseIds).toEqual(['hip_thrust']);
    expect(last.exerciseSwap).toEqual({ oldId: 'squat_bar', newId: 'hip_thrust' });
    expect(last.bbDiagScore).toBe(70);
  });

  it('lab-коррекция едет тем же каналом', () => {
    const seen: Array<{ data: WeakpointsPayload }> = [];
    const unsub = subscribePlannerApply(p => { if (p && p.kind === 'weakpoints') seen.push({ data: p.data as WeakpointsPayload }); });
    applyToPlanner({
      kind: 'weakpoints',
      label: 'ББ: техника',
      data: {
        groups: ['hamstrings'],
        labDiagnosis: { flags: ['short_rom'], score: 60 },
        labCorrection: { type: 'modifyROM', targetId: 'rdl' },
        labDelta: { summary: '-1 сет' },
      },
    });
    unsub();
    expect(seen.length).toBeGreaterThan(0);
    expect((seen[seen.length - 1].data.labCorrection as { type: string }).type).toBe('modifyROM');
  });
});

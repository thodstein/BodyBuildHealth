import { describe, expect, it } from 'vitest';
import { analyzePhaseAssistance, analyzeStickingCorrections, analyzeBarPathAssistance } from '../lift-assistance.engine';
import { barPathIssuesForLift } from '../lift-diagnostics.engine';
import { diagnosticProtocolFromCycle } from '../../lms/lms-builder.engine';
import { WEAK_POINTS_BY_LIFT } from '../../lms/weakpoint-pl';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

describe('диагностический протокол: карточка == билдер (parity)', () => {
  it('все фазы всех движений: protocolFromCycle(предмет) == diagnosticProtocolFromCycle(имя)', () => {
    let checked = 0;
    for (const lift of Object.keys(WEAK_POINTS_BY_LIFT)) {
      for (const phase of WEAK_POINTS_BY_LIFT[lift as keyof typeof WEAK_POINTS_BY_LIFT]) {
        for (const item of analyzePhaseAssistance(lift as any, phase as any, CYCLE_01).items) {
          expect(
            diagnosticProtocolFromCycle(CYCLE_01 as any, item.exercise.name),
            `${lift}/${phase}: ${item.exercise.name}`,
          ).toEqual(item.protocol);
          checked += 1;
        }
        for (const item of analyzeStickingCorrections(lift as any, phase as any, CYCLE_01).items) {
          expect(
            diagnosticProtocolFromCycle(CYCLE_01 as any, item.exercise.name),
            `${lift}/${phase} (sticking): ${item.exercise.name}`,
          ).toEqual(item.protocol);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('bar-path: protocolFromCycle(предмет) == diagnosticProtocolFromCycle(имя)', () => {
    let checked = 0;
    for (const lift of Object.keys(WEAK_POINTS_BY_LIFT)) {
      for (const issue of barPathIssuesForLift(lift as any)) {
        for (const item of analyzeBarPathAssistance(lift as any, issue, CYCLE_01).items) {
          expect(
            diagnosticProtocolFromCycle(CYCLE_01 as any, item.exercise.name),
            `${lift}/${issue}: ${item.exercise.name}`,
          ).toEqual(item.protocol);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('без шаблона оба дефолта совпадают (3×10@60% RIR 2)', () => {
    const item = analyzePhaseAssistance('squat', 'bottom').items[0];
    expect(item.protocol).toEqual({ pct: 0.6, reps: 10, sets: 3, rir: 2 });
    expect(diagnosticProtocolFromCycle(undefined, item.exercise.name)).toEqual(item.protocol);
  });
});

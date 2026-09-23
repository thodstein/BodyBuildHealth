import { describe, it, expect } from 'vitest';
import { auditArmliftPlan, worstArmliftLink, ARMLIFT_AUDIT_LINKS } from '../armlift-plan-audit.engine';
import { armliftLinkPoolIds } from '../armlift-correction.engine';
import { getArmExerciseById } from '../../../core/exercise-catalog-arm';

const mk = (id: string, sets = 3, isTable = false) => ({
  exerciseId: id, sets, isTable, sessionTag: isTable ? 'TableTech' : 'GripHeavy',
});
const plan = (exercises: ReturnType<typeof mk>[]) => ({
  weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'GripHeavy', exercises }] }],
});

describe('armlift-plan-audit ROUND-10', () => {
  it('пулы звеньев — реальные id каталога; 5 звеньев аудита', () => {
    expect(ARMLIFT_AUDIT_LINKS.length).toBe(5);
    for (const link of ARMLIFT_AUDIT_LINKS) {
      const pool = armliftLinkPoolIds(link);
      expect(pool.length, link).toBeGreaterThanOrEqual(6);
      for (const id of pool) expect(getArmExerciseById(id), `${link}:${id}`).toBeTruthy();
    }
  });

  it('пустой/битый план → null (честно)', () => {
    expect(auditArmliftPlan(null)).toBeNull();
    expect(auditArmliftPlan({})).toBeNull();
    expect(auditArmliftPlan({ weeks: [] })).toBeNull();
  });

  it('покрытие: 1 звено закрыто, остальные в missing; проценты считаются', () => {
    // apollon_axle — только в пуле fingers (rolling_thunder теперь и в support_endurance)
    const rt = 'apollon_axle';
    expect(armliftLinkPoolIds('fingers')).toContain(rt);
    const a = auditArmliftPlan(plan([mk(rt)]))!;
    expect(a.covered).toEqual(['fingers']);
    expect(a.missing.length).toBe(4);
    expect(a.coveragePct).toBe(20);
    expect(a.byLink.fingers.sets).toBe(3);
    expect(a.byLink.fingers.sessions).toContain('GripHeavy');
  });

  it('table/gym делятся по isTable; дубли от 3 сессий', () => {
    const a = auditArmliftPlan(plan([mk(armliftLinkPoolIds('thumb')[0]), mk('plate_pinch_hold', 4, true)]))!;
    expect(a.tableSets).toBe(4);
    expect(a.gymSets).toBe(3);
    expect(a.tableRatio).toBeCloseTo(0.57, 1);
    expect(a.totalSets).toBe(7);
  });

  it('worstArmliftLink: дыра (0 сетов) в приоритете; без плана — первый', () => {
    const thumbId = armliftLinkPoolIds('thumb')[0];
    expect(worstArmliftLink(plan([mk(thumbId)]))).not.toBe('thumb');
    expect(worstArmliftLink(null)).toBe(ARMLIFT_AUDIT_LINKS[0]);
    expect(worstArmliftLink(plan([]), [])).toBeNull();
  });

  it('полное покрытие всех 5 звеньев → coveragePct 100, missing пуст', () => {
    const ex = ARMLIFT_AUDIT_LINKS.map((l) => mk(armliftLinkPoolIds(l)[0]));
    const a = auditArmliftPlan(plan(ex))!;
    expect(a.missing).toEqual([]);
    expect(a.coveragePct).toBe(100);
  });
});

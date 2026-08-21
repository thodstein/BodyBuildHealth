import { describe, expect, it } from 'vitest';
import { JOINTS, JOINT_OPTIONS, jointLoadDiagnosis, DEPRECATED_JOINT_CALCULATORS } from '../joint-load-master.engine';

describe('joint-load-master', () => {
  it('7 опасных зон, поясница выделена L4-S1', () => {
    expect(JOINTS.length).toBe(7);
    const spine = JOINTS.find(j=>j.id==='spine')!;
    expect(spine.label).toContain('Поясница');
    expect(spine.dangerous.join(' ')).toMatch(/диск/);
  });
  it('опции покрывают плечо/колено/поясницу', () => {
    expect(JOINT_OPTIONS.filter(o=>o.joint==='shoulder').length).toBeGreaterThanOrEqual(2);
    expect(JOINT_OPTIONS.filter(o=>o.joint==='knee').length).toBeGreaterThanOrEqual(2);
    expect(JOINT_OPTIONS.filter(o=>o.joint==='spine').length).toBeGreaterThanOrEqual(3);
  });
  it('jointLoadDiagnosis использует все калькуляторы', () => {
    const d = jointLoadDiagnosis({ joint:'spine', lifts:['squat'] });
    expect(d.phase).toBeDefined();
    expect(d.options.length).toBeGreaterThan(0);
    expect(d.mobilityTests.length).toBeGreaterThan(0);
  });
  it('DEPRECATED список для чистки старых калькуляторов', () => {
    expect(DEPRECATED_JOINT_CALCULATORS.length).toBeGreaterThan(0);
    expect(DEPRECATED_JOINT_CALCULATORS.join(' ')).toMatch(/joint-load-master/);
  });
});

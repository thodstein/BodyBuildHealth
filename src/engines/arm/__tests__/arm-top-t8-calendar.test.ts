import { describe, it, expect } from 'vitest';
import { buildArmCalendar, calWeeksOut } from '../arm-calendar.engine';

describe('arm TOP T8 календарь', () => {
  it('обратный отсчёт', () => {
    expect(calWeeksOut('2026-09-01', '2026-09-29')).toBe(4);
    expect(calWeeksOut('2026-09-30', '2026-09-01')).toBe(0);
  });
  it('тейпер A=3, B=2, C=0', () => {
    expect(buildArmCalendar({ startIso: '2026-12-01', fromIso: '2026-09-01', priority: 'A' }).taperWeeks).toBe(3);
    expect(buildArmCalendar({ startIso: '2026-12-01', fromIso: '2026-09-01', priority: 'B' }).taperWeeks).toBe(2);
    expect(buildArmCalendar({ startIso: '2026-12-01', fromIso: '2026-09-01', priority: 'C' }).taperWeeks).toBe(0);
  });
  it('фазы: пик/тейпер/сила/база', () => {
    expect(buildArmCalendar({ startIso: '2026-09-08', fromIso: '2026-09-01', priority: 'A' }).phase).toBe('peak');
    expect(buildArmCalendar({ startIso: '2026-09-22', fromIso: '2026-09-01', priority: 'A' }).phase).toBe('taper');
    expect(buildArmCalendar({ startIso: '2026-10-20', fromIso: '2026-09-01', priority: 'A' }).phase).toBe('strength');
    expect(buildArmCalendar({ startIso: '2027-03-01', fromIso: '2026-09-01', priority: 'A' }).phase).toBe('base');
  });
  it('весогонка too_fast/too_slow/on_track', () => {
    const fast = buildArmCalendar({ startIso: '2026-09-15', fromIso: '2026-09-01', startKg: 90, targetKg: 85 });
    expect(fast.cut.status).toBe('too_fast');
    const ok = buildArmCalendar({ startIso: '2026-12-01', fromIso: '2026-09-01', startKg: 86, targetKg: 80 });
    expect(ok.cut.status).toBe('on_track');
    const slow = buildArmCalendar({ startIso: '2026-12-01', fromIso: '2026-09-01', startKg: 86, targetKg: 85 });
    expect(slow.cut.status).toBe('too_slow');
  });
  it('серии дают свои ноты', () => {
    expect(buildArmCalendar({ series: 'waf_worlds' }).milestones.join(' ')).toMatch(/24–30ч/i);
    expect(buildArmCalendar({ series: 'super_series' }).milestones.join(' ')).toMatch(/90\/96\/102/i);
  });
});

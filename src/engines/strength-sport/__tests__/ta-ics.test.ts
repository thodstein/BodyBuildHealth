import { describe, it, expect } from 'vitest';
import { buildTAIcs } from '../strength-sport-ta-ics.engine';
import { buildTASpecBlock } from '../strength-sport-ta-spec-block.engine';

describe('TA ICS E15', () => {
  it('пустой спец → null', () => {
    expect(buildTAIcs(null)).toBeNull();
    expect(buildTAIcs({ weeks: [] } as any)).toBeNull();
  });
  it('6 недель → 6 VEVENT + экранирование', () => {
    const spec = buildTASpecBlock({ weakPoints: ['snatch_mid', 'jerk_dip'], weeks: 6 });
    const ics = buildTAIcs(spec, { startDate: '2026-09-07' });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics?.split('BEGIN:VEVENT').length).toBe(7);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260907');
    expect(ics).toContain('snatch_mid');
  });
  it('мусорная дата → сегодня, без throw', () => {
    const spec = buildTASpecBlock({ weakPoints: ['snatch_mid'], weeks: 4 });
    const ics = buildTAIcs(spec, { startDate: 'nope' });
    expect(ics).toContain('BEGIN:VEVENT');
  });
});

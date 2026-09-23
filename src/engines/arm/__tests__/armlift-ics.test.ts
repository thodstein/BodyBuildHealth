import { describe, it, expect } from 'vitest';
import { buildArmliftIcs } from '../armlift-ics.engine';
import { buildArmliftSpecBlock } from '../armlift-correction.engine';

const spec = buildArmliftSpecBlock('thumb', 'saxon_bar', undefined, 4);

describe('armlift-ics ROUND-10', () => {
  it('пустой/битый блок → null (честно)', () => {
    expect(buildArmliftIcs(null)).toBeNull();
    expect(buildArmliftIcs([])).toBeNull();
    expect(buildArmliftIcs(undefined)).toBeNull();
  });

  it('блок → VCALENDAR с событием на каждую неделю, DATE-формат и UID', () => {
    const ics = buildArmliftIcs(spec, { startDate: '2026-09-21', implement: 'saxon_bar', title: 'Тест' });
    expect(ics).not.toBeNull();
    const body = ics as string;
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
    expect((body.match(/BEGIN:VEVENT/g) || []).length).toBe(spec.length);
    expect(body).toContain('DTSTART;VALUE=DATE:20260921');
    expect(body).toMatch(/SUMMARY:Тест: нед 1/);
    expect(body).toContain('Снаряд: saxon_bar');
  });

  it('ICS-экранирование: запятые/точки с запятой/переводы строк в note', () => {
    const ics = buildArmliftIcs([{ week: 1, focus: 'x', target: 'а, б; в', volume: '3×', targetSets: { thumb: 3 }, dayMap: { thumb: 'Пн' }, detail: 'строка1\nстрока2' }]);
    const body = ics as string;
    expect(body).toContain('а\\, б\\; в');
    expect(body).toContain('строка1\\nстрока2');
  });

  it('недели идут подряд (Пн +7 дней)', () => {
    const ics = buildArmliftIcs(spec, { startDate: '2026-09-21' }) as string;
    expect(ics).toContain('DTSTART;VALUE=DATE:20260921');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260928');
  });
});

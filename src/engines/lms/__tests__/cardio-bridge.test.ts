import { describe, it, expect, beforeEach } from 'vitest';
import { buildCardioCycle, buildCardioIcs, buildCardioPrintHtml } from '../cardio.engine';
import {
  getCardioLink, setCardioLink, clearCardioLink, subscribeCardioLink,
  SPORT_LABELS,
} from '../cardio-bridge';

const LINK_KEY = 'he_cardio_link';

beforeEach(() => {
  try { localStorage.removeItem(LINK_KEY); } catch { /* ignore */ }
  clearCardioLink();
});

describe('cardio-bridge', () => {
  it('set/get/clear link', () => {
    expect(getCardioLink()).toBeNull();
    setCardioLink({ cycleId: 'c-1', sport: 'bb', linkedAt: '2026-01-01' });
    expect(getCardioLink()?.sport).toBe('bb');
    clearCardioLink();
    expect(getCardioLink()).toBeNull();
  });

  it('повреждённые данные → null', () => {
    try { localStorage.setItem(LINK_KEY, '{bad'); } catch { /* ignore */ }
    expect(getCardioLink()).toBeNull();
  });

  it('subscribe получает события set/clear', () => {
    const seen: (string | null)[] = [];
    const un = subscribeCardioLink(l => seen.push(l?.sport ?? null));
    setCardioLink({ cycleId: 'c', sport: 'pl', linkedAt: 'x' });
    clearCardioLink();
    expect(seen).toEqual(['pl', null]);
    un();
  });

  it('SPORT_LABELS покрывает все направления', () => {
    expect(SPORT_LABELS.pl).toBe('ПЛ-авто');
    expect(SPORT_LABELS.bb).toBe('ББ-авто');
    expect(SPORT_LABELS.manual).toBe('Ручной конструктор');
  });
});

describe('buildCardioIcs', () => {
  it('строит VEVENT по неделям с экранированием', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 2, id: 'ics-1', name: 'Цикл; тест', createdAt: '2026-01-01T00:00:00.000Z' });
    const ics = buildCardioIcs(c, '2026-01-01T00:00:00.000Z');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Кардио ZONE2');
    expect(ics).toContain('UID:ics-1-w1-zone2-');
    expect(ics).toContain('DTEND:');
    expect(ics).not.toContain('; тест');
  });

  it('даты событий лежат внутри соответствующих недель от reference', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 2, id: 'd-1', daysAvailable: 7 });
    const ics = buildCardioIcs(c, '2026-01-05T00:00:00.000Z');
    const starts = [...ics.matchAll(/DTSTART:(\d{8})T/g)].map(m => m[1]);
    expect(starts.length).toBeGreaterThan(0);
    for (const st of starts) {
      const day = Number(st.slice(6, 8));
      const month = Number(st.slice(4, 6));
      expect(month).toBe(1);
      expect(day).toBeGreaterThanOrEqual(5);
      expect(day).toBeLessThanOrEqual(19);
    }
  });
});

describe('buildCardioPrintHtml', () => {
  it('XSS-safe: пользовательские названия экранируются', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, name: '<script>alert(1)</script>' });
    const html = buildCardioPrintHtml(c);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('содержит фазы, недели и рациональные обоснования', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4 });
    const html = buildCardioPrintHtml(c);
    expect(html).toContain('<table>');
    expect(html).toContain('ZONE2');
    expect(html).toContain('Цель: сушка');
  });

  it('содержит «неделю по дням» (Пн-Вс)', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 2 });
    const html = buildCardioPrintHtml(c);
    expect(html).toContain('Недели по дням');
    for (const d of ['<th>Пн</th>', '<th>Вт</th>', '<th>Вс</th>']) expect(html).toContain(d);
  });
});

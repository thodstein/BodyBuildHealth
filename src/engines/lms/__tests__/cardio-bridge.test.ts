import { describe, it, expect, beforeEach } from 'vitest';
import { buildCardioCycle, buildCardioIcs } from '../cardio.engine';
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
    expect(ics).toContain('UID:ics-1-w1-zone2@bbh');
    expect(ics).not.toContain('; тест');
  });

  it('даты недель шагают на 7 дней от reference', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 2, id: 'd-1' });
    const ics = buildCardioIcs(c, '2026-01-05T00:00:00.000Z');
    expect(ics).toContain('DTSTART:20260105Z');
    expect(ics).toContain('DTSTART:20260112Z');
  });
});

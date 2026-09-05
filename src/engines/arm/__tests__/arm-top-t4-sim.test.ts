import { describe, it, expect } from 'vitest';
import { buildContestSimWeek, refereeFlow, simAttempts } from '../arm-contest-sim.engine';

describe('arm TOP T4 contest-sim', () => {
  it('процедура WAF: set→ready→go→stop', () => {
    expect(refereeFlow()).toEqual(['Set (закрыть ладонь, большой виден, запястье прямо)', 'Ready (замереть, локоть-якорь)', 'Go (старт без фальстарта)', 'Stop → мгновенное замирание']);
  });
  it('попытки 90/96/102', () => {
    expect(simAttempts(100)).toEqual([90, 96, 102]);
    expect(simAttempts(NaN)).toEqual([]);
  });
  it('стол: 3 дня + раунды + чеклист', () => {
    const w = buildContestSimWeek({ discipline: 'armwrestling', level: 'advanced', supermatch: true });
    expect(w.days.length).toBe(3);
    expect(w.rounds).toBe(5);
    expect(w.checklist.join(' ')).toMatch(/2 warnings|60с/i);
    expect(w.note).toMatch(/красная линия запрещена/i);
  });
  it('помост: attempts + opener без максимума', () => {
    const w = buildContestSimWeek({ discipline: 'armlifting', targetKg: 100 });
    expect(w.attempts).toEqual([90, 96, 102]);
    expect(w.days[1].volumeNote).toMatch(/без максимума/i);
  });
  it('фол-фокус персонализируется', () => {
    const w = buildContestSimWeek({ foulIds: ['elbow_lift', 'slip_grip'] });
    expect(w.days[2].steps.join(' ')).toMatch(/локоть-якорь|containment/i);
  });
});

import { describe, it, expect } from 'vitest';
import { estimateSessionTimeWithSupersets } from '../bb-fatigue.engine';

describe('bb-fatigue superset time-optimizer', () => {
  it('без суперсетов: supersetSeconds == baseSeconds', () => {
    const session: any = { exercises: [
      { name: 'Жим лёжа', character: 'тяж', sets: 4, workSets: [{ reps: 8 }], restSeconds: 180 },
      { name: 'Тяга', character: 'тяж', sets: 4, workSets: [{ reps: 8 }], restSeconds: 180 },
    ] };
    const e = estimateSessionTimeWithSupersets(session);
    expect(e.pairs).toBe(0);
    expect(e.savedSeconds).toBe(0);
    expect(e.supersetSeconds).toBe(e.baseSeconds);
  });

  it('пара суперсетов экономит отдых второго элемента', () => {
    const session: any = { exercises: [
      { name: 'Жим лёжа', character: 'тяж', sets: 4, workSets: [{ reps: 8 }], restSeconds: 180, supersetGroup: 1 },
      { name: 'Тяга', character: 'тяж', sets: 4, workSets: [{ reps: 8 }], restSeconds: 180, supersetGroup: 1 },
    ] };
    const e = estimateSessionTimeWithSupersets(session);
    expect(e.pairs).toBe(1);
    // экономия = сеты второго × отдых = 4 × 180 = 720с
    expect(e.savedSeconds).toBe(720);
    expect(e.supersetSeconds).toBe(e.baseSeconds - 720);
  });
});

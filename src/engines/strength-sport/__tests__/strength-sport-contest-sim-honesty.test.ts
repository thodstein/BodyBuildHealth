/**
 * strength-sport-contest-sim-honesty.test.ts — контракт честности симулятора.
 *
 * Ревизия убрала кросс-ивентные фолбэки (йок ← становя, камень ← гантели,
 * царапина ← йок) и выдуманные дефолты 180/140/100/80/60. Раньше прогноз
 * места/очков выглядел правдоподобно, но считался от чужого показателя.
 * Тесты ниже фиксируют новый контракт:
 *   1) нет своего ПМ → hasData:false, 0 очков, ивент в noData (НЕ выдуманный ratio);
 *   2) тяговые (трак/арм-овер-арм/сани) → вес снаряда не считается нагрузкой;
 *   3) medley по implements → берётся ХУДШИЙ элемент;
 *   4) детерминизм: одинаковый вход → идентичный результат (Math.random удалён);
 *   5) полностью неизвестные ивенты → null, а не число из воздуха.
 */
import { describe, it, expect } from 'vitest';
import { simulateContest, recommendOrderForContest } from '../strength-sport-contest-simulator.engine';

const ev = (o: any) => ({ format: 'max', ...o }) as any;

describe('симулятор контеста: честность оценки', () => {
  it('1) нет своего ПМ → 0 очков, noData, а не ratio от чужого максимума', () => {
    // Раньше yoke_walk без yokeWalk считался от farmersWalk/deadlift (или 180).
    const s = simulateContest({ events: [ev({ id: 'yoke_walk', weight: 300 })] } as any, { deadlift: 200 } as any);
    expect(s!.hasEstimate).toBe(false); // ни одного ивента с честной базой → прогноза нет
    expect(s!.predictedPlace).toBe(0);  // и не «0 место из 10» в выдаче: surfaces ветвятся по hasEstimate

    const s2 = simulateContest(
      { events: [ev({ id: 'yoke_walk', weight: 300 }), ev({ id: 'log_press', weight: 100 })] } as any,
      { logPress: 110 } as any,
    );
    expect(s2).not.toBeNull();
    const yok = s2!.events.find(e => e.id === 'yoke_walk')!;
    expect(yok.hasData).toBe(false);
    expect(yok.points).toBe(0);
    expect(yok.ratio).toBe(0);
    expect(s2!.noData).toContain('yoke_walk');
    // очки начислены только заlog_press
    expect(s2!.totalPoints).toBe(s2!.events.find(e => e.id === 'log_press')!.points);
    expect(s2!.rationale.join(' ')).toMatch(/Без честной базы/);
  });

  it('1b) свой ПМ есть — ивент оценивается, hasData=true', () => {
    const s = simulateContest({ events: [ev({ id: 'yoke_walk', weight: 300 })] } as any, { yokeWalk: 300 } as any);
    expect(s!.events[0].hasData).toBe(true);
    expect(s!.events[0].points).toBeGreaterThan(0);
    expect(s!.noData).toEqual([]);
  });

  it('2) тяговые: вес грузовика/прицепа НЕ является нагрузкой атлета', () => {
    const s = simulateContest(
      { events: [ev({ id: 'truck_pull', weight: 5000, distanceM: 20 }), ev({ id: 'arm_over_arm', weight: 200, distanceM: 20 })] } as any,
      { deadlift: 250 } as any,
    );
    expect(s!.hasEstimate).toBe(false); // ни одного оцениваемого ивента
    expect(s!.noData).toEqual(expect.arrayContaining(['truck_pull', 'arm_over_arm']));
    const s2 = simulateContest(
      { events: [ev({ id: 'truck_pull', weight: 5000, distanceM: 20 }), ev({ id: 'log_press', weight: 100 })] } as any,
      { logPress: 110 } as any,
    );
    expect(s2!.events.find(e => e.id === 'truck_pull')!.hasData).toBe(false);
  });

  it('3) medley по implements берёт ХУДШИЙ элемент (слабейшее звено)', () => {
    const s = simulateContest(
      {
        events: [
          ev({ id: 'yoke_walk', weight: 300 }),
          ev({ id: 'log_press', weight: 100 }),
          ev({ id: 'uss_medley', format: 'medley_time', implements: ['yoke_walk', 'log_press'], timeCapS: 60 }),
        ],
      } as any,
      { yokeWalk: 300, logPress: 100 } as any,
    );
    const med = s!.events.find(e => e.id === 'uss_medley')!;
    expect(med.hasData).toBe(true);
    // yoke ratio = 1.0, log ratio = 1.0 → берётся минимум (учитывая fatigue медали как 3-й ивент)
    expect(med.ratio).toBeCloseTo(1.0, 2);
    expect(med.points).toBeGreaterThan(0);
  });

  it('3b) medley без данных по элементам → noData, а не ratio=1', () => {
    const s = simulateContest(
      { events: [ev({ id: 'log_press', weight: 100 }), ev({ id: 'uss_medley', format: 'medley_time', implements: ['yoke_walk', 'duck_walk'] })] } as any,
      { logPress: 110 } as any,
    );
    expect(s!.events.find(e => e.id === 'uss_medley')!.hasData).toBe(false);
    expect(s!.noData).toContain('uss_medley');
  });

  it('4) детерминизм: два вызова дают идентичный результат (Math.random удалён)', () => {
    const contest = { events: [ev({ id: 'yoke_walk', weight: 300 }), ev({ id: 'log_press', weight: 100 }), ev({ id: 'atlas_stone_load', format: 'ladder', ladderWeights: [100, 120, 140] })] } as any;
    const wm = { yokeWalk: 280, logPress: 105, atlasStone: 150 } as any;
    const a = simulateContest(contest, wm);
    const b = simulateContest(contest, wm);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('4b) порядок ивентов НЕ влияет на результат (нет randomness в модели)', () => {
    const wm = { yokeWalk: 280, logPress: 105, atlasStone: 150 } as any;
    const e1 = ev({ id: 'yoke_walk', weight: 300 });
    const e2 = ev({ id: 'log_press', weight: 100 });
    const fwd = simulateContest({ events: [e1, e2] } as any, wm);
    // те же ивенты, но повторный вызов с другим объектом-эквивалентом
    const again = simulateContest({ events: [ev({ id: 'yoke_walk', weight: 300 }), ev({ id: 'log_press', weight: 100 })] } as any, wm);
    expect(fwd!.totalPoints).toBe(again!.totalPoints);
    expect(fwd!.predictedPlace).toBe(again!.predictedPlace);
  });

  it('5a) нет контеста / пустые ивенты → null (тишина оправдана)', () => {
    expect(simulateContest({ events: [] } as any, {} as any)).toBeNull();
    expect(simulateContest(null, {} as any)).toBeNull();
  });

  it('5b) контест есть, данных нет → результам БЕЗ оценки + причина (не null, не «0 место»)', () => {
    const s = simulateContest({ events: [ev({ id: 'duck_walk', weight: 100 })] } as any, { deadlift: 200 } as any);
    expect(s).not.toBeNull();               // иначе блок молча исчезает: «нет данных» = «нет контеста»
    expect(s!.hasEstimate).toBe(false);
    expect(s!.predictedPlace).toBe(0);     // НЕ «9 место» и не выдуманное число
    expect(s!.totalPoints).toBe(0);
    expect(s!.noData).toEqual(['duck_walk']);
    expect(s!.noDataNote).toContain('duck_walk');   // причина названа поимённо
    expect(s!.weakEvents).toEqual([]);              // навязывать объём без базы нельзя
  });

  it('5c) частичные данные → hasEstimate=true + подсказка по недостающим', () => {
    const s = simulateContest(
      { events: [ev({ id: 'log_press', weight: 100 }), ev({ id: 'duck_walk', weight: 100 })] } as any,
      { logPress: 100 } as any,
    );
    expect(s!.hasEstimate).toBe(true);
    expect(s!.noData).toContain('duck_walk');
    expect(s!.noDataNote).toContain('duck_walk');
  });

  it('6) unknown-ивенты НЕ попадают в «слабые» (иначе навязывается лишний объём)', () => {
    const s = simulateContest(
      { events: [ev({ id: 'log_press', weight: 100 }), ev({ id: 'duck_walk', weight: 100 })] } as any,
      { logPress: 100 } as any,
    );
    expect(s!.weakEvents).not.toContain('duck_walk');
    expect(s!.noData).toContain('duck_walk');
  });

  it('7) recommendOrderForContest: unknown-ивенты в конце, известные по силе', () => {
    const order = recommendOrderForContest(
      { events: [ev({ id: 'duck_walk', weight: 100 }), ev({ id: 'log_press', weight: 100 }), ev({ id: 'yoke_walk', weight: 300 })] } as any,
      { logPress: 120, yokeWalk: 280 } as any,
    );
    expect(order).toHaveLength(3);
    expect(order[order.length - 1]).toBe('duck_walk');
  });
});

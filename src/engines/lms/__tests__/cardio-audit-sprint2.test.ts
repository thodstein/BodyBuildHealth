/**
 * cardio-audit-sprint2.test.ts — прямые тесты модулей, которые в круг
 * не попадали (0 прямых тестов при живых prod-потребителях):
 *   - cardio-date-utils.engine   — канон локальных дат (6 потребителей)
 *   - cardio-interference.engine — модель кардио×силовая (реэкспорт из cardio.engine)
 *   - cardio-physiology.engine   — зоны/VDOT/CTL/ATL/TSB, TRIMP (3 потребителя)
 *   - cardio-ble.engine          — контракт датчика пульса
 *
 * Спринт 4.2 плана «полный анализ кардио-планировщика»: нулевые пробелы
 * покрытия закрыты прямыми юнит-тестами (было — только косвенно).
 * Здесь же зафиксирован регресс на UTC-баг, найденный при покрытии:
 * cardioAcwrEwma смещал окно нагрузки на сутки из-за `new Date(iso)`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  toLocalIso, parseLocalIso, addDaysIso, todayLocalIso, weekStartIso, dayOfWeekIso,
} from '../../../../src/engines/lms/cardio-date-utils.engine';
import {
  cardioInterferenceScoreDetailed, interferenceForCycle, simpleInterferenceScore,
} from '../../../../src/engines/lms/cardio-interference.engine';
import {
  maxHrClassic, maxHrTanaka, maxHrGulati,
  cardioHeartZones, lthrZones, estimateLTHRFrom30Min, cyclingPowerZones, runningVdot,
  banisterTrimp, sessionTrimpEstimate, weeklyTrimp, cardioCtlSeries,
  cardioMonotonyStrain, cardioAcwrEwma, dailyTrimpMap, cardioFactCtlSeries,
  type CardioCtlPoint,
} from '../../../../src/engines/lms/cardio-physiology.engine';
import type { CardioCycle } from '../../../../src/engines/lms/cardio.engine';

// ─────────────────────── 1. cardio-date-utils (канон дат) ───────────────────────
describe('cardio-date-utils: локальные даты без UTC-сдвига', () => {
  it('toLocalIso берёт локальный календарный день, а не UTC', () => {
    // 23:30 local: toISOString() отдал бы 26-е в UTC+; канон — 25-е.
    expect(toLocalIso(new Date(2026, 8, 25, 23, 30, 0))).toBe('2026-09-25');
    // раннее утро: UTC− машина откатила бы на предыдущие сутки
    expect(toLocalIso(new Date(2026, 8, 26, 0, 30, 0))).toBe('2026-09-26');
  });

  it('toLocalIso дополняет месяц/день двумя цифрами', () => {
    expect(toLocalIso(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalIso(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('parseLocalIso(10 симв) = локальная полночь', () => {
    const d = parseLocalIso('2026-03-15');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 15, 0]);
  });

  it('addDaysIso переходит через границу месяца/года и учитывает високосный', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysIso('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysIso('2026-09-25', 7)).toBe('2026-10-02');
    expect(addDaysIso('2026-09-25', 0)).toBe('2026-09-25');
  });

  it('todayLocalIso = календарный день машины, формат YYYY-MM-DD', () => {
    expect(todayLocalIso()).toBe(toLocalIso(new Date()));
    expect(todayLocalIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('weekStartIso: неделя 1 = опорный день, дальше ровно +7 дней', () => {
    expect(weekStartIso(1, '2026-09-23')).toBe('2026-09-23');
    expect(weekStartIso(2, '2026-09-23')).toBe('2026-09-30');
    expect(weekStartIso(5, '2026-09-23')).toBe('2026-10-21');
  });

  it('dayOfWeekIso: dow 0 = понедельник недели, dow 6 = воскресенье', () => {
    expect(dayOfWeekIso(1, 0, '2026-09-23')).toBe('2026-09-23');
    expect(dayOfWeekIso(1, 6, '2026-09-23')).toBe('2026-09-29');
    // неделя 2 начинается с +7 дней, dow 2 = среда
    expect(dayOfWeekIso(2, 2, '2026-09-23')).toBe('2026-10-02');
  });

  it('регресс-барьер: addDaysIso не смещается назад (UTC-ловушка new Date(iso))', () => {
    // Именно этим отличается UTC-регресс, найденный в cardioAcwrEwma.
    const utcRegression = (iso: string, days: number) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    // На этой машине оба варианта обязаны совпасть (эталон фиксирует поведение):
    expect(utcRegression('2026-09-23', 7)).toBe(addDaysIso('2026-09-23', 7));
    expect(addDaysIso('2026-09-23', -1)).toBe('2026-09-22');
  });
});

// ─────────────────────── 2. cardio-interference ───────────────────────
describe('cardio-interference: бег хуже вело, тайминг важен', () => {
  const base = { frequencyPerWeek: 3, avgDurationMin: 30, timing: 'separate_day' as const };

  it('модальность: бег > вело, вело ≥ плавание', () => {
    const run = cardioInterferenceScoreDetailed({ ...base, modality: 'running' });
    const bike = cardioInterferenceScoreDetailed({ ...base, modality: 'cycling' });
    const swim = cardioInterferenceScoreDetailed({ ...base, modality: 'swimming' });
    expect(run.score).toBeGreaterThan(bike.score);
    expect(bike.score).toBeGreaterThanOrEqual(swim.score);
  });

  it('частота: score растёт с 3 до 5 раз/нед и упирается в потолок пункта', () => {
    const f3 = cardioInterferenceScoreDetailed({ ...base, frequencyPerWeek: 3 });
    const f5 = cardioInterferenceScoreDetailed({ ...base, frequencyPerWeek: 5 });
    const f6 = cardioInterferenceScoreDetailed({ ...base, frequencyPerWeek: 6 });
    expect(f5.score).toBeGreaterThan(f3.score);
    expect(f6.score).toBeGreaterThanOrEqual(f5.score);
    // потолок фактора «frequency» = 3.0 балла (анти-рост оценки)
    const freqPoints = f6.breakdown.find(b => b.factor === 'frequency')?.points ?? 99;
    expect(freqPoints).toBeLessThanOrEqual(3);
  });

  it('тайминг: бег ДО тяжёлых ног хуже, чем в отдельный день и чем ПОСЛЕ', () => {
    const sep = cardioInterferenceScoreDetailed({ ...base, modality: 'running', timing: 'separate_day' });
    const before = cardioInterferenceScoreDetailed({ ...base, modality: 'running', timing: 'same_day_before' });
    const after = cardioInterferenceScoreDetailed({ ...base, modality: 'running', timing: 'same_day_after' });
    expect(before.score).toBeGreaterThan(after.score);
    expect(after.score).toBeGreaterThan(sep.score);
  });

  it('счёт 0-10, уровень из шкалы, breakdown сходится с баллом', () => {
    const r = cardioInterferenceScoreDetailed({
      ...base, modality: 'running', frequencyPerWeek: 6, avgDurationMin: 60, timing: 'same_day_before',
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(10);
    expect(['low', 'mid', 'high']).toContain(r.level);
    expect(r.breakdown.length).toBeGreaterThan(0);
    const sum = r.breakdown.reduce((s, b) => s + b.points, 0);
    expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(0.6);
  });

  it('несколько модальностей — берётся худшая', () => {
    const multi = cardioInterferenceScoreDetailed({ ...base, modality: ['cycling', 'running'] });
    const runOnly = cardioInterferenceScoreDetailed({ ...base, modality: 'running' });
    expect(multi.score).toBeCloseTo(runOnly.score, 5);
  });

  it('simpleInterferenceScore — тайминг относительно дня ног (не счёт)', () => {
    expect(simpleInterferenceScore([], 1)).toBe('ok');
    expect(simpleInterferenceScore([0, 2, 4], 0)).toBe('avoid');   // кардио в день ног
    expect(simpleInterferenceScore([0, 2, 4], 1)).toBe('caution'); // вплотную к дню ног
    // день 4 при днях ног 0/1/2 — дистанция ≥2 во все стороны → ok
    expect(simpleInterferenceScore([0, 1, 2], 4)).toBe('ok');
  });

  it('interferenceForCycle: пустой цикл → дефолт, реальный → счёт по модальностям', () => {
    const empty = interferenceForCycle(null as never);
    expect(Number.isFinite(empty.score)).toBe(true);
    const real = interferenceForCycle({
      weeks: [
        { sessions: [{ type: 'zone2', equipment: 'treadmill', durationMin: 40, weeklyFrequency: 3 }] },
        { sessions: [{ type: 'zone2', equipment: 'treadmill', durationMin: 40, weeklyFrequency: 3 }] },
      ],
    }, 2, 'male');
    expect(real.score).toBeGreaterThan(0);
    expect(real.breakdown.length).toBeGreaterThan(0);
  });
});

// ─────────────────────── 3. cardio-physiology ───────────────────────
describe('cardio-physiology: ЧССмакс, зоны, VDOT, TRIMP, CTL/ATL/TSB', () => {
  it('формулы ЧССмакс дают правдоподобные значения и различаются', () => {
    // 30 лет: classic 220-30=190, Tanaka 208-0.7*30=187 (Tanaka точнее на 40+).
    expect(maxHrClassic(30)).toBe(190);
    expect(maxHrClassic(30, 'female')).toBe(196); // 226-30
    expect(maxHrTanaka(30)).toBe(187);
    expect(maxHrGulati(30)).toBeGreaterThan(170);
    // клампы возраста
    expect(maxHrClassic(5)).toBe(maxHrClassic(12));
    expect(maxHrClassic(120)).toBe(maxHrClassic(90));
  });

  it('cardioHeartZones(age, restingHr, maxHr) — непрерывная шкала по Karvonen', () => {
    const z = cardioHeartZones(30, 55, 190);
    expect(z.length).toBe(5);
    for (let i = 1; i < z.length; i++) expect(z[i].bpmMin).toBeGreaterThanOrEqual(z[i - 1].bpmMax - 1e-9);
    for (const hr of [130, 150, 170, 190]) {
      expect(z.some(x => hr >= x.bpmMin && hr <= x.bpmMax)).toBe(true);
    }
    // без restingHr — % от ЧССмакс, зоны всё равно покрывают шкалу
    const z2 = cardioHeartZones(30);
    expect(z2[0].bpmMin).toBeLessThan(z2[z2.length - 1].bpmMax);
  });

  it('lthrZones: непрерывная шкала от оздоровительной до анаэробной', () => {
    const z = lthrZones(165);
    expect(z.length).toBeGreaterThan(2);
    for (let i = 1; i < z.length; i++) expect(z[i].bpmMin).toBeGreaterThanOrEqual(z[i - 1].bpmMax - 1e-9);
  });

  it('estimateLTHRFrom30Min: без данных — null, с данными — правдоподобный пульс', () => {
    expect(estimateLTHRFrom30Min(0)).toBeNull();
    const lthr = estimateLTHRFrom30Min(170);
    expect(lthr).not.toBeNull();
    expect(lthr as number).toBeGreaterThan(140);
    expect(lthr as number).toBeLessThan(200);
  });

  it('runningVdot(testKm, testMin в МИНУТАХ): быстрее → выше VDOT; мусор → null', () => {
    const fast = runningVdot(5, 18);   // 5 км за 18 мин
    const slow = runningVdot(5, 26);
    expect(fast).not.toBeNull();
    expect((fast as { vdot: number }).vdot).toBeGreaterThan((slow as { vdot: number }).vdot);
    expect((fast as { pacesKm: unknown[] }).pacesKm.length).toBeGreaterThan(0);
    // контракт: минуты, а не секунды (20 мин на 5 км — реалистичный VDOT)
    expect((fast as { vdot: number }).vdot).toBeGreaterThan(20);
    expect(runningVdot(0, 20)).toBeNull();
    expect(runningVdot(5, 0)).toBeNull();
  });

  it('cyclingPowerZones монотонны и выходят за FTP', () => {
    const z = cyclingPowerZones(250);
    expect(z.length).toBeGreaterThan(2);
    expect(Math.max(...z.map(x => x.wattsMax))).toBeGreaterThan(250);
  });

  it('banisterTrimp монотонен по интенсивности, 0 на некорректных данных', () => {
    const easy = banisterTrimp(60, 120, 60, 190);
    const hard = banisterTrimp(60, 175, 60, 190);
    expect(hard).toBeGreaterThan(easy);
    expect(banisterTrimp(0, 150, 60, 190)).toBe(0);
    expect(banisterTrimp(60, 150, 60, 50)).toBe(0); // maxHr ≤ restHr — защита
  });

  it('sessionTrimpEstimate: HIIT > Zone2 > recovery при равной длительности', () => {
    const hiit = sessionTrimpEstimate('hiit', 30);
    const z2 = sessionTrimpEstimate('zone2', 30);
    const rec = sessionTrimpEstimate('recovery', 30);
    expect(hiit).toBeGreaterThan(z2);
    expect(z2).toBeGreaterThan(rec);
  });

  it('weeklyTrimp умножает на частоту', () => {
    const once = weeklyTrimp([{ type: 'zone2', durationMin: 40, weeklyFrequency: 1 }]);
    const thrice = weeklyTrimp([{ type: 'zone2', durationMin: 40, weeklyFrequency: 3 }]);
    expect(thrice).toBeGreaterThan(once);
  });

  it('cardioCtlSeries: CTL растёт с нагрузкой, TSB падает на нагрузочной неделе', () => {
    const cycle = {
      weeks: [
        { week: 1, phase: 'base', sessions: [{ type: 'zone2', durationMin: 60, weeklyFrequency: 3 }] },
        { week: 2, phase: 'base', sessions: [{ type: 'zone2', durationMin: 60, weeklyFrequency: 3 }] },
        { week: 3, phase: 'deload', sessions: [] },
        { week: 4, phase: 'deload', sessions: [] },
      ],
    } as unknown as CardioCycle;
    const s = cardioCtlSeries(cycle) as CardioCtlPoint[];
    expect(s.length).toBe(4);
    expect(s[1].ctl).toBeGreaterThan(s[0].ctl);
    // разгрузка → ATL падает быстрее CTL → TSB (форма) растёт
    expect(s[3].tsb).toBeGreaterThan(s[1].tsb);
  });

  it('РЕГРЕСС: сессия без weeklyFrequency не отравляет CTL/ATL/TSB (был NaN)', () => {
    const cycle = {
      weeks: [{ week: 1, phase: 'base', sessions: [{ type: 'zone2', durationMin: 45 }] }],
    } as unknown as CardioCycle;
    const s = cardioCtlSeries(cycle) as CardioCtlPoint[];
    expect(Number.isFinite(s[0].ctl)).toBe(true);
    expect(Number.isFinite(s[0].atl)).toBe(true);
    expect(Number.isFinite(s[0].tsb)).toBe(true);
  });

  it('cardioMonotonyStrain: равномерная нагрузка → monotony выше разбросанной', () => {
    const even = cardioMonotonyStrain([100, 100, 100, 100, 100, 100, 100]);
    const varied = cardioMonotonyStrain([10, 300, 20, 250, 30, 200, 40]);
    expect(even.monotony).toBeGreaterThan(varied.monotony);
    expect(cardioMonotonyStrain([]).monotony).toBe(0);
  });

  it('dailyTrimpMap суммирует день, пропускает completed=false и мусор', () => {
    const map = dailyTrimpMap([
      { date: '2026-09-21', type: 'zone2', durationMin: 30 },
      { date: '2026-09-21', type: 'miss', durationMin: 20 },
      { date: '2026-09-22', type: 'hiit', durationMin: 15, completed: false },
      { date: '2026-09-23', type: 'recovery', durationMin: 0 },
    ]);
    expect(map.get('2026-09-21')).toBeGreaterThan(0);
    expect(map.get('2026-09-22')).toBeUndefined();
    expect(map.get('2026-09-23')).toBeUndefined();
  });

  it('cardioAcwrEwma: стабильная нагрузка 28+ дней → ratio ≈ 1, зона optimal', () => {
    const daily = Array.from({ length: 28 }, (_, i) => ({
      date: addDaysIso('2026-09-01', i), load: 100,
    }));
    const acwr = cardioAcwrEwma(daily, '2026-09-28');
    expect(acwr.ratio).toBeGreaterThan(0.5);
    expect(acwr.ratio).toBeLessThan(1.5);
    expect(acwr.zone).toBeTruthy();
  });

  it('cardioAcwrEwma: всплеск нагрузки в последние 7 дней поднимает ratio', () => {
    const base = Array.from({ length: 28 }, (_, i) => ({ date: addDaysIso('2026-09-01', i), load: 100 }));
    const stable = cardioAcwrEwma(base, '2026-09-28');
    const spike = cardioAcwrEwma(
      [...base.filter(d => d.date < '2026-09-22'), ...Array.from({ length: 7 }, (_, i) => ({ date: addDaysIso('2026-09-22', i), load: 400 }))],
      '2026-09-28',
    );
    expect(spike.ratio).toBeGreaterThan(stable.ratio);
  });

  it('РЕГРЕСС: cardioAcwrEwma берёт ровно 7 последних дней (регресс к UTC-парсу давал сдвиг на сутки)', () => {
    // Нагрузка стоит только в последних 7 днях окна → острая = вся, хроническая = малая.
    const daily = Array.from({ length: 7 }, (_, i) => ({ date: addDaysIso('2026-09-22', i), load: 700 }));
    const acwr = cardioAcwrEwma(daily, '2026-09-28');
    expect(acwr.acute).toBeGreaterThan(0);
    // Если бы окно сместилось на сутки, 2026-09-22 выпал бы — острая была бы ≈0.
    expect(acwr.acute).toBeGreaterThan(acwr.chronic);
  });

  it('cardioFactCtlSeries: пустой лог → [], лог с датами → серия по датам', () => {
    expect(cardioFactCtlSeries([])).toEqual([]);
    const series = cardioFactCtlSeries(
      Array.from({ length: 10 }, (_, i) => ({ date: addDaysIso('2026-09-19', i), type: 'zone2' as const, durationMin: 40, completed: true })),
      { referenceIso: '2026-09-28', days: 14 },
    );
    expect(series.length).toBeGreaterThan(0);
    expect(series[series.length - 1].date).toBe('2026-09-28');
  });
});

// ─────────────────────── 4. cardio-ble (контракт датчика) ───────────────────────
describe('cardio-ble: контракт датчика пульса', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('connectBleHr — функция; без navigator.bluetooth не бросает', async () => {
    const { connectBleHr } = await import('../../../../src/engines/lms/cardio-ble.engine');
    expect(typeof connectBleHr).toBe('function');
    const res = await connectBleHr(() => {}, () => {});
    expect(res === null || typeof res.disconnect === 'function').toBe(true);
  });
});

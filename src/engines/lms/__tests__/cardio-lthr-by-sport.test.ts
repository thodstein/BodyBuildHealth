/**
 * cardio-lthr-by-sport.test.tsx — спринт 5.5: ручной ввод LTHR по видам спорта.
 *
 * Граница, которую закрывает этот тест: цепочка `config.lthrBySport` → движок →
 * дашборд работала, но ПОЛЬЯ ввода не было — значение неоткуда было взять, кроме
 * правки хранилища руками. Теперь поле есть (шаг «Атлет»), и оно обязано
 * доезжать до цикла.
 *
 * Проверяем не «поле нарисовано», а следствие: цикл, собранный с эталонами по
 * видам, отдаёт их в config, и разбор TID раскладывает факт по своим базам.
 */
import { describe, it, expect } from 'vitest';
import { buildCardioCycle, lthrBySportFromInput } from '../cardio.engine';
import { tidFactBySport, type FactSession } from '../cardio-tid.engine';

/** Конвертер ввода: диапазон 80–220, 'other' отбрасывается, пустое = не задано. */
describe('lthrBySportFromInput — единый канон ввода', () => {
  it('оставляет только корректные значения', () => {
    expect(lthrBySportFromInput({ run: '170', bike: '150', row: '' })).toEqual({ run: 170, bike: 150 });
  });
  it('отбрасывает вне диапазона и мусор', () => {
    expect(lthrBySportFromInput({ run: '79', bike: '221', row: 'abc' })).toBeUndefined();
    expect(lthrBySportFromInput({ run: '70' })).toBeUndefined();
  });
  it('не заводит эталон для «другого» — там базы нет', () => {
    expect(lthrBySportFromInput({ other: '160' })).toBeUndefined();
  });
  it('пустой ввод = undefined (прежнее поведение)', () => {
    expect(lthrBySportFromInput(undefined)).toBeUndefined();
    expect(lthrBySportFromInput({})).toBeUndefined();
  });
});

describe('Цикл хранит эталоны по видам спорта', () => {
  it('config.lthrBySport доезжает до цикла целиком', () => {
    const c = buildCardioCycle({
      goal: 'health', totalWeeks: 4, id: 'lthr-sport-1', startDate: '2026-01-05',
      lthr: 165, lthrBySport: { run: 172, bike: 152 },
    });
    expect(c.config?.lthr).toBe(165);
    expect(c.config?.lthrBySport).toEqual({ run: 172, bike: 152 });
  });

  it('без полей config.lthrBySport не появляется (байт-в-байт)', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'lthr-sport-2', startDate: '2026-01-05', lthr: 165 });
    expect(c.config?.lthrBySport).toBeUndefined();
  });
});

describe('TID раскладывает факт по базам своего вида', () => {
  it('один и тот же пульс даёт разные зоны при разных эталонах', () => {
    // Смысл фичи: 150 уд/мин у бегуна (LTHR 172) — это Z2, у велосипедиста
    // (LTHR 152) — почти Z3. База берётся по виду, иначе эталон по видам
    // ничего бы не менял.
    const log: FactSession[] = [
      { date: '2026-01-05', type: 'zone2', durationMin: 40, avgHr: 150, sport: 'run' },
      { date: '2026-01-06', type: 'zone2', durationMin: 40, avgHr: 150, sport: 'bike' },
    ];
    const facts = tidFactBySport(log, { run: { lthr: 172 }, bike: { lthr: 152 } });
    const run = facts.find(f => f.sport === 'run');
    const bike = facts.find(f => f.sport === 'bike');
    expect(run).toBeDefined();
    expect(bike).toBeDefined();
    // Z2 = 81..89% от эталона: 150/172 = 87% → Z2; 150/152 = 99% → Z3.
    expect(run!.fact.z2Min).toBe(40);
    expect(bike!.fact.z2Min).toBe(0);
    expect(bike!.fact.z3Min).toBe(40);
    // И оба факта честно помечены как посчитанные по СВОЕМУ эталону.
    expect(run!.ownRef).toBe(true);
    expect(bike!.ownRef).toBe(true);
  });

  it('без эталонов по видам факт идёт от базы по умолчанию', () => {
    const log: FactSession[] = [
      { date: '2026-01-05', type: 'zone2', durationMin: 40, avgHr: 150, sport: 'run' },
    ];
    const facts = tidFactBySport(log, {}, { lthr: 165 });
    expect(facts).toHaveLength(1);
    expect(facts[0].sport).toBe('run');
    expect(facts[0].ownRef).toBe(false);        // своего эталона не было
    expect(facts[0].fact.basis).toBe('lthr');   // посчитали от базы по умолчанию
  });
});

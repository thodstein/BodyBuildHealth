/**
 * pl-protocol-import.test.ts — Фаза 6, п.4: импорт протокола соревнования.
 *
 * Контракт: парсер толерантный, но НЕ угадывает. Нет маркера → made = null
 * (а не «зачёт»), аксессуар «тяга к поясу» не становится становой, дубли
 * попыток отбрасываются с предупреждением.
 */
import { describe, expect, it } from 'vitest';
import { parseMeetProtocol } from '../pl-protocol-import.engine';

describe('parseMeetProtocol — импорт протокола', () => {
  it('разбирает строки с движением, номером, весом и маркером', () => {
    const r = parseMeetProtocol('Присед 2 192.5 ✅\nПрисед 3 202,5 ❌\nЖим лёжа 140 x');
    expect(r.rows).toEqual([
      { lift: 'bench', liftName: 'Жим', attempt: 1, weight: 140, made: false },
      { lift: 'squat', liftName: 'Присед', attempt: 2, weight: 192.5, made: true },
      { lift: 'squat', liftName: 'Присед', attempt: 3, weight: 202.5, made: false },
    ]);
  });

  it('номер попытки выводится из порядка строк внутри движения', () => {
    const r = parseMeetProtocol('Присед 180 ✅\nПрисед 190 ✅\nПрисед 200 ✅');
    expect(r.rows.map(x => x.attempt)).toEqual([1, 2, 3]);
    expect(r.rows.every(x => x.made === true)).toBe(true);
  });

  it('без маркера зачёта результат НЕ выдумывается (made = null + предупреждение)', () => {
    const r = parseMeetProtocol('Присед 180');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].made).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/без маркера/);
  });

  it('«тяга к поясу» не считается становой', () => {
    const r = parseMeetProtocol('Тяга к поясу 90 ✅');
    expect(r.rows).toHaveLength(0);
    expect(r.warnings.join(' ')).toMatch(/без движения/);
  });

  it('голая «Тяга» — становая, но с честным предупреждением', () => {
    const r = parseMeetProtocol('Тяга 240 ✅');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].lift).toBe('deadlift');
    expect(r.warnings.join(' ')).toMatch(/без уточнения/);
  });

  it('дубль попытки отбрасывается с предупреждением', () => {
    const r = parseMeetProtocol('Присед 1 180 ✅\nПрисед 1 185 ✅');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].weight).toBe(180);
    expect(r.warnings.join(' ')).toMatch(/Дубль/);
  });

  it('пустой ввод → только предупреждение', () => {
    const r = parseMeetProtocol('   ');
    expect(r.rows).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/Пустой/);
  });

  it('строки-заголовки без движения не ломают разбор', () => {
    const r = parseMeetProtocol('Протокол соревнования 2026-11-03\nПрисед 185 ✅\nСудья: Иванов');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].weight).toBe(185);
  });
});

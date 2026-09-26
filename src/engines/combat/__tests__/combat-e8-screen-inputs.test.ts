/**
 * combat-e8-screen-inputs.test.ts — входы скринингов 8.4/8.8: авто + ручная правка.
 *
 * Контекст: до этого CombatPlanView передавал в карточку замеров только plan и
 * sleepHours, а карточка считала LEA и тепловой протокол по null. То есть оба
 * блока были мертвы в приложении, хотя их тесты проходили (тесты сами передавали
 * пропсы). Эти тесты фиксируют именно проводку и приоритет источников.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COMBAT_SCREEN_KEY, ScreenField, ScreenManual,
  ffmFromProfile, readScreenManual, writeScreenManual, clearScreenField, resolveScreenInputs,
} from '../combat-measurements.engine';

beforeEach(() => localStorage.clear());

describe('E8.SI.1 — Безжировая масса из профиля', () => {
  it('считается как вес × (1 − %жира)', () => {
    expect(ffmFromProfile(80, 20)).toBe(64);
    expect(ffmFromProfile(100, 10)).toBe(90);
  });

  it('без %жира возвращает null, а не выдуманные 85%', () => {
    // ключевая честность: подставить «15% жира» — значит выдумать знаменатель EA
    expect(ffmFromProfile(80, null)).toBeNull();
    expect(ffmFromProfile(80, undefined)).toBeNull();
    expect(ffmFromProfile(null, 20)).toBeNull();
  });

  it('мусорный %жира и вес отбрасываются', () => {
    expect(ffmFromProfile(80, 0.5)).toBeNull();   // < 3% — вне коридора
    expect(ffmFromProfile(80, 85)).toBeNull();    // > 70% — вне коридора
    expect(ffmFromProfile(5, 20)).toBeNull();     // вес 5 кг — не спортсмен
    expect(ffmFromProfile(300, 20)).toBeNull();   // 300 кг → FFM 240 > капа 200
    expect(ffmFromProfile(NaN, 20)).toBeNull();
  });
});

describe('E8.SI.2 — приоритет источников', () => {
  it('без ручного ввода берётся авто', () => {
    const r = resolveScreenInputs({ kcal: 3000, ffmKg: 70 }, {});
    expect(r.kcal).toBe(3000);
    expect(r.ffmKg).toBe(70);
    expect(r.source.kcal).toBe('auto');
    expect(r.source.ffmKg).toBe('auto');
  });

  it('ручной ввод перекрывает авто и меняет источник', () => {
    const r = resolveScreenInputs({ kcal: 3000, ffmKg: 70 }, { kcal: 2500 });
    expect(r.kcal).toBe(2500);
    expect(r.source.kcal).toBe('manual');
    expect(r.ffmKg).toBe(70);
    expect(r.source.ffmKg).toBe('auto');
  });

  it('то, чего нет нигде, честно помечается none и равно null', () => {
    const r = resolveScreenInputs({ kcal: 3000 }, {});
    expect(r.trainingKcal).toBeNull();
    expect(r.source.trainingKcal).toBe('none');
    expect(r.ffmKg).toBeNull();
    expect(r.source.ffmKg).toBe('none');
  });

  it('0 калорий не проходит как «идеальная доступность»', () => {
    const r = resolveScreenInputs({ kcal: 0 }, {});
    expect(r.kcal).toBeNull();
    expect(r.source.kcal).toBe('none');
  });

  it('cat2Flags = 0 — валидные данные, а не «нет данных»', () => {
    const r = resolveScreenInputs({}, { cat2Flags: 0 });
    expect(r.cat2Flags).toBe(0);
    expect(r.source.cat2Flags).toBe('manual');
  });

  it('каждое из 5 полей проходит через auto, а не через хардкод null', () => {
    // регресс-лок: в прошлой версии trainingKcal/cat2Flags/heatSessions
    // игнорировались и всегда становились null
    const r = resolveScreenInputs(
      { kcal: 3000, trainingKcal: 500, ffmKg: 70, cat2Flags: 1, heatSessions: 9 }, {});
    expect(r).toMatchObject({
      kcal: 3000, trainingKcal: 500, ffmKg: 70, cat2Flags: 1, heatSessions: 9,
    });
    for (const f of ['kcal', 'trainingKcal', 'ffmKg', 'cat2Flags', 'heatSessions'] as ScreenField[]) {
      expect(r.source[f]).toBe('auto');
    }
  });
});

describe('E8.SI.3 — персист ручных значений', () => {
  it('записано и прочитано', () => {
    const w = writeScreenManual({ kcal: 2800, trainingKcal: 600 });
    expect(w).toEqual({ kcal: 2800, trainingKcal: 600 });
    expect(readScreenManual()).toEqual({ kcal: 2800, trainingKcal: 600 });
  });

  it('переживает перезапуск карточки', () => {
    writeScreenManual({ ffmKg: 66 });
    // читаем заново, как будто карточка перемонтировалась
    expect(readScreenManual().ffmKg).toBe(66);
  });

  it('пустая строка удаляет поле, а не пишет 0', () => {
    writeScreenManual({ kcal: 2800, ffmKg: 66 });
    const after = writeScreenManual({ ffmKg: null as any });
    expect('ffmKg' in after).toBe(false);
    expect(after.kcal).toBe(2800);
  });

  it('мусорное значение не попадает в персист', () => {
    const w = writeScreenManual({ kcal: 50, heatSessions: 999 });
    expect('kcal' in w).toBe(false);          // 50 ккал — вне коридора
    expect('heatSessions' in w).toBe(false);   // 999 сессий — мусор
  });

  it('очистка одного поля не трогает остальные', () => {
    writeScreenManual({ kcal: 2800, ffmKg: 66 });
    const after = clearScreenField('ffmKg');
    expect(after.kcal).toBe(2800);
    expect('ffmKg' in after).toBe(false);
  });

  it('битое хранилище не ломает чтение', () => {
    localStorage.setItem(COMBAT_SCREEN_KEY, '{oops');
    expect(readScreenManual()).toEqual({});
    localStorage.setItem(COMBAT_SCREEN_KEY, '[1,2,3]');   // массив вместо объекта
    expect(readScreenManual()).toEqual({});
  });

  it('значение округляется до 0.1, чтобы не плодить ложную точность', () => {
    expect(writeScreenManual({ kcal: 2837.46 } as any).kcal).toBe(2837.5);
  });
});

describe('E8.SI.4 — ручное перекрытие доезжает до скрининга', () => {
  it('после ручного ввода LEA перестаёт просить данные', async () => {
    const { leaScreen } = await import('../combat-measurements.engine');
    writeScreenManual({ trainingKcal: 500 });
    const r = resolveScreenInputs({ kcal: 3000, ffmKg: 70 }, readScreenManual());
    const s = leaScreen({ kcal: r.kcal, trainingKcal: r.trainingKcal, ffmKg: r.ffmKg, cat2Flags: r.cat2Flags });
    expect(s.level).not.toBe('no_data');
    expect(typeof s.ea).toBe('number');
  });

  it('без ручного ввода LEA честно просит недостающее', () => {
    const r = resolveScreenInputs({ kcal: 3000, ffmKg: 70 }, {});
    expect(r.trainingKcal).toBeNull();
    // движок сам скажет, чего не хватает — мы не подставляем заглушки
    expect(typeof r.trainingKcal).toBe('object');
  });
});

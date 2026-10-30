/**
 * planner-special-meals-store.test.ts — B18 (аудит 2026-10).
 *
 * Находка: настройки держали снимок `he_special_meals`, прочитанный ОДИН раз при
 * монтировании, и при добавлении писали `[...снимок, новое]`. Рефиды, добавленные
 * календарём ПОСЛЕ монтирования, при следующем сохранении из настроек исчезали —
 * молчаливая потеря данных.
 *
 * Замок: запись всегда read-modify-write от актуального содержимого ключа.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SPECIAL_MEALS_KEY,
  SPECIAL_MEALS_EVENT,
  readSpecialMeals,
  writeSpecialMeals,
  addSpecialMeals,
  removeSpecialMeal,
  subscribeSpecialMeals,
} from '../planner-special-meals-store';

const seed = (list: any[]) => localStorage.setItem(SPECIAL_MEALS_KEY, JSON.stringify(list));

beforeEach(() => {
  try { localStorage.clear(); } catch {}
});

describe('B18: календарные рефиды не затираются сохранением из настроек', () => {
  it('главный кейс: 8 рефидов из календаря + читмил из настроек = 9 записей', () => {
    // 1) календарь добавил 8 рефидов
    const refeeds = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-11-${String(i * 7 + 1).padStart(2, '0')}`, type: 'refeed',
    }));
    expect(addSpecialMeals(refeeds).added).toBe(8);
    expect(readSpecialMeals()).toHaveLength(8);

    // 2) настройки добавляют читмил (раньше писали [...снимок, читмил] → 1 запись)
    const res = addSpecialMeals([{ date: '2026-12-31', type: 'cheat_meal', notes: 'НГ' }]);

    expect(res.list).toHaveLength(9);
    expect(readSpecialMeals()).toHaveLength(9);
    // ни один рефид не потерян
    for (const r of refeeds) {
      expect(readSpecialMeals().some(m => m.date === r.date && m.type === 'refeed')).toBe(true);
    }
    expect(readSpecialMeals().some(m => m.type === 'cheat_meal')).toBe(true);
  });

  it('обратный порядок (настройки → календарь) тоже сохраняет всё', () => {
    addSpecialMeals([{ date: '2026-12-31', type: 'cheat_meal' }]);
    addSpecialMeals([{ date: '2026-11-01', type: 'refeed' }]);
    expect(readSpecialMeals()).toHaveLength(2);
  });

  it('дубли по дате+типу не создаются (календарь можно нажимать повторно)', () => {
    const r1 = addSpecialMeals([{ date: '2026-11-01', type: 'refeed' }]);
    const r2 = addSpecialMeals([{ date: '2026-11-01', type: 'refeed' }]);
    expect(r1.added).toBe(1);
    expect(r2.added).toBe(0);
    expect(readSpecialMeals()).toHaveLength(1);
  });

  it('разные типы на одну дату — разные записи', () => {
    addSpecialMeals([{ date: '2026-11-01', type: 'refeed' }]);
    addSpecialMeals([{ date: '2026-11-01', type: 'cheat_meal' }]);
    expect(readSpecialMeals()).toHaveLength(2);
  });

  it('удаление убирает только целевую запись', () => {
    addSpecialMeals([
      { date: '2026-11-01', type: 'refeed' },
      { date: '2026-11-08', type: 'refeed' },
      { date: '2026-11-08', type: 'cheat_meal' },
    ]);
    const res = removeSpecialMeal({ date: '2026-11-08', type: 'refeed' });
    expect(res.removed).toBe(1);
    expect(readSpecialMeals()).toHaveLength(2);
    expect(readSpecialMeals().some(m => m.date === '2026-11-08' && m.type === 'refeed')).toBe(false);
    expect(readSpecialMeals().some(m => m.date === '2026-11-08' && m.type === 'cheat_meal')).toBe(true);
  });

  it('битый JSON в ключе не ломает чтение (возвращается пустой список)', () => {
    localStorage.setItem(SPECIAL_MEALS_KEY, '{не json');
    expect(readSpecialMeals()).toEqual([]);
    expect(addSpecialMeals([{ date: '2026-11-01', type: 'refeed' }]).added).toBe(1);
  });

  it('записи без даты/типа отфильтровываются при чтении и добавлении', () => {
    seed([{ date: '2026-11-01', type: 'refeed' }, { notes: 'мусор' }, null, 'строка']);
    expect(readSpecialMeals()).toHaveLength(1);
    const res = addSpecialMeals([{ date: '', type: 'refeed' } as any]);
    expect(res.added).toBe(0);
  });

  it('подписчик получает актуальный список после записи из другого места', () => {
    const seen: any[] = [];
    const unsub = subscribeSpecialMeals(list => seen.push(list));
    writeSpecialMeals([{ date: '2026-11-01', type: 'refeed' }]);
    addSpecialMeals([{ date: '2026-11-02', type: 'refeed' }]);
    unsub();
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1]).toHaveLength(2);
    // после отписки новых уведомлений нет
    const before = seen.length;
    writeSpecialMeals([{ date: '2026-11-03', type: 'refeed' }]);
    expect(seen.length).toBe(before);
  });

  it('событие изменения — кастомное (storage сам себе в том же документе не приходит)', () => {
    let fired = 0;
    const h = () => { fired++; };
    window.addEventListener(SPECIAL_MEALS_EVENT, h);
    writeSpecialMeals([{ date: '2026-11-01', type: 'refeed' }]);
    window.removeEventListener(SPECIAL_MEALS_EVENT, h);
    expect(fired).toBe(1);
  });

  it('лимит 400 записей: старые обрезаются, новые сохраняются', () => {
    const many = Array.from({ length: 410 }, (_, i) => ({
      date: `2027-01-${String((i % 28) + 1).padStart(2, '0')}`, type: `t${i}`,
    }));
    writeSpecialMeals(many);
    const list = readSpecialMeals();
    expect(list).toHaveLength(400);
    expect(list[list.length - 1].type).toBe('t409');
  });
});

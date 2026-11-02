/**
 * bb-compound-classifier.test.ts (расширение O-3, итерация F)
 *
 * До фикса классификатор сначала прогонял regex по имени и только потом смотрел
 * каталог. Из-за этого `подъём` в регексе переводил в «изоляцию» тяжёлые
 * многосуставные движения («Подъём на грудь» = clean, «Подъём ног в висе»,
 * «Турецкий подъём», «Махи гирей» = swing), хотя каталог (`EXERCISE_CATALOG.type`)
 * про них знает правду.
 *
 * Правило теперь одно: структурные данные каталога старше догадок по имени;
 * regex — только fallback для упражнений, которых в каталоге нет.
 *
 * Таблица ниже — то, что должно остаться верным при любом будущем изменении
 * эвристик: имя → ожидаемый класс.
 */
import { describe, expect, it } from 'vitest';
import { isCompoundEx, isIsolationByName } from '../bb-session-order.engine';

const ex = (name: string, role: 'primary' | 'accessory' = 'accessory') => ({
  muscle: 'chest',
  name,
  exerciseName: name,
  role,
  character: 'тяж' as const,
  sets: 3,
  repsRange: [8, 10] as [number, number],
  rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 50 }],
});

describe('O-3: классификатор compound/isolation', () => {
  it('каталог старше эвристик по имени', () => {
    // Все эти имена ловятся regex'ом «подъём/мах/разгибан», но каталог знает,
    // что движение многосуставное (или наоборот) — верим каталогу.
    for (const name of [
      'Подъём ног в висе',
      'Подъём коленей в висе',
      'Подъём корпуса (sit-up)',
      'Турецкий подъём (TGU)',
      'Махи гирей',
      'Махи двумя гирями',
      'Нордик-сгибание (Nordic ham curl)',
      'Обратное скандинавское сгибание',
    ]) {
      expect(isCompoundEx(ex(name) as any), name).toBe(true);
    }
    for (const name of [
      'Французский жим лёжа (EZ-гриф)',
      'Разгибание на блоке с прямым грифом',
      'Подъём штанги на бицепс стоя',
      'Махи гантелями в стороны',
      'Пуловер со штангой',
      'Сведение в кроссовере снизу',
      'Тяга к лицу (face pull)',
    ]) {
      expect(isCompoundEx(ex(name) as any), name).toBe(false);
    }
  });

  it('без каталога: чист и тяги остаются compound, «подъём на ...» — изоляция', () => {
    // Имён в каталоге нет — работает fallback по имени.
    expect(isCompoundEx(ex('Подъём на грудь (clean)', 'primary') as any)).toBe(true);
    expect(isCompoundEx(ex('Тяга в наклоне', 'primary') as any)).toBe(true);
    expect(isCompoundEx(ex('Жим ногами', 'primary') as any)).toBe(true);
    expect(isCompoundEx(ex('Приседания со штангой', 'primary') as any)).toBe(true);
    // Памп-изоляции не должны становиться compound из-за отсутствия в каталоге.
    for (const name of [
      'Подъём на носки в тренажёре Смита',
      'Подъём гантелей через стороны',
      'Подъём на скамье Скотта (нестандартная стойка)',
      'Разгибание ног в нестандартном тренажёре',
      'Махи в наклоне на заднюю дельту (нестандарт)',
    ]) {
      expect(isCompoundEx(ex(name) as any), name).toBe(false);
    }
  });

  it('isIsolationByName не считает изоляцией чист и вис на перекладине', () => {
    // Функция экспортируется и используется валидатором — её поведение
    // не должно расходиться с isCompoundEx на тех же именах.
    expect(isIsolationByName('Подъём на грудь (clean)')).toBe(false);
    expect(isIsolationByName('Махи гирей')).toBe(true); // по имени движение «мах»
    expect(isIsolationByName('Подъём на носки стоя')).toBe(true);
    expect(isIsolationByName('Французский жим лёжа')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { sessionTagLabel, muscleLabel, targetLabelFor, exerciseTargetNote, movementPatternLabel, MOVEMENT_PATTERN_RU } from '../bb-labels';

describe('bb-labels (локализация + targetLabel)', () => {
  it('sessionTagLabel переводит день на русский', () => {
    expect(sessionTagLabel('Pull')).toBe('Спина/Бицепс');
    expect(sessionTagLabel('ChestBack')).toBe('Грудь/Спина');
    expect(sessionTagLabel('FullBody')).toBe('Всё тело');
    expect(sessionTagLabel('Legs')).toBe('Ноги');
    expect(sessionTagLabel('Glutes')).toBe('Ягодицы');
    expect(sessionTagLabel('LegsBiceps')).toBe('Ноги/Бицепс');
  });

  it('movementPatternLabel переводит все 25 паттернов каталога', () => {
    expect(movementPatternLabel('horizontal_push')).toBe('Горизонтальный жим');
    expect(movementPatternLabel('vertical_pull')).toBe('Вертикальная тяга');
    expect(movementPatternLabel('hinge')).toBe('Тазобедренный шарнир');
    expect(movementPatternLabel('isolation_legs_ham')).toBe('Изоляция бицепса бедра');
    expect(movementPatternLabel('glute_squat')).toBe('Ягодичный паттерн');
    expect(movementPatternLabel('UnknownPattern')).toBe('UnknownPattern');
    expect(movementPatternLabel('')).toBe('');
  });

  it('MOVEMENT_PATTERN_RU покрывает все значения EXERCISE_CATALOG (23 ключа)', () => {
    expect(Object.keys(MOVEMENT_PATTERN_RU).length).toBeGreaterThanOrEqual(23);
    for (const v of ['anti_rotation', 'carry', 'core', 'decline_push', 'dip_push', 'glute_squat', 'hinge', 'horizontal_pull', 'horizontal_push', 'incline_push', 'isolation_arms', 'isolation_back', 'isolation_calves', 'isolation_chest', 'isolation_glutes', 'isolation_legs_ham', 'isolation_legs_quad', 'isolation_shoulders', 'lunge', 'rotation', 'squat', 'vertical_pull', 'vertical_push']) {
      expect(MOVEMENT_PATTERN_RU[v], v).toBeTruthy();
    }
  });

  it('sessionTagLabel fallback на исходный тег при неизвестном', () => {
    expect(sessionTagLabel('Unknown')).toBe('Unknown');
    expect(sessionTagLabel('')).toBe('');
  });

  it('muscleLabel переводит мышцу на русский', () => {
    expect(muscleLabel('back')).toBe('Спина');
    expect(muscleLabel('quads')).toBe('Квадрицепсы');
    expect(muscleLabel('hamstrings')).toBe('Бицепс бедра');
  });

  it('targetLabelFor: тяга на широчайшие', () => {
    const note = targetLabelFor({ muscle: 'back', name: 'Тяга верхнего блока', backSubgroup: 'back_width' });
    expect(note).toContain('широчайшие');
    expect(note).toContain('локтями');
  });

  it('targetLabelFor: тяга на толщину', () => {
    const note = targetLabelFor({ muscle: 'back', name: 'Тяга штанги в наклоне', backSubgroup: 'back_thickness' });
    expect(note).toContain('толщину');
    expect(note).toContain('локти в стороны');
  });

  it('targetLabelFor: растяжение широчайших', () => {
    const note = targetLabelFor({ muscle: 'back', name: 'Пуловер в блоке прямые руки' });
    expect(note).toContain('Растяжение');
  });

  it('targetLabelFor: бицепс длинная головка', () => {
    const note = targetLabelFor({ muscle: 'biceps', name: 'Подъём гантелей на наклонной скамье' });
    expect(note).toContain('длинная головка');
  });

  it('targetLabelFor: трицепс overhead', () => {
    const note = targetLabelFor({ muscle: 'triceps', name: 'Французский жим лёжа' });
    expect(note).toContain('длинная головка');
  });

  it('targetLabelFor: неизвестное упражнение → пусто', () => {
    expect(targetLabelFor({ muscle: 'abs', name: 'Скручивания' })).toBe('');
  });

  it('exerciseTargetNote добавляет 🎯 префикс', () => {
    expect(exerciseTargetNote({ muscle: 'back', name: 'Тяга верхнего блока', backSubgroup: 'back_width' })).toContain('🎯');
  });
});

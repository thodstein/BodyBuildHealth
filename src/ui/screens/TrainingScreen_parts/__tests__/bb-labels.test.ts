import { describe, expect, it } from 'vitest';
import { sessionTagLabel, muscleLabel, targetLabelFor, exerciseTargetNote } from '../bb-labels';

describe('bb-labels (локализация + targetLabel)', () => {
  it('sessionTagLabel переводит день на русский', () => {
    expect(sessionTagLabel('Pull')).toBe('Спина/Бицепс');
    expect(sessionTagLabel('ChestBack')).toBe('Грудь/Спина');
    expect(sessionTagLabel('FullBody')).toBe('Всё тело');
    expect(sessionTagLabel('Legs')).toBe('Ноги');
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

  it('targetLabelFor: пресс — пояснение есть (не пусто)', () => {
    const note = targetLabelFor({ muscle: 'abs', name: 'Скручивания' });
    expect(note).toContain('Пресс');
  });

  it('exerciseTargetNote добавляет 🎯 префикс', () => {
    expect(exerciseTargetNote({ muscle: 'back', name: 'Тяга верхнего блока', backSubgroup: 'back_width' })).toContain('🎯');
  });
});

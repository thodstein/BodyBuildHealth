/**
 * planner-supplement-timing.test.ts — PRO-схема приёма добавок относительно рациона.
 */
import { describe, it, expect } from 'vitest';
import { buildSupplementTiming, suppSlotFor, suppSlotForMealType, type SuppTimingInput } from '../planner-supplement-timing.engine';

const meals = [
  { type: 'breakfast', label: 'Завтрак', time: '07:30', items: [] },
  { type: 'lunch', label: 'Обед', time: '12:30', items: [] },
  { type: 'dinner', label: 'Ужин', time: '19:00', items: [] },
  { type: 'postworkout', label: 'Пост-трен', time: '19:30', items: [] },
  { type: 'presleep', label: 'Pre-sleep', time: '22:30', items: [] },
];

const inp = (over: Partial<SuppTimingInput> = {}): SuppTimingInput => ({
  supplements: [],
  meals,
  trainStartMin: 17 * 60,
  trainDurationMin: 90,
  isTrainingDay: true,
  weightKg: 85,
  sex: 'male',
  goal: 'mass',
  ...over,
});

describe('Схема приёма добавок', () => {
  it('классификация слотов по id/имени', () => {
    expect(suppSlotFor('caffeine')).toBe('preWO');
    expect(suppSlotFor('creatine_monohydrate')).toBe('postWO');
    expect(suppSlotFor('omega3')).toBe('lunch');
    expect(suppSlotFor('vitamin_d3')).toBe('lunch');
    expect(suppSlotFor('magnesium_glycinate')).toBe('presleep');
    expect(suppSlotFor('zinc_picolinate')).toBe('presleep');
    expect(suppSlotFor('iron_bisglycinate')).toBe('breakfast');
    expect(suppSlotFor('electrolyte')).toBe('intra');
    expect(suppSlotFor('some_unknown_thing')).toBe('anytime');
  });

  it('тип приёма плана → слот добавки (для строки «💊 К приёму»)', () => {
    expect(suppSlotForMealType('breakfast')).toBe('breakfast');
    expect(suppSlotForMealType('lunch')).toBe('lunch');
    expect(suppSlotForMealType('dinner')).toBe('dinner');
    expect(suppSlotForMealType('presleep')).toBe('presleep');
    expect(suppSlotForMealType('preworkout')).toBe('preWO');
    expect(suppSlotForMealType('intra')).toBe('intra');
    expect(suppSlotForMealType('postworkout')).toBe('postWO');
    expect(suppSlotForMealType('snack2')).toBe('anytime');
  });

  it('креатин — пост-трен, кофеин — за 45 мин до старта, омега — обед, магний — ночь', () => {
    const t = buildSupplementTiming(inp({
      supplements: [
        { id: 'creatine', nameRu: 'Креатин', dosage: '5 г' },
        { id: 'caffeine', nameRu: 'Кофеин', dosage: '200 мг' },
        { id: 'omega3', nameRu: 'Омега-3', dosage: '2 г' },
        { id: 'magnesium', nameRu: 'Магний', dosage: '300 мг' },
      ],
    }));
    const bySlot = Object.fromEntries(t.slots.map(s => [s.slot, s]));
    expect(bySlot.postWO.time).toBe('19:30');
    expect(bySlot.preWO.time).toBe('16:15'); // 17:00 − 45 мин
    expect(bySlot.lunch.time).toBe('12:30');
    expect(bySlot.presleep.time).toBe('22:30');
    // Хронологическая сортировка.
    const times = t.slots.map(s => s.time);
    expect([...times].sort()).toEqual(times);
  });

  it('без тренировки креатин уходит к завтраку, кофеин — в любой приём', () => {
    const t = buildSupplementTiming(inp({
      isTrainingDay: false, trainStartMin: undefined,
      supplements: [{ id: 'creatine' }, { id: 'caffeine' }],
    }));
    const slots = t.slots.map(s => s.slot);
    expect(slots).toContain('breakfast');
    expect(slots).not.toContain('preWO');
  });

  it('женщина + железо — честная нота (HCT/кальций/кофе)', () => {
    const t = buildSupplementTiming(inp({ sex: 'female', supplements: [{ id: 'iron_bisglycinate' }] }));
    expect(t.slots.some(s => s.slot === 'breakfast')).toBe(true);
    expect(t.notes.join(' ')).toMatch(/Железо/);
  });

  it('пустой вход → пустые слоты + нота; детерминизм', () => {
    const e = buildSupplementTiming(inp());
    expect(e.slots).toHaveLength(0);
    expect(e.notes.length).toBeGreaterThan(0);
    const a = buildSupplementTiming(inp({ supplements: [{ id: 'creatine' }, { id: 'omega3' }] }));
    const b = buildSupplementTiming(inp({ supplements: [{ id: 'creatine' }, { id: 'omega3' }] }));
    expect(a).toEqual(b);
  });
});

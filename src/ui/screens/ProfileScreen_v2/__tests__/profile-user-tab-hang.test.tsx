/**
 * profile-user-tab-hang.test.tsx — воспроизведение зависания вкладки «Пользователь».
 * Тесты: полный цикл ввод → debounce → updateSection → notifyAll с реальными данными
 * (все секции заполнены вложенными объектами/массивами) — версия профиля не должна
 * расти бесконечно после остановки ввода.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { ProfileUserTab } from '../ProfileUserTab';
import { getProfileVersion } from '../../../../core/profile-manager';

const fullProfile = (): Record<string, any> => ({
  name: 'Тест',
  id: 't1',
  role: 'user',
  settings: {
    personal: { age: 30, sex: 'male', height: 180, weight: 85, bodyFat: 15, bloodType: 'II+', emergencyName: 'A', emergencyPhone: '+7' },
    training: { primaryGoal: 'bulk', level: 'intermediate', daysPerWeek: 4, minutesPerSession: 70, weakPoints: ['chest_upper', 'back_width'], equipment: ['barbell', 'dumbbell'], workMax: { squat: 140, bench: 100, deadlift: 180 } },
    pharma: { phase: 'course', courseStartDate: '2026-07-01', experience: 'advanced', totalCycles: 3, yearsOnGear: 2, previousCycles: ['test', 'tren'], hcgEnabled: true, aiEnabled: true },
    health: { bpStage: 'normal', hctElevation: 'moderate', heartRate: 64, genetics: { snp1: 'AA', snp2: 'GG' }, injuries: [{ id: 'i1', location: 'knee', type: 'muscle', painLevel: 3 }], chronicConditions: ['asthma'], excludedSupplements: ['creatine'] },
    nutrition: { dietType: 'standard', mealsPerDay: 5, proteinPerKg: 2.2, foodAllergies: ['milk'], foodIntolerances: ['lactose'], excludedFoods: ['pork'], preferredFoods: ['chicken'], preferredByMeal: { breakfast: ['eggs'], lunch: ['rice'] } },
    lifestyle: { sleepHours: 8, sleepQuality: 'good', chronotype: 'owl', bedtime: '23:00', wakeTime: '07:00', stressLevel: 4, fatigueLevel: 3, activityLevel: 7, dailySteps: 8000, dailyWaterLiters: 2.5, morningHRV: 52, smoke: false },
    system: { preferredUnits: 'metric', notificationsEnabled: true, privacyLevel: 'private', email: 'a@b.c' },
    goals: { primaryGoal: 'bulk', targetWeight: 90, targetBodyFat: 12, goalTimelineWeeks: 16, cycleGoal: 'mass', cycleWeeks: 12 },
    labs: { summary: [] },
    symptoms: { recent: ['insomnia', 'fatigue'] },
  },
});

const openAgePopup = () => {
  fireEvent.click(screen.getByRole('button', { name: /Возраст/ }));
  return screen.getByPlaceholderText('—');
};

const setAge = (v: string) => {
  const input = openAgePopup();
  fireEvent.change(input, { target: { value: v } });
  fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
};

const flushDebounce = async () => {
  await act(async () => { vi.advanceTimersByTime(1200); });
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('he_profile_v2', JSON.stringify(fullProfile()));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProfileUserTab не зависает (реальные данные)', () => {
  it('цикл ввода в 2 секциях: версия профиля перестаёт расти после остановки ввода', async () => {
    render(<ProfileUserTab />);
    const v0 = getProfileVersion();

    setAge('31');
    await flushDebounce();
    expect(screen.getByText(/31 лет/)).toBeTruthy();
    const v1 = getProfileVersion();
    // После flush версия стабильна (нет бесконечного цикла записи)
    await act(async () => { vi.advanceTimersByTime(3000); });
    const v2 = getProfileVersion();
    expect(v2).toBe(v1);
    expect(v1).toBeGreaterThan(v0);

    // Вторая секция: открыть «Здоровье» (аккордеон в контенте — последний матч), поменять значение
    fireEvent.click(screen.getAllByRole('button', { name: /Здоровье/ }).pop()!);
    await act(async () => { vi.advanceTimersByTime(50); });
    const heartRateBtn = screen.getByRole('button', { name: /ЧСС/ });
    fireEvent.click(heartRateBtn);
    const input = screen.getByPlaceholderText('—');
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    await flushDebounce();
    const v3 = getProfileVersion();
    await act(async () => { vi.advanceTimersByTime(3000); });
    const v4 = getProfileVersion();
    expect(v4).toBe(v3);

    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(p.settings.personal.age).toBe(31);
    expect(p.settings.health.heartRate).toBe(70);
    // Ничего не потеряно при перезаписи секций (регрессия normalizeArrayFields)
    expect(p.settings.health.genetics.snp1).toBe('AA');
    expect(p.settings.personal.bloodType).toBe('II+');
    expect(p.settings.lifestyle.morningHRV).toBe(52);
  });

  it('30 быстрых изменений подряд → сходится, версия не растёт бесконечно', async () => {
    render(<ProfileUserTab />);
    for (let i = 0; i < 30; i++) setAge(String(20 + i));
    await flushDebounce();
    const v1 = getProfileVersion();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(getProfileVersion()).toBe(v1);
    const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(p.settings.personal.age).toBe(49);
  });
});

/**
 * HealthDiary.test.tsx — компонентные тесты UI дневника здоровья (Aug 11 2026):
 * план улучшений, чекбоксы выполнения, индекс здоровья, пустое состояние.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HealthDiary } from '../HealthDiary';
import { defaultGoals } from '../../../diary-helpers';
import { resetUnifiedHealthDiary, type UnifiedHealthEntry } from '../../../../../../engines/health-diary.engine';
import { loadPlanDone } from '../../../../../../engines/health-improvement-plan.engine';

const isoDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const entry = (date: string, over: Partial<UnifiedHealthEntry> = {}): UnifiedHealthEntry => ({
  id: `${date}_x`,
  date,
  pain: null,
  symptoms: [],
  neuro: null,
  acne: null,
  hemato: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const seedTwoDays = () => {
  const rows = [
    entry(isoDaysAgo(1), { pain: { zones: { shoulders: 3 }, totalScore: 3 } }),
    entry(isoDaysAgo(0), {
      pain: { zones: { shoulders: 9 }, totalScore: 9 },
      symptoms: [{ id: 's1', name: 'Головная боль', severity: 4 }],
      hemato: { symptoms: { nosebleeds: true, bruising: true }, totalScore: 2 },
    }),
  ];
  localStorage.setItem('he_health_diary', JSON.stringify(rows));
};

const renderDiary = () =>
  render(<HealthDiary open onClose={() => {}} diaryKey="health" goals={defaultGoals()} onDataChange={() => {}} />);

describe('HealthDiary UI', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUnifiedHealthDiary();
  });

  it('рендерит план улучшений с критическими пунктами', () => {
    seedTwoDays();
    renderDiary();
    expect(screen.getByText(/План улучшений/)).toBeTruthy();
    expect(screen.getByText(/Критическая боль: Плечи/)).toBeTruthy();
    expect(screen.getByText(/Перегенерировать/)).toBeTruthy();
  });

  it('показывает индекс здоровья в шапке', () => {
    seedTwoDays();
    renderDiary();
    expect(screen.getByText(/💚 \d+/)).toBeTruthy();
  });

  it('чекбокс плана сохраняет выполнение в localStorage', () => {
    seedTwoDays();
    renderDiary();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    fireEvent.click(boxes[0]);
    expect(loadPlanDone().length).toBe(1);
    expect(boxes[0].checked).toBe(true);
  });

  it('пустой дневник — без секции плана, с пустой таблицей', () => {
    renderDiary();
    expect(screen.queryByText(/План улучшений/)).toBeNull();
    expect(screen.getByText('Нет записей')).toBeTruthy();
  });
});

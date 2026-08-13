/** mix-diary-section.test.tsx — smoke-тест секции «Тренировочные миксы и пресеты»
 *  в дневнике тренировок: рендер записей, удаление, пустое состояние. */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MixDiarySection } from '../MixDiarySection';

beforeEach(() => {
  localStorage.clear();
});

const seed = (title: string, id = 'mix_x', substances = 2, interactions = 0) => {
  localStorage.setItem('he_training_mixes', JSON.stringify([{
    id,
    title,
    kind: 'preset',
    goal: 'joint',
    timing: 'pre',
    score: 82,
    label: 'Отлично',
    substances: Array.from({ length: substances }, (_, i) => ({
      id: `sub_${i}`, name: `Вещество ${i}`, dose: '500', unit: 'мг', mg: 500, timing: 'pre',
    })),
    recommendations: interactions > 0 ? { id: 'rec_x', title, kind: 'preset', goal: 'joint', substances: [], interactions: [{ a: 'a', b: 'b', effect: 'конфликт', severity: 'HIGH' }], general: [], ts: Date.now() } : null,
    date: '2026-08-13',
    ts: Date.now(),
  }]));
};

describe('MixDiarySection', () => {
  it('не рендерится без записей', () => {
    const { container } = render(<MixDiarySection />);
    expect(container.innerHTML).toBe('');
  });

  it('показывает заголовок и состав записи', () => {
    seed('Пресет: Суставы');
    render(<MixDiarySection />);
    expect(screen.getByText('💊 Тренировочные миксы и пресеты (1)')).toBeTruthy();
    expect(screen.getByText('Пресет: Суставы')).toBeTruthy();
    expect(screen.getByText('Вещество 0 · 500 мг')).toBeTruthy();
    expect(screen.getByText(/2 веществ/)).toBeTruthy();
  });

  it('показывает бейдж конфликтов из рекомендаций', () => {
    seed('Пресет: Суставы', 'mix_y', 2, 1);
    render(<MixDiarySection />);
    expect(screen.getByText(/Конфликтов в наборе: 1/)).toBeTruthy();
  });

  it('удаляет запись по кнопке', () => {
    seed('Пресет: Суставы');
    render(<MixDiarySection />);
    fireEvent.click(screen.getByText('🗑'));
    expect(JSON.parse(localStorage.getItem('he_training_mixes') || '[]').length).toBe(0);
  });

  it('разворачивает все записи при нажатии «Все ▼»', () => {
    const arr = Array.from({ length: 4 }, (_, i) => ({
      id: `mix_${i}`, title: `Микс ${i}`, kind: 'mix' as const, goal: 'pump', substances: [], recommendations: null,
      date: '2026-08-13', ts: Date.now(),
    }));
    localStorage.setItem('he_training_mixes', JSON.stringify(arr));
    render(<MixDiarySection />);
    expect(screen.queryByText('Микс 3')).toBeNull();
    fireEvent.click(screen.getByText('Все ▼'));
    expect(screen.getByText('Микс 3')).toBeTruthy();
  });

  it('обновляется по событию he-training-mix-saved', () => {
    seed('Старая запись', 'old');
    render(<MixDiarySection />);
    act(() => {
      window.dispatchEvent(new CustomEvent('he-training-mix-saved'));
    });
    expect(screen.getByText(/\(1\)/)).toBeTruthy();
  });
});

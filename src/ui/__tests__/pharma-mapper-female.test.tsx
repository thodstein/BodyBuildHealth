/**
 * pharma-mapper-female.test.tsx — Ж3/Л11 (фаза 2): MapperTab фарма-экрана
 * прокидывает пол профиля в mapStackToPathologies и analyzeClinicalRisks.
 * female → женские патологии стека (♀ Вирилизация); male/без профиля — прежний результат.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MapperTab } from '../screens/PharmaScreen_parts/MapperTab';

const seedProfile = (sex: 'male' | 'female') => {
  localStorage.setItem('he_profile_v2', JSON.stringify({
    settings: { personal: { sex, weight: 60, age: 30 }, lifestyle: { sleepHours: 7, stressLevel: 4 } },
  }));
};

/** Добавляет ручной препарат и запускает маппинг. */
const runManual = (container: HTMLElement, drug: string) => {
  fireEvent.click(screen.getByText(/Вручную/));
  const select = container.querySelector('select')!;
  fireEvent.change(select, { target: { value: drug } });
  fireEvent.click(screen.getByText('+'));
  fireEvent.click(screen.getByText(/Запустить маппинг/));
};

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('MapperTab: пол профиля → женские патологии стека', () => {
  it('female: тренболон даёт «♀ Вирилизация» в патологиях', () => {
    seedProfile('female');
    const { container } = render(<MapperTab />);
    runManual(container, 'trenbolone');
    expect(container.textContent).toContain('♀ Вирилизация');
    expect(container.textContent).toContain('♀ Нарушение менструального цикла');
  });

  it('male/без профиля: женских патологий нет (прежний результат)', () => {
    seedProfile('male');
    const { container } = render(<MapperTab />);
    runManual(container, 'trenbolone');
    expect(container.textContent).not.toContain('♀ Вирилизация');
    // мужские патологии тренболона на месте
    expect(container.textContent).toContain('FSGS');
  });
});

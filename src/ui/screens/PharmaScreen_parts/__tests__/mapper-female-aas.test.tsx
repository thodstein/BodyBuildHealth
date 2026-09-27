import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapperTab } from '../MapperTab';
import { FemalePharmaCalculator } from '../FemalePharmaCalculator';

const mockLinked = {
  course: [],
  profile: { settings: { personal: { sex: 'female', age: 25, weight: 60, height: 165 }, genetics: {}, lifestyle: {} } },
  labs: [],
};

vi.mock('../../../core/data-link', () => ({
  useDataLink: () => ({ profile: mockLinked.profile }),
}));

describe('FemalePharmaCalculator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('отображает заголовок калькулятора', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Женский калькулятор фармакологии/i)).toBeTruthy();
  });

  it('отображает предупреждение о контрацепции', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Контрацепция обязательна/i)).toBeTruthy();
  });

  it('отображает селект с опциями препаратов', () => {
    render(<FemalePharmaCalculator />);
    const selects = document.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });
});

describe('MapperTab: интеграция FemalePharmaCalculator', () => {
  it('отображает компонент FemalePharmaCalculator при sex=female', () => {
    render(<MapperTab />);
    expect(screen.getByText(/Мульти-ввод препаратов/i)).toBeTruthy();
  });
});

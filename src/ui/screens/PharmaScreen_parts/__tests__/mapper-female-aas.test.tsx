import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FemalePharmaCalculator } from '../FemalePharmaCalculator';
import { MapperTab } from '../MapperTab';

const mockLinked = {
  course: [],
  profile: { settings: { personal: { sex: 'female', age: 25, weight: 60, height: 165 }, genetics: {}, lifestyle: {} } },
  labs: [],
};

vi.mock('../../../core/data-link', () => ({
  useDataLink: () => mockLinked,
}));

describe('FemalePharmaCalculator', () => {
  it('отображает заголовок калькулятора', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Женский калькулятор фармакологии/i)).toBeTruthy();
  });

  it('отображает предупреждение о контрацепции (base warnings)', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Контрацепция обязательна/i)).toBeTruthy();
  });

  it('отображает предупреждение о тесте на беременность', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Тест на беременность/i)).toBeTruthy();
  });

  it('отображает фильтры препаратов', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText('Все')).toBeTruthy();
    expect(screen.getByText('Оральные')).toBeTruthy();
    expect(screen.getByText('Инъекции')).toBeTruthy();
  });

  it('показывает хотя бы один препарат из списка', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Тестостерон/i)).toBeTruthy();
  });
});

describe('MapperTab: интеграция FemalePharmaCalculator', () => {
  it('отображает женский калькулятор при sex=female', () => {
    render(<MapperTab />);
    expect(screen.getByText(/Женский калькулятор фармакологии/i)).toBeTruthy();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapperTab } from '../MapperTab';

const mockLinked = {
  course: [],
  profile: { settings: { personal: { sex: 'female', age: 25, weight: 60, height: 165 }, genetics: {}, lifestyle: {} } },
  labs: [],
};

vi.mock('../../../core/data-link', () => ({
  useDataLink: () => mockLinked,
}));

describe('MapperTab: женский AAS-калькулятор', () => {
  it('отображает женский калькулятор при sex=female', () => {
    render(<MapperTab />);
    expect(screen.getByText(/Женский AAS-калькулятор/i)).toBeTruthy();
  });

  it('отображает фильтры препаратов', () => {
    render(<MapperTab />);
    expect(screen.getByText('Все')).toBeTruthy();
    expect(screen.getByText('Оральные')).toBeTruthy();
    expect(screen.getByText('Инъекции')).toBeTruthy();
  });

  it('отображает предупреждение о вирилизации', () => {
    render(<MapperTab />);
    expect(screen.getByText(/Контрацепция обязательна/i)).toBeTruthy();
  });
});

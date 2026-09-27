import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapperTab } from '../MapperTab';
import { femaleAASWarnings, isFemaleAAS } from '../../../../data/aas-support-protocols';

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    course: [],
    profile: { settings: { personal: { sex: 'female', age: 25 }, genetics: {}, lifestyle: {} } },
    labs: [],
  }),
}));

vi.mock('../InteractionCheckerTab', () => ({
  InteractionCheckerTab: () => <div data-testid="interaction-checker" />,
}));

vi.mock('../../../components/SafetyDepletion', () => ({
  SafetyDepletion: () => <div data-testid="safety-depletion" />,
}));

describe('MapperTab: интеграция женских AAS', () => {
  it('предупреждения о вирилизации отображаются для женщин с AAS в курсе', () => {
    const { container } = render(<MapperTab />);
    const warnings = container.querySelectorAll('[data-virilization-warning]');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('femaleAASWarnings возвращает предупреждения для известных AAS', () => {
    expect(femaleAASWarnings(['test_enant'])).toContain('⚠️ Вирилизация');
    expect(femaleAASWarnings(['sust_250'])).toContain('⚠️ Вирилизация');
  });

  it('isFemaleAAS корректно определяет AAS по id', () => {
    expect(isFemaleAAS('test_enant')).toBe(true);
    expect(isFemaleAAS('sust_250')).toBe(true);
    expect(isFemaleAAS('test_prop')).toBe(false);
  });
});

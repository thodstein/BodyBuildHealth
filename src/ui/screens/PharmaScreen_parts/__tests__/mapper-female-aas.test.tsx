import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FemalePharmaCalculator } from '../FemalePharmaCalculator';
import { femaleAASWarnings, isFemaleAAS, matchProtocolsForStack, AAS_MEDICAL_DISCLAIMER } from '../../../../data/aas-support-protocols';

describe('FemalePharmaCalculator (мульти-ввод фармы)', () => {
  it('отображает заголовок калькулятора', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Женский калькулятор фармакологии/i)).toBeTruthy();
  });

  it('отображает базовые предупреждения (контрацепция, тест на беременность)', () => {
    render(<FemalePharmaCalculator />);
    expect(screen.getByText(/Контрацепция обязательна/i)).toBeTruthy();
    expect(screen.getByText(/Тест на беременность/i)).toBeTruthy();
  });

  it('добавляет препарат по клику и показывает селект с опциями', () => {
    render(<FemalePharmaCalculator />);
    fireEvent.click(screen.getByText(/Добавить препарат/i));
    expect(document.querySelectorAll('select').length).toBe(1);
    expect(screen.getByText(/мг\/нед/i)).toBeTruthy();
  });
});

describe('AAS-протоколы: доказательность и матчинг', () => {
  it('femaleAASWarnings пусто без AAS и непусто с AAS', () => {
    expect(femaleAASWarnings(['insulin_rapid'])).toHaveLength(0);
    expect(femaleAASWarnings(['test_enan']).length).toBeGreaterThanOrEqual(3);
  });

  it('isFemaleAAS различает AAS и не-AAS', () => {
    expect(isFemaleAAS('test_enan')).toBe(true);
    expect(isFemaleAAS('tren_acet')).toBe(true);
    expect(isFemaleAAS('insulin_rapid')).toBe(false);
    expect(isFemaleAAS('vitamin_d3')).toBe(false);
  });

  it('matchProtocolsForStack подбирает инсулиновый протокол по стеку', () => {
    const matched = matchProtocolsForStack(['insulin_rapid']);
    expect(matched.some((p) => p.id === 'insulin-management')).toBe(true);
  });

  it('matchProtocolsForStack даёт протокол вирилизации при AAS', () => {
    const matched = matchProtocolsForStack(['test_enan']);
    expect(matched.some((p) => p.id === 'female-virilization-monitoring')).toBe(true);
  });

  it('есть медицинский дисклеймер', () => {
    expect(AAS_MEDICAL_DISCLAIMER).toMatch(/не медицинское назначение/i);
  });
});

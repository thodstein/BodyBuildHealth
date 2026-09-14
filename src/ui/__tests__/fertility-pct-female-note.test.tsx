/**
 * fertility-pct-female-note.test.tsx — §6.4.6 аудита: экран мужской фертильности
 * показывает женщине честную оговорку (кломифен/hCG «по-мужски» неприменимы),
 * мужчине — не показывает (мужской путь не меняется).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { FertilityPCTScreen } from '../screens/FertilityPCTScreen';

const seedProfile = (sex: 'male' | 'female') => {
  localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { personal: { sex, weight: 80, age: 30 } } }));
};

beforeEach(() => {
  localStorage.clear();
});

describe('FertilityPCTScreen ♀ оговорка', () => {
  it('женщина: баннер с data-female-fertility-note и «НЕ применяются»', () => {
    seedProfile('female');
    const html = renderToStaticMarkup(React.createElement(FertilityPCTScreen));
    expect(html).toContain('data-female-fertility-note');
    expect(html).toContain('НЕ применяются');
  });

  it('мужчина: баннера нет', () => {
    seedProfile('male');
    const html = renderToStaticMarkup(React.createElement(FertilityPCTScreen));
    expect(html).not.toContain('data-female-fertility-note');
  });
});

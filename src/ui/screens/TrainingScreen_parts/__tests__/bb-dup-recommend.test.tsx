import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbAutoConstructor } from '../BbAutoConstructor';

/**
 * 3.7-UI (план BB-AUTO-EXHAUSTIVE-PRO): recommendDUPMode подключён к селектору dupMode
 * как рекомендация (чип «Рекомендуем: …»), БЕЗ авто-применения.
 * Сеем профиль: goal mass + intermediate + 4 дня → recommendDUPMode = heavy_light.
 */
beforeEach(() => {
  try { localStorage.clear(); } catch {}
  try {
    localStorage.setItem('he_profile_v2', JSON.stringify({
      settings: { goal: 'mass', trainingLevel: 'intermediate', workoutsPerWeek: 4 },
    }));
  } catch {}
});

describe('3.7-UI: чип рекомендации DUP', () => {
  it('SSR: селектор DUP и чип «Рекомендуем» показаны при рекомендации', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).toContain('Волновая периодизация (DUP)');
    expect(html).toContain('Рекомендуем');
    expect(html).toContain('Тяж/лёг');
  });

  it('SSR детерминирован', () => {
    const a = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    const b = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(a).toBe(b);
  });
});


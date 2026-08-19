/**
 * bb-prep-cycle-ui.test.tsx — SSR-smoke режима «🏁 Prep-цикл» в BB-авто.
 *
 * Интерактивный RTL-прогон всего BbAutoConstructor слишком тяжёл для jsdom
 * (рендер всего дерева + эффекты). Поэтому UI-покрытие — SSR (renderToStaticMarkup),
 * как в bb-auto-smoke; логика движка покрыта в bb-prep-cycle.test.ts.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BbAutoConstructor } from '../BbAutoConstructor';
import { buildPrepCycle, recommendMinimalMode, type PrepCycleConfig } from '../../../../engines/bb/bb-prep-cycle.engine';
import { DEFAULT_WORKMAX } from '../../../../engines/bb/bb-builder.engine';

describe('BB-auto Prep-цикл UI (SSR smoke)', () => {
  it('кнопка «Prep-цикл» присутствует в шапке по умолчанию', () => {
    const html = renderToStaticMarkup(React.createElement(BbAutoConstructor));
    expect(html).toContain('Prep-цикл');
    expect(html).toContain('Начать заново');
  });

  it('Prep-цикл строится движком (проверка связки UI-входа и движка)', () => {
    const cfg: PrepCycleConfig = {
      category: 'mens_physique', sex: 'male',
      accentMuscles: ['shoulders', 'back'], minimalMuscles: ['quads', 'arms'],
      weeks: 12, taperWeeks: 3, showDate: '2027-05-01',
      level: 'intermediate', trainingYears: 4,
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
      workMax: { ...DEFAULT_WORKMAX },
      enhanced: false, weightKg: 82, experienceLevel: 'intermediate',
    };
    const r = buildPrepCycle(cfg);
    expect(r.bbPlan.weeks.length).toBe(12);
    expect(r.prepWeeks).toBe(8);
    expect(r.accentMuscles).toContain('shoulders');
  });

  it('рекомендация режима минимальной нагрузки для разных профилей', () => {
    expect(recommendMinimalMode({ category: 'bikini', sex: 'female', enhanced: false, trainingYears: 1, level: 'intermediate', minimalMuscles: ['quads'] }).mode)
      .toBe('reduce_direct_to_floor');
    expect(recommendMinimalMode({ category: 'mens_bb', sex: 'male', enhanced: true, trainingYears: 5, level: 'advanced', minimalMuscles: ['arms'] }).mode)
      .toBe('remove_direct_when_indirect_covers_floor');
  });
});

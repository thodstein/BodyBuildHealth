import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ManualProgramWizard } from '../ManualProgramWizard';

function renderWizard(embedded = false): string {
  return renderToStaticMarkup(
    <ManualProgramWizard
      open
      embedded={embedded}
      step={4}
      direction="bb"
      goal="hypertrophy"
      level="intermediate"
      days={4}
      weeks={8}
      pro
      onClose={vi.fn()}
      onStep={vi.fn()}
      onDirection={vi.fn()}
      onGoal={vi.fn()}
      onLevel={vi.fn()}
      onDays={vi.fn()}
      onWeeks={vi.fn()}
      onCreate={vi.fn()}
    />,
  );
}

describe('ManualProgramWizard smoke render', () => {
  it('renders the modal wizard', () => {
    const html = renderWizard();
    // Единый конструктор: визард сжат 5→3, шаг 4 мапится на 3 (Превью)
    expect(html).toContain('Визард — шаг 3 из 3');
    expect(html).toContain('Создать и заполнить');
    expect(html).toContain('Превью');
  });

  it('renders the embedded wizard variant', () => {
    const html = renderWizard(true);
    expect(html).toContain('Визард — шаг 3 из 3');
    expect(html).toContain('Пустой каркас');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <ManualProgramWizard
        open={false}
        embedded
        step={1}
        direction="bb"
        goal="hypertrophy"
        level="beginner"
        days={3}
        weeks={8}
        pro={false}
        onClose={vi.fn()}
        onStep={vi.fn()}
        onDirection={vi.fn()}
        onGoal={vi.fn()}
        onLevel={vi.fn()}
        onDays={vi.fn()}
        onWeeks={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(html).toBe('');
  });
});

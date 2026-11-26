import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { StructuredAnalyticsCard } from '../StructuredAnalyticsCard';
import type { SessionData } from '../../../../engines/structured-analytics.engine';

const mkSession = (id: string, date: string, weight: number): SessionData => ({
  id,
  date,
  durationMin: 60,
  focus: 'fullbody',
  exercises: [{ name: 'squat', sets: [{ reps: 5, weight, rpe: 8, rir: 2 }] }],
});

// Два «прошлых» периода по 100 кг и два текущих по 110 кг → тренд 1RM +10 %.
const sessions: SessionData[] = [
  mkSession('s1', '2026-11-10', 100),
  mkSession('s2', '2026-11-12', 100),
  mkSession('s3', '2026-11-17', 110),
  mkSession('s4', '2026-11-19', 110),
];

describe('StructuredAnalyticsCard — реальные поля движка', () => {
  afterEach(() => cleanup());

  it('показывает оценку, объём, паттерн squat с 1RM, трендом и прогнозом', () => {
    const { container } = render(<StructuredAnalyticsCard sessions={sessions} />);
    const text = container.textContent || '';
    expect(container.querySelector('[data-analytics="structured"]')).not.toBeNull();
    expect(text).toContain('Структурная аналитика');
    expect(text).toContain('squat');
    expect(text).toMatch(/\d+ кг/);
    expect(text).toMatch(/\+10 %|10 %/);
    expect(text).toMatch(/\d+\/100/);
    expect(text).toMatch(/Excellent|Good|Warning|Critical/);
    expect(text).toContain('Объём');
    expect(text).toMatch(/→ \d+ кг/);
  });

  it('без прошлого периода честно пишет «нет сравнимых данных» и не даёт прогноза', () => {
    const { container } = render(<StructuredAnalyticsCard sessions={[mkSession('s1', '2026-11-10', 100)]} />);
    const text = container.textContent || '';
    expect(text).not.toContain('+0 %');
    expect(text).toContain('нет сравнимых данных');
    expect(text).not.toContain('→');
  });

  it('паттерн только из прошлого периода не печатает «0 кг»', () => {
    // Присед убран из плана: он остался в прошлой половине истории, в текущей — жим.
    const dropped = (id: string, date: string): SessionData => ({
      id,
      date,
      durationMin: 60,
      focus: 'fullbody',
      exercises: [{ name: 'squat', sets: [{ reps: 5, weight: 120, rpe: 8, rir: 2 }] }],
    });
    const bench = (id: string, date: string): SessionData => ({
      id,
      date,
      durationMin: 60,
      focus: 'fullbody',
      exercises: [{ name: 'bench', sets: [{ reps: 8, weight: 90, rpe: 8, rir: 2 }] }],
    });
    const { container } = render(
      <StructuredAnalyticsCard
        sessions={[
          dropped('s1', '2026-11-10'),
          dropped('s2', '2026-11-12'),
          bench('c1', '2026-11-17'),
          bench('c2', '2026-11-19'),
        ]}
      />,
    );
    const text = container.textContent || '';
    expect(text).toContain('squat');
    // Именно строка паттерна: «720 кг» объёма содержит «0 кг» как подстроку.
    expect(text).not.toMatch(/· 0 кг/);
    expect(text).toContain('нет сравнимых данных');
  });

  it('без сессий ничего не рендерит', () => {
    const { container } = render(<StructuredAnalyticsCard sessions={[]} />);
    expect(container.textContent).toBe('');
    expect(container.firstChild).toBeNull();
  });
});

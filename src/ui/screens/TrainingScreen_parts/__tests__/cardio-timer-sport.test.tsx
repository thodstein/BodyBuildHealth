/**
 * cardio-timer-sport.test.tsx — спринт 5.2 (аудит): таймер пишет дисциплину.
 *
 * Дефект: `CardioSessionTimer` вообще не передавал `sport` в запись дневника,
 * поэтому ВСЕ сессии, записанные самим пользователем, нормализовались в <other>.
 * Пер-спортная разбивка TID (спринт 5.2) видела только импорт, а смешанный
 * дневник бег+вело не определялся вовсе.
 *
 * Контракт: выбор пользователя сохраняется в записи; по умолчанию <другое>
 * (дисциплина НЕ выдумывается из FTP/темпа — в плане оба поля могут быть заданы).
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioSessionTimer } from '../CardioSessionTimer';
import { buildCardioCycle } from '../../../../engines/lms/cardio.engine';
import { loadCardioLog } from '../../../../engines/lms/cardio-diary.engine';

const cycle = buildCardioCycle({ goal: 'health', totalWeeks: 4, id: 'timer-sport' });

/** Стартуем сессию из списка «сегодня» и сразу завершаем её. */
function startAndFinish(): void {
  render(<CardioSessionTimer cycle={cycle} />);
  const startBtn = screen.getAllByRole('button').find(b => /старт/i.test(b.textContent ?? ''));
  expect(startBtn).toBeTruthy();
  fireEvent.click(startBtn!);
  fireEvent.click(screen.getByRole('button', { name: /завершить/i }));
}

describe('Таймер: дисциплина попадает в дневник', () => {
  beforeEach(() => localStorage.clear());

  it('по умолчанию честное «другое» — не выдумываем бег по FTP/темпу', () => {
    startAndFinish();
    fireEvent.click(screen.getByRole('button', { name: /сохранить в дневник/i }));
    const log = loadCardioLog();
    expect(log).toHaveLength(1);
    expect(log[0].sport).toBe('other');
  });

  it('выбранный велосипед записывается в запись (а не теряется)', () => {
    startAndFinish();
    fireEvent.click(screen.getByRole('button', { name: 'Дисциплина: велосипед' }));
    fireEvent.click(screen.getByRole('button', { name: /сохранить в дневник/i }));
    const log = loadCardioLog();
    expect(log).toHaveLength(1);
    expect(log[0].sport).toBe('bike');
  });

  it('выбранный бег сохраняется, чип отмечен aria-pressed', () => {
    startAndFinish();
    const runBtn = screen.getByRole('button', { name: 'Дисциплина: бег' });
    expect(runBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(runBtn);
    expect(screen.getByRole('button', { name: 'Дисциплина: бег' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /сохранить в дневник/i }));
    expect(loadCardioLog()[0].sport).toBe('run');
  });
});

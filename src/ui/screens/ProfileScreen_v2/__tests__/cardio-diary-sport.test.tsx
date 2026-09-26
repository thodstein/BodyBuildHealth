/**
 * cardio-diary-sport.test.tsx — спринт 5.2: форма кардио-дневника в профиле
 * пишет дисциплину.
 *
 * Дефект: у профиля ВТОРОЙ вход в дневник (форма в CardioDiary), и он не писал
 * ни `sport`, ни `source` — ручные сессии оттуда навсегда оставались <другое>
 * и не попадали в разбивку TID (в форме конструктора дисциплина уже была).
 * Плюс правка существующей записи обнуляла дисциплину.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioDiary } from '../diaries/CardioDiary/CardioDiary';
import { loadCardioLog, saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';

const iso = '2026-09-20';

/** Кнопка формы: текст ровно «Записать»/«Обновить» (у неё есть иконка, поэтому сверяем textContent). */
function clickSave(): void {
  const btn = screen.getAllByRole('button').find(b => /^(Записать|Обновить)$/.test((b.textContent ?? '').trim()));
  expect(btn).toBeTruthy();
  fireEvent.click(btn!);
}

function fillAndSave(minutes: string): void {
  render(<CardioDiary />);
  fireEvent.change(screen.getByLabelText('Минуты'), { target: { value: minutes } });
  clickSave();
}

describe('Кардио-дневник (профиль): дисциплина', () => {
  beforeEach(() => localStorage.clear());

  it('по умолчанию честное «другое» + provenance manual', () => {
    fillAndSave('40');
    const log = loadCardioLog();
    expect(log).toHaveLength(1);
    expect(log[0].durationMin).toBe(40);
    expect(log[0].sport).toBe('other');
    expect(log[0].source).toBe('manual');
  });

  it('выбранный бег попадает в запись', () => {
    render(<CardioDiary />);
    fireEvent.click(screen.getByRole('button', { name: 'Дисциплина: бег' }));
    fireEvent.change(screen.getByLabelText('Минуты'), { target: { value: '35' } });
    clickSave();
    expect(loadCardioLog()[0].sport).toBe('run');
  });

  it('правка записи сохраняет дисциплину (не сбрасывает в «другое»)', () => {
    saveCardioLogEntry({
      id: 'bike-1', date: iso, type: 'zone2', durationMin: 30,
      completed: true, avgHr: 140, sport: 'bike', source: 'manual',
    });
    render(<CardioDiary />);
    fireEvent.click(screen.getByRole('button', { name: `Редактировать ${iso}` }));
    // форма открылась с дисциплиной записи — сохраняем как есть
    expect(screen.getByRole('button', { name: 'Дисциплина: велосипед' }).getAttribute('aria-pressed')).toBe('true');
    clickSave();
    const log = loadCardioLog();
    expect(log).toHaveLength(1);
    expect(log[0].sport).toBe('bike');
  });
});

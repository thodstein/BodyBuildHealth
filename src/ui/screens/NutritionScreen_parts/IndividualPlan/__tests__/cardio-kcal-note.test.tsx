/**
 * cardio-kcal-note.test.tsx — блок «Кардио» в планировщике питания.
 *
 * Аудит 2026-11: контракт `he_cardio_kcal_note` больше не мёртвая запись —
 * питание его читает. Но цели КБЖУ он НЕ меняет (PAL уже учитывает тренировки),
 * и это должно быть сказано прямым текстом, а не подразумеваться.
 */
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CardioKcalNote } from '../CardioKcalNote';
import {
  publishCardioKcalContract, setCardioKcalInclude, CARDIO_KCAL_NOTE_KEY,
} from '../../../../../engines/lms/cardio-nutrition-contract.engine';
import { buildCardioCycle } from '../../../../../engines/lms/cardio.engine';

const cycle = () => buildCardioCycle({ goal: 'cut', totalWeeks: 6, bodyWeight: 80 });

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('CardioKcalNote (планировщик питания)', () => {
  it('без контракта блок не рисуется', async () => {
    const { container } = render(<CardioKcalNote />);
    await waitFor(() => expect(container.querySelector('[data-cardio-nutrition-note]')).toBeNull());
  });

  it('показывает ккал/нед, уверенность и честную оговорку про PAL', async () => {
    const contract = publishCardioKcalContract(cycle(), []);
    render(<CardioKcalNote />);
    await waitFor(() => expect(screen.getByText(/Кардио: \d+ ккал\/нед/)).toBeTruthy());
    expect(screen.getByText(new RegExp(`${contract.weeklyKcal} ккал/нед`))).toBeTruthy();
    expect(screen.getByText(/уверенность \d+%/)).toBeTruthy();
    expect(screen.getByText(/второй раз не добавляется/)).toBeTruthy();
  });

  it('выключенный учёт виден пользователю', async () => {
    publishCardioKcalContract(cycle(), []);
    setCardioKcalInclude(false);
    render(<CardioKcalNote />);
    await waitFor(() => expect(screen.getByText(/выключен/)).toBeTruthy());
    expect(screen.getByText(/второй раз не добавляется/)).toBeTruthy();
  });

  it('компактный режим: одна оговорка про справочность', async () => {
    publishCardioKcalContract(cycle(), []);
    render(<CardioKcalNote compact />);
    await waitFor(() => expect(screen.getByText(/Кардио показано справочно/i)).toBeTruthy());
  });

  it('«↻» перечитывает контракт после изменения в дневнике', async () => {
    publishCardioKcalContract(cycle(), []);
    render(<CardioKcalNote />);
    await waitFor(() => expect(screen.getByText(/ккал\/нед/)).toBeTruthy());
    localStorage.setItem(CARDIO_KCAL_NOTE_KEY, JSON.stringify({
      cycleId: 'updated', weeklyKcal: 999, weeklyMinutes: 60, confidence: 0.8,
      basis: 'log', include: true, updatedAt: new Date().toISOString(), text: '',
    }));
    fireEvent.click(screen.getByRole('button', { name: /Обновить данные кардио/ }));
    await waitFor(() => expect(screen.getByText(/999 ккал\/нед/)).toBeTruthy());
  });
});

/**
 * cardio-modal-sport.test.tsx — спринт 5.2: быстрый модал кардио-сессии
 * (плюс «+ Добавить» в дневниках профиля) пишет дисциплину и provenance.
 *
 * Дефект: `AddCardioModal` собирал запись без `sport`/`source` — самый быстрый
 * путь в приложении давал анонимные записи, которые не попадали в разбивку TID.
 * Плюс черновик уже умеет «повторять последнее» — дисциплина должна ехать так же.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddCardioModal } from '../cardio-diary-modal';
import { loadCardioLog, saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';

function openModal(onSave: (e: unknown) => void): void {
  render(<AddCardioModal open onClose={() => {}} onSave={onSave} />);
}

function submit(onSave: (e: unknown) => void): Record<string, unknown> {
  let saved: Record<string, unknown> | null = null;
  openModal(e => { saved = e as Record<string, unknown>; onSave(e); });
  const btn = screen.getAllByRole('button').find(b => /сохранить|готово|добавить/i.test((b.textContent ?? '').trim()));
  expect(btn).toBeTruthy();
  fireEvent.click(btn!);
  return saved as unknown as Record<string, unknown>;
}

describe('AddCardioModal: дисциплина', () => {
  beforeEach(() => localStorage.clear());

  it('без предыдущих записей — честное «другое» + manual', () => {
    const entry = submit(() => {});
    expect(entry.sport).toBe('other');
    expect(entry.source).toBe('manual');
  });

  it('выбранный велосипед попадает в запись', () => {
    let entry: Record<string, unknown> = {};
    render(<AddCardioModal open onClose={() => {}} onSave={e => { entry = e as Record<string, unknown>; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Дисциплина: велосипед' }));
    const btn = screen.getAllByRole('button').find(b => /сохранить|готово|добавить/i.test((b.textContent ?? '').trim()));
    fireEvent.click(btn!);
    expect(entry.sport).toBe('bike');
  });

  it('«повтор последнего» подставляет дисциплину прошлой записи', () => {
    saveCardioLogEntry({
      id: 'r-1', date: '2026-09-19', type: 'zone2', durationMin: 30,
      completed: true, avgHr: 140, sport: 'run', source: 'manual',
    });
    const entry = submit(() => {});
    expect(entry.sport).toBe('run');   // не <другое> и не выдуманное
  });

  it('запись действительно попадает в дневник (сквозной путь)', () => {
    let entry: Record<string, unknown> = {};
    render(<AddCardioModal open onClose={() => {}} onSave={e => {
      entry = e as Record<string, unknown>;
      saveCardioLogEntry({ id: 'new-1', ...(e as object) } as never);
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Дисциплина: гребля' }));
    const btn = screen.getAllByRole('button').find(b => /сохранить|готово|добавить/i.test((b.textContent ?? '').trim()));
    fireEvent.click(btn!);
    expect(entry.sport).toBe('row');
    expect(loadCardioLog().some(x => x.sport === 'row')).toBe(true);
  });
});

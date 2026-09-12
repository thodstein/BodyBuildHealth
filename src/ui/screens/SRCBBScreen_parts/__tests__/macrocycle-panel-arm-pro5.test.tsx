/**
 * macrocycle-panel-arm-pro5.test.tsx — PRO-5 №6: контролы ARM-блока пишут конфиг.
 */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MacrocyclePanel } from '../MacrocyclePanel';
import { loadAnnualTrainingPlan } from '../../../../engines/annual-training/annual-training-storage';

vi.mock('../../../../core/profile-manager', () => ({
  getProfile: () => ({ settings: { personal: { weight: 80, sex: 'male' }, goals: {} } }),
}));

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

async function openArmBlock(): Promise<void> {
  render(<MacrocyclePanel level="II-KMS" goal="powerlifting" onApplyCycle={() => {}} />);
  fireEvent.click(screen.getByText('Построить макроцикл'));
  await waitFor(() => expect(screen.getByText('🧩 Сборка года по конструкторам')).toBeTruthy());
  fireEvent.click(screen.getByLabelText(/^Блок .*недели 1-/));
  await waitFor(() => expect(screen.getByText('💪 Арм (арм-авто)')).toBeTruthy());
  fireEvent.click(screen.getByText('💪 Арм (арм-авто)'));
  await waitFor(() => expect(screen.getByText(/Конструктор блока изменён на .*Арм/)).toBeTruthy());
}

describe('MacrocyclePanel — ARM PRO-5', () => {
  it('контролы PRO-5 видны в конфиге ARM-блока', async () => {
    await openArmBlock();
    expect(screen.getByText('PRO-5 цикл %/нед')).toBeTruthy();
    expect(screen.getByText('PRO-5 мезо %')).toBeTruthy();
    expect(screen.getByText('PRO-5 hook-кап')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PRO-5 RIR-паритет' })).toBeTruthy();
  });

  it('ставка пишется в конфиг блока', async () => {
    await openArmBlock();
    fireEvent.click(screen.getByText('PRO-5 цикл %/нед'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.click(screen.getByText('OK'));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.blocks[0].config.cyclePctPerWeek).toBe(1));
  });

  it('RPE-тоггл пишется в конфиг блока', async () => {
    await openArmBlock();
    fireEvent.click(screen.getByRole('button', { name: 'PRO-5 RIR-паритет' }));
    await waitFor(() => expect(loadAnnualTrainingPlan()?.blocks[0].config.rpeParity).toBe(true));
    expect(screen.getByRole('button', { name: 'PRO-5 RIR-паритет' }).getAttribute('aria-pressed')).toBe('true');
  });
});

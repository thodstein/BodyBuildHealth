import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MixDiarySection } from '../MixDiarySection';

describe('MixDiarySection — повреждённые legacy-записи', () => {
  beforeEach(() => localStorage.clear());

  it('не роняет дневник при substances={} и повреждённых interactions', async () => {
    localStorage.setItem('he_training_mixes', JSON.stringify([{
      id: 'legacy-mix',
      title: 'Старый микс',
      date: '2025-01-01',
      substances: {},
      recommendations: { interactions: {} },
    }]));

    render(<MixDiarySection />);
    await waitFor(() => expect(screen.getByText('Старый микс')).toBeTruthy());
    expect(screen.getByText(/0 веществ/)).toBeTruthy();
  });

  it('не роняет дневник при substances отсутствует', async () => {
    localStorage.setItem('he_training_mixes', JSON.stringify([{
      id: 'legacy-mix-2', title: 'Старый микс 2', date: '2025-01-01',
    }]));
    render(<MixDiarySection />);
    await waitFor(() => expect(screen.getByText('Старый микс 2')).toBeTruthy());
    expect(screen.getByText(/0 веществ/)).toBeTruthy();
  });
});

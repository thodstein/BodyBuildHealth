import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrthoScreenCard } from '../OrthoScreenCard';

describe('OrthoScreenCard', () => {
  it('рендерится со сводкой и сохраняет в профиль', () => {
    render(<OrthoScreenCard />);
    expect(screen.getByText(/Орто-скрининг J1–J7/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Боль 60–120° при подъёме/));
    fireEvent.click(screen.getByText(/Боль при провокации Hawkins/));
    expect(screen.getByText(/кластер положительный/)).toBeTruthy();
    fireEvent.click(screen.getByText(/В профиль \+ историю/));
    expect(screen.getByRole('status').textContent).toMatch(/Сохранено/);
  });
  it('compact — без чеков, с гардами при кластере', () => {
    render(<OrthoScreenCard compact />);
    expect(screen.queryByText(/Боль 60–120° при подъёме/)).toBeNull();
    expect(screen.getByText(/скрининг, не диагноз/)).toBeTruthy();
  });
});

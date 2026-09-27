import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

describe('PRO-3 W4 UI: гигиена', () => {
  it('P7: side_pin — explainer про ручное дожимание (видео в хабе нет)', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    fireEvent.click(screen.getByText(/Side pin/));
    expect(document.body.textContent).toContain('дожимание оценивается вручную');
    // и никаких отсылок к видео-контуру
    expect(document.body.textContent).not.toContain('по видео');
  });
});

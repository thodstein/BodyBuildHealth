import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CalcQualityTab } from '../CalcQualityTab';

describe('CalcQualityTab — PRO smoke', () => {
  it('renders empty state without crash', () => {
    const { container } = render(<CalcQualityTab onBuildPlan={() => {}} />);
    expect(container.textContent).toContain('Калькулятор качества программ — PRO');
  });
  it('shows both divisions', () => {
    const { container } = render(<CalcQualityTab onBuildPlan={() => {}} level="intermediate" goal="mass" />);
    expect(container.textContent).toContain('ББ — гипертрофия');
    expect(container.textContent).toContain('ПЛ — сила');
  });
});

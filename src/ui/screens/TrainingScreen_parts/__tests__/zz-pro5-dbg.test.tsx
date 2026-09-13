import { it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { validateArmPlan } from '../../../engines/arm/arm-validator.engine';

it('zz dbg4', () => {
  const { container } = render(<ArmAutoConstructor />);
  fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
  const head = screen.getAllByRole('button', { name: /Именной цикл/ }).find((b) => b.getAttribute('aria-expanded') != null)!;
  if (head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
  fireEvent.change(screen.getByLabelText('Hook-кап сетов в неделю'), { target: { value: '2' } });
  fireEvent.click(screen.getByText('⚡ Собрать план'));
  fireEvent.click(screen.getByRole('button', { name: /Веса и качество/ }));
  const gates = container.querySelector("[data-arm='gates']");
  const cards = Array.from(gates?.querySelectorAll('[data-arm^="gate-"]') || []).map((c) => c.getAttribute('data-arm'));
  console.log('CARDS:' + JSON.stringify(cards));
  const vol = gates?.querySelector('[data-arm="gate-volume"]')?.textContent || '';
  console.log('VOL:' + vol.slice(0, 400));
});

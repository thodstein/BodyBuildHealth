import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CycleCatalog, isNamedSystemCycle } from '../CycleCatalog';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';

/**
 * Профессиональная библиотека (docs/BB-AUTO-PROFESSIONAL-CYCLES-PLAN.md):
 * 🏛-бейдж + фильтр «Именные» в каталоге циклов.
 */

const PROPS = { goal: 'mass', level: 'KMS-MS', daysPerWeek: 4 } as any;
const byId = (id: string) => LMS_CYCLES.find(c => c.meta.id === id)!;

const NAMED = [
  'cycle-bb-m-gvt-8', 'cycle-bb-m-gironda-8', 'cycle-bb-m-fst7-8', 'cycle-bb-m-meadows-8',
  'cycle-bb-m-bro-5', 'cycle-bb-m-nubret-6', 'cycle-bb-m-rp-ul-6', 'cycle-bb-m-dc-6',
  'cycle-bb-m-hit-6', 'cycle-bb-m-yates-8', 'cycle-bb-f-fb-3', 'cycle-bb-f-ppl-5',
];

describe('CycleCatalog — именные системы (🏛)', () => {
  beforeEach(() => localStorage.clear());

  it('isNamedSystemCycle: именные true, базовые false', () => {
    for (const id of NAMED) expect(isNamedSystemCycle(byId(id)), id).toBe(true);
    expect(isNamedSystemCycle(byId('cycle-bb-01'))).toBe(false);
    expect(isNamedSystemCycle({})).toBe(false);
  });

  it('фильтр «🏛 Именные» оставляет только именные системы', () => {
    const { container } = render(<CycleCatalog {...PROPS} />);
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    fireEvent.click(within(filters).getByText('🏛 Именные'));
    // именная система видна
    expect(screen.getByText(/Немецкий объёмный/)).toBeTruthy();
    // базовый (не именной) ББ-цикл отфильтрован
    expect(screen.queryByText(/Гипертрофия Upper/)).toBeNull();
  });
});

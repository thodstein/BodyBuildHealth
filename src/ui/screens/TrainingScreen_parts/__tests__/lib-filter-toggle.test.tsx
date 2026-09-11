/** lib-filter-toggle guard: фильтры сворачиваются, контент виден сразу. */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CycleCatalog } from '../CycleCatalog';
import { ManualLibraryGallery } from '../ManualLibraryGallery';
import ExerciseLabCatalog from '../ExerciseLabCatalog';
import { ProgramsTab } from '../ProgramsTab';

describe('lib-filter-toggle', () => {
  it('CycleCatalog: фильтры скрыты по умолчанию и раскрываются кнопкой', () => {
    const { container } = render(<CycleCatalog goal="mass" level="intermediate" daysPerWeek={3} />);
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    expect(filters).not.toBeNull();
    expect(filters.style.display).toBe('none');
    const toggle = screen.getByRole('button', { name: /фильтры/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(filters.style.display).toBe('flex');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Счётчик циклов виден на кнопке даже при скрытых фильтрах
    expect(toggle.textContent).toMatch(/циклов/);
  });

  it('ManualLibraryGallery: фильтры скрыты по умолчанию и раскрываются', () => {
    const { container } = render(
      <ManualLibraryGallery bbPrograms={[]} plCycles={[]} onSelectBB={() => {}} onSelectPL={() => {}} />,
    );
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    expect(filters).not.toBeNull();
    expect(filters.style.display).toBe('none');
    const toggle = screen.getByRole('button', { name: /Показать фильтры/ });
    fireEvent.click(toggle);
    expect(filters.style.display).toBe('flex');
  });

  it('ExerciseLabCatalog: фильтры скрыты по умолчанию и раскрываются', () => {
    const { container } = render(<ExerciseLabCatalog />);
    const filters = container.querySelector('.lib-filters') as HTMLElement;
    expect(filters).not.toBeNull();
    expect(filters.style.display).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: /Показать фильтры/ }));
    expect(filters.style.display).toBe('block');
  });

  it('ProgramsTab: фильтры скрыты по умолчанию и раскрываются', () => {
    const { container } = render(<ProgramsTab selectedProgram={null} setSelectedProgram={() => {}} />);
    expect(container.querySelectorAll('.lib-filters').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Показать фильтры/ }));
    expect(screen.getByRole('button', { name: /Скрыть фильтры/ })).toBeInTheDocument();
  });

  it('все разделы имеют запас прокрутки вниз (.lib-bottom-space)', () => {
    const c1 = render(<CycleCatalog goal="mass" level="intermediate" daysPerWeek={3} />);
    expect(c1.container.querySelector('.lib-bottom-space')).not.toBeNull();
    c1.unmount();
    const c2 = render(
      <ManualLibraryGallery bbPrograms={[]} plCycles={[]} onSelectBB={() => {}} onSelectPL={() => {}} />,
    );
    expect(c2.container.querySelector('.lib-bottom-space')).not.toBeNull();
    c2.unmount();
    const c3 = render(<ExerciseLabCatalog />);
    expect(c3.container.querySelector('.lib-bottom-space')).not.toBeNull();
    c3.unmount();
    const c4 = render(<ProgramsTab selectedProgram={null} setSelectedProgram={() => {}} />);
    expect(c4.container.querySelector('.lib-bottom-space')).not.toBeNull();
    c4.unmount();
  });
});

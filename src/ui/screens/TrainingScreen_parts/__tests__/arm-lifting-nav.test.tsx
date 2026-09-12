import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { TrainingScreen } from '../../TrainingScreen';
import { ZONES, zoneForTab } from '../nav';
import { TAB_LABELS } from '../shared';

afterEach(() => {
  cleanup();
});

describe('arm-lifting nav: второй хаб виден в навигации', () => {
  it('регистрация: tabs + категория + zone + label', () => {
    expect(ZONES.calculators.tabs).toContain('arm_lifting_diagnostics');
    const flat = (ZONES.calculators.categories ?? []).flatMap((c) => c.tabs);
    expect(flat).toContain('arm_lifting_diagnostics');
    expect(zoneForTab('arm_lifting_diagnostics')).toBe('calculators');
    expect(TAB_LABELS['arm_lifting_diagnostics']).toContain('Армлифтинг');
  });
  it('оба хаба рядом в «Качество и диагностика», клик открывает армлифтинг', () => {
    try {
      localStorage.clear();
    } catch {
      /* noop */
    }
    render(<TrainingScreen />);
    fireEvent.click(
      document.querySelector('.training-hero-zone[data-zone="calculators"]')!,
    );
    // Вкладка видна рядом с армрестлинг-хабом, а не только через карточку.
    expect(
      screen.getAllByText('🏋️ Армлифтинг-диагностика').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('🤝 Арм-диагностика').length,
    ).toBeGreaterThan(0);
    // Клик строго по пилюле поднавигации (.tp-tabs-pill), а не по карточке дашборда:
    // чинит путь «полоса вкладок → хаб», а не только «карточка → хаб».
    const subnavs = Array.from(
      document.querySelectorAll('.training-subnav'),
    );
    const pill = subnavs
      .map((s) => {
        try {
          return within(s as HTMLElement).getByText(
            '🏋️ Армлифтинг-диагностика',
          );
        } catch {
          return null;
        }
      })
      .find(Boolean);
    expect(pill).toBeTruthy();
    fireEvent.click(pill!);
    expect(document.body.textContent).toContain('замеры снарядов');
  });
});

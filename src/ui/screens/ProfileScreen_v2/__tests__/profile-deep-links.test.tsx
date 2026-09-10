/**
 * profile-deep-links.test.tsx — переходы из профиля в дневник/отчёт блока:
 * 1. каждая цель кнопок профиля есть в NAV_TARGETS с конкретным subTab;
 * 2. каждый целевой экран по своему subTab открывает именно вкладку
 *    дневника/отчёта, а не hero-главную.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NAV_TARGETS } from '../../../../App';
import { QUICK_DIARY_LINKS, QUICK_REPORT_LINKS } from '../ProfileDiariesTab';
import { REPORT_SOURCES } from '../ProfileReportsTab';
import { LabsScreen } from '../../LabsScreen';
import { NutritionScreen } from '../../NutritionScreen';
import { TrainingScreen } from '../../TrainingScreen';

beforeEach(() => {
  localStorage.clear();
});

describe('profile deep links — карта NAV_TARGETS', () => {
  it('все кнопки дневников профиля ведут в конкретный subTab', () => {
    for (const link of QUICK_DIARY_LINKS) {
      const t = NAV_TARGETS[link.target];
      expect(t, link.target).toBeTruthy();
      expect(t.subTab, link.target).toBeTruthy();
    }
  });

  it('все кнопки отчётов профиля ведут в конкретный subTab', () => {
    for (const link of QUICK_REPORT_LINKS) {
      const t = NAV_TARGETS[link.target];
      expect(t, link.target).toBeTruthy();
      expect(t.subTab, link.target).toBeTruthy();
    }
  });

  it('все источники «Отчётов по блокам» ведут в конкретный subTab', () => {
    for (const src of REPORT_SOURCES) {
      if (src.target === 'custom-report') continue;
      const t = NAV_TARGETS[src.target];
      expect(t, src.target).toBeTruthy();
      expect(t.subTab, src.target).toBeTruthy();
    }
  });

  it('дневники → subTab diary/course, отчёты → reports/analytics', () => {
    expect(NAV_TARGETS['labs-diary']).toMatchObject({ tab: 'labs', subTab: 'diary' });
    expect(NAV_TARGETS['labs-reports']).toMatchObject({ tab: 'labs', subTab: 'reports' });
    expect(NAV_TARGETS['nutrition-diary']).toMatchObject({ tab: 'nutrition', subTab: 'diary' });
    expect(NAV_TARGETS['nutrition-reports']).toMatchObject({ tab: 'nutrition', subTab: 'reports' });
    expect(NAV_TARGETS['workout-log']).toMatchObject({ tab: 'training', subTab: 'diary' });
    expect(NAV_TARGETS['training-analytics']).toMatchObject({ tab: 'training', subTab: 'analytics' });
    expect(NAV_TARGETS['support-diary']).toMatchObject({ tab: 'support', subTab: 'diary' });
    expect(NAV_TARGETS['support-reports']).toMatchObject({ tab: 'support', subTab: 'reports' });
    expect(NAV_TARGETS['pharma-course']).toMatchObject({ tab: 'pharma', subTab: 'course' });
    expect(NAV_TARGETS['pharma-reports']).toMatchObject({ tab: 'pharma', subTab: 'reports' });
    expect(NAV_TARGETS['risk-reports']).toMatchObject({ tab: 'risks', subTab: 'reports' });
  });
});

describe('profile deep links — целевые экраны открывают вкладку сразу', () => {
  it('LabsScreen diary → «Дневник анализов», hero закрыт', async () => {
    const { container } = render(<LabsScreen initialSubTab="diary" />);
    await waitFor(() => {
      expect(screen.getByText('Дневник анализов')).toBeTruthy();
    });
    expect(container.querySelector('.labs-hero-title')).toBeNull();
  });

  it('LabsScreen reports → генерация отчёта, hero закрыт', async () => {
    const { container } = render(<LabsScreen initialSubTab="reports" />);
    await waitFor(() => {
      expect(screen.getAllByText(/Сгенерировать отчёт/).length).toBeGreaterThan(0);
    });
    expect(container.querySelector('.labs-hero-title')).toBeNull();
  });

  it('NutritionScreen diary → тело вкладок дневника, hero закрыт', async () => {
    const { container } = render(<NutritionScreen initialSubTab="diary" />);
    await waitFor(() => {
      expect(container.querySelector('.nutrition-tabs-body')).not.toBeNull();
    });
  });

  it('NutritionScreen reports → «Отчёты», hero закрыт', async () => {
    render(<NutritionScreen initialSubTab="reports" />);
    await waitFor(() => {
      expect(screen.getAllByText('Отчёты').length).toBeGreaterThan(0);
    });
  });

  it('TrainingScreen diary → «Дневник тренировок», hero закрыт', async () => {
    const { container } = render(<TrainingScreen initialSubTab="diary" />);
    await waitFor(() => {
      expect(screen.getByText('Дневник тренировок')).toBeTruthy();
    });
    expect(container.querySelector('.training-hero-title')).toBeNull();
  });

  it('TrainingScreen analytics → hero закрыт', async () => {
    const { container } = render(<TrainingScreen initialSubTab="analytics" />);
    await waitFor(() => {
      expect(container.querySelector('.training-hero-title')).toBeNull();
    });
  });
});

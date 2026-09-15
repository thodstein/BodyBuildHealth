/**
 * labs-female-p2.test.tsx — Л8/Л9/Л10 «Фазы 2 женского слоя»: вкладка «Анализы» под женщин.
 *  - LabsOverview/LabsResults/LabDiaryTab: женские пороги + строка-пометка (только sex=female);
 *  - LabsCatalogTab: легенда «♀ пороги по полу» и бейдж «♀» у строк;
 *  - без sex (мужской путь) — ни одного ♀-хука, прежние границы (36–52 у HCT).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LabsOverview } from '../screens/LabsScreen_parts/LabsOverview';
import { LabsResults } from '../screens/LabsScreen_parts/LabsResults';
import { LabDiaryTab } from '../screens/LabsScreen_parts/LabDiaryTab';
import LabsCatalogTab from '../screens/LabsScreen_parts/LabsCatalogTab';
import type { LabPoint } from '../../core/types';

const lab = (code: string, value: number): LabPoint => ({
  id: `${code}-1`, code, name: code, value, unit: '%', date: '2026-09-01', phase: 'baseline',
} as LabPoint);

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('LabsOverview: женские границы и пометка', () => {
  const renderOv = (sex?: 'male' | 'female') => (
    <LabsOverview labs={[lab('HCT', 49)]} hasLabs forceNoLabs={false} setForceNoLabs={() => {}} sex={sex} />
  );

  it('female: HCT 49 — отклонение (женский ULN 48), есть пометка ♀', () => {
    const { container } = render(renderOv('female'));
    expect(container.querySelector('[data-female-labs-note]')).not.toBeNull();
    expect(screen.getByText(/1 откл\./)).toBeTruthy();
  });

  it('male/без sex: HCT 49 — норма (ULN 52), пометки нет', () => {
    const { container } = render(renderOv());
    expect(container.querySelector('[data-female-labs-note]')).toBeNull();
    expect(screen.getByText(/стабильно/)).toBeTruthy();
    cleanup();
    const male = render(renderOv('male'));
    expect(male.container.querySelector('[data-female-labs-note]')).toBeNull();
  });
});

describe('LabsResults: статус по женским границам + норма ♀', () => {
  it('female: «выше» и диапазон 36–48 ♀; male: норма и 36–52', () => {
    const fem = render(<LabsResults labs={[lab('HCT', 49)]} sex="female" />);
    expect(screen.getByText(/выше/)).toBeTruthy();
    expect(fem.container.textContent).toContain('36–48');
    expect(fem.container.querySelector('[data-female-labs-note]')).not.toBeNull();
    cleanup();
    const male = render(<LabsResults labs={[lab('HCT', 49)]} />);
    expect(screen.getByText(/норма/)).toBeTruthy();
    expect(male.container.textContent).toContain('36–52');
    expect(male.container.querySelector('[data-female-labs-note]')).toBeNull();
  });
});

describe('LabDiaryTab: пометка женских порогов', () => {
  it('female — пометка есть; без sex — нет', () => {
    const fem = render(<LabDiaryTab labs={[lab('HCT', 49)]} sex="female" />);
    expect(fem.container.querySelector('[data-female-labs-note]')).not.toBeNull();
    cleanup();
    const male = render(<LabDiaryTab labs={[lab('HCT', 49)]} />);
    expect(male.container.querySelector('[data-female-labs-note]')).toBeNull();
  });
});

describe('LabsCatalogTab: легенда и бейджи ♀', () => {
  const renderCat = (sex?: 'male' | 'female') => (
    <LabsCatalogTab labs={[]} selectedPhase="baseline" onPhaseChange={() => {}} tick={0} sex={sex} />
  );

  it('female: легенда + ♀-бейдж у HCT + диапазон 36–48', () => {
    const { container } = render(renderCat('female'));
    expect(container.querySelector('[data-female-labs-legend]')).not.toBeNull();
    const row = container.querySelector('[data-female-lab-row="HCT"]');
    expect(row).not.toBeNull();
    expect(container.textContent).toContain('36–48');
  });

  it('male/без sex: легенды и ♀-бейджей нет, HCT 36–52 (прежний каталог)', () => {
    const { container } = render(renderCat());
    expect(container.querySelector('[data-female-labs-legend]')).toBeNull();
    expect(container.querySelector('[data-female-lab-row]')).toBeNull();
    expect(container.textContent).toContain('36–52');
    cleanup();
    const male = render(renderCat('male'));
    expect(male.container.querySelector('[data-female-labs-legend]')).toBeNull();
  });
});

describe('Л8: паритет FEMALE_LAB_BOUNDS ↔ FEMALE_LAB_GROUPS (таб «Женщины и ААС»)', () => {
  it('HCT/Hb/RBC/ALT/креатинин — числа совпадают с женской таблицей протокола', async () => {
    const { FEMALE_LAB_BOUNDS } = await import('../../engines/lab-norms.engine');
    const { FEMALE_LAB_GROUPS } = await import('../screens/SupportScreen_parts/supportProtocolWomenData');
    const find = (marker: string) => FEMALE_LAB_GROUPS.flatMap((g) => g.rows).find((r) => r.marker === marker)!;
    // норма гематокрита «36–48%»
    expect(find('Гематокрит').normal).toBe('36–48%');
    expect(FEMALE_LAB_BOUNDS.HCT).toEqual({ lln: 36, uln: 48 });
    // гемоглобин: зелёный <150 = верхняя женская граница
    expect(find('Гемоглобин').green).toBe('<150');
    expect(FEMALE_LAB_BOUNDS.HGB.uln).toBe(150);
    // АЛТ: норма 7–31
    expect(find('АЛТ').normal).toBe('7–31 Ед/л');
    expect(FEMALE_LAB_BOUNDS.ALT).toEqual({ lln: 7, uln: 31 });
    // креатинин: зелёный <97
    expect(find('Креатинин').green).toBe('<97');
    expect(FEMALE_LAB_BOUNDS.CREATININE.uln).toBe(97);
    // RBC верх 5.2
    expect(FEMALE_LAB_BOUNDS.RBC.uln).toBe(5.2);
  });
});

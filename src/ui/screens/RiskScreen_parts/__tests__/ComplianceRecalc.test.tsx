/**
 * ComplianceRecalc.test.tsx — guard на баг: useEffect автопересчёта висел на
 * [.., markers.length] → правка ЗНАЧЕНИЯ анализа при том же количестве
 * маркеров не пересчитывала отчёт (stale). После фикса — зависимость весь markers.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Стабильные ссылки (как стор в проде): иначе genetics-memo новое каждый
// рендер и эффект автопересчёта зацикливается — это артефакт мока, не кода.
const stableProfile = { settings: {} };
const stableCourse: any[] = [];
let mockLabs: any[] = [
  { code: 'ALT', name: 'ALT', value: 30, unit: 'U/L', date: '2026-08-01' },
];

vi.mock('../../../../core/data-link', () => ({
  useDataLink: () => ({
    profile: stableProfile,
    labs: mockLabs,
    course: stableCourse,
  }),
  notifyDataChange: () => {},
}));

let analyzeCalls = 0;
vi.mock('../../../../engines/compliance-engine', async (importOriginal) => {
  const mod: any = await importOriginal();
  return {
    ...mod,
    analyzeWithCompliance: (args: any) => {
      analyzeCalls++;
      return mod.analyzeWithCompliance(args);
    },
  };
});

import { ComplianceDisplay } from '../../RiskScreen';

afterEach(() => {
  cleanup();
});

describe('ComplianceDisplay auto-recalc', () => {
  it('1. правка значения анализа (то же количество) пересчитывает отчёт', () => {
    const { rerender } = render(<ComplianceDisplay />);
    expect(analyzeCalls).toBe(1);
    mockLabs = [
      { code: 'ALT', name: 'ALT', value: 300, unit: 'U/L', date: '2026-08-01' },
    ];
    rerender(<ComplianceDisplay />);
    expect(analyzeCalls).toBe(2);
  });
});

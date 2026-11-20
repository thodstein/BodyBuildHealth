/**
 * labs-overview-bound-visible.test.tsx — проход 164: сводка «Анализов» не
 * выдаёт границу бланка за норму.
 *
 * «АЛТ >20» при верхней границе 40 — это «не меньше 20»: значение может быть и
 * в норме, и выше. Прежний `getLabStatus` сравнивал обрезанное число с нормой и
 * печатал «✓ норма» / «стабильно». Теперь сторону доказывает `boundProvesSide`,
 * а недоказанная запись считается отдельно — «без вывода».
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { LabsOverview } from '../LabsOverview';
import { LabsResults } from '../LabsResults';
import type { LabPoint } from '../../../../core/types';

const lab = (code: string, value: number, bound?: '<' | '>'): LabPoint => ({
  id: `${code}-1`, code, name: code, value, unit: 'U/L', date: '2026-09-01', phase: 'baseline', bound,
} as LabPoint);

const renderOv = (labs: LabPoint[]) =>
  render(<LabsOverview labs={labs} hasLabs forceNoLabs={false} setForceNoLabs={() => {}} />);

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('проход 164: граница в сводке — не «норма»', () => {
  it('«АЛТ >20» при верхней границе 40 — «без вывода», не «стабильно»', () => {
    const { container } = renderOv([lab('ALT', 20, '>')]);
    expect(container.textContent).toContain('без вывода');
    expect(container.textContent).not.toContain('стабильно');
    expect(container.querySelector('[data-labs-unknown-bar]')).not.toBeNull();
  });

  it('«АЛТ >40» при верхней границе 40 — доказано высокое', () => {
    const { container } = renderOv([lab('ALT', 40, '>')]);
    expect(container.textContent).toContain('1 откл.');
    expect(container.textContent).toContain('выше');
    expect(container.textContent).not.toContain('без вывода');
  });

  it('«АЛТ <7» при нижней границе 7 — доказано низкое', () => {
    const { container } = renderOv([lab('ALT', 7, '<')]);
    expect(container.textContent).toContain('ниже');
    expect(container.textContent).not.toContain('без вывода');
  });

  it('точное число в норме печатается как раньше: «стабильно»', () => {
    const { container } = renderOv([lab('ALT', 20)]);
    expect(container.textContent).toContain('стабильно');
    expect(container.textContent).not.toContain('без вывода');
  });
});

describe('проход 164: строка результата — тоже не «норма»', () => {
  const renderRes = (labs: LabPoint[]) => render(<LabsResults labs={labs} />);

  it('«АЛТ >20» при верхней границе 40 — «без вывода»', () => {
    const { container } = renderRes([lab('ALT', 20, '>')]);
    expect(container.textContent).toContain('без вывода');
    expect(container.textContent).not.toContain('✓ норма');
  });

  it('«АЛТ >40» — доказано высокое, точное 20 — норма', () => {
    const high = renderRes([lab('ALT', 40, '>')]);
    expect(high.container.textContent).toContain('выше');
    cleanup();
    const normal = renderRes([lab('ALT', 20)]);
    expect(normal.container.textContent).toContain('норма');
    expect(normal.container.textContent).not.toContain('без вывода');
  });
});

describe('проход 164: подсказки ассистента берут сторону из одного модуля', () => {
  it('SmartAssistantScreen не сравнивает число с нормой сам', () => {
    const src = readFileSync(join(process.cwd(), 'src/ui/screens/SmartAssistantScreen.tsx'), 'utf8');
    expect(src).toContain('computeMarkerDeviations');
    expect(src).not.toContain('UCUM_MAP[');
  });
});

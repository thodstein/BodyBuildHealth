// labs-coverage-single-source.test.ts — покрытие анализами в карточке «Анализы»:
// одного источника (`riskLabCoverage`) на приложение (проход 207, ревью P2).
// Рукописный список 22 кодов давал 3/22 = 0.14 там, где модель по своим 46
// маркерам считала 0.42: на тех же анализах карточка печатала «×1.22», а
// вкладка «Риски» — «×1.15», и на 18 маркерах модель уже ×1.00 против ×1.05.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const labsScreenSrc = () => readFileSync(resolve(process.cwd(), 'src/ui/screens/LabsScreen.tsx'), 'utf8');

describe('покрытие анализами в карточке «Анализы»', () => {
  it('своего списка кодов у экрана нет', () => {
    const src = labsScreenSrc();
    expect(src).not.toMatch(/const t4\s*=/);
    expect(src).not.toContain('t4.length');
  });

  it('покрытие считается функцией модели, а не своей формулой', () => {
    const src = labsScreenSrc();
    expect(src).toContain('riskLabCoverage(');
    expect(src).toContain("from '../../engines/risk-engine-tz-spec'");
    // Прежняя формула доли рукописного списка: p / t4.length
    expect(src).not.toMatch(/\bp\s*\/\s*t4\b/);
  });
});

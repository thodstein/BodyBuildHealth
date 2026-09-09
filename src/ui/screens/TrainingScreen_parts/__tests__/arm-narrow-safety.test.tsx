/**
 * arm-narrow-safety.test.tsx — узкие экраны 320–360px не давят контент.
 *
 * jsdom не считает layout: проверяем CSS-правила слоя напрямую
 * (прецедент — изоляционные тесты apk-arm-pack читают файл).
 * Ключевые ряды обязаны переноситься, heat — скроллиться.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readBaseCss(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-design.css'),
    'utf-8',
  );
}

function ruleBody(css: string, selector: string): string {
  const idx = css.indexOf(selector);
  if (idx < 0) return '';
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  if (open < 0 || close < 0) return '';
  return css.slice(open + 1, close);
}

describe('Arm narrow safety (320–360px)', () => {
  it('.ad-ex-top переносится: имя + мета не давят друг друга', () => {
    const body = ruleBody(readBaseCss(), '.ad-ex-top {');
    expect(body, 'rule').toContain('flex-wrap');
    expect(body).toContain('wrap');
  });

  it('.ad-split-top переносится: скор-бейдж не давит имя', () => {
    const body = ruleBody(readBaseCss(), '.ad-split-top {');
    expect(body, 'rule').toContain('flex-wrap');
  });

  it('.ad-hero-side переносится: скор + имя + тег', () => {
    const body = ruleBody(readBaseCss(), '.ad-hero-side {');
    expect(body, 'rule').toContain('flex-wrap');
  });

  it('.ad-ex-nm тянется и рвёт длинные названия', () => {
    const body = ruleBody(readBaseCss(), '.ad-ex-nm {');
    expect(body, 'rule').toContain('overflow-wrap');
    expect(body).toContain('min-width: 0');
  });

  it('.ad-heat скроллится горизонтально', () => {
    const body = ruleBody(readBaseCss(), '.ad-heat {');
    expect(body, 'rule').toContain('overflow-x');
    expect(body).toContain('auto');
  });
});

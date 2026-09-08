/**
 * articles-markdown-checklist.test.tsx — guard на баг порядка замен:
 * `^- ` заворачивал `- [ ]` в <li> с тире-префиксом раньше, чем срабатывали
 * чекбокс-паттерны — чеклисты рендерились мусором «— [ ] ...».
 */
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../screens/ArticlesScreen';

describe('renderMarkdown checklists', () => {
  it('1. - [ ] / - [x] дают чекбоксы, а не literal-скобки', () => {
    const html = renderMarkdown('- [ ] ОАК + HCT\n- [x] Готово');
    expect(html).toContain('ОАК + HCT');
    expect(html).toContain('✓');
    expect(html).not.toContain('[ ]');
    expect(html).not.toContain('[x]');
  });

  it('2. обычные пункты списка по-прежнему работают', () => {
    const html = renderMarkdown('- Пункт один\n- Пункт два');
    expect(html).toContain('<ul');
    expect(html).toContain('Пункт один');
  });
});

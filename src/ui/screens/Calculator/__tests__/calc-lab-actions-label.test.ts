/**
 * calc-lab-actions-label.test.ts — проход 97: блок по анализам называется
 * «Действия», а не «Питание».
 *
 * Было: под заголовком «Питание по анализам» лежали не только нутри-советы, но и
 * «Врач (уролог)», «УЗИ почек», «Контроль через 2 нед» — а с прохода 97 там же
 * женская диагностика («пересдать E2 по фазе», «УЗИ яичников»). Название обещало
 * питание и тем самым обесценивало шаги: читатель пролистывал раздел как
 * диетические советы.
 *
 * Стало: одно имя на всех поверхностях — «Действия по анализам» (панель
 * калькулятора и легенда генератора поддержки).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('проход 97: одно имя у блока по анализам', () => {
  it('панель калькулятора: «Действия по анализам», прежнего имени нет', () => {
    const mapper = read('src/ui/screens/Calculator/Calc.mapper.tsx');
    expect(mapper).toContain('Действия по анализам');
    expect(mapper).not.toContain('Питание по анализам');
  });

  it('легенда генератора поддержки называет блок так же', () => {
    const info = read('src/ui/screens/SupportScreen_parts/SupportGeneratorInfo.tsx');
    expect(info).toContain('Действия по анализам');
    expect(info).not.toContain('Питание по анализам');
  });

  it('комментарии слоя безопасности не держат старое имя', () => {
    const safety = read('src/ui/screens/Calculator/CalcSafetyLayer.tsx');
    expect(safety).not.toContain('Питание по анализам');
  });
});

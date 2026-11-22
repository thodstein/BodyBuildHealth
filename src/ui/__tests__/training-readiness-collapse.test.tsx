/**
 * training-readiness-collapse.test.tsx — на вкладке проведения сводка
 * «Готовность к тренировке» не должна оттеснять старт ниже первого экрана:
 * карточка свёрнута до одной строки и раскрывается тапом.
 *
 * Полный рендер TrainingScreen в jsdom не поднимается (OOM на ленивых зонах),
 * поэтому проверяем контракт по исходнику — как это уже делают тесты
 * ExecutionZone в workout-exec-pro.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/ui/screens/TrainingScreen.tsx', 'utf8');

describe('TrainingScreen: готовность свёрнута', () => {
  it('у сводки есть кнопка-аккордеон с aria-expanded', () => {
    expect(src).toContain('data-act="readiness-toggle"');
    expect(src).toContain('aria-expanded={readinessOpen}');
    expect(src).toContain('onClick={() => setReadinessOpen(v => !v)}');
  });

  it('детали скрыты, пока сводка свёрнута', () => {
    expect(src).toContain('data-pl="readiness-body"');
    expect(src).toContain("display: readinessOpen ? 'block' : 'none'");
    // Процент готовности остаётся видимым в заголовке.
    expect(src).toContain('tp-readiness-val');
  });
});

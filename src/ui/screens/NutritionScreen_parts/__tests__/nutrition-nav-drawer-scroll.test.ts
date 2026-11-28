/**
 * nutrition-nav-drawer-scroll.test.ts — меню питания (список подвкладок) обязано
 * прокручиваться до конца и не прятать нижние разделы под плавающей навигацией.
 *
 * Дефект: панель меню лежит в stacking-контексте `.screen` (z-index:1), поэтому
 * fixed-навигация снизу (`z-index:100`) остаётся сверху и перехватывает тапы.
 * Зазор панели учитывал только safe-area (16px), и последние подвкладки уходили
 * под пилюлю — «докрутил до конца, а нижних разделов нет».
 *
 * Замер в браузере (1264×749, dev): drawer clientHeight 735 / scrollHeight 1208,
 * при scrollTop = max последний чип 666..710, полоса навигации 663..739,
 * `elementFromPoint` по чипу → `nav-btn` (тап недоступен).
 *
 * Замок держит зазор `--tabbar-clear` и собственный скролл-контейнер панели.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const screen = () => readFileSync(join(__dirname, '..', '..', 'NutritionScreen.tsx'), 'utf8');
const styles = () => readFileSync(join(__dirname, '..', '..', '..', '..', 'styles.css'), 'utf8');

const drawerBlock = (): string => {
  const src = screen();
  const i = src.indexOf('className="nutrition-nav-drawer"');
  expect(i, 'панель меню питания должна существовать').toBeGreaterThan(-1);
  return src.slice(i, i + 1200);
};

describe('меню питания: список подвкладок прокручивается до конца', () => {
  it('панель — собственный скролл-контейнер с инерционной прокруткой', () => {
    const block = drawerBlock();
    expect(block).toContain("overflowY: 'auto'");
    expect(block).toContain("overscrollBehavior: 'contain'");
    expect(block).toContain("touchAction: 'pan-y'");
    // WebView: без этого длинный список дёргается и «не докручивается».
    expect(styles()).toContain('-webkit-overflow-scrolling: touch');
  });

  it('зазор снизу = --tabbar-clear: последний раздел выше плавающей навигации', () => {
    const block = drawerBlock();
    expect(block).toContain("padding: '12px 12px calc(12px + var(--tabbar-clear, 110px))',");
    // Старый зазор «16px + safe-area» оставлял подвкладки под пилюлей.
    expect(block).not.toContain('calc(16px + max(env(safe-area-inset-bottom,0px),0px))');
  });
});

import { describe, expect, it } from 'vitest';
import { buildTrajectorySvg } from '../movement-diagnostics-export.engine';

/** Точки в сантиметрах: x — горизонталь грифа, y — высота. */
const REP = [
  { x: 0, y: 0 },
  { x: 2, y: 20 },
  { x: 0, y: 40 },
  { x: -1, y: 20 },
  { x: 0, y: 0 },
];

describe('buildTrajectorySvg — экспорт траектории штанги', () => {
  it('отдаёт самостоятельный SVG с заголовком и траекторией', () => {
    const svg = buildTrajectorySvg({ liftRu: 'Жим лёжа', series: REP, xLoopCm: 3.2, vmax: 0.52 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 480 320"');
    expect(svg).toContain('Траектория штанги — Жим лёжа');
    // одна серия → одна линия, без легенды overlay
    expect(svg.match(/<path /g)?.length).toBe(1);
    expect(svg).not.toContain('последний повтор');
    expect(svg).toContain('xLoop 3.2 см');
    expect(svg).toContain('vmax 0.52 м/с');
    // дисклеймер про оценку скорости остаётся
    expect(svg).toContain('оценка (не LPT)');
  });

  it('overlay: первый и последний повтор — две разные линии и легенда', () => {
    const svg = buildTrajectorySvg({
      liftRu: 'Присед',
      firstRep: REP,
      lastRep: REP.map((p) => ({ x: p.x + 1, y: p.y })),
      overlayText: 'Повторы: 3 · Δvmax −18% · внимание',
    });
    expect(svg.match(/<path /g)?.length).toBe(2);
    expect(svg).toContain('первый повтор');
    expect(svg).toContain('последний повтор');
    expect(svg).toContain('Повторы: 3');
    expect(svg).toContain('stroke-dasharray="6 4"');
  });

  it('экранирует пользовательский текст (без инъекции тегов)', () => {
    const svg = buildTrajectorySvg({
      liftRu: '<script>alert(1)</script>',
      overlayText: '</text><script>evil()</script>',
      captureQuality: 'rough — <b>x</b>',
      series: REP,
    });
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('</text><script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('без данных рисует честное «нет данных траектории» и остаётся валидным', () => {
    const svg = buildTrajectorySvg({ liftRu: 'Тяга' });
    expect(svg).toContain('нет данных траектории');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('target-zone');
  });

  it('одна точка не ломает масштаб (делим на защищённую дельту)', () => {
    const svg = buildTrajectorySvg({ liftRu: 'Жим стоя', series: [{ x: 5, y: 5 }] });
    expect(svg).toContain('<path');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('Infinity');
  });

  it('качество съёмки попадает в футер', () => {
    const svg = buildTrajectorySvg({
      liftRu: 'Жим лёжа',
      series: REP,
      captureQuality: 'ok — Геометрия съёмки в допуске',
    });
    expect(svg).toContain('качество: ok');
  });
});

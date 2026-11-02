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

  it('модель поворота: пунктир с камерой в плоскости и это названо моделью', () => {
    const svg = buildTrajectorySvg({
      liftRu: 'Жим лёжа',
      series: REP,
      lastRep: REP,
      firstRep: REP,
      modelXScale: 1.25,
      modelNote: 'Модель поворота: при камере в плоскости движения горизонталь была бы ×1.25',
    });
    // Измеренный путь + модель, а не «исправленная» кривая вместо измерения.
    expect(svg.match(/<path /g)?.length).toBe(3);
    expect(svg).toContain('stroke="#4ade80"');
    expect(svg).toContain('модель: камера в плоскости');
    expect(svg).toContain('Модель поворота');
  });

  it('без угла модели нет: пустой пунктир не рисуется', () => {
    const svg = buildTrajectorySvg({ liftRu: 'Жим лёжа', series: REP });
    expect(svg).not.toContain('#4ade80');
    expect(svg).not.toContain('модель: камера в плоскости');
  });

  it('мусорный множитель модели отбрасывается, а не растягивает график в ноль', () => {
    for (const bad of [0, -2, NaN, Infinity, 1e6]) {
      const svg = buildTrajectorySvg({ liftRu: 'Жим лёжа', series: REP, modelXScale: bad });
      expect(svg).not.toContain('модель: камера в плоскости');
    }
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

  it('строка ракурса идёт отдельной строкой и не налезает на дату', () => {
    const svg = buildTrajectorySvg({
      liftRu: 'Жим лёжа',
      series: REP,
      overlayText: 'Повторы: 3 · vmax 0.52→0.44 м/с',
      sessionText: 'vmax ниже прошлой сессии: 0.44 против 0.52',
      angleText: '⚠ ход 37.5% · масштаб по высоте 31% — либо техника, либо камера не под 90°',
      createdAt: '2026-11-01',
    });
    expect(svg).toContain('ход 37.5%');
    // Три строки подписи + дата — четыре разных y, иначе текст накладывается.
    const ys = [...svg.matchAll(/<text[^>]*y="(\d+)"/g)].map((m) => Number(m[1]));
    const footerYs = ys.slice(-4);
    expect(new Set(footerYs).size, `разные y для подписей: ${footerYs.join(',')}`).toBe(4);
    expect(footerYs[3]).toBeGreaterThan(footerYs[2]);
    // Картинка выросла под текст, дата не уехала за край.
    const height = Number(/height="(\d+)"/.exec(svg)![1]);
    expect(footerYs[3]).toBeLessThan(height);
  });

  it('длинная оговорка к сравнению переносится и остаётся внутри картинки', () => {
    const caveat = '⚠ ракурс 8° → 25°: ΔxLoop — разница ракурсов, а не техники · ΔxLoop с поправкой +0.6 см (оценка)';
    const svg = buildTrajectorySvg({
      liftRu: 'Жим лёжа',
      series: REP,
      sessionText: 'vmax ниже прошлой сессии',
      sessionCaveat: caveat,
      createdAt: '2026-11-01',
    });
    // Слова не разрезаны и не потеряны, но ни одна строка не длиннее бюджета подписи.
    const infoLines = [...svg.matchAll(/<text[^<>]*fill="(#[0-9a-f]+)"[^<>]*font-size="10">([^<]*)<\/text>/g)]
      .map((m) => ({ color: m[1], text: m[2] }));
    const caveatLines = infoLines.filter((l) => l.color === '#fbbf24').map((l) => l.text);
    expect(caveatLines.length).toBeGreaterThan(1);
    expect(caveatLines.join(' ')).toBe(caveat);
    for (const line of caveatLines) expect(line.length).toBeLessThanOrEqual(78);
    // Оговорка — вниманием, а не будничным серым.
    expect(svg).toContain('fill="#fbbf24"');
    // Каждая подпись выше нижнего края, иначе её обрежет вьюпорт.
    const height = Number(/height="(\d+)"/.exec(svg)![1]);
    const ys = [...svg.matchAll(/<text[^>]*y="(\d+)"/g)].map((m) => Number(m[1]));
    for (const y of ys) expect(y).toBeLessThan(height);
  });

  it('без лишних строк высота картинки остаётся 320 (раскладка не разъехалась)', () => {
    const svg = buildTrajectorySvg({ liftRu: 'Тяга', series: REP, createdAt: '2026-11-01' });
    expect(/height="320"/.test(svg)).toBe(true);
  });

  it('heatmap: с временем серия рисуется цветными отрезками и легендой скоростей', () => {
    // t растёт: медленный старт, быстрая середина, медленный финиш
    const withT = [
      { x: 0, y: 0, t: 0 },
      { x: 0.5, y: 5, t: 1 },
      { x: 1, y: 20, t: 1.2 },
      { x: 1.5, y: 35, t: 1.4 },
      { x: 2, y: 45, t: 2.4 },
    ];
    const svg = buildTrajectorySvg({ liftRu: 'Присед', series: withT });
    expect(svg).toContain('быстро');
    expect(svg).toContain('медленно (срыв)');
    expect(svg).toContain('#00e68a'); // fast
    expect(svg).toContain('#f87171'); // slow
    // серия разбита на отрезки, а не одной полилинией
    expect(svg.match(/<line /g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(svg).not.toContain('NaN');
  });

  it('heat=false отключает раскраску по скорости (обычная линия)', () => {
    const withT = REP.map((p, i) => ({ ...p, t: i * 0.5 }));
    const svg = buildTrajectorySvg({ liftRu: 'Присед', series: withT, heat: false });
    expect(svg).not.toContain('медленно (срыв)');
    expect(svg.match(/<path /g)?.length).toBe(1);
  });

  it('справка прошлой сессии: серая линия, легенда и строка сравнения', () => {
    const svg = buildTrajectorySvg({
      liftRu: 'Присед',
      series: REP,
      prevRep: REP.map((p) => ({ x: p.x - 1, y: p.y })),
      sessionText: 'vmax ниже прошлой сессии: 0.55 → 0.48 м/с (−13%) · xLoop +0.5 см',
    });
    expect(svg).toContain('прошлая сессия');
    expect(svg).toContain('vmax ниже прошлой сессии');
    expect(svg).toContain('stroke-dasharray="2 3"');
  });
});

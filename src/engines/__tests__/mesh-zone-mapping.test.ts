/**
 * mesh-zone-mapping.test.ts — тесты геодезического нанесения зон:
 * 1) зона растёт ТОЛЬКО по поверхности (не протекает сквозь тело),
 * 2) мягкий градиент веса (центр = 1, край ≈ 0),
 * 3) работает и с индексами, и без (неиндексированная геометрия),
 * 4) две зоны делят поверхность по ближайшему seed.
 */
import { describe, it, expect } from 'vitest';
import { buildZoneMapping, nearestVertexIndex, type ZoneSeed } from '../mesh-zone-mapping';

/** Плоская сетка N×N в плоскости z=const. Индексы — два треугольника на клетку. */
function gridPlane(n: number, z: number, size = 4): { positions: Float32Array; indices: Uint32Array } {
  const positions: number[] = [];
  const indices: number[] = [];
  const step = size / (n - 1);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      positions.push(-size / 2 + x * step, -size / 2 + y * step, z);
    }
  }
  const vid = (x: number, y: number) => y * n + x;
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      indices.push(vid(x, y), vid(x + 1, y), vid(x, y + 1));
      indices.push(vid(x + 1, y), vid(x + 1, y + 1), vid(x, y + 1));
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

describe('buildZoneMapping: зоны не протекают сквозь тело', () => {
  it('seed у передней плоскости НЕ окрашивает заднюю (две несвязанные плоскости)', () => {
    // Две отдельные плоскости (передняя z=+1 и задняя z=-1) — вершины НЕ связаны
    // (как передняя/задняя поверхности тела, разъединённые толщиной).
    const front = gridPlane(6, 1);
    const back = gridPlane(6, -1);
    const positions = new Float32Array([...front.positions, ...back.positions]);
    const backOffset = front.positions.length / 3;
    const indices = new Uint32Array([
      ...front.indices,
      ...Array.from(back.indices).map(i => i + backOffset),
    ]);
    const seeds: ZoneSeed[] = [{ id: 'chest', pos: [0, 0, 1.4], radius: 10 }];
    const { zoneIdx } = buildZoneMapping(positions, indices, seeds);

    // Передняя плоскость — в зоне (все её вершины связаны между собой)
    expect(zoneIdx[0]).toBe(0);
    // Задняя плоскость — НЕ в зоне (путь идёт через воздух — связи нет)
    for (let i = backOffset; i < zoneIdx.length; i++) {
      expect(zoneIdx[i]).toBe(-1);
    }
  });

  it('старый сферный подход окрасил бы заднюю, а геодезика — нет (расстояние по воздуху < радиуса)', () => {
    const front = gridPlane(4, 1, 2);
    const back = gridPlane(4, -1, 2);
    const positions = new Float32Array([...front.positions, ...back.positions]);
    const backOffset = front.positions.length / 3;
    const indices = new Uint32Array([
      ...front.indices,
      ...Array.from(back.indices).map(i => i + backOffset),
    ]);
    // Расстояние по воздуху от seed (z=+1.5) до задней плоскости (z=-1) ≈ 2.5 < radius 10
    const seeds: ZoneSeed[] = [{ id: 'chest', pos: [0, 0, 1.5], radius: 10 }];
    const { zoneIdx } = buildZoneMapping(positions, indices, seeds);
    for (let i = backOffset; i < zoneIdx.length; i++) {
      expect(zoneIdx[i]).toBe(-1);
    }
  });
});

describe('buildZoneMapping: мягкий градиент', () => {
  it('центр зоны = вес 1, дальние вершины = вес < 1, за радиусом = 0', () => {
    const { positions, indices } = gridPlane(20, 0, 8); // шаг ~0.42
    const seeds: ZoneSeed[] = [{ id: 'z0', pos: [0, 0, 0.5], radius: 2.5 }];
    const { zoneIdx, weights } = buildZoneMapping(positions, indices, seeds);

    const center = nearestVertexIndex(positions, 0, 0, 0);
    expect(zoneIdx[center]).toBe(0);
    expect(weights[center]).toBeGreaterThan(0.9);

    // Угол сетки (-4,-4): поверхностный путь ~ 4*√2 ≈ 5.66 > radius → вне зоны
    const corner = nearestVertexIndex(positions, -3.9, -3.9, 0);
    expect(zoneIdx[corner]).toBe(-1);
    expect(weights[corner]).toBe(0);

    // Промежуточная точка: в зоне, но вес заметно меньше 1
    const mid = nearestVertexIndex(positions, 1.8, 0, 0);
    expect(zoneIdx[mid]).toBe(0);
    expect(weights[mid]).toBeLessThan(weights[center]);
    expect(weights[mid]).toBeGreaterThan(0);
  });
});

describe('buildZoneMapping: индексы и границы между зонами', () => {
  it('неиндексированная геометрия работает (последовательные тройники)', () => {
    // Один квадрат из двух треугольников без индексов
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 0, 1, 1, 0, 0, 1, 0,
    ]);
    const seeds: ZoneSeed[] = [{ id: 'z0', pos: [0, 0, 0.3], radius: 5 }];
    const { zoneIdx, weights } = buildZoneMapping(positions, null, seeds);
    expect(zoneIdx[0]).toBe(0);
    expect(zoneIdx[4]).toBe(0); // дальний угол связан через треугольники
    expect(weights[4]).toBeGreaterThan(0);
  });

  it('два seed делят полосу по ближайшему на поверхности', () => {
    const positions: number[] = [];
    const indices: number[] = [];
    // Полоса: 21 вершина по x, 2 ряда по y
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 21; x++) positions.push(x, y, 0);
    }
    for (let x = 0; x < 20; x++) {
      indices.push(x, x + 1, x + 21);
      indices.push(x + 1, x + 22, x + 21);
    }
    const seeds: ZoneSeed[] = [
      { id: 'a', pos: [2, 0, 0.3], radius: 30 },
      { id: 'b', pos: [17, 0, 0.3], radius: 30 },
    ];
    const { zoneIdx } = buildZoneMapping(new Float32Array(positions), new Uint32Array(indices), seeds);
    // Вершина x=2 → зона a; x=17 → зона b; x=10 → ближе к a (8 против 7)
    expect(zoneIdx[2]).toBe(0);
    expect(zoneIdx[17]).toBe(1);
    expect(zoneIdx[10]).toBe(1);
    expect(zoneIdx[9]).toBe(0);
  });
});

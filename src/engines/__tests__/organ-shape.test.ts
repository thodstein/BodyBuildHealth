/**
 * organ-shape.test.ts — инварианты форм органов и посадки в тело.
 *
 * Граница теста: движок чистый (без WebGL), поэтому проверяются решения —
 * пропорции, профиль силуэта и клампинг. Факт «орган реально нарисован» и
 * «GLB валиден» проверяется в organ-assets-integrity.test.ts и TZRisk3DModel.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  ORGAN_SHAPES,
  BODY_UNIT_CM,
  organShapeExtent,
  buildSilhouetteProfile,
  silhouetteAt,
  placeInsideBody,
  anchorZ,
  type OrganShapeId,
} from '../organ-shape.engine';

const SHAPE_IDS = Object.keys(ORGAN_SHAPES) as OrganShapeId[];

/** Синтетический силуэт: полукруглый «торс» шириной 0.5 и глубиной 0.2. */
const SYNTHETIC = buildSilhouetteProfile(
  (() => {
    const out: number[] = [];
    for (const y of [-0.5, 0, 0.5]) {
      for (const [x, z] of [[0.5, 0], [-0.5, 0], [0, 0.2], [0, -0.2]]) out.push(x, y, z);
    }
    return new Float32Array(out);
  })(),
  0.5,
);

describe('ORGAN_SHAPES — пропорции по анатомии', () => {
  it('у каждой формы наибольшая ось = size (extent нормирован максимумом 1)', () => {
    for (const id of SHAPE_IDS) {
      const s = ORGAN_SHAPES[id];
      expect(Math.max(...s.extent), `${id}: max(extent)`).toBeCloseTo(1, 10);
    }
  });

  it('доли лобулей лежат в [−0.5, 0.5] по каждой оси', () => {
    for (const id of SHAPE_IDS) {
      for (const lobe of ORGAN_SHAPES[id].lobes) {
        for (let k = 0; k < 3; k++) {
          expect(Math.abs(lobe.c[k]), `${id}: c[${k}]`).toBeLessThanOrEqual(0.5);
          expect(lobe.r[k], `${id}: r[${k}]`).toBeGreaterThan(0);
          expect(lobe.r[k], `${id}: r[${k}]`).toBeLessThanOrEqual(0.5);
          expect(Math.abs(lobe.c[k]) + lobe.r[k], `${id}: |c|+r по оси ${k}`).toBeLessThanOrEqual(0.5 + 1e-9);
        }
      }
    }
  });

  it('собранный полугабарит не превышает половину заявленного (лобуль не торчит за bbox)', () => {
    for (const id of SHAPE_IDS) {
      const s = ORGAN_SHAPES[id];
      const half = organShapeExtent(s);
      for (let k = 0; k < 3; k++) {
        expect(half[k], `${id}: полугабарит по оси ${k} ≤ size*extent/2`).toBeLessThanOrEqual((s.size * s.extent[k]) / 2 + 1e-9);
        expect(half[k], `${id}: полугабарит по оси ${k} > 0`).toBeGreaterThan(0);
      }
    }
  });

  it('полные габариты органов в диапазоне 2.5–21 см (тело ≈2.0 = 180 см)', () => {
    for (const id of SHAPE_IDS) {
      const half = organShapeExtent(ORGAN_SHAPES[id]);
      for (let k = 0; k < 3; k++) {
        // organShapeExtent возвращает ПОЛУгабарит (|c|+r — половина лобуля),
        // поэтому полная сторона = half * 2, а 1 локальная единица = 90 см.
        const cm = half[k] * 2 * BODY_UNIT_CM;
        expect(cm, `${id}: ось ${k} — ${cm.toFixed(1)} см`).toBeGreaterThan(2.5);
        expect(cm, `${id}: ось ${k} — ${cm.toFixed(1)} см`).toBeLessThan(21);
      }
    }
  });

  it('наибольшая сторона формы близка к заявленному размеру (см)', () => {
    // Заодно фиксирует, что 1 единица = 90 см, а не 60 (тело в сцене = 3.0 —
    // это МИРОВЫЕ единицы, органы живут в группе тела с масштабом ≈2.0).
    expect(BODY_UNIT_CM).toBe(90);
    const WANTED = { brain: 17, heart: 12, liver: 15, kidneys: 18, uterus: 8 } as Record<string, number>;
    for (const id of SHAPE_IDS) {
      const maxCm = Math.max(...organShapeExtent(ORGAN_SHAPES[id])) * 2 * BODY_UNIT_CM;
      const ratio = maxCm / WANTED[id];
      // Лобули не заполняют bbox на 100% (у мозга 0.48 из 0.5 по z) — это норма.
      // Но ошибка масштаба (например ×1.5 из-за путаницы единиц) обязана ловиться.
      expect(ratio, `${id}: ${maxCm.toFixed(1)} см из ${WANTED[id]}`).toBeGreaterThan(0.85);
      expect(ratio, `${id}: ${maxCm.toFixed(1)} см из ${WANTED[id]}`).toBeLessThanOrEqual(1.001);
    }
  });

  it('форма не вырожденная: хотя бы два лобуля и ненулевой габарит', () => {
    for (const id of SHAPE_IDS) {
      const s = ORGAN_SHAPES[id];
      expect(s.lobes.length, `${id}: лобулей`).toBeGreaterThanOrEqual(2);
      expect(organShapeExtent(s).every((v) => v > 0), `${id}: габарит`).toBe(true);
    }
  });
});

describe('buildSilhouetteProfile — профиль из реальной геометрии', () => {
  it('на синтетическом теле даёт ожидаемые полуширину и границы по z', () => {
    const band = silhouetteAt(SYNTHETIC, 0);
    expect(band).not.toBeNull();
    expect(band!.halfW).toBeCloseTo(0.5, 6);
    expect(band!.zFront).toBeCloseTo(0.2, 6);
    expect(band!.zBack).toBeCloseTo(-0.2, 6);
  });

  it('полосы отсортированы по высоте', () => {
    const ys = SYNTHETIC.map(b => b.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it('на пустых данных не падает и даёт пустой профиль', () => {
    expect(buildSilhouetteProfile(new Float32Array(0))).toEqual([]);
    expect(silhouetteAt([], 0)).toBeNull();
  });

  it('выше и ниже тела берётся ближайшая крайняя полоса', () => {
    expect(silhouetteAt(SYNTHETIC, 5)!.y).toBe(SYNTHETIC[SYNTHETIC.length - 1].y);
    expect(silhouetteAt(SYNTHETIC, -5)!.y).toBe(SYNTHETIC[0].y);
  });
});

describe('placeInsideBody — орган всегда целиком внутри тела', () => {
  it('не выходит за боковую границу силуэта', () => {
    const [x] = placeInsideBody([10, 0, 0], [0.05, 0.05, 0.05], SYNTHETIC);
    expect(Math.abs(x)).toBeLessThanOrEqual(0.5 * 0.9);
  });

  it('вписывается по глубине между задней и передней поверхностями', () => {
    const [, , z] = placeInsideBody([0, 0, 5], [0.05, 0.05, 0.05], SYNTHETIC);
    expect(z).toBeLessThanOrEqual(0.2 - 0.05);
    expect(z).toBeGreaterThanOrEqual(-0.2 + 0.05);
  });

  it('орган толще тела ставится по центру глубины, а не вылетает наружу', () => {
    const [, , z] = placeInsideBody([0, 0, 9], [0.5, 0.5, 0.5], SYNTHETIC);
    expect(z).toBeCloseTo(0, 6);
  });

  it('якорь внутри силуэта по глубине не сдвигается', () => {
    const [, , z] = placeInsideBody([0, 0, 0], [0.02, 0.02, 0.02], SYNTHETIC);
    expect(z).toBeCloseTo(0, 6);
  });

  it('без профиля возвращает якорь как есть (старый путь)', () => {
    expect(placeInsideBody([0.3, -0.1, 0.2], [0.1, 0.1, 0.1], [])).toEqual([0.3, -0.1, 0.2]);
  });

  it('высота якоря сохраняется — орган не уезжает по вертикали', () => {
    const [, y] = placeInsideBody([0, 0.37, 0], [0.05, 0.05, 0.05], SYNTHETIC);
    expect(y).toBeCloseTo(0.37, 10);
  });
});

describe('anchorZ — якорь зоны ставится СНАРУЖИ нужной поверхности', () => {
  it('передняя зона — впереди лица тела, задняя — за спиной', () => {
    const front = anchorZ([0, 0, 0], 'front', SYNTHETIC);
    const back = anchorZ([0, 0, 0], 'back', SYNTHETIC);
    expect(front).toBeGreaterThan(0.2);
    expect(back).toBeLessThan(-0.2);
  });

  it('без профиля даёт безопасные значения с нужным знаком', () => {
    expect(anchorZ([0, 0, 0], 'front', [])).toBeGreaterThan(0);
    expect(anchorZ([0, 0, 0], 'back', [])).toBeLessThan(0);
  });
});

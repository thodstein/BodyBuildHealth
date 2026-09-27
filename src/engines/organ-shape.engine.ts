/**
 * organ-shape.engine.ts — анатомия органов и посадка их в тело (чистые функции, без WebGL).
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ. У трёхмерной модели рисков два класса дефекта, оба невидимы
 * в коде без замеров:
 *
 * 1) Ассеты. Четыре organ-меша пришли битыми: glTF-Transform положил геометрию
 *    в `buffers[1]`, а в файл попал только `buffers[0]` (текстура). three.js на
 *    `loadBuffer(1)` уходит в загрузку `undefined` → onError → мозг, сердце,
 *    печень и почки не рисуются ВООБЩЕ. Проверка — `organ-assets-integrity.test.ts`.
 *    Поэтому формы этих органов задаются здесь параметрами, а не файлами.
 *
 * 2) Посадка. Прежний код пускал луч СНАРУЖИ к точке-якорю и, если луч промахивался
 *    мимо тела, молча бил с противоположной стороны — орган оказывался по другую
 *    сторону от запрошенной. Здесь размещение считается по ИЗМЕРЕННОМУ силуэту
 *    тела: орган гарантированно целиком лежит внутри, на запрошенной стороне.
 *
 * КООРДИНАТЫ. Тело (`bodybuilder.glb`) автором нормализовано: y ∈ [−1, +1]
 * (стопы → макушка), x ∈ [−0.51, +0.51] (ширина), z ∈ [−0.25, +0.25] (глубина),
 * центр в нуле. Замеренные маркеры (пальцы стоп +0.25, икры выпячены на −0.16,
 * пресс +0.16, лицо +0.13) дают: **тело смотрит в +z**, значит
 * **лево тела = +x**, правое тело = −x.
 *
 * Камера стоит на +z и смотрит в −z, поэтому на экране +x — правая половина
 * картинки, а тело повёрнуто к зрителю. Прежние якоря печени (+0.18) и селезёнки
 * (−0.24) были заданы в экранных координатах, а не в собственных координатах
 * тела: они ставили печень в левую половину тела, а селезёнку — в правую.
 *
 * МАСШТАБ. Тело нормализуется кодом до высоты 3.0 мировых единиц, то есть
 * 1 единица = 60 см при статуре 180 см. Все размеры органов ниже — в этих же
 * мировых единицах, пересчитаны из реальных анатомических габаритов.
 */

/** Доля силуэта, занимаемая органом: остальное — запас до кожи. */
const BODY_FILL = 0.9;
/** Отступ от кожи, чтобы орган не «слипался» с поверхностью при рентгене. */
const SKIN_MARGIN = 0.02;

// ── Формы (только для органов без валидного GLB) ────────────────────────────

/** Один эллипсоид в системе координат органа: центр `c` и полуоси `r`, всё в долях [−0.5, 0.5]. */
export interface OrganLobe {
  c: [number, number, number];
  r: [number, number, number];
}

export interface OrganShape {
  /**
   * Наибольший габарит органа в ЛОКАЛЬНЫХ единицах тела: тело = ≈2.0 = 180 см,
   * то есть 1 единица ≈ 90 см. ВАЖНО: не путать с мировыми единицами сцены,
   * где тело растянуто до 3.0 (там 1 единица = 60 см) — органы живут в группе
   * тела, поэтому масштаб локальный.
   */
  size: number;
  /** Пропорции габарита [x, y, z] в долях `size`; максимум всегда 1. */
  extent: [number, number, number];
  lobes: OrganLobe[];
}

export type OrganShapeId = 'brain' | 'heart' | 'liver' | 'kidneys' | 'uterus';

/** 1 локальная единица тела в сантиметрах (тело ≈2.0 = 180 см). */
export const BODY_UNIT_CM = 90;

/**
 * Формы заданы по реальным анатомическим габаритам, а не по «красивому шару».
 * `c`/`r` — доли ПОЛНОГО габарита по своей оси, поэтому 2·r = доля диаметра.
 *
 * Размеры в сантиметрах → `size` = max(см) / 90:
 *   мозг 15×12×17 → 0.189; сердце 9×7×12 → 0.133; печень 15×15×10 → 0.167;
 *   пара почек 18 см в ширину при 11×6×6 каждая → 0.200; матка 5×8×4 → 0.089.
 */
export const ORGAN_SHAPES: Record<OrganShapeId, OrganShape> = {
  brain: {
    size: 17 / 90,
    extent: [15 / 17, 12 / 17, 1],
    lobes: [
      { c: [0, 0.03, 0.02], r: [0.44, 0.44, 0.44] },      // большие полушария
      { c: [0, -0.28, -0.28], r: [0.26, 0.16, 0.20] },     // мозжечок
      { c: [0, -0.30, 0.02], r: [0.08, 0.18, 0.08] },       // ствол
    ],
  },
  heart: {
    size: 12 / 90,
    extent: [9 / 12, 7 / 12, 1],
    lobes: [
      { c: [-0.08, 0.05, 0.08], r: [0.30, 0.32, 0.40] },   // желудочки
      { c: [0.05, 0.22, -0.24], r: [0.26, 0.18, 0.20] },   // предсердия
    ],
  },
  liver: {
    size: 15 / 90,
    extent: [1, 1, 10 / 15],
    lobes: [
      { c: [-0.17, 0.02, 0.04], r: [0.33, 0.44, 0.44] },   // правая доля (тело: −x)
      { c: [0.29, 0.0, 0.0], r: [0.20, 0.28, 0.24] },      // левая доля
    ],
  },
  kidneys: {
    size: 18 / 90,
    extent: [1, 11 / 18, 6 / 18],
    lobes: [
      { c: [-0.333, 0, 0], r: [0.167, 0.5, 0.5] },         // правая почка
      { c: [0.333, 0, 0], r: [0.167, 0.5, 0.5] },          // левая почка
    ],
  },
  uterus: {
    size: 8 / 90,
    extent: [5 / 8, 1, 4 / 8],
    lobes: [
      { c: [0, 0.06, 0], r: [0.42, 0.34, 0.44] },           // тело матки
      { c: [0, -0.3, -0.1], r: [0.12, 0.2, 0.12] },         // шейка
    ],
  },
};

/**
 * ПОЛУгабарит формы в мировых единицах, собранный из лобулей (|c|+r — половина
 * лобуля). Именно полугабарит нужен посадке: `placeInsideBody` сравнивает его с
 * половиной ширины силуэта. Полная сторона = результат * 2; при размере тела
 * 3.0 = 180 см один world unit = 60 см.
 */
export function organShapeExtent(shape: OrganShape): [number, number, number] {
  const acc: [number, number, number] = [0, 0, 0];
  for (const lobe of shape.lobes) {
    for (let k = 0; k < 3; k++) {
      const reach = (Math.abs(lobe.c[k]) + lobe.r[k]) * shape.extent[k] * shape.size;
      if (reach > acc[k]) acc[k] = reach;
    }
  }
  return acc;
}

// ── Профиль силуэта тела (из реальной геометрии) ─────────────────────────────

/** Одна полоса силуэта: полуширина по x и границы по z на заданной высоте. */
export interface SilhouetteBand {
  /** центр полосы по высоте (те же нормированные координаты, что у тела) */
  y: number;
  /** максимальный |x| */
  halfW: number;
  /** максимальный z (перед тела = +z) */
  zFront: number;
  /** минимальный z (зад тела = −z) */
  zBack: number;
}

/**
 * Строит профиль силуэта по реальным вершинам тела.
 * Раньше границу тела угадывали лучом; здесь она измеряется, поэтому посадка
 * органов не зависит от того, попал луч в модель или нет.
 */
export function buildSilhouetteProfile(
  positions: Float32Array,
  yStep = 0.04,
): SilhouetteBand[] {
  const bins = new Map<number, { halfW: number; zFront: number; zBack: number; n: number }>();
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const key = Math.round(y / yStep);
    let b = bins.get(key);
    if (!b) {
      b = { halfW: 0, zFront: -Infinity, zBack: Infinity, n: 0 };
      bins.set(key, b);
    }
    const ax = Math.abs(x);
    if (ax > b.halfW) b.halfW = ax;
    if (z > b.zFront) b.zFront = z;
    if (z < b.zBack) b.zBack = z;
    b.n++;
  }
  return [...bins.entries()]
    .filter(([, b]) => b.n > 0)
    .map(([key, b]) => ({ y: key * yStep, halfW: b.halfW, zFront: b.zFront, zBack: b.zBack }))
    .sort((a, b) => a.y - b.y);
}

/** Ближайшая полоса профиля к высоте `y` (за краями тела — крайняя полоса). */
export function silhouetteAt(profile: SilhouetteBand[], y: number): SilhouetteBand | null {
  if (!profile.length) return null;
  let best = profile[0];
  let bestD = Math.abs(best.y - y);
  for (const band of profile) {
    const d = Math.abs(band.y - y);
    if (d < bestD) {
      bestD = d;
      best = band;
    }
  }
  return best;
}

/**
 * Ставит орган целиком внутрь тела на заданной высоте.
 * x прижимается к центральной оси силуэта, z укладывается между задней и передней
 * поверхностями. Никаких «если луч промахнулся — бьём сзади»: сторона задаётся
 * якорем, а не результатом raycast.
 */
export function placeInsideBody(
  pos: [number, number, number],
  /** полугабариты органа в НОРМИРОВАННЫХ координатах тела (мировые / 1.5) */
  half: [number, number, number],
  profile: SilhouetteBand[],
): [number, number, number] {
  const band = silhouetteAt(profile, pos[1]);
  if (!band) return [pos[0], pos[1], pos[2]];
  const margin = half[0] + SKIN_MARGIN;
  const xLimit = Math.max(0, band.halfW * BODY_FILL - margin);
  const x = Math.max(-xLimit, Math.min(xLimit, pos[0]));

  const zLo = band.zBack + half[2] + SKIN_MARGIN;
  const zHi = band.zFront - half[2] - SKIN_MARGIN;
  // Если орган толще промежутка (мелкий силуэт внизу) — ставим по центру глубины.
  const z = zLo <= zHi
    ? Math.max(zLo, Math.min(zHi, pos[2]))
    : (band.zBack + band.zFront) / 2;
  return [x, pos[1], z];
}

/**
 * Сторона тела для якоря кликабельной зоны. Якорь должен лежать ЧУТЬ СНАРУЖИ
 * нужной поверхности: иначе ближайшей вершиной окажется противоположная сторона
 * и зона «сердце» нарисовалась бы на спине.
 */
export function anchorZ(anchor: [number, number, number], side: 'front' | 'back', profile: SilhouetteBand[]): number {
  const band = silhouetteAt(profile, anchor[1]);
  if (!band) return side === 'front' ? 0.4 : -0.4;
  return side === 'front' ? band.zFront + 0.1 : band.zBack - 0.1;
}

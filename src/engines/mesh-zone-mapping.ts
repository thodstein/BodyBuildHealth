/**
 * mesh-zone-mapping.ts — ЧИСТОЕ нанесение зон на единый меш (hulk.glb).
 *
 * В отличие от старого подхода (якорные СФЕРЫ в 3D + евклидово расстояние),
 * зоны растут ПО ПОВЕРХНОСТИ меша (Дейкстра по рёбрам треугольников):
 *  - зона не «протекает» сквозь тело (спина не окрашивается от якоря груди);
 *  - границы идут по анатомии, а не по кругу в воздухе;
 *  - у каждой вершины — мягкий вес (smoothstep-затухание от центра зоны),
 *    поэтому края зон рендерятся как плавный градиент, а не зубцы треугольников.
 *
 * hulk.glb — НЕиндексированный меш (последовательные тройники вершин), поэтому
 * вершины сначала «свариваются» по совпадающим координатам (welding) — иначе
 * соседние треугольники были бы изолированы и зона = один треугольник.
 *
 * Чистые функции, без three.js — тестируются на синтетических сетках.
 */

export interface ZoneSeed {
  id: string;
  /** Якорь зоны в мировых координатах модели. */
  pos: [number, number, number];
  /** Максимальное расстояние ПО ПОВЕРХНОСТИ от якоря (в единицах модели). */
  radius: number;
}

export interface ZoneMapping {
  /** Индекс зоны (в массиве seeds) для каждой вершины, −1 = вне зон. */
  zoneIdx: Int8Array;
  /** Мягкий вес 0..1 для каждой вершины (0 вне зон, 1 в центре зоны). */
  weights: Float32Array;
}

/** Простая бинарная куча (min-heap) — без внешних зависимостей. */
class MinHeap {
  private data: number[] = []; // [dist, vertex] пары
  get size(): number { return this.data.length >> 1; }
  push(dist: number, vertex: number): void {
    const d = this.data;
    let i = d.length >> 1;
    d.push(dist, vertex);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p << 1] <= d[i << 1]) break;
      [d[p << 1], d[i << 1]] = [d[i << 1], d[p << 1]];
      [d[(p << 1) + 1], d[(i << 1) + 1]] = [d[(i << 1) + 1], d[(p << 1) + 1]];
      i = p;
    }
  }
  pop(): [number, number] | null {
    const d = this.data;
    if (d.length === 0) return null;
    const top: [number, number] = [d[0], d[1]];
    const lastDist = d[d.length - 2];
    const lastV = d[d.length - 1];
    d.length -= 2;
    if (d.length > 0) {
      d[0] = lastDist; d[1] = lastV;
      let i = 0;
      for (;;) {
        const l = (i << 1) + 1;
        const r = l + 1;
        let m = i;
        if (l < (d.length >> 1) && d[l << 1] < d[m << 1]) m = l;
        if (r < (d.length >> 1) && d[r << 1] < d[m << 1]) m = r;
        if (m === i) break;
        [d[m << 1], d[i << 1]] = [d[i << 1], d[m << 1]];
        [d[(m << 1) + 1], d[(i << 1) + 1]] = [d[(i << 1) + 1], d[(m << 1) + 1]];
        i = m;
      }
    }
    return top;
  }
}

const posKey = (positions: Float32Array, i: number): string =>
  `${positions[i * 3]}|${positions[i * 3 + 1]}|${positions[i * 3 + 2]}`;

/** Ближайшая вершина к точке (евклидово) — стартовый seed зоны. */
export function nearestVertexIndex(positions: Float32Array, px: number, py: number, pz: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i * 3 < positions.length; i++) {
    const dx = positions[i * 3] - px;
    const dy = positions[i * 3 + 1] - py;
    const dz = positions[i * 3 + 2] - pz;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Сварка вершин по совпадающим координатам → граф канонических вершин. */
function weldAndBuildAdjacency(
  positions: Float32Array,
  indices: Uint32Array | null,
): { canonicalOf: Int32Array; canonCount: number; neighbors: number[][]; edgeLen: number[][] } {
  const vertexCount = positions.length / 3;

  const keyToCanonical = new Map<string, number>();
  const canonicalOf = new Int32Array(vertexCount).fill(-1);
  const canonPos: number[] = []; // x,y,z per canonical vertex

  const getCanonical = (i: number): number => {
    let c = canonicalOf[i];
    if (c >= 0) return c;
    const key = posKey(positions, i);
    const existing = keyToCanonical.get(key);
    if (existing !== undefined) {
      canonicalOf[i] = existing;
      return existing;
    }
    c = keyToCanonical.size;
    keyToCanonical.set(key, c);
    canonicalOf[i] = c;
    canonPos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    return c;
  };

  const canonCount = (): number => keyToCanonical.size;
  const neighbors: number[][] = [];
  const edgeLen: number[][] = [];

  const addEdge = (ca: number, cb: number) => {
    if (ca === cb) return;
    const ax = canonPos[ca * 3], ay = canonPos[ca * 3 + 1], az = canonPos[ca * 3 + 2];
    const bx = canonPos[cb * 3], by = canonPos[cb * 3 + 1], bz = canonPos[cb * 3 + 2];
    const len = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
    while (neighbors.length <= ca) { neighbors.push([]); edgeLen.push([]); }
    while (neighbors.length <= cb) { neighbors.push([]); edgeLen.push([]); }
    neighbors[ca].push(cb); edgeLen[ca].push(len);
    neighbors[cb].push(ca); edgeLen[cb].push(len);
  };

  const tri = (a: number, b: number, c: number) => {
    const ca = getCanonical(a);
    const cb = getCanonical(b);
    const cc = getCanonical(c);
    addEdge(ca, cb);
    addEdge(cb, cc);
    addEdge(cc, ca);
  };

  if (indices && indices.length >= 3) {
    for (let t = 0; t + 2 < indices.length; t += 3) {
      tri(indices[t], indices[t + 1], indices[t + 2]);
    }
  } else {
    for (let t = 0; t + 2 < vertexCount; t += 3) {
      tri(t, t + 1, t + 2);
    }
  }

  return { canonicalOf, canonCount: canonCount(), neighbors, edgeLen };
}

/**
 * Нанести зоны на меш: рост по поверхности (Дейкстра от seed-вершины с лимитом
 * радиуса), зона вершины = ближайший достижимый seed, вес = smoothstep-затухание.
 *
 * @param positions мировые координаты вершин (x,y,z × N)
 * @param indices индексы треугольников (Uint32Array) или null для неиндексированной
 * @param seeds зоны: якорь + радиус по поверхности
 */
export function buildZoneMapping(
  positions: Float32Array,
  indices: Uint32Array | null,
  seeds: ZoneSeed[],
): ZoneMapping {
  const vertexCount = positions.length / 3;
  const zoneIdx = new Int8Array(vertexCount).fill(-1);
  const weights = new Float32Array(vertexCount).fill(0);
  if (seeds.length === 0 || vertexCount === 0) return { zoneIdx, weights };

  const { canonicalOf, canonCount, neighbors, edgeLen } = weldAndBuildAdjacency(positions, indices);

  const bestDist = new Float32Array(canonCount).fill(Infinity);
  const bestSeed = new Int8Array(canonCount).fill(-1);

  for (let s = 0; s < seeds.length; s++) {
    const seed = seeds[s];
    const startOriginal = nearestVertexIndex(positions, seed.pos[0], seed.pos[1], seed.pos[2]);
    const start = canonicalOf[startOriginal];
    const radius = Math.max(0.001, seed.radius);

    const dist = new Float32Array(canonCount).fill(Infinity);
    const heap = new MinHeap();
    dist[start] = 0;
    heap.push(0, start);

    while (heap.size > 0) {
      const top = heap.pop();
      if (!top) break;
      const [d, u] = top;
      if (d > dist[u] + 1e-9) continue; // устаревшая запись кучи
      const nb = neighbors[u] || [];
      const nl = edgeLen[u] || [];
      for (let k = 0; k < nb.length; k++) {
        const w = nb[k];
        const nd = d + nl[k];
        if (nd > radius) continue; // за пределами зоны — дальше не распространяемся
        if (nd < dist[w]) {
          dist[w] = nd;
          heap.push(nd, w);
        }
      }
    }

    for (let v = 0; v < canonCount; v++) {
      if (dist[v] <= radius && dist[v] < bestDist[v]) {
        bestDist[v] = dist[v];
        bestSeed[v] = s;
      }
    }
  }

  for (let i = 0; i < vertexCount; i++) {
    const c = canonicalOf[i];
    if (c < 0 || bestSeed[c] < 0) continue;
    zoneIdx[i] = bestSeed[c];
    const t = 1 - bestDist[c] / Math.max(0.001, seeds[bestSeed[c]].radius);
    weights[i] = smoothstep(t);
  }

  return { zoneIdx, weights };
}

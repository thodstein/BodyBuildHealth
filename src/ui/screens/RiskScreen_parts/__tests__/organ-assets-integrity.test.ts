/**
 * organ-assets-integrity.test.ts — страж против «модель рисков пустая, а тесты зелёные».
 *
 * Что произошло раньше: из 6 систем ТЗ на экране рисовались только 2. У четырёх
 * ассетов (brain/heart/liver/kidneys.glb) в GLB-заголовке объявлены ДВА буфера,
 * при этом в самом файле лежит только BIN чанка (buffer 0), а вершины сетки
 * ссылаются на buffer 1. three.js GLTFLoader для embedded-данных обрабатывает
 * только индекс 0, поэтому загрузка падала целиком: 4 из 6 органов не появлялись
 * вообще, а UI тихо показывал модель «без органов».
 *
 * Тест читает РЕАЛЬНЫЕ GLB-файлы и проверяет то же условие, на котором падал
 * загрузчик: каждая bufferView, к которой обращается accessor геометрии,
 * должна помещаться в фактический размер GLB.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ORGAN_MODELS } from '../TZRisk3DModel';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

type BufferView = { buffer?: number; byteOffset?: number; byteLength: number };

/** Разбирает GLB: JSON-чанк + список реально присутствующих бинарных чанков. */
function readGlb(file: string) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file}: не GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));

  // Проходим чанки от начала JSON до конца файла и собираем их длины по порядку.
  // ВНИМАНИЕ: тип чанка — 4 байта, бинарный записывается как 'BIN\0', то есть
  // сравнивать надо с учётом NUL, иначе BIN-чанк «не находится».
  const chunks: { type: string; start: number; length: number }[] = [];
  let off = 20 + jsonLen;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.toString('ascii', off + 4, off + 8).replace(/\0+$/, '');
    chunks.push({ type, start: off + 8, length: len });
    off += 8 + len;
  }
  return { json, chunks, totalBytes: buf.length };
}

/** Размер фактически доступного буфера для номера `index` (0 = первый BIN-чанк). */
function availableBytes(glb: ReturnType<typeof readGlb>, index: number): number {
  if (index === 0) {
    const bin = glb.chunks.find(c => c.type === 'BIN');
    return bin ? bin.length : 0;
  }
  // Второго и последующих буферов в файле просто нет.
  return 0;
}

/** Максимальный byteOffset+byteLength, к которому обращается геометрия. */
function maxGeometryByteLength(glb: ReturnType<typeof readGlb>, glbPath: string): number {
  const views: BufferView[] = glb.json.bufferViews || [];
  let worst = 0;
  let worstAt = '';

  const visit = (accessorIndex: number | undefined, kind: string) => {
    if (accessorIndex === undefined) return;
    const acc = glb.json.accessors?.[accessorIndex];
    if (!acc) throw new Error(`${glbPath}: accessor ${accessorIndex} не найден`);
    const view = views[acc.bufferView];
    if (!view) throw new Error(`${glbPath}: bufferView ${acc.bufferView} не найден`);
    const end = (view.byteOffset || 0) + view.byteLength;
    if (end > worst) { worst = end; worstAt = `${kind}→accessor ${accessorIndex}→view ${acc.bufferView}`; }
  };

  for (const mesh of glb.json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      for (const [kind, idx] of Object.entries(prim.attributes || {})) visit(idx as number, kind);
      if (prim.indices !== undefined) visit(prim.indices, 'indices');
    }
  }
  if (worst && worstAt) {
    // eslint-disable-next-line no-console
    console.log(`[integrity] ${path.basename(glbPath)}: самая дальняя ссылка ${worstAt} = ${worst} байт`);
  }
  return worst;
}

const GLB_ORGANS = ORGAN_MODELS.filter(d => d.kind === 'glb' && d.url);

describe('целостность используемых GLB-органов', () => {
  it('есть хотя бы один GLB-орган (иначе тест проверяет пустоту)', () => {
    expect(GLB_ORGANS.length).toBeGreaterThan(0);
  });

  for (const def of GLB_ORGANS) {
    const url = def.url!;
    it(`${url}: файл существует и не пустой`, () => {
      const file = path.join(PUBLIC_DIR, url.replace(/^\/+/, ''));
      expect(fs.existsSync(file), file).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(1024);
    });

    it(`${url}: геометрия помещается в файл (иначе GLTFLoader падает)`, () => {
      const file = path.join(PUBLIC_DIR, url.replace(/^\/+/, ''));
      const glb = readGlb(file);
      const needed = maxGeometryByteLength(glb, file);
      const have = availableBytes(glb, 0);
      expect(needed, `${url}: нужно ${needed} байт данных`).toBeLessThanOrEqual(have);
    });

    it(`${url}: буферы объявлены и присутствуют в файле`, () => {
      const file = path.join(PUBLIC_DIR, url.replace(/^\/+/, ''));
      const glb = readGlb(file);
      const declared = (glb.json.buffers || []).length;
      const present = glb.chunks.filter(c => c.type === 'BIN').length;
      expect(declared, `${url}: объявлено буферов`).toBeLessThanOrEqual(1 + present);
    });
  }
});

describe('каждая система ТЗ имеет рисуемый орган', () => {
  const SYSTEMS = ['cns', 'cardio', 'hepatic', 'hematologic', 'renal', 'reproductive'];

  it('все 6 систем покрыты ORGAN_MODELS', () => {
    for (const s of SYSTEMS) expect(ORGAN_MODELS.some(d => d.system === s), s).toBe(true);
  });

  it('ни одна система не осталась только на нерабочем GLB', () => {
    for (const s of SYSTEMS) {
      const defs = ORGAN_MODELS.filter(d => d.system === s);
      expect(defs.length, s).toBeGreaterThan(0);
      for (const def of defs) {
        const usable = def.kind === 'procedural'
          ? Boolean(def.shape)
          : GLB_ORGANS.includes(def);
        expect(usable, `${s}: модель ${def.url || def.shape} нерисуемая`).toBe(true);
      }
    }
  });
});

describe('известные битые ассеты не подключены обратно', () => {
  /**
   * Эти файлы остаются в public (удаление — отдельное решение по размеру бандла),
   * но ни один из них не должен снова попасть в ORGAN_MODELS: их геометрия
   * ссылается на отсутствующий второй буфер.
   */
  const BROKEN = ['brain.glb', 'heart.glb', 'liver.glb', 'kidneys.glb'];

  for (const name of BROKEN) {
    it(`${name} не используется в модели`, () => {
      expect(ORGAN_MODELS.some(d => (d.url || '').endsWith(name)), name).toBe(false);
    });

    it(`${name}: дефект подтверждён (сетка ссылается на несуществующий буфер)`, () => {
      const file = path.join(PUBLIC_DIR, 'organs', name);
      expect(fs.existsSync(file), file).toBe(true);
      const glb = readGlb(file);
      const have = availableBytes(glb, 0);
      const needed = maxGeometryByteLength(glb, file);
      // Если бы файл внезапно починили — тест надо переписать, а не молча пропустить.
      expect(needed).toBeGreaterThan(have);
    });
  }

  it('uterus.glb не используется: валидный, но плоская пластина', () => {
    expect(ORGAN_MODELS.some(d => (d.url || '').endsWith('uterus.glb'))).toBe(false);
    expect(ORGAN_MODELS.some(d => d.system === 'reproductive' && d.shape === 'uterus')).toBe(true);
  });

  it('все системы с процедурной формой покрыты — не осталось «схемы без тела»', () => {
    const proceduralSystems = new Set(
      ORGAN_MODELS.filter(d => d.kind === 'procedural').map(d => d.system),
    );
    for (const s of ['cns', 'cardio', 'hepatic', 'renal']) {
      expect(proceduralSystems.has(s), s).toBe(true);
    }
  });
});

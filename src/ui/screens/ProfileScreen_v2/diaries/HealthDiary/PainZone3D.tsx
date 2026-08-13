/**
 * PainZone3D.tsx — 3D-карта зон боли (hulk.glb).
 * Один меш (фигура без отдельных частей) → зоны задаются якорными сферами в
 * мировых координатах модели, каждому вертексу назначается зона. Подсветка —
 * через второй меш (additive blending) с vertex colors: выбранная часть тела
 * светится цветом боли БЕЗ кругов/маркеров. Клик по модели циклирует VAS 0–10.
 *
 * Зоны разделены на стороны (13 шт., как было 13 кружков на SVG-карте):
 * shoulders_l/r, elbows_l/r, wrists_l/r, lower_back, hips_l/r, knees_l/r, ankles_l/r.
 * Данные сохраняются в 7 базовых ключей (shoulders, elbows, …) — сторона пишет
 * в свою базовую зону, что совместимо со статистикой/CSV/поддержкой.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PAIN_ZONES, painZoneColor } from '../../diary-modals';

export interface ZoneAnchor {
  id: string; // уникальный: shoulders_l, shoulders_r, …
  pos: [number, number, number];
  r: number;
}

/** Базовый ключ данных для зоны-стороны (shoulders_l → shoulders). */
export function baseZoneKey(zoneId: string): string {
  return zoneId.replace(/_(l|r)$/, '');
}

/** Якоря зон в мировых координатах hulk.glb (y: −1 стопы … +1 голова). 13 шт.
 *  Измерены по фактической геометрии модели: фронт тела = +z (поза «боковая
 *  грудь»: левая рука поднята вперёд, правая за корпусом, левая нога впереди). */
export const ZONE_ANCHORS: ZoneAnchor[] = [
  { id: 'shoulders_l', pos: [-0.45, 0.6, 0.12], r: 0.3 },
  { id: 'shoulders_r', pos: [0.15, 0.35, -0.05], r: 0.28 },
  { id: 'elbows_l', pos: [-0.48, 0.36, 0.26], r: 0.22 },
  { id: 'elbows_r', pos: [0.44, 0.2, -0.49], r: 0.22 },
  { id: 'wrists_l', pos: [-0.37, 0.2, 0.34], r: 0.22 },
  { id: 'wrists_r', pos: [0.49, 0.11, -0.42], r: 0.22 },
  { id: 'lower_back', pos: [0, 0.12, -0.45], r: 0.3 },
  { id: 'hips_l', pos: [-0.17, -0.22, 0.24], r: 0.3 },
  { id: 'hips_r', pos: [0.08, -0.24, -0.26], r: 0.3 },
  { id: 'knees_l', pos: [-0.25, -0.54, 0.34], r: 0.26 },
  { id: 'knees_r', pos: [0.08, -0.46, -0.34], r: 0.26 },
  { id: 'ankles_l', pos: [-0.25, -0.88, 0.46], r: 0.3 },
  { id: 'ankles_r', pos: [0.23, -0.93, -0.44], r: 0.3 },
];

/** Список зон-сторон для чипов: {id, base, label} — 13 шт. */
export const SIDE_ZONES: { id: string; base: string; label: string }[] = ZONE_ANCHORS.map((a) => {
  const base = baseZoneKey(a.id);
  const meta = PAIN_ZONES.find((z) => z.id === base);
  const side = a.id.endsWith('_l') ? 'Л' : a.id.endsWith('_r') ? 'П' : '';
  return { id: a.id, base, label: `${meta?.label || base}${side ? ` ${side}` : ''}` };
});

/**
 * Чистая функция: каждому вертексу (x,y,z × N) — индекс якоря (или −1).
 * Экспортируется для тестов.
 */
export function assignVertexZones(positions: Float32Array, anchors: ZoneAnchor[] = ZONE_ANCHORS): Int8Array {
  const out = new Int8Array(positions.length / 3).fill(-1);
  for (let i = 0; i < out.length; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    let best = -1;
    let bestD = Infinity;
    for (let a = 0; a < anchors.length; a++) {
      const dx = x - anchors[a].pos[0];
      const dy = y - anchors[a].pos[1];
      const dz = z - anchors[a].pos[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best >= 0 && Math.sqrt(bestD) <= anchors[best].r) out[i] = best;
  }
  return out;
}

const WHITE = new THREE.Color('#ffffff');

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
}

/** Сводный анализ зоны (из истории дневника, по базовому ключу). */
export interface ZoneAnalysis {
  last?: number;
  avg30?: number;
  count?: number;
  trend?: 'up' | 'down' | 'stable' | null;
}

export interface PainZone3DProps {
  zones: Record<string, number>;
  onChange?: (zones: Record<string, number>) => void;
  height?: number;
  /** Сводный анализ по базовой зоне (shoulders, elbows, …) из истории дневника. */
  analysisFor?: (baseZone: string) => ZoneAnalysis | null;
}

export const PainZone3D: React.FC<PainZone3DProps> = ({ zones, onChange, height = 440, analysisFor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    animId: number;
    colorAttr: THREE.BufferAttribute;
    zoneIdx: Int8Array;
    anchorToZone: string[];
    zonesRef: Record<string, number>;
    hoverRef: string | null;
    selectedRef: string | null;
    applyColors: () => void;
  } | null>(null);

  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ── Инициализация сцены ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const w = container.clientWidth || 300;
    const h = container.clientHeight || height;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 30);
    camera.position.set(0, 0.5, 3.6);
    camera.lookAt(0, 0.25, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.6;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.target.set(0, 0.25, 0);
    controls.update();

    const ambient = new THREE.AmbientLight('#aabbdd', 1.0);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#ffffff', 1.8);
    key.position.set(2.5, 4, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#99aacc', 0.7);
    fill.position.set(-2.5, 0.5, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#dde6ff', 0.5);
    rim.position.set(0, 0, 3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    let overlayMat: THREE.MeshBasicMaterial | null = null;
    let overlay: THREE.Mesh | null = null;
    let colorAttr: THREE.BufferAttribute | null = null;
    let zoneIdx: Int8Array = new Int8Array(0);
    let anchorToZone: string[] = [];
    let baseMesh: THREE.Mesh | null = null;

    const loader = new GLTFLoader();
    loader.load(
      '/hulk.glb',
      (gltf) => {
        const model = gltf.scene;
        model.updateMatrixWorld(true);

        // Зоны считаются по ИСХОДНОЙ мировой матрице (масштаб ещё не применён):
        // якоря ZONE_ANCHORS измерены на оригинальной модели (стопы y≈−1, голова y≈+1)
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) baseMesh = child;
        });
        if (!baseMesh) return;
        const pos = baseMesh.geometry.attributes.position as THREE.BufferAttribute;
        const worldPos = new Float32Array(pos.count * 3);
        const v = new THREE.Vector3();
        const mat4 = baseMesh.matrixWorld.clone();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mat4);
          worldPos[i * 3] = v.x;
          worldPos[i * 3 + 1] = v.y;
          worldPos[i * 3 + 2] = v.z;
        }
        zoneIdx = assignVertexZones(worldPos);
        anchorToZone = ZONE_ANCHORS.map((a) => a.id);

        // Нормализация для отображения: высота → 3.0, центровка
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = 3.0 / Math.max(0.001, size.y);
        group.scale.setScalar(s);
        group.position.y = -center.y * s + 0.4;
        model.position.set(-center.x, -center.y, -center.z);
        group.add(model);
        model.updateMatrixWorld(true);

        // Тело: оригинальная текстура модели (без перекраски) — подсветка зон идёт overlay-слоем
        model.updateMatrixWorld(true);

        // Overlay-меш: additive vertex colors — светящиеся зоны
        colorAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
        colorAttr.setUsage(THREE.DynamicDrawUsage);
        (baseMesh.geometry as THREE.BufferGeometry).setAttribute('color', colorAttr);
        overlayMat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        overlay = new THREE.Mesh(baseMesh.geometry as THREE.BufferGeometry, overlayMat);
        overlay.renderOrder = 1;
        // ВАЖНО: overlay вешается на baseMesh (а не на group/model), иначе он НЕ наследует
        // внутренние повороты/масштабы цепочки нод hulk.glb и рендерится второй, повёрнутой копией.
        baseMesh.add(overlay);

        sceneRef.current = {
          camera, renderer, controls, animId: 0,
          colorAttr, zoneIdx, anchorToZone,
          zonesRef: zonesRef.current,
          hoverRef: hoverRef.current,
          selectedRef: selectedRef.current,
          applyColors,
        };
        applyColors();
        setLoaded(true);
      },
      undefined,
      () => setFailed(true),
    );

    const applyColors = () => {
      if (!colorAttr || !zoneIdx.length) return;
      const z = zonesRef.current;
      const hover = hoverRef.current;
      const sel = selectedRef.current;
      const arr = colorAttr.array as Float32Array;
      const zoneColor = new THREE.Color();
      const lerp = new THREE.Color();
      for (let i = 0; i < zoneIdx.length; i++) {
        const ai = zoneIdx[i];
        if (ai < 0) {
          // вне зон — чёрный: аддитивная подсветка ничего не добавляет, видна текстура
          arr[i * 3] = 0;
          arr[i * 3 + 1] = 0;
          arr[i * 3 + 2] = 0;
          continue;
        }
        const zoneId = anchorToZone[ai];
        const val = z[baseZoneKey(zoneId)] || 0;
        if (val > 0) {
          const [r, g, b] = hexToRgb(painZoneColor(val));
          zoneColor.setRGB(r, g, b);
          if (sel === zoneId || hover === zoneId) {
            lerp.copy(zoneColor).lerp(WHITE, 0.35);
            arr[i * 3] = lerp.r * 1.6;
            arr[i * 3 + 1] = lerp.g * 1.6;
            arr[i * 3 + 2] = lerp.b * 1.6;
          } else if (sel) {
            // другая зона выбрана — приглушаем
            arr[i * 3] = zoneColor.r * 0.45;
            arr[i * 3 + 1] = zoneColor.g * 0.45;
            arr[i * 3 + 2] = zoneColor.b * 0.45;
          } else {
            arr[i * 3] = zoneColor.r * 1.5;
            arr[i * 3 + 1] = zoneColor.g * 1.5;
            arr[i * 3 + 2] = zoneColor.b * 1.5;
          }
        } else {
          // зона без боли — чёрный (текстура остаётся чистой)
          arr[i * 3] = 0;
          arr[i * 3 + 1] = 0;
          arr[i * 3 + 2] = 0;
        }
      }
      colorAttr.needsUpdate = true;
    };

    // ── Raycast: hover + клик ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rayTargets = () => (baseMesh ? [baseMesh, overlay].filter(Boolean) as THREE.Object3D[] : []);

    const zoneAt = (event: MouseEvent): string | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(rayTargets(), false);
      if (!hits.length || !hits[0].face) return null;
      const face = hits[0].face;
      const verts = [face.a, face.b, face.c];
      const zonesInFace = verts.map((vi) => (vi < zoneIdx.length ? zoneIdx[vi] : -1)).filter((z) => z >= 0);
      if (!zonesInFace.length) return null;
      const counts = new Map<number, number>();
      let best = -1;
      let bestN = 0;
      for (const z of zonesInFace) {
        const n = (counts.get(z) || 0) + 1;
        counts.set(z, n);
        if (n > bestN) {
          bestN = n;
          best = z;
        }
      }
      return anchorToZone[best] || null;
    };

    const handleMove = (event: MouseEvent) => {
      const zone = zoneAt(event);
      hoverRef.current = zone;
      setHoveredZone(zone);
      if (containerRef.current) containerRef.current.style.cursor = zone ? 'pointer' : 'grab';
      applyColors();
    };
    const handleClick = (event: MouseEvent) => {
      const zone = zoneAt(event);
      if (!zone) return;
      setSelectedZone((prev) => {
        const next = prev === zone ? null : zone;
        selectedRef.current = next;
        return next;
      });
      applyColors();
    };
    const handleLeave = () => {
      hoverRef.current = null;
      setHoveredZone(null);
      applyColors();
    };

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('mouseleave', handleLeave);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const cw = container.clientWidth || 300;
      const ch = container.clientHeight || height;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseleave', handleLeave);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // ── Перекраска при смене данных / hover / выборе ──
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    ref.zonesRef = zones;
    ref.hoverRef = hoveredZone;
    ref.selectedRef = selectedZone;
    ref.applyColors();
  }, [zones, hoveredZone, selectedZone, loaded]);

  const selectZone = useCallback((id: string) => {
    setSelectedZone((prev) => {
      const next = prev === id ? null : id;
      selectedRef.current = next;
      return next;
    });
  }, []);

  const setZoneValue = useCallback((base: string, v: number) => {
    if (!onChange) return;
    onChange({ ...zones, [base]: v });
  }, [zones, onChange]);

  const selectAll = useCallback(() => {
    if (!onChange) return;
    const next: Record<string, number> = {};
    for (const z of PAIN_ZONES) next[z.id] = 5;
    onChange(next);
  }, [onChange]);

  const clearAll = useCallback(() => {
    if (!onChange) return;
    const next: Record<string, number> = {};
    for (const z of PAIN_ZONES) next[z.id] = 0;
    onChange(next);
  }, [onChange]);

  const hoverInfo = hoveredZone ? SIDE_ZONES.find((z) => z.id === hoveredZone) : null;

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          borderRadius: 16,
          overflow: 'hidden',
          background:
            'radial-gradient(600px 300px at 50% 0%, rgba(236,72,153,0.10), transparent 65%), rgba(28,32,42,0.55)',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          cursor: 'grab',
        }}
        role="img"
        aria-label="3D карта зон боли"
      >
        {failed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            3D недоступно в этом окружении
          </div>
        )}
        {!loaded && !failed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div className="loading-spinner" style={{ marginRight: 8 }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Загрузка 3D модели…</span>
          </div>
        )}
        {hoverInfo && !failed && (() => {
          const val = zones[hoverInfo.base] || 0;
          return (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(0,0,0,0.85)', color: '#fff',
              padding: '6px 10px', borderRadius: 6, fontSize: 11,
              pointerEvents: 'none', zIndex: 10,
              border: `1px solid ${painZoneColor(val)}55`,
            }}>
              <b>{hoverInfo.label}</b>
              <span style={{ marginLeft: 6, fontWeight: 700, color: painZoneColor(val) }}>
                {val}/10
              </span>
            </div>
          );
        })()}
      </div>

      {/* Управление */}
      {onChange && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          <button
            onClick={selectAll}
            style={{
              minHeight: 36, padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(236,72,153,0.14)', border: '1px solid rgba(236,72,153,0.4)',
              color: '#f472b6', fontSize: 12, fontWeight: 700,
            }}
          >
            🎯 Выбрать все
          </button>
          <button
            onClick={clearAll}
            style={{
              minHeight: 36, padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600,
            }}
          >
            🧹 Сбросить
          </button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>
            Клик по телу — анализ зоны (одно нажатие)
          </span>
        </div>
      )}

      {/* Панель выбранной зоны: отметка боли + сводный анализ */}
      {selectedZone && (() => {
        const meta = SIDE_ZONES.find((z) => z.id === selectedZone);
        if (!meta) return null;
        const base = meta.base;
        const val = zones[base] || 0;
        const analysis = analysisFor ? analysisFor(base) : null;
        const c = painZoneColor(val);
        return (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${c}44` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <b style={{ fontSize: 12, color: c }}>{meta.label}</b>
              <button
                onClick={() => selectZone(selectedZone)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, minWidth: 32, minHeight: 32 }}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginRight: 2 }}>Боль:</span>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <button
                  key={v}
                  onClick={() => setZoneValue(base, v)}
                  disabled={!onChange}
                  style={{
                    minWidth: 26, height: 28, borderRadius: 8, fontSize: 10, fontWeight: 800,
                    cursor: onChange ? 'pointer' : 'default', fontFamily: 'inherit',
                    background: val === v ? `${painZoneColor(v)}33` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${val === v ? painZoneColor(v) : 'rgba(255,255,255,0.1)'}`,
                    color: val === v ? painZoneColor(v) : 'rgba(255,255,255,0.6)',
                  }}
                  aria-pressed={val === v}
                >
                  {v}
                </button>
              ))}
            </div>
            {analysis && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  📊 Сводный анализ
                </div>
                <div>Последняя запись: {analysis.last ?? '—'}/10 · среднее за 30 дней: {analysis.avg30 ?? '—'}/10</div>
                <div style={{ marginTop: 2 }}>
                  Записей с зоной: {analysis.count ?? 0}
                  {analysis.trend
                    ? ` · динамика: ${analysis.trend === 'up' ? '📈 ухудшение' : analysis.trend === 'down' ? '📉 улучшение' : '➡️ стабильно'}`
                    : ''}
                </div>
              </div>
            )}
            {!analysis && (
              <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                Записей с этой зоной пока нет — отметьте уровень боли выше.
              </div>
            )}
          </div>
        );
      })()}

      {/* Чипы зон: 13 (левая/правая стороны) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {SIDE_ZONES.map((z) => {
          const val = zones[z.base] || 0;
          const active = z.id === selectedZone;
          const c = painZoneColor(val);
          return (
            <button
              key={z.id}
              onClick={() => selectZone(z.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 10,
                fontSize: 10, fontWeight: active ? 700 : 500, cursor: 'pointer',
                background: active ? `${c}33` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? c : 'rgba(255,255,255,0.08)'}`,
                color: active ? c : 'rgba(255,255,255,0.65)',
                transition: 'all 0.15s',
              }}
              aria-pressed={active}
              title={`${z.label}: ${val}/10 — клик для анализа`}
            >
              {z.label} <b>{val}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
};

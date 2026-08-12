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

/** Якоря зон в мировых координатах hulk.glb (y: −1 стопы … +1 голова). 13 шт. */
export const ZONE_ANCHORS: ZoneAnchor[] = [
  { id: 'shoulders_l', pos: [-0.48, 0.6, 0.2], r: 0.3 },
  { id: 'shoulders_r', pos: [0.3, 0.6, 0.1], r: 0.3 },
  { id: 'elbows_l', pos: [-0.55, 0.4, 0.3], r: 0.25 },
  { id: 'elbows_r', pos: [0.55, 0.25, -0.2], r: 0.28 },
  { id: 'wrists_l', pos: [-0.5, 0.15, 0.35], r: 0.22 },
  { id: 'wrists_r', pos: [0.55, 0.05, -0.35], r: 0.25 },
  { id: 'lower_back', pos: [0, 0.12, 0], r: 0.42 },
  { id: 'hips_l', pos: [-0.2, -0.18, 0.15], r: 0.3 },
  { id: 'hips_r', pos: [0.2, -0.18, 0.15], r: 0.3 },
  { id: 'knees_l', pos: [-0.28, -0.55, 0.1], r: 0.28 },
  { id: 'knees_r', pos: [0.28, -0.55, 0.1], r: 0.28 },
  { id: 'ankles_l', pos: [-0.28, -0.92, 0.1], r: 0.3 },
  { id: 'ankles_r', pos: [0.28, -0.92, 0.1], r: 0.3 },
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

const BASE_HEX = new THREE.Color('#aebfd8');
const BLACK = new THREE.Color('#000000');
const WHITE = new THREE.Color('#ffffff');

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
}

export interface PainZone3DProps {
  zones: Record<string, number>;
  onChange?: (zones: Record<string, number>) => void;
  height?: number;
}

export const PainZone3D: React.FC<PainZone3DProps> = ({ zones, onChange, height = 440 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
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
    applyColors: () => void;
  } | null>(null);

  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const hoverRef = useRef<string | null>(null);
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
    renderer.toneMappingExposure = 1.1;
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

    const ambient = new THREE.AmbientLight('#aabbdd', 1.6);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2.5, 4, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#99aacc', 1.1);
    fill.position.set(-2.5, 0.5, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#dde6ff', 0.8);
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

        // Материал тела: исходный (текстура Hulk) — светлый, чтобы модель была видна
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.vertexColors = false;
              mat.color = new THREE.Color('#8a97ab');
              mat.roughness = 0.6;
              mat.metalness = 0.05;
            }
          }
        });

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
        group.add(overlay);

        sceneRef.current = {
          camera, renderer, controls, animId: 0,
          colorAttr, zoneIdx, anchorToZone,
          zonesRef: zonesRef.current,
          hoverRef: hoverRef.current,
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
      const arr = colorAttr.array as Float32Array;
      const zoneColor = new THREE.Color();
      const lerp = new THREE.Color();
      for (let i = 0; i < zoneIdx.length; i++) {
        const ai = zoneIdx[i];
        if (ai < 0) {
          // тело — светлая подложка
          arr[i * 3] = BASE_HEX.r * 0.5;
          arr[i * 3 + 1] = BASE_HEX.g * 0.5;
          arr[i * 3 + 2] = BASE_HEX.b * 0.5;
          continue;
        }
        const zoneId = anchorToZone[ai];
        const val = z[baseZoneKey(zoneId)] || 0;
        if (val > 0) {
          const [r, g, b] = hexToRgb(painZoneColor(val));
          zoneColor.setRGB(r, g, b);
          if (hover === zoneId) {
            lerp.copy(zoneColor).lerp(WHITE, 0.35);
            arr[i * 3] = lerp.r * 1.6;
            arr[i * 3 + 1] = lerp.g * 1.6;
            arr[i * 3 + 2] = lerp.b * 1.6;
          } else {
            arr[i * 3] = zoneColor.r * 1.3;
            arr[i * 3 + 1] = zoneColor.g * 1.3;
            arr[i * 3 + 2] = zoneColor.b * 1.3;
          }
        } else {
          arr[i * 3] = BASE_HEX.r * 0.6;
          arr[i * 3 + 1] = BASE_HEX.g * 0.6;
          arr[i * 3 + 2] = BASE_HEX.b * 0.6;
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
      if (!onChangeRef.current) return;
      const zone = zoneAt(event);
      if (!zone) return;
      const base = baseZoneKey(zone);
      const current = zonesRef.current[base] || 0;
      const next = current >= 10 ? 0 : current + 1;
      onChangeRef.current({ ...zonesRef.current, [base]: next });
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

  // ── Перекраска при смене данных / hover ──
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    ref.zonesRef = zones;
    ref.hoverRef = hoveredZone;
    ref.applyColors();
  }, [zones, hoveredZone, loaded]);

  const cycleZone = useCallback((id: string) => {
    if (!onChange) return;
    const base = baseZoneKey(id);
    const current = zones[base] || 0;
    onChange({ ...zones, [base]: current >= 10 ? 0 : current + 1 });
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
            Клик по телу — отметка зоны (0→10)
          </span>
        </div>
      )}

      {/* Чипы зон: 13 (левая/правая стороны) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {SIDE_ZONES.map((z) => {
          const val = zones[z.base] || 0;
          const active = val > 0;
          const c = painZoneColor(val);
          return (
            <button
              key={z.id}
              onClick={() => cycleZone(z.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 10,
                fontSize: 10, fontWeight: active ? 700 : 500, cursor: onChange ? 'pointer' : 'default',
                background: active ? `${c}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? c : 'rgba(255,255,255,0.08)'}`,
                color: active ? c : 'rgba(255,255,255,0.65)',
                transition: 'all 0.15s',
              }}
              aria-pressed={active}
              title={`${z.label}: ${val}/10`}
            >
              {z.label} <b>{val}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
};

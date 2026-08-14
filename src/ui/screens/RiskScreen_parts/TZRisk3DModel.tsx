/**
 * TZRisk3DModel.tsx — 3D-модель рисков (ТЗ) на модели Халка (hulk.glb).
 * Органы на Халке нарисовать нельзя (один меш) → 6 систем подсвечиваются
 * ЗОНАМИ на теле: каждому вертексу назначается система по якорной сфере,
 * подсветка через overlay-меш с additive vertex colors (часть тела светится
 * цветом риска). Клик по телу выбирает систему, hover — предпросмотр.
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TzSpecResult, TzSpecOrganResult } from '../../../engines/risk-engine-tz-spec';

const riskColor = (pct: number): string => {
  if (pct < 25) return '#22c55e';
  if (pct < 50) return '#eab308';
  if (pct < 75) return '#f97316';
  return '#ef4444';
};

const TZ_SYSTEM_ICONS: Record<string, string> = {
  cardio: '❤️', hepatic: '🫁', renal: '🫘', cns: '🧠', reproductive: '🧬', hematologic: '🩸',
};

// ── Якоря систем в мировых координатах hulk.glb (y: −1 стопы … +1 голова) ──
// Измерены по фактической геометрии модели: фронт тела = +z.
export interface SystemAnchor {
  id: string; // id системы ТЗ (cardio, hepatic, …)
  label: string;
  pos: [number, number, number];
  r: number;
}

export const SYSTEM_ANCHORS: SystemAnchor[] = [
  { id: 'cns', label: 'Головной мозг', pos: [0, 0.92, 0], r: 0.28 },
  { id: 'cardio', label: 'Сердце / грудь', pos: [-0.1, 0.3, 0.47], r: 0.35 },
  { id: 'hepatic', label: 'Печень', pos: [0.22, 0.18, 0.4], r: 0.35 },
  { id: 'hematologic', label: 'Селезёнка / кровь', pos: [-0.25, 0.16, 0.15], r: 0.35 },
  { id: 'renal', label: 'Почки / поясница', pos: [0, 0.05, -0.45], r: 0.35 },
  { id: 'reproductive', label: 'Репродуктивная', pos: [0, -0.42, 0.25], r: 0.35 },
];

/**
 * Чистая функция: каждому вертексу (x,y,z × N) — индекс якоря (или −1).
 * Экспортируется для тестов.
 */
export function assignVertexSystems(positions: Float32Array, anchors: SystemAnchor[] = SYSTEM_ANCHORS): Int8Array {
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

interface Props {
  tzResult: TzSpecResult;
}

export const TZRisk3DModel: React.FC<Props> = ({ tzResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [hoveredSystem, setHoveredSystem] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    animId: number;
    colorAttr: THREE.BufferAttribute;
    zoneIdx: Int8Array;
    anchorToSystem: string[];
    selectedRef: { current: string };
    hoverRef: { current: string | null };
    applyColors: () => void;
  } | null>(null);

  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef('');

  // Build organ lookup
  const organMap = useMemo(() => {
    const m: Record<string, TzSpecOrganResult> = {};
    for (const o of tzResult.organs) m[o.id] = o;
    return m;
  }, [tzResult]);

  const getSystemRiskPct = useCallback((systemId: string): number => {
    const o = organMap[systemId];
    return o ? o.afterPercent : 0;
  }, [organMap]);

  const systemList = useMemo(() => {
    return tzResult.organs.map(o => ({
      system: o.id,
      label: `${TZ_SYSTEM_ICONS[o.id] || ''} ${o.name}`,
      color: riskColor(o.afterPercent),
      riskPct: Math.round(o.afterPercent),
      description: `${o.name}: ${Math.round(o.afterPercent)}% · K_protect: ${o.k_protect}% · ${o.mechanisms.length} механизмов`,
    })).sort((a, b) => b.riskPct - a.riskPct);
  }, [tzResult]);

  // ── Init scene ──
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
    const h = container.clientHeight || 450;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
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

    const ambient = new THREE.AmbientLight('#aabbdd', 0.5);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#ffffff', 1.2);
    key.position.set(2.5, 4, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#99aacc', 0.4);
    fill.position.set(-2.5, 0.5, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#dde6ff', 0.3);
    rim.position.set(0, 0, 3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    let colorAttr: THREE.BufferAttribute | null = null;
    let zoneIdx: Int8Array = new Int8Array(0);
    let anchorToSystem: string[] = [];
    let baseMesh: THREE.Mesh | null = null;
    let overlay: THREE.Mesh | null = null;

    const loader = new GLTFLoader();
    loader.load(
      '/hulk.glb',
      (gltf) => {
        const model = gltf.scene;
        model.updateMatrixWorld(true);

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) baseMesh = child;
        });
        if (!baseMesh) return;

        // Системы считаются по ИСХОДНОЙ мировой матрице (якоря измерены на оригинале)
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
        zoneIdx = assignVertexSystems(worldPos);
        anchorToSystem = SYSTEM_ANCHORS.map((a) => a.id);

        // Нормализация: высота → 3.0, центровка
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = 3.0 / Math.max(0.001, size.y);
        group.scale.setScalar(s);
        group.position.y = -center.y * s + 0.4;
        model.position.set(-center.x, -center.y, -center.z);
        group.add(model);
        model.updateMatrixWorld(true);

        // Тело: оригинальная текстура модели (без перекраски) — подсветка систем идёт overlay-слоем
        model.updateMatrixWorld(true);

        // Overlay: additive vertex colors — светящиеся системы
        colorAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
        colorAttr.setUsage(THREE.DynamicDrawUsage);
        (baseMesh.geometry as THREE.BufferGeometry).setAttribute('color', colorAttr);
        const overlayMat = new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        overlay = new THREE.Mesh(baseMesh.geometry as THREE.BufferGeometry, overlayMat);
        overlay.renderOrder = 1;
        // ВАЖНО: overlay вешается на baseMesh (а не на group/model), иначе он НЕ наследует
        // внутренние повороты/масштабы цепочки нод hulk.glb и рендерится второй, повёрнутой копией.
        baseMesh.add(overlay);

        const applyColors = () => {
          if (!colorAttr || !zoneIdx.length) return;
          const sel = selectedRef.current;
          const hover = hoverRef.current;
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
            const sysId = anchorToSystem[ai];
            const pct = getSystemRiskPct(sysId);
            const [r, g, b] = hexToRgb(riskColor(pct));
            zoneColor.setRGB(r, g, b);
            if (sel === sysId) {
              lerp.copy(zoneColor).lerp(WHITE, 0.3);
              arr[i * 3] = lerp.r * 1.25;
              arr[i * 3 + 1] = lerp.g * 1.25;
              arr[i * 3 + 2] = lerp.b * 1.25;
            } else if (hover === sysId) {
              lerp.copy(zoneColor).lerp(WHITE, 0.35);
              arr[i * 3] = lerp.r * 1.1;
              arr[i * 3 + 1] = lerp.g * 1.1;
              arr[i * 3 + 2] = lerp.b * 1.1;
            } else if (sel) {
              // другая система выбрана — приглушаем
              arr[i * 3] = zoneColor.r * 0.35;
              arr[i * 3 + 1] = zoneColor.g * 0.35;
              arr[i * 3 + 2] = zoneColor.b * 0.35;
            } else {
              arr[i * 3] = zoneColor.r * 1.0;
              arr[i * 3 + 1] = zoneColor.g * 1.0;
              arr[i * 3 + 2] = zoneColor.b * 1.0;
            }
          }
          colorAttr.needsUpdate = true;
        };

        sceneRef.current = {
          camera, renderer, controls, animId: 0,
          colorAttr, zoneIdx, anchorToSystem,
          selectedRef, hoverRef,
          applyColors,
        };
        applyColors();
        setLoaded(true);
      },
      undefined,
      () => setFailed(true),
    );

    // ── Raycast: hover + клик ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rayTargets = () => (baseMesh ? [baseMesh, overlay].filter(Boolean) as THREE.Object3D[] : []);

    const systemAt = (event: MouseEvent): string | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(rayTargets(), false);
      if (!hits.length || !hits[0].face) return null;
      const face = hits[0].face;
      const verts = [face.a, face.b, face.c];
      const sysInFace = verts.map((vi) => (vi < zoneIdx.length ? zoneIdx[vi] : -1)).filter((z) => z >= 0);
      if (!sysInFace.length) return null;
      const counts = new Map<number, number>();
      let best = -1;
      let bestN = 0;
      for (const z of sysInFace) {
        const n = (counts.get(z) || 0) + 1;
        counts.set(z, n);
        if (n > bestN) {
          bestN = n;
          best = z;
        }
      }
      return anchorToSystem[best] || null;
    };

    const handleMove = (event: MouseEvent) => {
      const sys = systemAt(event);
      hoverRef.current = sys;
      setHoveredSystem(sys);
      if (containerRef.current) containerRef.current.style.cursor = sys ? 'pointer' : 'grab';
      sceneRef.current?.applyColors();
    };
    const handleClick = (event: MouseEvent) => {
      const sys = systemAt(event);
      if (!sys) return;
      setSelectedSystem(prev => {
        const next = prev === sys ? null : sys;
        selectedRef.current = next || '';
        return next;
      });
      sceneRef.current?.applyColors();
    };
    const handleLeave = () => {
      hoverRef.current = null;
      setHoveredSystem(null);
      sceneRef.current?.applyColors();
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
      const ch = container.clientHeight || 450;
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
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSystemRiskPct]);

  // ── Перекраска при смене данных / hover / выборе ──
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    ref.selectedRef.current = selectedSystem || '';
    ref.hoverRef.current = hoveredSystem;
    ref.applyColors();
  }, [tzResult, selectedSystem, hoveredSystem, loaded, getSystemRiskPct]);

  // ── Selected system sync from chip buttons ──
  const handleChipClick = useCallback((sys: string) => {
    setSelectedSystem(prev => {
      const next = prev === sys ? null : sys;
      selectedRef.current = next || '';
      return next;
    });
    sceneRef.current?.applyColors();
  }, []);

  const hoverInfo = hoveredSystem ? SYSTEM_ANCHORS.find((a) => a.id === hoveredSystem) : null;

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: '100%', height: 'min(60vh, 450px)',
          borderRadius: 16, overflow: 'hidden',
          background:
            'radial-gradient(600px 300px at 50% 0%, rgba(139,92,246,0.10), transparent 65%), rgba(28,32,42,0.55)',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          cursor: 'grab',
        }}
        role="img"
        aria-label="3D модель рисков"
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
        {hoverInfo && !selectedSystem && !failed && (() => {
          const o = organMap[hoverInfo.id];
          const pct = o ? o.afterPercent : 0;
          return (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(0,0,0,0.85)', color: '#fff',
              padding: '6px 10px', borderRadius: 6, fontSize: 11,
              pointerEvents: 'none', zIndex: 10,
              border: `1px solid ${riskColor(pct)}55`,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {TZ_SYSTEM_ICONS[hoverInfo.id]} {o ? o.name : hoverInfo.label}
              </div>
              <span style={{ color: riskColor(pct), fontWeight: 700 }}>
                {Math.round(pct)}%
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>
                риск · {o ? o.mechanisms.length : 0} мех.
              </span>
            </div>
          );
        })()}
      </div>

      {/* Chip buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {systemList.map(o => {
          const isSel = selectedSystem === o.system;
          return (
            <button key={o.system} onClick={() => handleChipClick(o.system)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 10,
              fontSize: 10, fontWeight: isSel ? 700 : 500, cursor: 'pointer',
              background: isSel ? o.color + '22' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isSel ? o.color : 'rgba(255,255,255,0.06)'}`,
              color: isSel ? o.color : 'rgba(255,255,255,0.7)',
              transition: 'all 0.15s',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
              {o.label} <span style={{ fontWeight: 700 }}>{o.riskPct}%</span>
            </button>
          );
        })}
      </div>

      {/* Selected system detail panel */}
      {selectedSystem && (() => {
        const info = systemList.find(o => o.system === selectedSystem);
        if (!info) return null;
        return (
          <div style={{
            marginTop: 8, padding: 10, borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${info.color}44`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.label}</span>
              <button onClick={() => handleChipClick(selectedSystem)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14,
              }}>✕</button>
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, height: 6, background: 'rgba(255,255,255,0.06)',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${info.riskPct}%`, height: '100%',
                  background: info.color, borderRadius: 3,
                  transition: 'width 0.4s',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.riskPct}%</span>
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{info.description}</div>
          </div>
        );
      })()}

      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>
        🖱 Клик по зоне на теле · Вращайте · Колёсико для зума · Клик по чипу для деталей
      </div>
    </div>
  );
};

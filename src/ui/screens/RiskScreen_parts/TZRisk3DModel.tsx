import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

// ── Organ definitions: position, geometry, scale per TZ system ──
interface OrganDef {
  system: string;
  id: string;
  label: string;
  geo: 'sphere' | 'cylinder' | 'box' | 'torus' | 'heart' | 'brain';
  pos: [number, number, number];
  scale: [number, number, number];
  rot?: [number, number, number];
}

const ORGAN_DEFS: OrganDef[] = [
  // Cardio
  { system: 'cardio', id: 'heart', label: 'Сердце', geo: 'heart', pos: [0, 1.5, 0.35], scale: [0.35, 0.35, 0.22] },
  { system: 'cardio', id: 'aorta', label: 'Аорта', geo: 'cylinder', pos: [0.05, 1.0, 0.5], scale: [0.04, 2.8, 0.04] },
  // Hepatic
  { system: 'hepatic', id: 'liver', label: 'Печень', geo: 'sphere', pos: [-0.1, 0.85, 0.18], scale: [0.55, 0.25, 0.35] },
  // Renal
  { system: 'renal', id: 'left_kidney', label: 'Левая почка', geo: 'sphere', pos: [-0.45, 0.15, 0.15], scale: [0.25, 0.18, 0.2] },
  { system: 'renal', id: 'right_kidney', label: 'Правая почка', geo: 'sphere', pos: [0.45, 0.15, 0.15], scale: [0.25, 0.18, 0.2] },
  // CNS
  { system: 'cns', id: 'brain', label: 'Мозг', geo: 'brain', pos: [0, 3.05, 0], scale: [0.42, 0.42, 0.42] },
  // Reproductive
  { system: 'reproductive', id: 'left_testis', label: 'Левое яичко', geo: 'sphere', pos: [-0.15, -0.32, 0.15], scale: [0.17, 0.17, 0.17] },
  { system: 'reproductive', id: 'right_testis', label: 'Правое яичко', geo: 'sphere', pos: [0.15, -0.32, 0.15], scale: [0.17, 0.17, 0.17] },
  // Hematologic
  { system: 'hematologic', id: 'spleen', label: 'Селезёнка', geo: 'sphere', pos: [-0.55, 0.85, 0.15], scale: [0.15, 0.2, 0.1] },
];

function createHeartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  s.bezierCurveTo(0, 0.8, 0.45, 0.8, 0.45, 0.45);
  s.bezierCurveTo(0.45, 0.25, 0.25, 0.05, 0, -0.3);
  s.bezierCurveTo(-0.25, 0.05, -0.45, 0.25, -0.45, 0.45);
  s.bezierCurveTo(-0.45, 0.8, 0, 0.8, 0, 0.5);
  return s;
}

interface Props {
  tzResult: TzSpecResult;
}

export const TZRisk3DModel: React.FC<Props> = ({ tzResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [hoveredOrgan, setHoveredOrgan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    organMeshes: THREE.Mesh[];
    bodyMesh: THREE.Mesh[];
    systemMeshMap: Map<string, THREE.Mesh[]>;
    controls: OrbitControls;
    animId: number;
  } | null>(null);

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
    const w = container.clientWidth;
    const h = container.clientHeight || 500;
    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 20);
    camera.position.set(0, 0.5, 8);
    camera.lookAt(0, 0.5, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.target.set(0, 0.5, 0);
    controls.update();
    const ambient = new THREE.AmbientLight('#334466', 1.8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#ffffff', 2.5);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#8899cc', 0.8);
    fill.position.set(-2, 1, -1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#4466aa', 1.0);
    rim.position.set(0, -0.5, 3);
    scene.add(rim);

    // ── Procedural body ──
    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0x1a1a2e, shininess: 60, transparent: true, opacity: 0.45,
      specular: 0x333366,
    });
    const bodyGroup = new THREE.Group();
    const bodyMeshes: THREE.Mesh[] = [];

    const addBodyPart = (geo: THREE.BufferGeometry, pos: [number, number, number], scale?: [number, number, number], rot?: number) => {
      const m = new THREE.Mesh(geo, bodyMat.clone());
      m.position.set(pos[0], pos[1], pos[2]);
      if (scale) m.scale.set(scale[0], scale[1], scale[2]);
      if (rot) m.rotation.z = rot;
      bodyGroup.add(m);
      bodyMeshes.push(m);
    };

    addBodyPart(new THREE.SphereGeometry(0.42, 20, 20), [0, 2.85, 0]); // head
    addBodyPart(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 10), [0, 2.45, 0]); // neck
    addBodyPart(new THREE.CylinderGeometry(0.55, 0.38, 2.0, 14), [0, 1.15, 0]); // torso
    addBodyPart(new THREE.SphereGeometry(0.45, 12, 8), [0, -0.1, 0], [1, 0.35, 0.75]); // pelvis
    addBodyPart(new THREE.CylinderGeometry(0.11, 0.09, 1.7, 8), [-0.72, 1.25, 0], undefined, 0.12); // left arm
    addBodyPart(new THREE.CylinderGeometry(0.11, 0.09, 1.7, 8), [0.72, 1.25, 0], undefined, -0.12); // right arm
    addBodyPart(new THREE.CylinderGeometry(0.09, 0.07, 1.5, 8), [-0.78, 0.1, 0]); // left forearm
    addBodyPart(new THREE.CylinderGeometry(0.09, 0.07, 1.5, 8), [0.78, 0.1, 0]); // right forearm
    addBodyPart(new THREE.CylinderGeometry(0.15, 0.11, 2.3, 10), [-0.25, -1.55, 0]); // left leg
    addBodyPart(new THREE.CylinderGeometry(0.15, 0.11, 2.3, 10), [0.25, -1.55, 0]); // right leg
    addBodyPart(new THREE.CylinderGeometry(0.11, 0.08, 2.1, 10), [-0.25, -3.0, 0]); // left calf
    addBodyPart(new THREE.CylinderGeometry(0.11, 0.08, 2.1, 10), [0.25, -3.0, 0]); // right calf

    scene.add(bodyGroup);

    // ── Organ meshes ──
    const organMat = (color: number) => new THREE.MeshPhongMaterial({
      color, shininess: 90, transparent: true, opacity: 0.92, specular: 0x444444,
    });

    const organMeshes: THREE.Mesh[] = [];
    const systemMeshMap = new Map<string, THREE.Mesh[]>();

    for (const def of ORGAN_DEFS) {
      let geo: THREE.BufferGeometry;
      switch (def.geo) {
        case 'sphere':
          geo = new THREE.SphereGeometry(1, 16, 12);
          break;
        case 'cylinder':
          geo = new THREE.CylinderGeometry(1, 1, 1, 8);
          break;
        case 'box':
          geo = new THREE.BoxGeometry(1, 1, 1);
          break;
        case 'torus':
          geo = new THREE.TorusGeometry(0.5, 0.12, 8, 20);
          break;
        case 'heart':
          geo = new THREE.ExtrudeGeometry(createHeartShape(), { depth: 0.35, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.02 });
          geo.translate(0, 0, -0.175);
          break;
        case 'brain':
          geo = new THREE.IcosahedronGeometry(1, 2);
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.08);
            pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.08);
          }
          pos.needsUpdate = true;
          break;
        default:
          geo = new THREE.SphereGeometry(1, 12, 10);
      }

      const baseColor = 0x666688;
      const mesh = new THREE.Mesh(geo, organMat(baseColor));
      mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      mesh.scale.set(def.scale[0], def.scale[1], def.scale[2]);
      if (def.rot) mesh.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
      mesh.castShadow = true;
      mesh.userData = { system: def.system, id: def.id, label: def.label };
      scene.add(mesh);
      organMeshes.push(mesh);

      const existing = systemMeshMap.get(def.system);
      if (existing) existing.push(mesh);
      else systemMeshMap.set(def.system, [mesh]);
    }

    // ── Raycaster ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickables = [...organMeshes];

    const handleClick3D = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickables);
      if (hits.length > 0) {
        const sys = hits[0].object.userData.system as string;
        setSelectedOrgan(prev => prev === sys ? null : sys);
      }
    };

    const handleHover3D = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickables);
      const newHover = hits.length > 0 ? (hits[0].object.userData.system as string) : null;
      setHoveredOrgan(newHover);
      containerRef.current.style.cursor = newHover ? 'pointer' : 'default';
    };

    container.addEventListener('click', handleClick3D);
    container.addEventListener('mousemove', handleHover3D);

    setLoading(false);

    let animId: number = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight || 500;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = { scene, organMeshes, bodyMesh: bodyMeshes, systemMeshMap, controls, animId };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('click', handleClick3D);
      container.removeEventListener('mousemove', handleHover3D);
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
  }, []);

  // ── Update organ colors on data change ──
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { systemMeshMap, organMeshes } = ref;

    const sel = selectedOrgan;

    for (const mesh of organMeshes) {
      const sys = mesh.userData.system as string;
      const pct = getSystemRiskPct(sys);
      const colorHex = riskColor(pct);
      const isSelected = sel === sys;
      const isHovered = hoveredOrgan === sys && !isSelected;
      const mat = mesh.material as THREE.MeshPhongMaterial;

      const color = new THREE.Color(colorHex);
      mat.color.copy(color);
      mat.emissive.copy(isSelected ? new THREE.Color('#00e68a') : isHovered ? new THREE.Color('#44aaff') : new THREE.Color(0x000000));
      mat.emissiveIntensity = isSelected ? 0.6 : isHovered ? 0.3 : 0;
      mat.opacity = isSelected ? 1.0 : 0.92;
      mat.needsUpdate = true;
    }

    // Dim body when nothing selected
    for (const bm of ref.bodyMesh) {
      const mat = bm.material as THREE.MeshPhongMaterial;
      mat.opacity = sel ? 0.2 : 0.45;
      mat.needsUpdate = true;
    }
  }, [tzResult, selectedOrgan, hoveredOrgan, getSystemRiskPct]);

  // ── Selected organ sync from chip buttons ──
  const handleChipClick = useCallback((sys: string) => {
    setSelectedOrgan(prev => prev === sys ? null : sys);
  }, []);

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: '100%', height: 'min(60vh, 450px)',
          borderRadius: 16, overflow: 'hidden',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
        }}
      >
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Загрузка 3D модели...</span>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredOrgan && !selectedOrgan && (() => {
          const o = organMap[hoveredOrgan];
          if (!o) return null;
          return (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(0,0,0,0.85)', color: '#fff',
              padding: '6px 10px', borderRadius: 6, fontSize: 11,
              pointerEvents: 'none', zIndex: 10,
              border: `1px solid ${riskColor(o.afterPercent)}44`,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {TZ_SYSTEM_ICONS[hoveredOrgan]} {o.name}
              </div>
              <span style={{ color: riskColor(o.afterPercent), fontWeight: 700 }}>
                {Math.round(o.afterPercent)}%
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>
                риск · {o.mechanisms.length} мех.
              </span>
            </div>
          );
        })()}
      </div>

      {/* Chip buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {systemList.map(o => {
          const isSel = selectedOrgan === o.system;
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

      {/* Selected organ detail panel */}
      {selectedOrgan && (() => {
        const info = systemList.find(o => o.system === selectedOrgan);
        if (!info) return null;
        return (
          <div style={{
            marginTop: 8, padding: 10, borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${info.color}44`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.label}</span>
              <button onClick={() => setSelectedOrgan(null)} style={{
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
        🖱 Клик по органу на модели · Вращайте · Колёсико для зума · Клик по чипу для деталей
      </div>
    </div>
  );
};

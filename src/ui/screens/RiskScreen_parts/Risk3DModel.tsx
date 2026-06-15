import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { V7RiskResult } from '../../../engines/risk-engine-v7';
import { getRiskColor } from '../../../core/utils/risk-colors';

// Mesh name → organ key mapping. Update mesh names to match the GLB model.
const MESH_TO_ORGAN: Record<string, string> = {
  heart: 'heart', vessels: 'vessels', liver: 'hepatic', kidney: 'renal',
  blood: 'hematologic', endocrine: 'endocrine', metabolic: 'metabolic',
  ghigf: 'ghigf', ins_axis: 'ins_axis',
  musculoskeletal: 'musculoskeletal', neuro_toxicity: 'neuro_toxicity',
  reproductive: 'reproductive',
  // Aliases for common naming conventions
  brain: 'neuro_toxicity', kidneys: 'renal', lungs: 'cardio', artery: 'vessels',
  vein: 'vessels', pancreas: 'endocrine', spleen: 'hematologic', stomach: 'metabolic',
  intestine: 'metabolic', colon: 'metabolic', thyroid: 'endocrine', adrenal: 'endocrine',
  pituitary: 'ghigf', testes: 'reproductive', ovaries: 'reproductive', prostate: 'reproductive',
  bladder: 'renal', urethra: 'renal', bone: 'musculoskeletal', muscle: 'musculoskeletal',
  skin: 'hepatic', aorta: 'cardio', artery_: 'vessels', vein_: 'vessels',
};

interface OrganInfo {
  label: string;
  system: string;
  color: string;
  riskPct: number;
  description: string;
}

const ORGAN_INFO: Record<string, { label: string; system: string }> = {
  heart: { label: '❤️ Сердце', system: 'cardio' },
  vessels: { label: '🩸 Сосуды', system: 'vessels' },
  liver: { label: '🫁 Печень', system: 'hepatic' },
  kidney: { label: '🫘 Почки', system: 'renal' },
  blood: { label: '🩸 Кровь', system: 'hematologic' },
  endocrine: { label: '⚖️ Эндокринная', system: 'endocrine' },
  metabolic: { label: '⚡ Метаболизм', system: 'metabolic' },
  ghigf: { label: '📈 GH/IGF', system: 'ghigf' },
  ins_axis: { label: '🍬 Инсулин', system: 'ins_axis' },
  musculoskeletal: { label: '💪 Опорно-двиг.', system: 'musculoskeletal' },
  neuro_toxicity: { label: '🧠 Нейротокс.', system: 'neuro_toxicity' },
  reproductive: { label: '🧬 Репрод.', system: 'reproductive' },
  cardio: { label: '❤️ Сердце', system: 'cardio' },
  hepatic: { label: '🫁 Печень', system: 'hepatic' },
  renal: { label: '🫘 Почки', system: 'renal' },
  hematologic: { label: '🩸 Кровь', system: 'hematologic' },
};

function getOrganRisk(organKey: string, result: V7RiskResult, organWeek: number, riskMode: string): number {
  const { organSummary, weeklyOrganData } = result;
  if (organWeek > 0 && weeklyOrganData[organKey] && weeklyOrganData[organKey].length >= organWeek) {
    const v = weeklyOrganData[organKey][organWeek - 1] ?? 0;
    return riskMode === 'raw' ? v * 1.3 : v;
  }
  const s = organSummary[organKey];
  if (!s) return 0;
  return riskMode === 'raw' ? (s.meanS ?? 0) * 1.3 : s.meanS ?? 0;
}

interface Props {
  result: V7RiskResult;
  mcEnabled: boolean;
  onToggleMC: () => void;
  organWeek: number;
  onWeekChange: (w: number) => void;
}

export const Risk3DModel: React.FC<Props> = ({ result, mcEnabled, onToggleMC, organWeek, onWeekChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [riskMode, setRiskMode] = useState<'net' | 'raw'>('net');
  const [loading, setLoading] = useState(true);
  const [organList, setOrganList] = useState<OrganInfo[]>([]);
  const sceneRef = useRef<{ scene: THREE.Scene; meshes: Map<string, THREE.Mesh | THREE.Mesh[]>; controls: OrbitControls; animate: () => void } | null>(null);

  // Compute organ info list
  useEffect(() => {
    const { organSummary } = result;
    const infos: OrganInfo[] = [];
    const seen = new Set<string>();
    for (const [key, data] of Object.entries(organSummary)) {
      const organKey = key;
      const info = ORGAN_INFO[organKey] || ORGAN_INFO[MESH_TO_ORGAN[organKey]];
      const label = info?.label || key;
      const system = info?.system || key;
      if (seen.has(system)) continue;
      seen.add(system);
      const riskPct = Math.round(getOrganRisk(organKey, result, organWeek, riskMode) * 100);
      infos.push({
        label,
        system,
        color: getRiskColor(riskPct),
        riskPct,
        description: `Риск: ${riskPct}%`,
      });
    }
    infos.sort((a, b) => b.riskPct - a.riskPct);
    setOrganList(infos);
  }, [result, organWeek, riskMode]);

  // Initialize Three.js
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = null;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 20);
    camera.position.set(0, 0.2, 3.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.5;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.target.set(0, 0.1, 0);
    controls.update();

    // Lighting
    const ambient = new THREE.AmbientLight('#334466', 1.8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#ffffff', 2.5);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#8899cc', 0.8);
    fill.position.set(-2, 1, -1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#4466aa', 1.0);
    rim.position.set(0, -0.5, 3);
    scene.add(rim);

    // Meshes map
    const meshes = new Map<string, THREE.Mesh>();

    // Load GLB
    const loader = new GLTFLoader();
    loader.load('/hulk.glb', (gltf) => {
      setLoading(false);
      const model = gltf.scene;
      model.position.set(0, -0.15, 0);
      
      // Add to scene and collect meshes
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const meshName = child.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (meshName && meshName.length > 1) {
            // Direct match
            let organ = MESH_TO_ORGAN[meshName];
            // Try partial match
            if (!organ) {
              for (const [key, val] of Object.entries(MESH_TO_ORGAN)) {
                if (meshName.includes(key) || key.includes(meshName)) { organ = val; break; }
              }
            }
            if (organ) {
              meshes.set(organ, child);
              // Log for debugging
              console.log('[3D] Matched mesh:', child.name, '→ organ:', organ);
            } else {
              // Unmatched — store under 'body' for default coloring
              if (!meshes.has('__body__')) meshes.set('__body__', [] as unknown as THREE.Mesh);
              const body = meshes.get('__body__') as unknown as THREE.Mesh[];
              body.push(child);
            }
          } else {
            // Unnamed mesh
            if (!meshes.has('__body__')) meshes.set('__body__', [] as unknown as THREE.Mesh);
            const body2 = meshes.get('__body__') as unknown as THREE.Mesh[];
            body2.push(child);
          }
        }
      });
      
      scene.add(model);
      // Initial coloring
      updateOrganColors(meshes, result, organWeek, riskMode);
    }, undefined, () => setLoading(false));

    // Animation
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight || 500;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = { scene, meshes, controls, animate };

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Update colors when risk data changes
  const updateOrganColors = useCallback((
    meshes: Map<string, THREE.Mesh | THREE.Mesh[]>,
    res: V7RiskResult,
    week: number,
    mode: string
  ) => {
    // Calculate average risk for body
    let totalRisk = 0;
    let count = 0;
    meshes.forEach((mesh, key) => {
      if (key !== '__body__' && !Array.isArray(mesh)) {
        const pct = Math.round(getOrganRisk(key, res, week, mode) * 100);
        totalRisk += pct;
        count++;
      }
    });
    const avgRisk = count > 0 ? totalRisk / count : 15;
    
    const colorMesh = (mesh: THREE.Mesh, colorHex: string, pct: number) => {
      const color = new THREE.Color(colorHex);
      // Keep existing material colors, just tint with risk color
      const factor = Math.min(1, Math.max(0.05, pct / 100)) * 0.5;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial) {
            // Preserve original color, add subtle risk tint
            const orig = new THREE.Color('#8899aa');
            m.color.copy(orig).lerp(color, factor);
            m.emissive.copy(color).multiplyScalar(0.15);
            m.roughness = 0.5;
            m.metalness = 0.05;
          }
        });
      } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
        const orig = new THREE.Color('#8899aa');
        mesh.material.color.copy(orig).lerp(color, factor);
        mesh.material.emissive.copy(color).multiplyScalar(0.15);
        mesh.material.roughness = 0.5;
        mesh.material.metalness = 0.05;
      }
    };

    // Color body meshes with average risk tint
    const bodyRaw = meshes.get('__body__') as unknown as THREE.Mesh[] | undefined;
    if (bodyRaw && Array.isArray(bodyRaw)) {
      const avgColor = getRiskColor(Math.round(avgRisk));
      bodyRaw.forEach((m: THREE.Mesh) => colorMesh(m, avgColor, avgRisk));
    }

    // Color organ meshes
    meshes.forEach((mesh, key) => {
      if (key === '__body__' || Array.isArray(mesh)) return;
      const pct = Math.round(getOrganRisk(key, res, week, mode) * 100);
      colorMesh(mesh as THREE.Mesh, getRiskColor(pct), pct);
    });
  }, []);

  // Update colors when props change
  useEffect(() => {
    if (sceneRef.current) {
      updateOrganColors(sceneRef.current.meshes, result, organWeek, riskMode);
    }
  }, [result, organWeek, riskMode, updateOrganColors]);

  // Highlight selected organ
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    ref.meshes.forEach((mesh) => {
      if (!Array.isArray(mesh)) (mesh as THREE.Mesh).userData.selected = false;
    });
    if (selectedOrgan && ref.meshes.has(selectedOrgan)) {
      const mesh = ref.meshes.get(selectedOrgan)!;
      if (!Array.isArray(mesh)) (mesh as THREE.Mesh).userData.selected = true;
    }
  }, [selectedOrgan]);

  const sysColors: Record<string, string> = {
    hepatic: '#22c55e', renal: '#3b82f6', endocrine: '#a855f7',
    hematologic: '#ef4444', cardio: '#f97316', metabolic: '#eab308',
    reproductive: '#ec4899', neuro_toxicity: '#14b8a6', other: '#6b7280',
    ghigf: '#06b6d4', ins_axis: '#d946ef', musculoskeletal: '#84cc16',
    vessels: '#f43f5e', blood: '#dc2626',
  };

  const weeks = useMemo(() => {
    const max = result.weeklyGlobalData?.length || 8;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [result]);

  return (
    <div>
      {/* Controls bar */}
      <div className="card" style={{ marginBottom: 8, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {/* Risk mode */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 8, padding: 2 }}>
          {(['net', 'raw'] as const).map(m => (
            <button key={m} onClick={() => setRiskMode(m)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: riskMode === m ? 'var(--accent)' : 'transparent',
              color: riskMode === m ? '#000' : 'var(--text-dim)', transition: 'all 0.15s',
            }}>{m === 'net' ? 'Чистый риск' : 'Сырой риск'}</button>
          ))}
        </div>

        {/* Week slider */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 140 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Неделя</span>
          <input type="range" min={0} max={weeks.length} value={organWeek}
            onChange={e => onWeekChange(parseFloat(e.target.value) || 0)}
            style={{ flex: 1, height: 4, accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, minWidth: 18 }}>
            {organWeek === 0 ? '0' : organWeek}
          </span>
        </div>

        {/* MC Toggle */}
        <button onClick={onToggleMC} style={{
          padding: '5px 14px', borderRadius: 16, fontSize: 10, fontWeight: 700, cursor: 'pointer',
          background: mcEnabled ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'var(--bg-secondary)',
          border: mcEnabled ? '1px solid #8b5cf6' : '1px solid var(--border)',
          color: mcEnabled ? '#fff' : 'var(--text-dim)',
          boxShadow: mcEnabled ? '0 0 12px rgba(139,92,246,0.3)' : 'none',
          transition: 'all 0.3s',
        }}>🎲 МК: {mcEnabled ? 'ВКЛ' : 'ВЫКЛ'}</button>
      </div>

      {/* 3D Viewer */}
      <div
        ref={containerRef}
        style={{
          width: '100%', height: 'min(70vh, 550px)',
          borderRadius: 16, overflow: 'hidden',
          background: 'transparent',
          border: '1px solid var(--border)',
          position: 'relative',
        }}
      >
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div className="loading-spinner" style={{ marginRight: 8 }} />
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Загрузка 3D модели...</span>
          </div>
        )}
      </div>

      {/* Organ legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {organList.map(o => {
          const isSel = selectedOrgan === o.system;
          return (
            <button key={o.system} onClick={() => setSelectedOrgan(isSel ? null : o.system)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 10,
              fontSize: 10, fontWeight: isSel ? 700 : 500, cursor: 'pointer',
              background: isSel ? o.color + '22' : 'var(--bg-secondary)',
              border: `1px solid ${isSel ? o.color : 'var(--border)'}`,
              color: isSel ? o.color : 'var(--text-dim)',
              transition: 'all 0.15s',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
              {o.label} <span style={{ fontWeight: 700 }}>{o.riskPct}%</span>
            </button>
          );
        })}
      </div>

      {/* Selected organ detail */}
      {selectedOrgan && (() => {
        const info = organList.find(o => o.system === selectedOrgan);
        if (!info) return null;
        return (
          <div className="card" style={{ marginTop: 8, padding: 10, borderColor: info.color + '44' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.label}</span>
              <button onClick={() => setSelectedOrgan(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${info.riskPct}%`, height: '100%', background: info.color, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.riskPct}%</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>{info.description}</div>
          </div>
        );
      })()}

      <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8 }}>
        🖱 Вращайте модель • Колёсико для зума • Клик по органу для деталей
      </div>
    </div>
  );
};

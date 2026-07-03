import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { TzSpecResult, TzSpecOrganResult } from '../../../engines/risk-engine-tz-spec';
import { getRiskColor } from '../../../core/utils/risk-colors';

const MESH_TO_ORGAN: Record<string, string> = {
  heart: 'cardio', vessels: 'cardio', liver: 'hepatic', kidney: 'renal',
  blood: 'hematologic', endocrine: 'hematologic', metabolic: 'hematologic',
  ghigf: 'cns', ins_axis: 'cns',
  musculoskeletal: 'hematologic', neuro_toxicity: 'cns',
  reproductive: 'reproductive',
  brain: 'cns', kidneys: 'renal', lungs: 'cardio', artery: 'cardio',
  vein: 'cardio', pancreas: 'hematologic', spleen: 'hematologic', stomach: 'hematologic',
  intestine: 'hematologic', colon: 'hematologic', thyroid: 'hematologic', adrenal: 'hematologic',
  pituitary: 'cns', testes: 'reproductive', ovaries: 'reproductive', prostate: 'reproductive',
  bladder: 'renal', urethra: 'renal', bone: 'hematologic', muscle: 'hematologic',
  skin: 'hepatic', aorta: 'cardio', artery_: 'cardio', vein_: 'cardio',
};

const TZ_SYSTEM_INFO: Record<string, { label: string; id: string }> = {
  cardio: { label: '❤️ ССС', id: 'cardio' },
  hepatic: { label: '🫁 Печень', id: 'hepatic' },
  renal: { label: '🫘 Почки', id: 'renal' },
  cns: { label: '🧠 ЦНС', id: 'cns' },
  reproductive: { label: '🧬 Репродуктивная', id: 'reproductive' },
  hematologic: { label: '🩸 Гематология', id: 'hematologic' },
};

const TZ_SYSTEM_COLORS: Record<string, string> = {
  cardio: '#f97316', hepatic: '#22c55e', renal: '#3b82f6',
  cns: '#14b8a6', reproductive: '#ec4899', hematologic: '#ef4444',
};

interface Props {
  tzResult: TzSpecResult;
}

export const TZRisk3DModel: React.FC<Props> = ({ tzResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sceneRef = useRef<{ scene: THREE.Scene; meshes: Map<string, THREE.Mesh | THREE.Mesh[]>; controls: OrbitControls; animate: () => void } | null>(null);

  const organMap = useMemo(() => {
    const m: Record<string, TzSpecOrganResult> = {};
    for (const o of tzResult.organs) m[o.id] = o;
    return m;
  }, [tzResult]);

  const organList = useMemo(() => {
    return tzResult.organs.map(o => ({
      system: o.id,
      label: `${o.icon} ${o.name}`,
      color: getRiskColor(o.afterPercent),
      riskPct: o.afterPercent,
      description: `${o.name}: ${o.afterPercent}% · K_protect: ${o.k_protect}% · ${o.mechanisms.length} механизмов`,
    })).sort((a, b) => b.riskPct - a.riskPct);
  }, [tzResult]);

  const getOrganRiskPct = useCallback((organKey: string): number => {
    const tzSys = MESH_TO_ORGAN[organKey] || organKey;
    const o = organMap[tzSys];
    if (o) return o.afterPercent;
    const bodyAvg = tzResult.organs.reduce((s, o2) => s + o2.afterPercent, 0) / Math.max(1, tzResult.organs.length);
    return bodyAvg;
  }, [organMap, tzResult]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight || 500;
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = null;
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 20);
    camera.position.set(0, 0.2, 3.5);
    camera.lookAt(0, 0, 0);
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
    controls.minDistance = 1.5;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.target.set(0, 0.1, 0);
    controls.update();
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
    const meshes = new Map<string, THREE.Mesh>();
    const loader = new GLTFLoader();
    loader.load('/hulk.glb', (gltf) => {
      setLoading(false);
      const model = gltf.scene;
      model.position.set(0, -0.15, 0);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const meshName = child.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (meshName && meshName.length > 1) {
            let organ = MESH_TO_ORGAN[meshName];
            if (!organ) {
              for (const [key, val] of Object.entries(MESH_TO_ORGAN)) {
                if (meshName.includes(key) || key.includes(meshName)) { organ = val; break; }
              }
            }
            if (organ) {
              meshes.set(organ, child);
            } else {
              if (!meshes.has('__body__')) meshes.set('__body__', [] as unknown as THREE.Mesh);
              (meshes.get('__body__') as unknown as THREE.Mesh[]).push(child);
            }
          } else {
            if (!meshes.has('__body__')) meshes.set('__body__', [] as unknown as THREE.Mesh);
            (meshes.get('__body__') as unknown as THREE.Mesh[]).push(child);
          }
        }
      });
      scene.add(model);
      updateOrganColors(meshes);
    }, undefined, () => setLoading(false));
    let animId: number;
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
    sceneRef.current = { scene, meshes, controls, animate };
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  const updateOrganColors = useCallback((meshes: Map<string, THREE.Mesh | THREE.Mesh[]>) => {
    let totalRisk = 0;
    let count = 0;
    meshes.forEach((mesh, key) => {
      if (key !== '__body__' && !Array.isArray(mesh)) {
        const pct = getOrganRiskPct(key);
        totalRisk += pct;
        count++;
      }
    });
    const avgRisk = count > 0 ? totalRisk / count : 15;
    const colorMesh = (mesh: THREE.Mesh, colorHex: string, pct: number) => {
      const color = new THREE.Color(colorHex);
      const factor = Math.min(1, Math.max(0.05, pct / 100)) * 0.5;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => {
          if (m instanceof THREE.MeshStandardMaterial) {
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
    const bodyRaw = meshes.get('__body__') as unknown as THREE.Mesh[] | undefined;
    if (bodyRaw && Array.isArray(bodyRaw)) {
      const avgColor = getRiskColor(Math.round(avgRisk));
      bodyRaw.forEach((m: THREE.Mesh) => colorMesh(m, avgColor, avgRisk));
    }
    meshes.forEach((mesh, key) => {
      if (key === '__body__' || Array.isArray(mesh)) return;
      const pct = getOrganRiskPct(key);
      colorMesh(mesh as THREE.Mesh, getRiskColor(Math.round(pct)), pct);
    });
  }, [getOrganRiskPct]);

  useEffect(() => {
    if (sceneRef.current) {
      updateOrganColors(sceneRef.current.meshes);
    }
  }, [tzResult, updateOrganColors]);

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
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {organList.map(o => {
          const isSel = selectedOrgan === o.system;
          return (
            <button key={o.system} onClick={() => setSelectedOrgan(isSel ? null : o.system)} style={{
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

      {selectedOrgan && (() => {
        const info = organList.find(o => o.system === selectedOrgan);
        if (!info) return null;
        return (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${info.color}44` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.label}</span>
              <button onClick={() => setSelectedOrgan(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${info.riskPct}%`, height: '100%', background: info.color, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.riskPct}%</span>
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{info.description}</div>
          </div>
        );
      })()}

      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>
        🖱 Вращайте модель · Колёсико для зума · Клик по системе для деталей
      </div>
    </div>
  );
};

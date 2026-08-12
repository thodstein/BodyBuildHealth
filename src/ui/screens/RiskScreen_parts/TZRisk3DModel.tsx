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

// ── Deterministic pseudo-noise (для «живых» поверхностей органов) ──
function pseudoNoise(x: number, y: number, z: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

// Бугристая сфера (извилины мозга, неровности органов)
function bumpySphere(radius: number, jitter: number, detail = 26): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(radius, detail * 2, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = pseudoNoise(v.x * 7.13, v.y * 5.71, v.z * 9.31);
    const j = 1 + (n - 0.5) * jitter;
    pos.setXYZ(i, v.x * j, v.y * j, v.z * j);
  }
  geo.computeVertexNormals();
  return geo;
}

// Сфера, «раздавленная» в эллипсоид (ядро, поджелудочная, щитовидная и т.д.)
function ellipsoid(rx: number, ry: number, rz: number, detail = 22): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, detail, Math.max(10, Math.floor(detail * 0.8)));
  geo.scale(rx, ry, rz);
  geo.computeVertexNormals();
  return geo;
}

// Фигура вращения по профилю [x=радиус, y=высота] — почки (бобы), лёгкие, желудок
function latheByProfile(profile: [number, number][], segments = 28): THREE.BufferGeometry {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  return geo;
}

// ── Контур сердца (вид спереди): предсердия сверху, желудочки, верхушка внизу ──
function createHeartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(0.12, -0.55, 0.34, -0.38, 0.52, -0.22);
  s.bezierCurveTo(0.82, 0.06, 1.0, 0.28, 1.0, 0.56);
  s.bezierCurveTo(1.0, 0.82, 0.85, 0.92, 0.6, 0.87);
  s.bezierCurveTo(0.55, 0.55, 0.45, 0.5, 0.3, 0.5);
  s.bezierCurveTo(0.24, 0.72, 0.2, 0.93, 0, 1.0);
  s.bezierCurveTo(-0.2, 0.93, -0.24, 0.72, -0.3, 0.5);
  s.bezierCurveTo(-0.45, 0.5, -0.55, 0.55, -0.6, 0.87);
  s.bezierCurveTo(-0.85, 0.92, -1.0, 0.82, -1.0, 0.56);
  s.bezierCurveTo(-1.0, 0.28, -0.82, 0.06, -0.52, -0.22);
  s.bezierCurveTo(-0.34, -0.38, -0.12, -0.55, 0, -1);
  return s;
}

// ── Печень (вид спереди): большая правая доля + сужающаяся левая ──
function createLiverShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.9, -0.12);
  s.bezierCurveTo(-0.95, 0.25, -0.6, 0.45, -0.2, 0.5);
  s.bezierCurveTo(0.1, 0.53, 0.55, 0.56, 0.88, 0.32);
  s.bezierCurveTo(1.0, 0.22, 1.0, -0.12, 0.9, -0.28);
  s.bezierCurveTo(0.62, -0.55, 0.18, -0.62, -0.08, -0.52);
  s.bezierCurveTo(-0.34, -0.46, -0.58, -0.36, -0.74, -0.16);
  s.bezierCurveTo(-0.84, -0.04, -0.86, -0.04, -0.9, -0.12);
  return s;
}

// Профиль почки (reniform): два полюса + выемка ворот (hilum) по экватору
const KIDNEY_PROFILE: [number, number][] = [
  [0.1, -1], [0.35, -0.82], [0.5, -0.45], [0.55, -0.12], [0.3, 0],
  [0.55, 0.12], [0.5, 0.45], [0.35, 0.82], [0.1, 1],
];

// Профиль селезёнки: вытянутый боб
const SPLEEN_PROFILE: [number, number][] = [
  [0.06, -1], [0.28, -0.8], [0.42, -0.35], [0.46, 0.1], [0.28, 0.48], [0.1, 0.8], [0.06, 1],
];

// Профиль лёгкого: верхушка сверху, широкое основание внизу
const LUNG_PROFILE: [number, number][] = [
  [0.01, 1], [0.2, 0.8], [0.34, 0.5], [0.42, 0.1], [0.44, -0.3], [0.38, -0.65], [0.24, -0.88], [0.02, -1],
];

// Профиль желудка: мешок с широким дном (fundus) и узким выходом (pylorus)
const STOMACH_PROFILE: [number, number][] = [
  [0.02, -1], [0.35, -0.9], [0.5, -0.6], [0.55, -0.2], [0.5, 0.2],
  [0.4, 0.5], [0.28, 0.72], [0.12, 0.88], [0.02, 1],
];

// Петли кишечника: трубка по спиральной кривой
function createIntestinesGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const loops = 5;
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const x = Math.sin(t * Math.PI * loops) * 0.17;
    const y = -0.5 + t * 1.0 + Math.sin(t * Math.PI * (loops + 1.5)) * 0.07;
    const z = Math.cos(t * Math.PI * loops * 0.6) * 0.12;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 90, 0.05, 8, false);
}

// Дуга аорты: изгиб от сердца вверх и влево
function createAortaGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 1.0, 0),
    new THREE.Vector3(0.1, 1.3, 0.1),
    new THREE.Vector3(0.02, 1.55, 0.2),
    new THREE.Vector3(-0.22, 1.62, 0.22),
    new THREE.Vector3(-0.4, 1.45, 0.16),
    new THREE.Vector3(-0.48, 1.2, 0.1),
  ]);
  return new THREE.TubeGeometry(curve, 26, 0.05, 10, false);
}

// ── Описания органов ──
interface OrganDef {
  system: string;
  id: string;
  label: string;
  build: () => THREE.Object3D | THREE.Object3D[];
  pos: [number, number, number];
  scale?: [number, number, number];
  rot?: [number, number, number];
  interactive?: boolean; // декоративные органы не кликабельны
}

const ORGAN_DEFS: OrganDef[] = [
  // ── CNS: мозг (2 полушария + мозжечок + ствол) ──
  {
    system: 'cns', id: 'brain', label: 'Головной мозг',
    build: () => {
      const g = new THREE.Group();
      const left = new THREE.Mesh(bumpySphere(0.5, 0.14));
      left.position.set(-0.16, 0, 0);
      const right = new THREE.Mesh(bumpySphere(0.5, 0.14));
      right.position.set(0.16, 0, 0);
      const cereb = new THREE.Mesh(bumpySphere(0.22, 0.16));
      cereb.position.set(0, -0.44, 0);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.34, 12));
      stem.position.set(0, -0.66, 0);
      g.add(left, right, cereb, stem);
      return g;
    },
    pos: [0, 2.85, 0], scale: [0.56, 0.56, 0.56],
  },
  // ── CNS: спинной мозг ──
  {
    system: 'cns', id: 'spinal_cord', label: 'Спинной мозг',
    build: () => new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10)),
    pos: [0, 0.95, -0.28], scale: [1, 1, 1],
  },
  // ── Cardio: сердце (объёмное, с дугой аорты) ──
  {
    system: 'cardio', id: 'heart', label: 'Сердце',
    build: () => {
      const g = new THREE.Group();
      const heartGeo = new THREE.ExtrudeGeometry(createHeartShape(), {
        depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, steps: 2,
      });
      heartGeo.translate(0, 0, -0.275);
      const heart = new THREE.Mesh(heartGeo);
      g.add(heart);
      const aorta = new THREE.Mesh(createAortaGeometry());
      g.add(aorta);
      return g;
    },
    pos: [0, 1.4, 0.3], scale: [0.3, 0.3, 0.3], rot: [0, 0, 0.15],
  },
  // ── Cardio: лёгкие (декоративные, дим) ──
  {
    system: 'cardio', id: 'left_lung', label: 'Левое лёгкое',
    build: () => new THREE.Mesh(latheByProfile(LUNG_PROFILE)),
    pos: [-0.28, 1.55, 0.2], scale: [0.36, 0.5, 0.2], rot: [0, 0, -0.08], interactive: false,
  },
  {
    system: 'cardio', id: 'right_lung', label: 'Правое лёгкое',
    build: () => new THREE.Mesh(latheByProfile(LUNG_PROFILE)),
    pos: [0.28, 1.55, 0.2], scale: [0.36, 0.5, 0.2], rot: [0, 0, 0.08], interactive: false,
  },
  // ── Hepatic: печень (клиновидная, с долями) ──
  {
    system: 'hepatic', id: 'liver', label: 'Печень',
    build: () => {
      const geo = new THREE.ExtrudeGeometry(createLiverShape(), {
        depth: 0.3, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, steps: 1,
      });
      geo.translate(0, 0, -0.15);
      return new THREE.Mesh(geo);
    },
    pos: [-0.12, 0.85, 0.18], scale: [0.36, 0.36, 0.36],
  },
  // ── Hepatic: жёлчный пузырь (декоративный) ──
  {
    system: 'hepatic', id: 'gallbladder', label: 'Жёлчный пузырь',
    build: () => new THREE.Mesh(ellipsoid(0.1, 0.16, 0.1)),
    pos: [-0.52, 0.52, 0.28], scale: [1, 1, 1], interactive: false,
  },
  // ── Renal: почки (бобовидные, с воротами) ──
  {
    system: 'renal', id: 'left_kidney', label: 'Левая почка',
    build: () => new THREE.Mesh(latheByProfile(KIDNEY_PROFILE)),
    pos: [-0.36, 0.35, 0.06], scale: [0.26, 0.3, 0.17],
  },
  {
    system: 'renal', id: 'right_kidney', label: 'Правая почка',
    build: () => new THREE.Mesh(latheByProfile(KIDNEY_PROFILE)),
    pos: [0.36, 0.35, 0.06], scale: [0.26, 0.3, 0.17],
  },
  // ── Renal: мочевой пузырь ──
  {
    system: 'renal', id: 'bladder', label: 'Мочевой пузырь',
    build: () => new THREE.Mesh(ellipsoid(0.3, 0.24, 0.28)),
    pos: [0, -0.5, 0.16], scale: [1, 1, 1],
  },
  // ── Reproductive: яички (эллипсоиды + придатки) ──
  {
    system: 'reproductive', id: 'left_testis', label: 'Левое яичко',
    build: () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(ellipsoid(0.85, 0.65, 0.7));
      const epi = new THREE.Mesh(bumpySphere(0.26, 0.1, 12));
      epi.position.set(0, 0.32, -0.1);
      g.add(body, epi);
      return g;
    },
    pos: [-0.16, -0.32, 0.15], scale: [0.26, 0.26, 0.26],
  },
  {
    system: 'reproductive', id: 'right_testis', label: 'Правое яичко',
    build: () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(ellipsoid(0.85, 0.65, 0.7));
      const epi = new THREE.Mesh(bumpySphere(0.26, 0.1, 12));
      epi.position.set(0, 0.32, -0.1);
      g.add(body, epi);
      return g;
    },
    pos: [0.16, -0.32, 0.15], scale: [0.26, 0.26, 0.26],
  },
  // ── Hematologic: селезёнка (вытянутый боб) ──
  {
    system: 'hematologic', id: 'spleen', label: 'Селезёнка',
    build: () => new THREE.Mesh(latheByProfile(SPLEEN_PROFILE)),
    pos: [0.36, 0.85, 0.08], scale: [0.4, 0.28, 0.2], rot: [0, 0, 0.5],
  },
  // ── Декоративные органы (заполняют анатомию, не кликабельны) ──
  {
    system: 'cns', id: 'thyroid', label: 'Щитовидная железа',
    build: () => {
      const g = new THREE.Group();
      const l1 = new THREE.Mesh(ellipsoid(0.12, 0.18, 0.09));
      l1.position.set(-0.19, 0, 0);
      const l2 = l1.clone();
      l2.position.set(0.19, 0, 0);
      const isthmus = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.1));
      g.add(l1, l2, isthmus);
      return g;
    },
    pos: [0, 2.14, 0.17], scale: [1, 1, 1], interactive: false,
  },
  {
    system: 'cns', id: 'trachea', label: 'Трахея',
    build: () => {
      const g = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 12));
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 10));
      b1.rotation.z = 0.55;
      b1.position.set(-0.1, -0.28, 0);
      const b2 = b1.clone();
      b2.rotation.z = -0.55;
      b2.position.set(0.1, -0.28, 0);
      g.add(tube, b1, b2);
      return g;
    },
    pos: [0, 1.92, 0.18], scale: [1, 1, 1], interactive: false,
  },
  {
    system: 'renal', id: 'ureters', label: 'Мочеточники',
    build: () => {
      const g = new THREE.Group();
      const u1 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 8));
      u1.position.set(-0.22, -0.3, 0);
      u1.rotation.z = 0.18;
      const u2 = u1.clone();
      u2.position.set(0.22, -0.3, 0);
      u2.rotation.z = -0.18;
      g.add(u1, u2);
      return g;
    },
    pos: [0, 0, 0.12], scale: [1, 1, 1], interactive: false,
  },
  {
    system: 'renal', id: 'stomach', label: 'Желудок',
    build: () => new THREE.Mesh(latheByProfile(STOMACH_PROFILE)),
    pos: [0.3, 0.82, 0.26], scale: [0.44, 0.5, 0.44], rot: [0, 0, -0.18], interactive: false,
  },
  {
    system: 'renal', id: 'pancreas', label: 'Поджелудочная железа',
    build: () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(ellipsoid(0.5, 0.14, 0.18));
      const head = new THREE.Mesh(ellipsoid(0.18, 0.16, 0.18));
      head.position.set(0.42, 0.02, 0);
      g.add(body, head);
      return g;
    },
    pos: [0.02, 1.0, 0.34], scale: [0.6, 0.8, 0.8], rot: [0, 0, -0.06], interactive: false,
  },
  {
    system: 'hematologic', id: 'intestines', label: 'Кишечник',
    build: () => new THREE.Mesh(createIntestinesGeometry()),
    pos: [0, 0.1, 0.2], scale: [1, 1, 1], interactive: false,
  },
];

interface Props {
  tzResult: TzSpecResult;
}

export const TZRisk3DModel: React.FC<Props> = ({ tzResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedOrgan, setSelectedOrgan] = useState<string | null>(null);
  const [hoveredOrgan, setHoveredOrgan] = useState<string | null>(null);

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
    const organMat = (color: number, opacity = 0.92) => new THREE.MeshPhongMaterial({
      color, shininess: 90, transparent: true, opacity, specular: 0x444444,
    });
    const decoMat = new THREE.MeshPhongMaterial({
      color: 0x39475f, shininess: 30, transparent: true, opacity: 0.32, specular: 0x1a2233,
    });

    const organMeshes: THREE.Mesh[] = [];
    const systemMeshMap = new Map<string, THREE.Mesh[]>();

    for (const def of ORGAN_DEFS) {
      const built = def.build();
      const list = Array.isArray(built) ? built : [built];
      for (const obj of list) {
        obj.position.set(def.pos[0], def.pos[1], def.pos[2]);
        if (def.scale) obj.scale.set(def.scale[0], def.scale[1], def.scale[2]);
        if (def.rot) obj.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.userData = { system: def.system, id: def.id, label: def.label };
            if (def.interactive !== false) {
              child.material = organMat(0x666688);
              organMeshes.push(child);
              const existing = systemMeshMap.get(def.system);
              if (existing) existing.push(child);
              else systemMeshMap.set(def.system, [child]);
            } else {
              child.material = decoMat;
            }
            child.castShadow = true;
          }
        });
        scene.add(obj);
      }
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

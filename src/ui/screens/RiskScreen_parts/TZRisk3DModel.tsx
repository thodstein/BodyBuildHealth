/**
 * TZRisk3DModel.tsx — 3D-модель рисков (ТЗ) на теле бодибилдера (bodybuilder.glb,
 * автор 3dUVpro, лицензия CC Attribution — атрибуция под моделью).
 *
 * Тело всегда чистое: риск-цветом красится ТОЛЬКО орган. Кожа чуть прозрачна
 * (рентген), чтобы органы внутри было видно; зоны на теле не рисуются,
 * их индексы используются лишь для кликов.
 *
 * Анатомия, система координат и посадка органов — в `engines/organ-shape.engine.ts`
 * (там же замеры тела, из которых взяты все якоря). Органы без валидного GLB
 * (мозг, сердце, печень, почки, матка) рисуются параметрическими формами.
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { TzSpecResult, TzSpecOrganResult } from '../../../engines/risk-engine-tz-spec';
import { buildZoneMapping } from '../../../engines/mesh-zone-mapping';
import {
  ORGAN_SHAPES,
  organShapeExtent,
  buildSilhouetteProfile,
  placeInsideBody,
  anchorZ,
  type OrganShapeId,
  type SilhouetteBand,
} from '../../../engines/organ-shape.engine';
import { getRiskColor as riskColor } from '../../../core/utils/risk-colors';
import { isNativeApp } from '../../../core/app-platform';

/**
 * Активы резолвим с учётом платформы:
 * - АПК (native): всегда './x.glb' — абсолютный '/x.glb' ломается в WebView
 *   (file://, LiveUpdate-бандлы) и модель не грузится;
 * - web/TG: как раньше, от BASE_URL (в проде './', в dev/test '/').
 * Экспортируется для тестов.
 */
export function assetUrl(p: string): string {
  const clean = p.replace(/^\/+/, '');
  try {
    if (isNativeApp()) return `./${clean}`;
  } catch {
    /* ниже — web-ветка */
  }
  try {
    const base = (import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL || './';
    return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`;
  } catch {
    return `./${clean}`;
  }
}

/**
 * Есть ли WebGL в этом окружении (дешёвые телефоны / jsdom — нет).
 * Проверяем ДО создания WebGLRenderer: иначе three бросает исключение
 * и без ErrorBoundary роняет весь экран рисков в АПК.
 * Экспортируется для тестов.
 */
export function hasWebGL(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return false;
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as unknown;
    return !!gl;
  } catch {
    return false;
  }
}

const TZ_SYSTEM_ICONS: Record<string, string> = {
  cardio: '❤️', hepatic: '🫁', renal: '🫘', cns: '🧠', reproductive: '🧬', hematologic: '🩸',
};

/**
 * Параметры «студийного» рендера — вынесены и экспортированы, потому что именно
 * они давали жалобу «модель очень тёмная», и именно их держит тест.
 */
export const RENDER_LOOK = {
  /** Канвас непрозрачный: сквозь него просвечивал глобальный `canvas { background: #141414 }`. */
  alpha: false as const,
  /** Фон сцены и подложка контейнера — одно значение, иначе рамка мигает другим цветом. */
  background: 0x2f3a52,
  backgroundCss: '#2f3a52',
  /** Тонмаппинг: раньше 0.85 — тело и органы уходили в темноту. */
  exposureNative: 1.05,
  exposureWeb: 1.2,
  /** Прозрачность рентген-тела при выключенных органах: было 0.32 — читалась «пустота». */
  bodyOpacityNoOrgans: 0.45,
  /** Кожа больше не затемняется в пол (было multiplyScalar(0.88)). */
  bodyDimFactor: 1,
} as const;

// ── Якоря кликабельных зон тела ──────────────────────────────────────────────
//
// Координаты: y ∈ [−1 стопы … +1 макушка], x — лево тела (+) / правое (−),
// z — перед тела (+). Точка ставится в анатомический центр области, а глубина
// берётся из измеренного силуэта (anchorZ) чуть СНАРУЖИ нужной поверхности:
// якорь внутри тела дал бы зону на противоположной стороне.
//
// Печень/селезёнка/сердце раньше стояли зеркально (±x перепутаны), а «пах»
// был на уровне середины бедра вместо таза.
export interface SystemAnchor {
  id: string;
  label: string;
  pos: [number, number, number];
  side: 'front' | 'back';
  r: number;
}

// Радиусы подобраны так, чтобы соседние зоны НЕ перекрывались: якоря печени и
// сердца разнесены по вертикали всего на 0.06, и при r=0.22 зона «Сердце»
// захватывала верх живота (проверяется в TZRisk3DModel.test.ts).
export const SYSTEM_ANCHORS: SystemAnchor[] = [
  { id: 'cns', label: 'Головной мозг', pos: [0, 0.90, 0.02], side: 'front', r: 0.16 },
  { id: 'cardio', label: 'Сердце / грудь', pos: [0.04, 0.38, 0.05], side: 'front', r: 0.14 },
  { id: 'hepatic', label: 'Печень', pos: [-0.10, 0.32, 0.05], side: 'front', r: 0.17 },
  { id: 'hematologic', label: 'Селезёнка / кровь', pos: [0.13, 0.32, 0.0], side: 'front', r: 0.15 },
  { id: 'renal', label: 'Почки / поясница', pos: [0, 0.20, -0.10], side: 'back', r: 0.19 },
  { id: 'reproductive', label: 'Репродуктивная', pos: [0, -0.04, 0.05], side: 'front', r: 0.16 },
];

export interface OrganModelDef {
  system: string;
  /** glb — реальная модель-файл; procedural — параметрическая форма из organ-shape */
  kind: 'glb' | 'procedural';
  url?: string;
  shape?: OrganShapeId;
  sex?: 'male' | 'female';
  /** анатомический центр органа в локальных координатах тела (y ∈ [−1…+1]) */
  pos: [number, number, number];
  /**
   * Наибольший габарит в ЛОКАЛЬНЫХ единицах тела (тело ≈2.0 = 180 см,
   * 1 единица ≈ 90 см). Обязателен для glb; для procedural берётся из
   * `ORGAN_SHAPES[shape].size` — дублировать размер в двух местах нельзя
   * (так печень разъехалась на 0.26 против 0.25).
   */
  size?: number;
  /** запас от кожи, чтобы орган не слипался с поверхностью при рентгене */
  deep: number;
}

/**
 * В каком пространстве живут органы.
 *
 * 'body-local' — потомок группы тела: координаты органов совпадают с якорями
 *   1:1 (тело ≈2.0 = 180 см, 1 единица ≈ 90 см).
 * 'scene' — потомок сцены: тогда органы оказываются в МИРОВЫХ единицах, где тело
 *   растянуто до 3.0 и сдвинуто на +0.4. Раньше было именно так, из-за чего:
 *   органы выходили ×1.5 крупнее анатомии, посадка сверялась с профилем,
 *   измеренным в другом пространстве, а якоря зон клика уезжали вверх на ~0.85.
 */
export const ORGAN_SPACE = 'body-local' as const;

/** Наибольший габарит модели: у процедурной — из формы, у GLB — из поля `size`. */
export function organSize(def: OrganModelDef): number {
  if (def.kind === 'procedural') return ORGAN_SHAPES[def.shape as OrganShapeId].size;
  return def.size ?? 0.1;
}

/**
 * Размеры пересчитаны из реальных анатомических габаритов: прежние `size`
 * приехали из плоского SVG-макета (орган во весь рост на проекции) и были
 * завышены в 1.3–2.4 раза — почка была 21 см при реальных 11.
 */
export const ORGAN_MODELS: OrganModelDef[] = [
  { system: 'cns', kind: 'procedural', shape: 'brain', pos: [0, 0.905, -0.02], deep: 0.0 },
  { system: 'cardio', kind: 'procedural', shape: 'heart', pos: [0.045, 0.37, 0.05], deep: 0.02 },
  { system: 'hepatic', kind: 'procedural', shape: 'liver', pos: [-0.10, 0.32, 0.055], deep: 0.02 },
  { system: 'hematologic', kind: 'glb', url: '/organs/spleen.glb', pos: [0.13, 0.32, -0.02], size: 12 / 90, deep: 0.02 },
  { system: 'renal', kind: 'procedural', shape: 'kidneys', pos: [0, 0.20, -0.105], deep: 0.02 },
  { system: 'reproductive', kind: 'glb', url: '/organs/prostate.glb', sex: 'male', pos: [0, -0.04, 0.045], size: 4 / 90, deep: 0.02 },
  { system: 'reproductive', kind: 'procedural', shape: 'uterus', sex: 'female', pos: [0, 0.0, 0.03], deep: 0.02 },
  { system: 'reproductive', kind: 'glb', url: '/organs/ovary-left.glb', sex: 'female', pos: [0.075, 0.0, -0.005], size: 3 / 90, deep: 0.02 },
  { system: 'reproductive', kind: 'glb', url: '/organs/ovary-right.glb', sex: 'female', pos: [-0.075, 0.0, -0.005], size: 3 / 90, deep: 0.02 },
];

/** Разрешённые якори с глубиной из измеренного силуэта тела. */
function resolvedAnchors(profile: SilhouetteBand[]): SystemAnchor[] {
  return SYSTEM_ANCHORS.map((a) => ({
    ...a,
    pos: [a.pos[0], a.pos[1], anchorZ(a.pos, a.side, profile)] as [number, number, number],
  }));
}

/**
 * Чистая функция: каждому вертексу (x,y,z × N) — индекс якоря (или −1).
 * Без профиля глубина берётся из самого `pos` (старый путь и юнит-тесты).
 */
export function assignVertexSystems(
  positions: Float32Array,
  anchors: SystemAnchor[] = SYSTEM_ANCHORS,
  profile?: SilhouetteBand[],
): Int8Array {
  const live = profile && profile.length ? resolvedAnchors(profile) : anchors;
  const out = new Int8Array(positions.length / 3).fill(-1);
  for (let i = 0; i < out.length; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    let best = -1;
    let bestD = Infinity;
    for (let a = 0; a < live.length; a++) {
      const dx = x - live[a].pos[0];
      const dy = y - live[a].pos[1];
      const dz = z - live[a].pos[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best >= 0 && Math.sqrt(bestD) <= live[best].r) out[i] = best;
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255];
}

interface Props {
  tzResult: TzSpecResult;
  sex?: 'male' | 'female';
}

export const TZRisk3DModel: React.FC<Props> = ({ tzResult, sex = 'male' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [hoveredSystem, setHoveredSystem] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showOrgans, setShowOrgans] = useState(true);
  const [wants3D, setWants3D] = useState<boolean>(() => {
    try {
      return !isNativeApp();
    } catch {
      return true;
    }
  });

  interface OrganEntry {
    system: string;
    group: THREE.Group;
    mats: THREE.MeshStandardMaterial[];
  }

  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    animId: number;
    zoneIdx: Int8Array;
    anchorToSystem: string[];
    applyOrganColors: () => void;
  } | null>(null);

  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef('');
  const showOrgansRef = useRef(true);
  const organEntriesRef = useRef<OrganEntry[]>([]);
  const organRootRef = useRef<THREE.Group | null>(null);
  const loadedOrganSystemsRef = useRef<Set<string>>(new Set());
  const organLoadInFlightRef = useRef<Set<string>>(new Set());
  const organErrorsRef = useRef<Set<string>>(new Set());
  const loadOrganSystemRef = useRef<(system: string) => void>(() => undefined);
  const organLoadTokenRef = useRef(0);
  const hulkMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const setXray = useCallback((on: boolean) => {
    for (const m of hulkMatsRef.current) {
      m.transparent = true;
      // 0.32 делало тело почти невидимым: на светлом фоне читался только контур.
      m.opacity = on ? RENDER_LOOK.bodyOpacityNoOrgans : 1;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  }, []);

  const organMap = useMemo(() => {
    const m: Record<string, TzSpecOrganResult> = {};
    for (const o of tzResult.organs) m[o.id] = o;
    return m;
  }, [tzResult]);

  const getSystemRiskPct = useCallback((systemId: string): number => {
    const o = organMap[systemId];
    return o ? o.afterPercent : 0;
  }, [organMap]);

  // Свежие проценты риска без переинициализации сцены: init-эффект висит на []
  // (раньше зависел от getSystemRiskPct и пересоздавал весь WebGL-контекст
  // при каждом пересчёте — на АПК это убивало WebView).
  const riskPctRef = useRef(getSystemRiskPct);
  riskPctRef.current = getSystemRiskPct;

  const systemList = useMemo(() => {
    return tzResult.organs.map(o => ({
      system: o.id,
      label: `${TZ_SYSTEM_ICONS[o.id] || ''} ${o.name}`,
      color: riskColor(o.afterPercent),
      riskPct: Math.round(o.afterPercent),
      description: `${o.name}: ${Math.round(o.afterPercent)}% · K_protect: ${o.k_protect}% · ${o.mechanisms.length} механизмов`,
    })).sort((a, b) => b.riskPct - a.riskPct);
  }, [tzResult]);

  const activeOrganModels = useMemo(
    () => ORGAN_MODELS.filter(def => !def.sex || def.sex === sex),
    [sex],
  );

  // ── Init scene: lit-материалы + мягкий свет, тело без раскраски ──
  // Сцена создаётся ОДИН раз (wants3D-гейт); данные обновляются перекраской.
  useEffect(() => {
    if (!wants3D) return;
    if (!hasWebGL()) {
      setFailed(true);
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    setLoaded(false);
    setFailed(false);
    sceneRef.current = null;

    let disposed = false;
    let native = false;
    try {
      native = isNativeApp();
    } catch {
      native = false;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !native,
        // alpha:false — канвас непрозрачен, поэтому глобальный
        // `canvas { background: var(--bg-secondary) }` из styles.css больше не
        // просвечивает сквозь сцену. Фон целиком задаёт scene.background.
        alpha: RENDER_LOOK.alpha,
        powerPreference: native ? 'low-power' : 'high-performance',
        precision: native ? 'lowp' : 'highp',
      });
    } catch {
      setFailed(true);
      return;
    }
    const w = container.clientWidth || 300;
    const h = container.clientHeight || 450;
    renderer.setSize(w, h);
    renderer.setPixelRatio(native ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // ACES сама по себе затемняет; 0.85 сверху уводило тело в почти чёрный.
    renderer.toneMappingExposure = native ? RENDER_LOOK.exposureNative : RENDER_LOOK.exposureWeb;
    let animId = 0;
    let stopped = false;
    const stopAnimation = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(animId);
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      stopAnimation();
      setFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(RENDER_LOOK.background);
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 30);
    // Тело высотой 3.0 должно целиком влезать в кадр (голова+стопы) — камера дальше
    camera.position.set(0, 0.5, 4.4);
    camera.lookAt(0, 0.35, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2.2;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.target.set(0, 0.35, 0);
    controls.update();

    // «Студийное» освещение: полусфера (небо/пол) + key + fill + rim.
    // Суммарно было втрое слабее, чем нужно под ACES с новой экспозицией —
    // тело читалось как тёмный силуэт.
    const hemi = new THREE.HemisphereLight('#dce7ff', '#5c6070', 0.95);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffffff', 2.1);
    key.position.set(2.5, 4, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#b6c4e0', 0.8);
    fill.position.set(-2.5, 0.5, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#e6efff', 0.7);
    rim.position.set(0, 1, 3);
    scene.add(rim);
    // Заполняющий свет снизу-спереди: снимает «чёрную грудь» на рентгене.
    const bounce = new THREE.DirectionalLight('#9fb0cc', 0.45);
    bounce.position.set(0, -3, 2);
    scene.add(bounce);

    const group = new THREE.Group();
    scene.add(group);

    let zoneIdx: Int8Array = new Int8Array(0);
    let anchorToSystem: string[] = [];
    let baseMesh: THREE.Mesh | null = null;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      assetUrl('/bodybuilder.glb'),
      (gltf) => {
        const model = gltf.scene;
        model.updateMatrixWorld(true);

        // 1) Все меши → MeshStandardMaterial с сохранением оригинальной текстуры.
        //    Если материал GLB был unlit (MeshBasicMaterial/emissive) — свет наконец работает,
        //    «выбеленность» исчезает, текстура остаётся родной.
        const meshes: THREE.Mesh[] = [];
        const hulkMats: THREE.MeshStandardMaterial[] = [];
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          meshes.push(child);
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          const converted = mats.map((m) => {
            const src = m as THREE.MeshStandardMaterial;
            const tex = src.map || null;
            const n = new THREE.MeshStandardMaterial({
              map: tex,
              roughness: 0.65,
              metalness: 0.05,
              // ОБЯЗАТЕЛЬНО сохраняем двуслойность (в GLB doubleSided:true) —
              // иначе задняя сторона тела становится невидимой
              side: (src.side ?? THREE.DoubleSide) === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide,
            });
            if (src.color && src.color.getHex() !== 0xffffff) n.color.copy(src.color);
            if (RENDER_LOOK.bodyDimFactor !== 1) n.color.multiplyScalar(RENDER_LOOK.bodyDimFactor);
            if (tex && native) tex.anisotropy = 1;
            hulkMats.push(n);
            return n;
          });
          child.material = Array.isArray(child.material) ? converted : converted[0];
        });
        if (meshes.length === 0) return;
        // Базовая (тело) — самый большой меш по числу вершин; остальные меши не трогаем для зон
        baseMesh = meshes.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a), meshes[0]);

        // 2) Профиль силуэта ИЗ ГЕОМЕТРИИ ТЕЛА + зоны по той же системе координат.
        //
        //    ВАЖНО: якоря и позиции органов заданы в локальном пространстве GLB
        //    тела (y ∈ [−1 стопы … +1 макушка]). Раньше здесь брались МИРОВЫЕ
        //    координаты тела (оно масштабируется до высоты 3.0 и сдвигается на
        //    +0.4), а сравнивались они с локальными якорями — из-за этого зоны
        //    клика были сдвинуты вверх примерно на 0.85 (≈57 см): голова не
        //    попадала ни в одну зону, а зона «Сердце» забирала шею. Теперь
        //    профиль и зоны строятся по локальным вершинам — это то же
        //    пространство, что и якоря, и заодно ровно то, по которому потом
        //    считается посадка органов.
        const pos = baseMesh.geometry.attributes.position as THREE.BufferAttribute;
        const localPos = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          localPos[i * 3] = pos.getX(i);
          localPos[i * 3 + 1] = pos.getY(i);
          localPos[i * 3 + 2] = pos.getZ(i);
        }
        const profile = buildSilhouetteProfile(localPos);
        const anchors = resolvedAnchors(profile);
        if (native) {
          zoneIdx = assignVertexSystems(localPos, anchors);
        } else {
          const geoIndex = baseMesh.geometry.index ? (baseMesh.geometry.index.array as Uint32Array) : null;
          try {
            const mapping = buildZoneMapping(
              localPos,
              geoIndex,
              anchors.map((a) => ({ id: a.id, pos: a.pos, radius: a.r * 1.4 })),
            );
            zoneIdx = mapping.zoneIdx;
          } catch {
            zoneIdx = assignVertexSystems(localPos, anchors);
          }
        }
        anchorToSystem = anchors.map((a) => a.id);

        // 3) Нормализация: высота → 3.0, центровка
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = 3.0 / Math.max(0.001, size.y);
        group.scale.setScalar(s);
        group.position.y = -center.y * s + 0.4;
        model.position.set(-center.x, -center.y, -center.z);
        group.add(model);
        model.updateMatrixWorld(true);

        // Тело остаётся чистым: красится ТОЛЬКО орган (риск-цветом), кожа — нет.
        // zoneIdx выше нужен лишь для кликов по телу (выбор системы).

        const applyOrganColors = () => {
          const sel = selectedRef.current;
          const hover = hoverRef.current;
          for (const entry of organEntriesRef.current) {
            const pct = riskPctRef.current(entry.system);
            const [r, g, b] = hexToRgb(riskColor(pct));
            for (const m of entry.mats) {
              m.emissive.setRGB(r, g, b);
              if (sel === entry.system) m.emissiveIntensity = 0.85;
              else if (hover === entry.system) m.emissiveIntensity = 0.7;
              else if (sel) m.emissiveIntensity = 0.22;
              else m.emissiveIntensity = 0.45;
            }
          }
        };

        sceneRef.current = {
          camera, renderer, controls, animId: 0,
          zoneIdx, anchorToSystem,
          applyOrganColors,
        };
        setLoaded(true);

        // ── Органы: посадка по измеренному силуэту + рентген ──
        // Никаких лучей снаружи: сторона задаётся анатомическим якорем, глубина
        // и ширина укладываются в измеренный контур тела (placeInsideBody).
        hulkMatsRef.current = hulkMats;
        setXray(showOrgansRef.current);
        group.updateMatrixWorld(true);
        const boxCenter = center;
        const scaleK = s;
        const groupPosY = group.position.y;
        const normToFinal = (p: [number, number, number]): THREE.Vector3 => new THREE.Vector3(
          (p[0] - boxCenter.x) * scaleK,
          (p[1] - boxCenter.y) * scaleK + groupPosY,
          (p[2] - boxCenter.z) * scaleK,
        );
        /**
         * Ставит орган: переводит его габарит в нормированные координаты тела,
         * даёт engine-функции уложить его внутрь силуэта и переводит результат
         * в мировые координаты сцены.
         */
        const placeInside = (def: OrganModelDef, halfWorld: THREE.Vector3): THREE.Vector3 => {
          const half: [number, number, number] = [
            halfWorld.x / scaleK,
            halfWorld.y / scaleK,
            halfWorld.z / scaleK,
          ];
          return normToFinal(placeInsideBody(def.pos, half, profile));
        };
        const organRoot = new THREE.Group();
        organRootRef.current = organRoot;
        // Органы — потомки ТЕЛА, а не сцены (см. ORGAN_SPACE). Иначе они
        // оказываются в мировых координатах (тело растянуто до 3.0 и сдвинуто
        // на +0.4), а якоря заданы в локальном пространстве GLB (y ∈ [−1…+1]).
        (ORGAN_SPACE === 'body-local' ? group : scene).add(organRoot);

        const disposeObject3D = (object: THREE.Object3D) => {
          object.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              const mat = m as THREE.Material & { map?: THREE.Texture | null };
              mat.map?.dispose();
              mat.dispose();
            });
          });
        };
        const disposeSystem = (system: string) => {
          for (let i = organEntriesRef.current.length - 1; i >= 0; i--) {
            const entry = organEntriesRef.current[i];
            if (entry.system !== system) continue;
            organRoot.remove(entry.group);
            disposeObject3D(entry.group);
            organEntriesRef.current.splice(i, 1);
          }
          loadedOrganSystemsRef.current.delete(system);
        };
        const finishHolder = (
          def: OrganModelDef,
          content: THREE.Object3D,
          mats: THREE.MeshStandardMaterial[],
          halfWorld: [number, number, number],
        ) => {
          const holder = new THREE.Group();
          holder.add(content);
          holder.position.copy(placeInside(def, new THREE.Vector3(halfWorld[0], halfWorld[1], halfWorld[2])));
          holder.userData.systemId = def.system;
          content.traverse((o) => {
            o.userData.systemId = def.system;
            if (o instanceof THREE.Mesh) o.renderOrder = 11;
          });
          holder.visible = showOrgansRef.current;
          organRoot.add(holder);
          organEntriesRef.current.push({ system: def.system, group: holder, mats });
          applyOrganColors();
        };

        /**
         * Параметрический орган: группа эллипсоидов по форме из движка.
         * Геометрия сразу в мировых единицах (тело = 3.0), поэтому её габарит
         * известен точно и уходит в посадку без дополнительного масштабирования.
         */
        const buildProcedural = (def: OrganModelDef): {
          content: THREE.Group;
          mats: THREE.MeshStandardMaterial[];
          half: [number, number, number];
        } => {
          const shape = ORGAN_SHAPES[def.shape as OrganShapeId];
          const segW = native ? 14 : 22;
          const segH = native ? 9 : 14;
          const content = new THREE.Group();
          const mats: THREE.MeshStandardMaterial[] = [];
          for (const lobe of shape.lobes) {
            const geo = new THREE.SphereGeometry(1, segW, segH);
            geo.scale(
              lobe.r[0] * shape.extent[0] * shape.size,
              lobe.r[1] * shape.extent[1] * shape.size,
              lobe.r[2] * shape.extent[2] * shape.size,
            );
            geo.translate(
              lobe.c[0] * shape.extent[0] * shape.size,
              lobe.c[1] * shape.extent[1] * shape.size,
              lobe.c[2] * shape.extent[2] * shape.size,
            );
            const mat = new THREE.MeshStandardMaterial({
              color: '#ffffff',
              roughness: 0.45,
              metalness: 0.05,
              side: THREE.DoubleSide,
            });
            mats.push(mat);
            content.add(new THREE.Mesh(geo, mat));
          }
          // organShapeExtent отдаёт ПОЛУгабарит собранной геометрии (|c|+r) —
          // ровно то, что нужно placeInsideBody. Делить ещё на 2 нельзя.
          return { content, mats, half: organShapeExtent(shape) };
        };

        /** Приводит загруженный GLB к габариту `def.size` и возвращает его полугабариты. */
        const fitGltf = (def: OrganModelDef, content: THREE.Object3D): [number, number, number] => {
          const target = organSize(def);
          const obox = new THREE.Box3().setFromObject(content);
          const osize = obox.getSize(new THREE.Vector3());
          const ocenter = obox.getCenter(new THREE.Vector3());
          const maxDim = Math.max(0.001, osize.x, osize.y, osize.z);
          content.position.set(-ocenter.x, -ocenter.y, -ocenter.z);
          content.scale.setScalar(target / maxDim);
          return [
            (target * osize.x) / (2 * maxDim),
            (target * osize.y) / (2 * maxDim),
            (target * osize.z) / (2 * maxDim),
          ];
        };

        const loadOrganSystem = (system: string) => {
          if (disposed) return;
          const defs = activeOrganModels.filter(def => def.system === system);
          if (!defs.length || !organRoot) return;
          if (loadedOrganSystemsRef.current.has(system) || organLoadInFlightRef.current.has(system)) return;
          const token = native ? ++organLoadTokenRef.current : organLoadTokenRef.current;
          if (native) {
            for (const entry of organEntriesRef.current.slice()) {
              if (entry.system !== system) disposeSystem(entry.system);
            }
          }
          organLoadInFlightRef.current.add(system);
          let remaining = defs.length;
          let finished = false;
          const complete = () => {
            if (finished) return;
            finished = true;
            organLoadInFlightRef.current.delete(system);
            if (token !== organLoadTokenRef.current) return;
            if (!organErrorsRef.current.has(system)) loadedOrganSystemsRef.current.add(system);
            organErrorsRef.current.delete(system);
            applyOrganColors();
          };
          for (const def of defs) {
            // Параметрические органы не грузятся вообще — они строятся из формы.
            if (def.kind === 'procedural') {
              const built = buildProcedural(def);
              finishHolder(def, built.content, built.mats, built.half);
              remaining -= 1;
              if (remaining === 0) complete();
              continue;
            }
            const organLoader = new GLTFLoader();
            organLoader.setMeshoptDecoder(MeshoptDecoder);
            organLoader.load(
              assetUrl(def.url as string),
              (ogltf) => {
                if (token !== organLoadTokenRef.current) {
                  disposeObject3D(ogltf.scene);
                  remaining -= 1;
                  if (remaining === 0) {
                    organLoadInFlightRef.current.delete(system);
                    if (native && selectedRef.current === system) window.setTimeout(() => loadOrganSystem(system), 0);
                  }
                  return;
                }
                const content = ogltf.scene;
                const half = fitGltf(def, content);
                const mats: THREE.MeshStandardMaterial[] = [];
                content.traverse((o) => {
                  if (!(o instanceof THREE.Mesh)) return;
                  const sourceMaterials = Array.isArray(o.material) ? o.material : [o.material];
                  const convertedMaterials = sourceMaterials.map((sourceMaterial) => {
                    const src = sourceMaterial as THREE.MeshStandardMaterial;
                    const map = src.map || null;
                    if (map && native) map.anisotropy = 1;
                    return new THREE.MeshStandardMaterial({
                      map,
                      color: src.color ? src.color.clone() : new THREE.Color('#ffffff'),
                      roughness: 0.45,
                      metalness: 0.05,
                      side: THREE.DoubleSide,
                    });
                  });
                  o.material = Array.isArray(o.material) ? convertedMaterials : convertedMaterials[0];
                  mats.push(...convertedMaterials);
                });
                finishHolder(def, content, mats, half);
                remaining -= 1;
                if (remaining === 0) complete();
              },
              undefined,
              (err) => {
                organLoadInFlightRef.current.delete(system);
                organErrorsRef.current.add(system);
                console.warn('[TZ3D] орган не загрузился:', def.url, err);
                remaining -= 1;
                if (remaining === 0) complete();
              },
            );
          }
        };
        loadOrganSystemRef.current = loadOrganSystem;

        if (native) {
          if (showOrgansRef.current) loadOrganSystem(selectedRef.current || 'cns');
        } else if (showOrgansRef.current) {
          const systems = Array.from(new Set(activeOrganModels.map(def => def.system)));
          let queueIndex = 0;
          const loadNext = () => {
            if (disposed || queueIndex >= systems.length) return;
            const system = systems[queueIndex++];
            loadOrganSystem(system);
            const waitForTurn = () => {
              if (disposed || !organLoadInFlightRef.current.has(system)) {
                loadNext();
                return;
              }
              window.setTimeout(waitForTurn, 80);
            };
            window.setTimeout(waitForTurn, 80);
          };
          loadNext();
        }
      },
      undefined,
      () => {
        stopAnimation();
        setFailed(true);
      },
    );

    // ── Raycast: hover + клик (органы в приоритете, затем зоны тела) ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rayTargets = () => [organRootRef.current, baseMesh].filter(Boolean) as THREE.Object3D[];

    const systemAt = (event: MouseEvent): string | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(rayTargets(), true);
      if (!hits.length) return null;
      // Органы несут systemId на себе и родителях — приоритет им
      let o: THREE.Object3D | null = hits[0].object;
      while (o) {
        if (o.userData && typeof o.userData.systemId === 'string') return o.userData.systemId as string;
        o = o.parent;
      }
      if (!hits[0].face) return null;
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
      sceneRef.current?.applyOrganColors();
    };
    const handleClick = (event: MouseEvent) => {
      const sys = systemAt(event);
      if (!sys) return;
      setSelectedSystem(prev => {
        const next = prev === sys ? null : sys;
        selectedRef.current = next || '';
        return next;
      });
      sceneRef.current?.applyOrganColors();
    };
    const handleLeave = () => {
      hoverRef.current = null;
      setHoveredSystem(null);
      sceneRef.current?.applyOrganColors();
    };

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('mouseleave', handleLeave);

    const animate = () => {
      if (stopped) return;
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
      disposed = true;
      stopAnimation();
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseleave', handleLeave);
      organLoadTokenRef.current += 1;
      loadOrganSystemRef.current = () => undefined;
      sceneRef.current = null;
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      renderer.dispose();
      organEntriesRef.current = [];
      organRootRef.current = null;
      loadedOrganSystemsRef.current.clear();
      organLoadInFlightRef.current.clear();
      organErrorsRef.current.clear();
      hulkMatsRef.current = [];
      try {
        if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      } catch {
        /* уже отмонтировано */
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => {
            const mat = m as THREE.Material & { map?: THREE.Texture | null };
            mat.map?.dispose();
            mat.dispose();
          });
        }
      });
    };
    // init один раз за монтирование 3D (wants3D-гейт); свежие данные идут
    // через riskPctRef + эффект перекраски ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wants3D, sex]);

  useEffect(() => {
    if (!loaded || !showOrgans) return;
    loadOrganSystemRef.current(selectedSystem || 'cns');
  }, [loaded, selectedSystem, showOrgans, sex]);

  // ── Перекраска при смене данных / hover / выборе ──
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    ref.applyOrganColors();
  }, [tzResult, selectedSystem, hoveredSystem, loaded, getSystemRiskPct]);

  // ── Тоггл органов: показ мешей + рентген кожи (иначе органы внутри не видны) ──
  useEffect(() => {
    showOrgansRef.current = showOrgans;
    for (const entry of organEntriesRef.current) entry.group.visible = showOrgans;
    setXray(showOrgans);
  }, [showOrgans, setXray]);

  // ── Selected system sync from chip buttons ──
  const handleChipClick = useCallback((sys: string) => {
    setSelectedSystem(prev => {
      const next = prev === sys ? null : sys;
      selectedRef.current = next || '';
      return next;
    });
    sceneRef.current?.applyOrganColors();
  }, []);

  const hoverInfo = hoveredSystem ? SYSTEM_ANCHORS.find((a) => a.id === hoveredSystem) : null;

  return (
    <div>
      {!wants3D ? (
        <div
          style={{
            width: '100%', minHeight: 220,
            borderRadius: 16, overflow: 'hidden',
            background: 'radial-gradient(600px 300px at 50% 0%, rgba(0,230,138,0.10), transparent 65%), rgba(28,32,42,0.55)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: 16, textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
            🧊 3D модель рисков
          </div>
          <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.5, marginBottom: 12 }}>
            На телефоне активен один выбранный орган: остальные качественные модели
            загружаются по чипу, чтобы не перегружать память. Цифры риска — в чипах ниже.
          </div>
          <button
            onClick={() => {
              if (!hasWebGL()) {
                setFailed(true);
                setWants3D(true);
                return;
              }
              setWants3D(true);
            }}
            style={{
              minHeight: 48, padding: '12px 24px', borderRadius: 999,
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              background: 'linear-gradient(135deg, #00e68a, #00a86b)',
              border: '1px solid #00e68a', color: '#04150d',
            }}
          >
            🧊 Загрузить 3D
          </button>
        </div>
      ) : (
      <div
        ref={containerRef}
        style={{
          width: '100%', height: 'min(60vh, 450px)',
          borderRadius: 16, overflow: 'hidden',
          // Подложка совпадает с RENDER_LOOK.background: пока 3D грузится, рамка не
          // «мигает» другим цветом. Раньше здесь был отдельный фиолетовый тон.
          background: RENDER_LOOK.backgroundCss,
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          cursor: 'grab',
        }}
        data-risk3d="stage"
        role="img"
        aria-label="3D модель рисков"
      >
        {failed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontSize: 13, fontWeight:700, color: '#fff' }}>
            3D недоступно в этом окружении
          </div>
        )}
        {!loaded && !failed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div className="loading-spinner" style={{ marginRight: 8 }} />
            <span style={{ fontSize: 13, fontWeight:700, color: '#fff' }}>Загрузка 3D модели…</span>
          </div>
        )}
        {hoverInfo && !selectedSystem && !failed && (() => {
          const o = organMap[hoverInfo.id];
          const pct = o ? o.afterPercent : 0;
          return (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(0,0,0,0.85)', color: '#fff',
              padding: '6px 10px', borderRadius: 6, fontSize: 12,
              pointerEvents: 'none', zIndex: 10,
              border: `1px solid ${riskColor(pct)}55`,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>
                {TZ_SYSTEM_ICONS[hoverInfo.id]} {o ? o.name : hoverInfo.label}
              </div>
              <span style={{ color: riskColor(pct), fontWeight: 700 }}>
                {Math.round(pct)}%
              </span>
              <span style={{ color: '#fff', marginLeft: 4 }}>
                риск · {o ? o.mechanisms.length : 0} мех.
              </span>
            </div>
          );
        })()}
      </div>
      )}

      {/* Chip buttons — APK PRO: 44px, белый */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <button onClick={() => setShowOrgans(v => !v)} aria-pressed={showOrgans} style={{
          display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '10px 16px', borderRadius: 999,
          fontSize: 13, fontWeight: 800, cursor: 'pointer',
          background: showOrgans ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${showOrgans ? '#00e68a' : 'rgba(255,255,255,0.10)'}`,
          color: '#fff',
          transition: 'all 0.15s',
        }}>
          🫀 Органы · рентген {showOrgans ? 'вкл' : 'выкл'}
        </button>
        {systemList.map(o => {
          const isSel = selectedSystem === o.system;
          return (
            <button key={o.system} onClick={() => handleChipClick(o.system)} style={{
              display: 'flex', alignItems: 'center', gap: 6, minHeight:44, padding: '10px 16px', borderRadius: 999,
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              background: isSel ? o.color + '26' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isSel ? o.color : 'rgba(255,255,255,0.10)'}`,
              color: '#fff',
              transition: 'all 0.15s',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
              {o.label} <span style={{ fontWeight: 800 }}>{o.riskPct}%</span>
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
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{info.label}</span>
              <button onClick={() => handleChipClick(selectedSystem)} aria-label="Закрыть" style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', cursor: 'pointer', fontSize: 14, minWidth:44, minHeight:44, borderRadius:999,
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
            <div style={{ fontSize: 12, color: '#fff', marginTop: 4, lineHeight:1.5 }}>{info.description}</div>
          </div>
        );
      })()}

      <div style={{ fontSize: 12, color: '#fff', textAlign: 'center', marginTop: 10, lineHeight:1.5 }}>
        🖱 Клик по зоне или органу · Вращайте · Колёсико для зума · Клик по чипу для деталей
      </div>
      <div style={{ fontSize: 12, color: '#fff', textAlign: 'center', marginTop: 4 }}>
        Тело: 3dUVpro (CC-BY) · Селезёнка/простата/яичники: HuBMAP CCF (CC-BY 4.0) · Мозг, сердце, печень, почки и матка — схематичные формы по анатомическим пропорциям. Цветом подсвечены только органы: цвет = риск системы
      </div>
    </div>
  );
};

export default TZRisk3DModel;

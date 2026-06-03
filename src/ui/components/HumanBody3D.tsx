import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { getRiskColor } from '../../core/utils/risk-colors';

interface HumanBody3DProps {
  systems: Record<string, { raw: number; net: number }>;
  selectedSystem: string | null;
  onSelectSystem: (system: string) => void;
  size?: number;
  selectedOrgan?: string | null;
  onSelectOrgan?: (organ: string) => void;
}

function createHeartShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.5);
  shape.bezierCurveTo(0, 0.8, 0.45, 0.8, 0.45, 0.45);
  shape.bezierCurveTo(0.45, 0.25, 0.25, 0.05, 0, -0.3);
  shape.bezierCurveTo(-0.25, 0.05, -0.45, 0.25, -0.45, 0.45);
  shape.bezierCurveTo(-0.45, 0.8, 0, 0.8, 0, 0.5);
  return shape;
}

const SYSTEM_ICONS: Record<string, string> = {
  cardio: '❤️', hepatic: '🫁', renal: '🫘', neuro: '🧠',
  endocrine: '🦋', hematologic: '🩸', reproductive: '🍆', musculoskeletal: '🦴',
};

const ORGAN_DESCS: Record<string, string> = {
  heart: 'Сердце — главный насос кровеносной системы',
  aorta: 'Аорта — крупнейшая артерия, распределяющая кровь',
  lung_l: 'Левое лёгкое — газообмен O₂/CO₂',
  lung_r: 'Правое лёгкое — gas exchange',
  liver: 'Печень — детоксикация, метаболизм, синтез белков',
  gallbladder: 'Жёлчный пузырь — хранение и выброс жёлчи',
  stomach: 'Желудок — переваривание пищи',
  intestine: 'Кишечник — всасывание нутриентов',
  left_kidney: 'Левая почка — фильтрация крови',
  right_kidney: 'Правая почка — фильтрация крови',
  bladder: 'Мочевой пузырь — накопление мочи',
  brain: 'Головной мозг — ЦНС, управление организмом',
  cerebellum: 'Мозжечок — координация движений',
  spine: 'Спинной мозг — проводящие пути',
  thyroid: 'Щитовидная железа — T3/T4, метаболизм',
  left_adrenal: 'Левый надпочечник — кортизол, адреналин',
  right_adrenal: 'Правый надпочечник — кортизол, адреналин',
  pancreas: 'Поджелудочная — инсулин, глюкагон',
  pituitary: 'Гипофиз — мастер-железа, гормональный контроль',
  bone_marrow: 'Костный мозг — кроветворение',
  spleen: 'Селезёнка — фильтрация крови, иммунитет',
  left_testis: 'Левое яичко — сперматогенез, тестостерон',
  right_testis: 'Правое яичко — сперматогенез, тестостерон',
  prostate: 'Простата — секреция простатической жидкости',
  knee_joint: 'Коленный сустав — амортизация, движение',
  left_shoulder: 'Левое плечо — вращательная манжета',
  right_shoulder: 'Правое плечо — вращательная манжета',
  vertebra_l: 'Поясничный позвонок',
  vertebra_t: 'Грудной позвонок',
  vertebra_c: 'Шейный позвонок',
};

const HumanBody3D: React.FC<HumanBody3DProps> = ({ systems, selectedSystem, onSelectSystem, size = 340, selectedOrgan, onSelectOrgan }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshMapRef = useRef<Record<string, THREE.Mesh>>({});
  const organMeshesRef = useRef<THREE.Mesh[]>([]);
  const organSystemMapRef = useRef<Record<string, string>>({});
  const organLabelsRef = useRef<Record<string, string>>({});
  const animMeshesRef = useRef<Record<string, THREE.Mesh>>({});
  const [hoveredOrgan, setHoveredOrgan] = React.useState<string | null>(null);
  const animIdRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    while (container.firstChild) container.removeChild(container.firstChild);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.Fog(0x0a0a12, 8, 16);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, size / (size * 1.35), 0.1, 100);
    camera.position.set(0, 0.5, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size * 1.35);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(4, 6, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0x4488ff, 0.25);
    dirLight2.position.set(-3, -2, 3);
    scene.add(dirLight2);
    const rimLight = new THREE.DirectionalLight(0x00e68a, 0.15);
    rimLight.position.set(0, 0, -5);
    scene.add(rimLight);

    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e, shininess: 60, transparent: true, opacity: 0.45, specular: 0x333366 });
    const bodyGroup = new THREE.Group();

    const headGeom = new THREE.SphereGeometry(0.42, 20, 20);
    const head = new THREE.Mesh(headGeom, bodyMat.clone());
    head.position.set(0, 2.85, 0);
    bodyGroup.add(head);

    const neckGeom = new THREE.CylinderGeometry(0.14, 0.18, 0.3, 10);
    const neck = new THREE.Mesh(neckGeom, bodyMat.clone());
    neck.position.set(0, 2.45, 0);
    bodyGroup.add(neck);

    const torsoGeom = new THREE.CylinderGeometry(0.55, 0.38, 2.0, 14);
    const torso = new THREE.Mesh(torsoGeom, bodyMat.clone());
    torso.position.set(0, 1.15, 0);
    bodyGroup.add(torso);

    const pelvisGeom = new THREE.SphereGeometry(0.45, 12, 8);
    const pelvis = new THREE.Mesh(pelvisGeom, bodyMat.clone());
    pelvis.scale.set(1, 0.35, 0.75);
    pelvis.position.set(0, -0.1, 0);
    bodyGroup.add(pelvis);

    const armGeom = new THREE.CylinderGeometry(0.11, 0.09, 1.7, 8);
    const leftArm = new THREE.Mesh(armGeom, bodyMat.clone());
    leftArm.position.set(-0.72, 1.25, 0);
    leftArm.rotation.z = 0.12;
    bodyGroup.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom.clone(), bodyMat.clone());
    rightArm.position.set(0.72, 1.25, 0);
    rightArm.rotation.z = -0.12;
    bodyGroup.add(rightArm);

    const forearmGeom = new THREE.CylinderGeometry(0.09, 0.07, 1.5, 8);
    const leftForearm = new THREE.Mesh(forearmGeom, bodyMat.clone());
    leftForearm.position.set(-0.78, 0.1, 0);
    leftForearm.rotation.z = 0.05;
    bodyGroup.add(leftForearm);
    const rightForearm = new THREE.Mesh(forearmGeom.clone(), bodyMat.clone());
    rightForearm.position.set(0.78, 0.1, 0);
    rightForearm.rotation.z = -0.05;
    bodyGroup.add(rightForearm);

    const legGeom = new THREE.CylinderGeometry(0.15, 0.11, 2.3, 10);
    const leftLeg = new THREE.Mesh(legGeom, bodyMat.clone());
    leftLeg.position.set(-0.25, -1.55, 0);
    bodyGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom.clone(), bodyMat.clone());
    rightLeg.position.set(0.25, -1.55, 0);
    bodyGroup.add(rightLeg);

    const calfGeom = new THREE.CylinderGeometry(0.11, 0.08, 2.1, 10);
    const leftCalf = new THREE.Mesh(calfGeom, bodyMat.clone());
    leftCalf.position.set(-0.25, -3.0, 0);
    bodyGroup.add(leftCalf);
    const rightCalf = new THREE.Mesh(calfGeom.clone(), bodyMat.clone());
    rightCalf.position.set(0.25, -3.0, 0);
    bodyGroup.add(rightCalf);

    scene.add(bodyGroup);

    const organMat = (color: number, emissive: number, opacity = 0.92) => new THREE.MeshPhongMaterial({
      color, emissive, shininess: 90, transparent: true, opacity, specular: 0x444444,
    });

    const organMeshes: THREE.Mesh[] = [];
    const organSystemMap: Record<string, string> = {};
    const organLabels: Record<string, string> = {};
    const animMeshes: Record<string, THREE.Mesh> = {};

    const addOrgan = (mesh: THREE.Mesh, system: string, organ: string, label: string, animKey?: string) => {
      mesh.userData = { system, organ, label };
      scene.add(mesh);
      organMeshes.push(mesh);
      organSystemMap[organ] = system;
      organLabels[organ] = label;
      if (animKey) animMeshes[animKey] = mesh;
    };

    // === CARDIO ===
    const heartGeom = new THREE.ExtrudeGeometry(createHeartShape(), { depth: 0.35, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.02 });
    heartGeom.translate(0, 0, -0.175);
    const heart = new THREE.Mesh(heartGeom, organMat(0xff3344, 0x551111));
    heart.position.set(0.12, 1.45, 0.35);
    addOrgan(heart, 'cardio', 'heart', 'Сердце', 'heart');
    meshMapRef.current['cardio'] = heart;

    const aortaGeom = new THREE.CylinderGeometry(0.04, 0.035, 2.8, 8);
    const aorta = new THREE.Mesh(aortaGeom, organMat(0xcc2233, 0x331111));
    aorta.position.set(0.05, 1.0, 0.5);
    addOrgan(aorta, 'cardio', 'aorta', 'Аорта');

    const lungGeom = new THREE.SphereGeometry(0.55, 16, 12);
    lungGeom.scale(1.0, 1.6, 0.9);
    const leftLung = new THREE.Mesh(lungGeom, organMat(0xff9999, 0x331515, 0.85));
    leftLung.position.set(-0.35, 1.4, 0.15);
    addOrgan(leftLung, 'cardio', 'lung_l', 'Левое лёгкое', 'lung_l');
    const rightLung = new THREE.Mesh(lungGeom.clone(), organMat(0xff9999, 0x331515, 0.85));
    rightLung.position.set(0.35, 1.4, 0.15);
    addOrgan(rightLung, 'cardio', 'lung_r', 'Правое лёгкое', 'lung_r');

    // === HEPATIC ===
    const liverGeom = new THREE.SphereGeometry(1.0, 16, 12);
    liverGeom.scale(1.2, 0.55, 0.75);
    const liver = new THREE.Mesh(liverGeom, organMat(0x8b4513, 0x2a1100));
    liver.position.set(-0.1, 0.85, 0.18);
    addOrgan(liver, 'hepatic', 'liver', 'Печень');
    meshMapRef.current['hepatic'] = liver;

    const gallGeom = new THREE.SphereGeometry(0.08, 8, 8);
    gallGeom.scale(0.6, 1.3, 0.8);
    const gallbladder = new THREE.Mesh(gallGeom, organMat(0x55aa44, 0x112211));
    gallbladder.position.set(-0.5, 0.65, 0.3);
    addOrgan(gallbladder, 'hepatic', 'gallbladder', 'Жёлчный пузырь');

    const stomachGeom = new THREE.SphereGeometry(0.35, 12, 10);
    stomachGeom.scale(0.9, 1.1, 0.7);
    const stomach = new THREE.Mesh(stomachGeom, organMat(0xddaa77, 0x332211));
    stomach.position.set(0.15, 0.55, 0.3);
    addOrgan(stomach, 'hepatic', 'stomach', 'Желудок');

    const intestineGeom = new THREE.TorusGeometry(0.3, 0.06, 8, 20);
    const intestine = new THREE.Mesh(intestineGeom, organMat(0xcc9966, 0x221100));
    intestine.position.set(0, 0.0, 0.35);
    intestine.rotation.x = Math.PI / 2;
    addOrgan(intestine, 'hepatic', 'intestine', 'Кишечник');

    // === RENAL ===
    const kidneyGeom = new THREE.SphereGeometry(0.35, 12, 12);
    kidneyGeom.scale(1.2, 0.65, 0.8);
    const leftKidney = new THREE.Mesh(kidneyGeom, organMat(0xaa4444, 0x221111));
    leftKidney.position.set(-0.45, 0.15, 0.15);
    addOrgan(leftKidney, 'renal', 'left_kidney', 'Левая почка', 'left_kidney');
    const rightKidney = new THREE.Mesh(kidneyGeom.clone(), organMat(0xaa4444, 0x221111));
    rightKidney.position.set(0.45, 0.15, 0.15);
    addOrgan(rightKidney, 'renal', 'right_kidney', 'Правая почка', 'right_kidney');
    meshMapRef.current['renal'] = leftKidney;

    const bladder = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), organMat(0xddaa55, 0x332200));
    bladder.position.set(0, -0.5, 0.2);
    addOrgan(bladder, 'renal', 'bladder', 'Мочевой пузырь');

    // === NEURO ===
    const brainGeom = new THREE.IcosahedronGeometry(0.38, 2);
    const pos = brainGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const offset = (Math.random() - 0.5) * 0.05;
      pos.setX(i, pos.getX(i) + offset);
      pos.setY(i, pos.getY(i) + offset);
    }
    pos.needsUpdate = true;
    const brain = new THREE.Mesh(brainGeom, organMat(0xffaa88, 0x332211));
    brain.position.set(0, 3.02, 0.05);
    addOrgan(brain, 'neuro', 'brain', 'Мозг', 'brain');
    meshMapRef.current['neuro'] = brain;

    const cerebellumGeom = new THREE.SphereGeometry(0.18, 10, 8);
    cerebellumGeom.scale(1.0, 0.7, 0.8);
    const cerebellum = new THREE.Mesh(cerebellumGeom, organMat(0xeebb99, 0x221100));
    cerebellum.position.set(0, 2.72, -0.15);
    addOrgan(cerebellum, 'neuro', 'cerebellum', 'Мозжечок');

    const spineGeom = new THREE.CylinderGeometry(0.055, 0.055, 3.0, 8);
    const spine = new THREE.Mesh(spineGeom, organMat(0xccccaa, 0x222222));
    spine.position.set(0, 0.5, -0.25);
    addOrgan(spine, 'neuro', 'spine', 'Спинной мозг');

    // === ENDOCRINE ===
    const thyroidGeom = new THREE.SphereGeometry(0.14, 10, 10);
    thyroidGeom.scale(1.3, 0.55, 0.75);
    const thyroid = new THREE.Mesh(thyroidGeom, organMat(0xaa6688, 0x221122));
    thyroid.position.set(0, 2.32, 0.28);
    addOrgan(thyroid, 'endocrine', 'thyroid', 'Щитовидная железа');
    meshMapRef.current['endocrine'] = thyroid;

    const adrenalGeom = new THREE.SphereGeometry(0.08, 8, 8);
    adrenalGeom.scale(1.3, 0.65, 0.85);
    const leftAdrenal = new THREE.Mesh(adrenalGeom, organMat(0xcc8844, 0x332200));
    leftAdrenal.position.set(-0.42, 0.22, 0.2);
    addOrgan(leftAdrenal, 'endocrine', 'left_adrenal', 'Левый надпочечник');
    const rightAdrenal = new THREE.Mesh(adrenalGeom.clone(), organMat(0xcc8844, 0x332200));
    rightAdrenal.position.set(0.42, 0.22, 0.2);
    addOrgan(rightAdrenal, 'endocrine', 'right_adrenal', 'Правый надпочечник');

    const pancreasGeom = new THREE.CylinderGeometry(0.07, 0.11, 0.85, 8);
    const pancreas = new THREE.Mesh(pancreasGeom, organMat(0xddbb88, 0x332211));
    pancreas.position.set(0.12, 0.5, 0.3);
    pancreas.rotation.z = 0.6;
    addOrgan(pancreas, 'endocrine', 'pancreas', 'Поджелудочная');

    const pituitaryGeom = new THREE.SphereGeometry(0.06, 8, 8);
    const pituitary = new THREE.Mesh(pituitaryGeom, organMat(0xdd88aa, 0x331122));
    pituitary.position.set(0, 2.68, 0.22);
    addOrgan(pituitary, 'endocrine', 'pituitary', 'Гипофиз');

    // === HEMATOLOGIC ===
    const marrowGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8);
    const marrow = new THREE.Mesh(marrowGeom, organMat(0xcc3344, 0x331111));
    marrow.position.set(0, 0.5, 0.42);
    addOrgan(marrow, 'hematologic', 'bone_marrow', 'Костный мозг');
    meshMapRef.current['hematologic'] = marrow;

    const spleenGeom = new THREE.SphereGeometry(0.2, 10, 10);
    spleenGeom.scale(0.75, 1.0, 0.5);
    const spleen = new THREE.Mesh(spleenGeom, organMat(0x993344, 0x221111));
    spleen.position.set(-0.55, 0.85, 0.15);
    addOrgan(spleen, 'hematologic', 'spleen', 'Селезёнка');

    // === REPRODUCTIVE ===
    const testisGeom = new THREE.SphereGeometry(0.15, 12, 12);
    const leftTestis = new THREE.Mesh(testisGeom, organMat(0xdd8844, 0x332200));
    leftTestis.position.set(-0.15, -0.32, 0.15);
    addOrgan(leftTestis, 'reproductive', 'left_testis', 'Левое яичко');
    const rightTestis = new THREE.Mesh(testisGeom.clone(), organMat(0xdd8844, 0x332200));
    rightTestis.position.set(0.15, -0.32, 0.15);
    addOrgan(rightTestis, 'reproductive', 'right_testis', 'Правое яичко');
    meshMapRef.current['reproductive'] = leftTestis;

    const prostateGeom = new THREE.SphereGeometry(0.1, 10, 10);
    const prostate = new THREE.Mesh(prostateGeom, organMat(0xcc8866, 0x221100));
    prostate.position.set(0, -0.18, 0.2);
    addOrgan(prostate, 'reproductive', 'prostate', 'Простата');

    // === MUSCULOSKELETAL ===
    const jointGeom = new THREE.SphereGeometry(0.2, 12, 12);
    jointGeom.scale(1.4, 0.6, 1.0);
    const kneeJoint = new THREE.Mesh(jointGeom, organMat(0xddddcc, 0x222222));
    kneeJoint.position.set(-0.25, -0.7, 0.35);
    addOrgan(kneeJoint, 'musculoskeletal', 'knee_joint', 'Коленный сустав');
    meshMapRef.current['musculoskeletal'] = kneeJoint;

    const shoulderGeom = new THREE.SphereGeometry(0.16, 10, 10);
    const leftShoulder = new THREE.Mesh(shoulderGeom, organMat(0xccccbb, 0x222222));
    leftShoulder.position.set(-0.66, 1.95, 0.08);
    addOrgan(leftShoulder, 'musculoskeletal', 'left_shoulder', 'Левое плечо');
    const rightShoulder = new THREE.Mesh(shoulderGeom.clone(), organMat(0xccccbb, 0x222222));
    rightShoulder.position.set(0.66, 1.95, 0.08);
    addOrgan(rightShoulder, 'musculoskeletal', 'right_shoulder', 'Правое плечо');

    const vertGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.15, 8);
    const vl = new THREE.Mesh(vertGeom, organMat(0xccccbb, 0x222222));
    vl.position.set(0, -0.3, -0.2);
    addOrgan(vl, 'musculoskeletal', 'vertebra_l', 'Поясничный позвонок');
    const vt = new THREE.Mesh(vertGeom.clone(), organMat(0xccccbb, 0x222222));
    vt.position.set(0, 0.7, -0.2);
    addOrgan(vt, 'musculoskeletal', 'vertebra_t', 'Грудной позвонок');
    const vc = new THREE.Mesh(vertGeom.clone(), organMat(0xccccbb, 0x222222));
    vc.position.set(0, 2.0, -0.15);
    addOrgan(vc, 'musculoskeletal', 'vertebra_c', 'Шейный позвонок');

    organMeshesRef.current = organMeshes;
    organSystemMapRef.current = organSystemMap;
    organLabelsRef.current = organLabels;
    animMeshesRef.current = animMeshes;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(organMeshes);
      if (intersects.length > 0) {
        const ud = intersects[0].object.userData;
        if (ud.system) {
          onSelectSystem(ud.system);
          if (onSelectOrgan && ud.organ) onSelectOrgan(ud.organ);
        }
      }
    };

    const handleHover = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(organMeshes);
      const newHovered = intersects.length > 0 ? intersects[0].object.userData.organ : null;
      setHoveredOrgan(newHovered);
      containerRef.current.style.cursor = newHovered ? 'pointer' : 'default';
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('mousemove', handleHover);

    const startTime = Date.now();
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);
      const t = (Date.now() - startTime) * 0.001;

      bodyGroup.rotation.y += 0.002;

      for (const mesh of organMeshes) {
        mesh.rotation.y += 0.002;
      }

      const heartBeat = 0.04 * Math.sin(t * 4.5);
      if (animMeshes['heart']) {
        animMeshes['heart'].scale.setScalar(1 + heartBeat);
      }

      const breathScale = 0.08 * Math.sin(t * 0.8);
      if (animMeshes['lung_l']) {
        animMeshes['lung_l'].scale.set(1, 1 + breathScale, 1);
      }
      if (animMeshes['lung_r']) {
        animMeshes['lung_r'].scale.set(1, 1 + breathScale, 1);
      }

      const kidneyPulse = 0.03 * Math.sin(t * 3);
      if (animMeshes['left_kidney']) {
        animMeshes['left_kidney'].scale.set(1 + kidneyPulse, 1, 1 + kidneyPulse);
      }
      if (animMeshes['right_kidney']) {
        animMeshes['right_kidney'].scale.set(1 + kidneyPulse, 1, 1 + kidneyPulse);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animIdRef.current);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousemove', handleHover);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, [size, onSelectSystem, onSelectOrgan]);

  useEffect(() => {
    for (const [sys, mesh] of Object.entries(meshMapRef.current)) {
      const riskData = systems[sys];
      const riskLevel = riskData ? riskData.net : 0;
      const isSelected = selectedSystem === sys;
      const mat = mesh.material as THREE.MeshPhongMaterial;

      if (isSelected) {
        mat.emissive.setHex(0x00e68a);
        mat.emissiveIntensity = 0.6;
        mat.opacity = 1.0;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.color.set(getRiskColor(riskLevel));
        mat.opacity = riskLevel > 0 ? 0.92 : 0.45;
      }
      mat.needsUpdate = true;
    }

    for (const mesh of organMeshesRef.current) {
      const sys = mesh.userData.system;
      const organ = mesh.userData.organ;
      const riskData = systems[sys];
      const riskLevel = riskData ? riskData.net : 0;
      const isSelected = selectedSystem === sys;
      const isHovered = hoveredOrgan === organ;
      const mat = mesh.material as THREE.MeshPhongMaterial;

      if (isSelected) {
        mat.emissive.setHex(0x00e68a);
        mat.emissiveIntensity = 0.4;
      } else if (isHovered) {
        mat.emissive.setHex(0x44aaff);
        mat.emissiveIntensity = 0.3;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }

      if (sys === selectedSystem) {
        mat.opacity = 1.0;
      } else {
        mat.opacity = riskLevel > 0 ? 0.9 : 0.45;
      }
      mat.needsUpdate = true;
    }
  }, [systems, selectedSystem, hoveredOrgan]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div ref={containerRef} style={{ width: size, height: Math.round(size * 1.35), borderRadius: 12, overflow: 'hidden' }} />
      {hoveredOrgan && ORGAN_DESCS[hoveredOrgan] && (
        <div style={{
          position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '6px 10px',
          borderRadius: 6, fontSize: 11, maxWidth: 200, pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{organLabelsRef.current[hoveredOrgan] || hoveredOrgan}</div>
          <div style={{ color: '#aaa', fontSize: 10 }}>{ORGAN_DESCS[hoveredOrgan]}</div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap', padding: '0 4px' }}>
        {Object.entries(SYSTEM_ICONS).map(([sys, icon]) => {
          const riskData = systems[sys];
          const net = riskData ? Math.round(riskData.net) : 0;
          const isSelected = selectedSystem === sys;
          return (
            <button
              key={sys}
              onClick={() => onSelectSystem(sys)}
              style={{
                padding: '2px 5px', border: isSelected ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4, background: isSelected ? 'rgba(0,230,138,0.15)' : 'rgba(0,0,0,0.4)',
                color: riskData ? getRiskColor(net) : '#666', fontSize: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' as const,
              }}
            >
              <span>{icon}</span>
              <span>{net}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HumanBody3D;
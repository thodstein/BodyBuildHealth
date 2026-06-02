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

interface OrganDef {
  key: string;
  system: string;
  label: string;
  build: () => THREE.Mesh;
}

const ORGAN_DEFS: OrganDef[] = [];

const HumanBody3D: React.FC<HumanBody3DProps> = ({ systems, selectedSystem, onSelectSystem, size = 340, selectedOrgan, onSelectOrgan }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshMapRef = useRef<Record<string, THREE.Mesh>>({});

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, size / (size * 1.3), 0.1, 100);
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size * 1.3);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0x4488ff, 0.3);
    dirLight2.position.set(-3, -2, 2);
    scene.add(dirLight2);

    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x2a2a3a, shininess: 40, transparent: true, opacity: 0.6 });
    const wireMaterial = new THREE.LineBasicMaterial({ color: 0x3a3a4a, transparent: true, opacity: 0.4 });

    const bodyGroup = new THREE.Group();

    const headGeom = new THREE.SphereGeometry(0.45, 16, 16);
    const head = new THREE.Mesh(headGeom, bodyMaterial.clone());
    head.position.set(0, 2.8, 0);
    bodyGroup.add(head);

    const torsoGeom = new THREE.CylinderGeometry(0.55, 0.4, 2.2, 12);
    const torso = new THREE.Mesh(torsoGeom, bodyMaterial.clone());
    torso.position.set(0, 1.1, 0);
    bodyGroup.add(torso);

    const pelvisGeom = new THREE.SphereGeometry(0.5, 12, 8);
    const pelvis = new THREE.Mesh(pelvisGeom, bodyMaterial.clone());
    pelvis.scale.set(1, 0.4, 0.8);
    pelvis.position.set(0, -0.15, 0);
    bodyGroup.add(pelvis);

    const leftArmGeom = new THREE.CylinderGeometry(0.12, 0.1, 1.8, 8);
    const leftArm = new THREE.Mesh(leftArmGeom, bodyMaterial.clone());
    leftArm.position.set(-0.75, 1.2, 0);
    leftArm.rotation.z = 0.1;
    bodyGroup.add(leftArm);

    const rightArm = new THREE.Mesh(leftArmGeom.clone(), bodyMaterial.clone());
    rightArm.position.set(0.75, 1.2, 0);
    rightArm.rotation.z = -0.1;
    bodyGroup.add(rightArm);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 1.5, 8), bodyMaterial.clone());
    leftForearm.position.set(-0.8, 0.0, 0);
    leftForearm.rotation.z = 0.05;
    bodyGroup.add(leftForearm);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 1.5, 8), bodyMaterial.clone());
    rightForearm.position.set(0.8, 0.0, 0);
    rightForearm.rotation.z = -0.05;
    bodyGroup.add(rightForearm);

    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 2.2, 8), bodyMaterial.clone());
    leftLeg.position.set(-0.3, -1.5, 0);
    bodyGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 2.2, 8), bodyMaterial.clone());
    rightLeg.position.set(0.3, -1.5, 0);
    bodyGroup.add(rightLeg);

    const leftCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 2.0, 8), bodyMaterial.clone());
    leftCalf.position.set(-0.3, -3.0, 0);
    bodyGroup.add(leftCalf);

    const rightCalf = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 2.0, 8), bodyMaterial.clone());
    rightCalf.position.set(0.3, -3.0, 0);
    bodyGroup.add(rightCalf);

    scene.add(bodyGroup);

    const organMaterial = (color: number, emissive: number) => new THREE.MeshPhongMaterial({
      color, emissive, shininess: 80, transparent: true, opacity: 0.9,
    });

    const organMeshes: THREE.Mesh[] = [];
    const organSystemMap: Record<string, string> = {};
    const organLabels: Record<string, string> = {};

    const heartGeom = new THREE.ExtrudeGeometry(createHeartShape(), { depth: 0.3, bevelEnabled: true, bevelSize: 0.05 });
    heartGeom.translate(0, 0, -0.15);
    const heart = new THREE.Mesh(heartGeom, organMaterial(0xff3344, 0x441111));
    heart.position.set(0.15, 1.4, 0.35);
    heart.userData = { system: 'cardio', organ: 'heart', label: 'Сердце' };
    scene.add(heart); organMeshes.push(heart);
    meshMapRef.current['cardio'] = heart;
    organSystemMap['heart'] = 'cardio'; organLabels['heart'] = 'Сердце';

    const vascularGeom = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6);
    const aorta = new THREE.Mesh(vascularGeom, organMaterial(0xcc2233, 0x331111));
    aorta.position.set(0.05, 1.0, 0.5);
    aorta.userData = { system: 'cardio', organ: 'aorta', label: 'Аорта' };
    scene.add(aorta); organMeshes.push(aorta);
    organSystemMap['aorta'] = 'cardio'; organLabels['aorta'] = 'Аорта';

    const liverGeom = new THREE.SphereGeometry(1, 16, 12);
    liverGeom.scale(1.0, 0.6, 0.7);
    const liver = new THREE.Mesh(liverGeom, organMaterial(0x8b4513, 0x221100));
    liver.position.set(-0.2, 0.8, 0.2);
    liver.userData = { system: 'hepatic', organ: 'liver', label: 'Печень' };
    scene.add(liver); organMeshes.push(liver);
    meshMapRef.current['hepatic'] = liver;
    organSystemMap['liver'] = 'hepatic'; organLabels['liver'] = 'Печень';

    const gallGeom = new THREE.SphereGeometry(0.1, 8, 8);
    gallGeom.scale(0.7, 1.2, 0.8);
    const gallbladder = new THREE.Mesh(gallGeom, organMaterial(0x55aa44, 0x112211));
    gallbladder.position.set(-0.55, 0.6, 0.35);
    gallbladder.userData = { system: 'hepatic', organ: 'gallbladder', label: 'Жёлчный пузырь' };
    scene.add(gallbladder); organMeshes.push(gallbladder);
    organSystemMap['gallbladder'] = 'hepatic'; organLabels['gallbladder'] = 'Жёлчный пузырь';

    const kidneyGeom = new THREE.SphereGeometry(0.35, 12, 12);
    kidneyGeom.scale(1.2, 0.7, 0.8);
    const leftKidney = new THREE.Mesh(kidneyGeom, organMaterial(0xaa4444, 0x221111));
    leftKidney.position.set(-0.45, 0.1, 0.15);
    leftKidney.userData = { system: 'renal', organ: 'left_kidney', label: 'Левая почка' };
    scene.add(leftKidney);

    const rightKidney = new THREE.Mesh(kidneyGeom.clone(), organMaterial(0xaa4444, 0x221111));
    rightKidney.position.set(0.45, 0.1, 0.15);
    rightKidney.userData = { system: 'renal', organ: 'right_kidney', label: 'Правая почка' };
    scene.add(rightKidney);
    meshMapRef.current['renal'] = leftKidney;
    organSystemMap['left_kidney'] = 'renal'; organLabels['left_kidney'] = 'Левая почка';
    organSystemMap['right_kidney'] = 'renal'; organLabels['right_kidney'] = 'Правая почка';

    const bladderGeom = new THREE.SphereGeometry(0.2, 10, 10);
    const bladder = new THREE.Mesh(bladderGeom, organMaterial(0xddaa55, 0x332200));
    bladder.position.set(0, -0.5, 0.2);
    bladder.userData = { system: 'renal', organ: 'bladder', label: 'Мочевой пузырь' };
    scene.add(bladder); organMeshes.push(bladder);
    organSystemMap['bladder'] = 'renal'; organLabels['bladder'] = 'Мочевой пузырь';

    const brainGeom = new THREE.IcosahedronGeometry(0.35, 2);
    const pos = brainGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const offset = (Math.random() - 0.5) * 0.06;
      pos.setX(i, pos.getX(i) + offset);
      pos.setY(i, pos.getY(i) + offset);
    }
    pos.needsUpdate = true;
    const brain = new THREE.Mesh(brainGeom, organMaterial(0xffaa88, 0x332211));
    brain.position.set(0, 3.05, 0.05);
    brain.userData = { system: 'neuro', organ: 'brain', label: 'Мозг' };
    scene.add(brain); organMeshes.push(brain);
    meshMapRef.current['neuro'] = brain;
    organSystemMap['brain'] = 'neuro'; organLabels['brain'] = 'Мозг';

    const spineGeom = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8);
    const spine = new THREE.Mesh(spineGeom, organMaterial(0xccccaa, 0x222222));
    spine.position.set(0, 0.8, -0.2);
    spine.userData = { system: 'neuro', organ: 'spine', label: 'Спинной мозг' };
    scene.add(spine); organMeshes.push(spine);
    organSystemMap['spine'] = 'neuro'; organLabels['spine'] = 'Спинной мозг';

    const thyroidGeom = new THREE.SphereGeometry(0.15, 10, 10);
    thyroidGeom.scale(1.3, 0.6, 0.8);
    const thyroid = new THREE.Mesh(thyroidGeom, organMaterial(0xaa6688, 0x221122));
    thyroid.position.set(0, 2.25, 0.3);
    thyroid.userData = { system: 'endocrine', organ: 'thyroid', label: 'Щитовидная железа' };
    scene.add(thyroid); organMeshes.push(thyroid);
    meshMapRef.current['endocrine'] = thyroid;
    organSystemMap['thyroid'] = 'endocrine'; organLabels['thyroid'] = 'Щитовидная железа';

    const adrenalGeom = new THREE.SphereGeometry(0.1, 8, 8);
    adrenalGeom.scale(1.3, 0.7, 0.9);
    const leftAdrenal = new THREE.Mesh(adrenalGeom, organMaterial(0xcc8844, 0x332200));
    leftAdrenal.position.set(-0.42, 0.35, 0.2);
    leftAdrenal.userData = { system: 'endocrine', organ: 'left_adrenal', label: 'Левый надпочечник' };
    scene.add(leftAdrenal); organMeshes.push(leftAdrenal);
    organSystemMap['left_adrenal'] = 'endocrine'; organLabels['left_adrenal'] = 'Левый надпочечник';

    const rightAdrenal = new THREE.Mesh(adrenalGeom.clone(), organMaterial(0xcc8844, 0x332200));
    rightAdrenal.position.set(0.42, 0.35, 0.2);
    rightAdrenal.userData = { system: 'endocrine', organ: 'right_adrenal', label: 'Правый надпочечник' };
    scene.add(rightAdrenal); organMeshes.push(rightAdrenal);
    organSystemMap['right_adrenal'] = 'endocrine'; organLabels['right_adrenal'] = 'Правый надпочечник';

    const pancreasGeom = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8);
    const pancreas = new THREE.Mesh(pancreasGeom, organMaterial(0xddbb88, 0x332211));
    pancreas.position.set(0.1, 0.55, 0.3);
    pancreas.rotation.z = 0.6;
    pancreas.userData = { system: 'endocrine', organ: 'pancreas', label: 'Поджелудочная' };
    scene.add(pancreas); organMeshes.push(pancreas);
    organSystemMap['pancreas'] = 'endocrine'; organLabels['pancreas'] = 'Поджелудочная';

    const marrowGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
    const marrow = new THREE.Mesh(marrowGeom, organMaterial(0xcc3344, 0x331111));
    marrow.position.set(0, 0.5, 0.45);
    marrow.userData = { system: 'hematologic', organ: 'bone_marrow', label: 'Костный мозг' };
    scene.add(marrow); organMeshes.push(marrow);
    meshMapRef.current['hematologic'] = marrow;
    organSystemMap['bone_marrow'] = 'hematologic'; organLabels['bone_marrow'] = 'Костный мозг';

    const reprodGeom = new THREE.SphereGeometry(0.18, 12, 12);
    const testis_l = new THREE.Mesh(reprodGeom, organMaterial(0xdd8844, 0x332200));
    testis_l.position.set(-0.18, -0.35, 0.15);
    testis_l.userData = { system: 'reproductive', organ: 'left_testis', label: 'Левое яичко' };
    scene.add(testis_l); organMeshes.push(testis_l);
    organSystemMap['left_testis'] = 'reproductive'; organLabels['left_testis'] = 'Левое яичко';

    const testis_r = new THREE.Mesh(reprodGeom.clone(), organMaterial(0xdd8844, 0x332200));
    testis_r.position.set(0.18, -0.35, 0.15);
    testis_r.userData = { system: 'reproductive', organ: 'right_testis', label: 'Правое яичко' };
    scene.add(testis_r); organMeshes.push(testis_r);
    meshMapRef.current['reproductive'] = testis_l;
    organSystemMap['right_testis'] = 'reproductive'; organLabels['right_testis'] = 'Правое яичко';

    const prostateGeom = new THREE.SphereGeometry(0.12, 10, 10);
    const prostate = new THREE.Mesh(prostateGeom, organMaterial(0xcc8866, 0x221100));
    prostate.position.set(0, -0.2, 0.2);
    prostate.userData = { system: 'reproductive', organ: 'prostate', label: 'Простата' };
    scene.add(prostate); organMeshes.push(prostate);
    organSystemMap['prostate'] = 'reproductive'; organLabels['prostate'] = 'Простата';

    const jointsGeom = new THREE.SphereGeometry(0.22, 12, 12);
    jointsGeom.scale(1.4, 0.6, 1.0);
    const knee_joint = new THREE.Mesh(jointsGeom, organMaterial(0xddddcc, 0x222222));
    knee_joint.position.set(-0.3, -0.7, 0.4);
    knee_joint.userData = { system: 'musculoskeletal', organ: 'knee_joint', label: 'Коленный сустав' };
    scene.add(knee_joint); organMeshes.push(knee_joint);
    meshMapRef.current['musculoskeletal'] = knee_joint;
    organSystemMap['knee_joint'] = 'musculoskeletal'; organLabels['knee_joint'] = 'Коленный сустав';

    const shoulderGeom = new THREE.SphereGeometry(0.18, 10, 10);
    const shoulder_l = new THREE.Mesh(shoulderGeom, organMaterial(0xccccbb, 0x222222));
    shoulder_l.position.set(-0.68, 1.95, 0.1);
    shoulder_l.userData = { system: 'musculoskeletal', organ: 'left_shoulder', label: 'Левое плечо' };
    scene.add(shoulder_l); organMeshes.push(shoulder_l);
    organSystemMap['left_shoulder'] = 'musculoskeletal'; organLabels['left_shoulder'] = 'Левое плечо';

    const shoulder_r = new THREE.Mesh(shoulderGeom.clone(), organMaterial(0xccccbb, 0x222222));
    shoulder_r.position.set(0.68, 1.95, 0.1);
    shoulder_r.userData = { system: 'musculoskeletal', organ: 'right_shoulder', label: 'Правое плечо' };
    scene.add(shoulder_r); organMeshes.push(shoulder_r);
    organSystemMap['right_shoulder'] = 'musculoskeletal'; organLabels['right_shoulder'] = 'Правое плечо';

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
        const clickedMesh = intersects[0].object;
        const ud = clickedMesh.userData;
        if (ud.system) {
          onSelectSystem(ud.system);
          if (onSelectOrgan && ud.organ) onSelectOrgan(ud.organ);
        }
      }
    };

    containerRef.current.addEventListener('click', handleClick);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      bodyGroup.rotation.y += 0.003;
      for (const mesh of organMeshes) {
        mesh.rotation.y += 0.003;
      }
      const pulse = 0.02 * Math.sin(Date.now() * 0.003);
      if (meshMapRef.current['cardio']) {
        meshMapRef.current['cardio'].scale.setScalar(1 + pulse);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      containerRef.current?.removeEventListener('click', handleClick);
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
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
      const baseColor = getOrganBaseColor(sys);
      const riskColorHex = getRiskColor(riskLevel);

      if (isSelected) {
        mat.emissive.setHex(0x00e68a);
        mat.emissiveIntensity = 0.5;
        mat.opacity = 1.0;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.color.set(riskColorHex);
        mat.opacity = riskLevel > 0 ? 0.9 : 0.4;
      }
      mat.needsUpdate = true;
    }
  }, [systems, selectedSystem]);

  function getOrganBaseColor(sys: string): number {
    const colors: Record<string, number> = {
      cardio: 0xff3344, hepatic: 0x8b4513, renal: 0xaa4444,
      neuro: 0xffaa88, endocrine: 0xaa6688, hematologic: 0xcc3344,
      reproductive: 0xdd8844, musculoskeletal: 0xddddcc,
    };
    return colors[sys] || 0x888888;
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

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div ref={containerRef} style={{ width: size, height: size * 1.3, borderRadius: 12, overflow: 'hidden' }} />
      <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', padding: '0 4px' }}>
        {Object.entries(SYSTEM_ICONS).map(([sys, icon]) => {
          const riskData = systems[sys];
          const net = riskData ? Math.round(riskData.net) : 0;
          const isSelected = selectedSystem === sys;
          return (
            <button
              key={sys}
              onClick={() => onSelectSystem(sys)}
              style={{
                padding: '2px 5px',
                border: isSelected ? '1px solid #00e68a' : '1px solid var(--border)',
                borderRadius: 4,
                background: isSelected ? 'rgba(0,230,138,0.15)' : 'rgba(0,0,0,0.3)',
                color: riskData ? getRiskColor(net) : '#888',
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                whiteSpace: 'nowrap' as const,
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
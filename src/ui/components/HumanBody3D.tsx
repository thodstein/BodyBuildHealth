import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { getRiskColor } from '../screens/RiskScreen';

interface HumanBody3DProps {
  systems: Record<string, { raw: number; net: number }>;
  selectedSystem: string | null;
  onSelectSystem: (system: string) => void;
  size?: number;
}

const BODY_PARTS: Record<string, { mesh: THREE.Mesh; color: string }> = {};

const HumanBody3D: React.FC<HumanBody3DProps> = ({ systems, selectedSystem, onSelectSystem, size = 340 }) => {
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

    const heartGeom = new THREE.ExtrudeGeometry(createHeartShape(), { depth: 0.3, bevelEnabled: true, bevelSize: 0.05 });
    heartGeom.translate(0, 0, -0.15);
    const heart = new THREE.Mesh(heartGeom, organMaterial(0xff3344, 0x441111));
    heart.position.set(0.15, 1.4, 0.35);
    scene.add(heart);
    meshMapRef.current['cardio'] = heart;

    const liverGeom = new THREE.SphereGeometry(1, 16, 12);
    liverGeom.scale(1.0, 0.6, 0.7);
    const liver = new THREE.Mesh(liverGeom, organMaterial(0x8b4513, 0x221100));
    liver.position.set(-0.2, 0.8, 0.2);
    scene.add(liver);
    meshMapRef.current['hepatic'] = liver;

    const kidneyGeom = new THREE.SphereGeometry(0.35, 12, 12);
    kidneyGeom.scale(1.2, 0.7, 0.8);
    const leftKidney = new THREE.Mesh(kidneyGeom, organMaterial(0xaa4444, 0x221111));
    leftKidney.position.set(-0.45, 0.1, 0.15);
    scene.add(leftKidney);

    const rightKidney = new THREE.Mesh(kidneyGeom.clone(), organMaterial(0xaa4444, 0x221111));
    rightKidney.position.set(0.45, 0.1, 0.15);
    scene.add(rightKidney);
    meshMapRef.current['renal'] = leftKidney;

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
    scene.add(brain);
    meshMapRef.current['neuro'] = brain;

    const thyroidGeom = new THREE.SphereGeometry(0.15, 10, 10);
    thyroidGeom.scale(1.3, 0.6, 0.8);
    const thyroid = new THREE.Mesh(thyroidGeom, organMaterial(0xaa6688, 0x221122));
    thyroid.position.set(0, 2.25, 0.3);
    scene.add(thyroid);
    meshMapRef.current['endocrine'] = thyroid;

    const marrowGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
    const marrow = new THREE.Mesh(marrowGeom, organMaterial(0xcc3344, 0x331111));
    marrow.position.set(0, 0.5, 0.45);
    scene.add(marrow);
    meshMapRef.current['hematologic'] = marrow;

    const reprodGeom = new THREE.SphereGeometry(0.2, 12, 12);
    reprodGeom.scale(1.0, 0.7, 1.0);
    const reproductive = new THREE.Mesh(reprodGeom, organMaterial(0xdd8844, 0x332200));
    reproductive.position.set(0, -0.35, 0.15);
    scene.add(reproductive);
    meshMapRef.current['reproductive'] = reproductive;

    const jointsGeom = new THREE.SphereGeometry(0.18, 10, 10);
    const joints = new THREE.Mesh(jointsGeom, organMaterial(0xddddcc, 0x222222));
    joints.position.set(-0.3, -0.7, 0.4);
    scene.add(joints);
    meshMapRef.current['musculoskeletal'] = joints;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const organMeshes = Object.values(meshMapRef.current);

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(organMeshes);
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        for (const [sys, mesh] of Object.entries(meshMapRef.current)) {
          if (mesh === clickedMesh) {
            onSelectSystem(sys);
            return;
          }
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
  }, [size, onSelectSystem]);

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
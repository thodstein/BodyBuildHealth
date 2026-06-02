import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getRiskColor } from '../../core/utils/risk-colors';

interface Organ3DProps {
  organName: string;
  riskLevel: number; // 0-100
  size?: number;
}

const Organ3D: React.FC<Organ3DProps> = ({ organName, riskLevel, size = 200 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f); // Match dark theme
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(45, size / size, 0.1, 1000);
    camera.position.z = 5;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    containerRef.current.appendChild(renderer.domElement);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Create organ shape (simplified heart for demonstration)
    // In a real app, you'd load detailed organ models from GLTF/OBJ files
    const organGeometry = createOrganGeometry(organName);
    const organMaterial = new THREE.MeshPhongMaterial({
      color: new THREE.Color(getRiskColor(riskLevel)),
      shininess: 50,
      specular: 0xffffff
    });
    
    const organMesh = new THREE.Mesh(organGeometry, organMaterial);
    scene.add(organMesh);
    
    // Add wireframe for detail
    const wireframe = new THREE.WireframeGeometry(organGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x1e1e1e, linewidth: 1 });
    const wireframeMesh = new THREE.LineSegments(wireframe, lineMaterial);
    scene.add(wireframeMesh);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Slow rotation
      organMesh.rotation.y += 0.005;
      organMesh.rotation.x += 0.002;
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Cleanup
    return () => {
      if (!containerRef.current) return;
      containerRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [organName, riskLevel, size]);

  // Create simplified organ geometries
  function createOrganGeometry(organName: string): THREE.BufferGeometry {
    switch (organName.toLowerCase()) {
      case 'cardio':
        return createHeartGeometry();
      case 'hepatic':
        return createLiverGeometry();
      case 'renal':
        return createKidneyGeometry();
      case 'neuro':
        return createBrainGeometry();
      case 'endocrine':
        return createThyroidGeometry();
      case 'hematologic':
        return createBoneMarrowGeometry();
      case 'reproductive':
        return createReproductiveGeometry();
      default:
        return createSphereGeometry();
    }
  }

  function createHeartGeometry(): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    // Simplified heart shape
    shape.moveTo(0, 1.5);
    shape.bezierCurveTo(0, 2.2, 1.4, 2.2, 1.4, 1.2);
    shape.bezierCurveTo(1.4, 1.0, 1.0, 0.5, 0.0, 0.0);
    shape.bezierCurveTo(-1.0, 0.5, -1.4, 1.0, -1.4, 1.2);
    shape.bezierCurveTo(-1.4, 2.2, 0, 2.2, 0, 1.5);
    
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: true });
    geometry.translate(0, 0, -0.2); // Center
    return geometry;
  }

  function createLiverGeometry(): THREE.BufferGeometry {
    // Simplified liver - irregular oval
    const geometry = new THREE.SphereGeometry(1, 16, 16);
    // Scale to liver-like proportions
    geometry.scale(1.3, 0.8, 1.1);
    return geometry;
  }

  function createKidneyGeometry(): THREE.BufferGeometry {
    // Simplified kidney bean shape
    const geometry = new THREE.SphereGeometry(0.8, 16, 16);
    geometry.scale(1.2, 0.6, 1.0);
    // Add slight twist for kidney shape
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setX(i, x + Math.sin(z * 2) * 0.1);
    }
    position.needsUpdate = true;
    return geometry;
  }

  function createBrainGeometry(): THREE.BufferGeometry {
    // Simplified brain - wrinkled sphere
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    // Add noise for wrinkles
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const offset = (Math.random() - 0.5) * 0.1;
      position.setX(i, position.getX(i) + offset);
      position.setY(i, position.getY(i) + offset);
      position.setZ(i, position.getZ(i) + offset);
    }
    position.needsUpdate = true;
    return geometry;
  }

  function createThyroidGeometry(): THREE.BufferGeometry {
    // Simplified butterfly shape for thyroid
    const geometry = new THREE.SphereGeometry(0.6, 12, 12);
    geometry.scale(1.5, 0.4, 1.0);
    return geometry;
  }

  function createBoneMarrowGeometry(): THREE.BufferGeometry {
    // Simplified bone structure
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    return geometry;
  }

  function createReproductiveGeometry(): THREE.BufferGeometry {
    // Simplified oval/ellipsoid
    const geometry = new THREE.SphereGeometry(0.8, 16, 16);
    geometry.scale(1.0, 0.7, 1.0);
    return geometry;
  }

  function createSphereGeometry(): THREE.BufferGeometry {
    return new THREE.SphereGeometry(1, 16, 16);
  }

  return <div ref={containerRef} style={{ width: size, height: size }} />;
};

export default Organ3D;
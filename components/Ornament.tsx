import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrnamentProps, OrnamentType, MaterialStyle } from '../types';
import { 
  GoldMaterial, EmeraldMaterial, PearlMaterial, ObsidianMaterial, 
  SilverMaterial, LeafMaterial, RubyMaterial, MatteRedMaterial, 
  CookieMaterial, FleeceWhiteMaterial 
} from './Materials';

// --- Specialized Components for New Ornaments ---

const StockingGeometry = () => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    // Simplified stocking shape
    s.moveTo(0, 0);
    s.lineTo(0.3, 0);
    s.lineTo(0.35, -0.6);
    s.quadraticCurveTo(0.4, -0.8, 0.1, -0.85); // Heel
    s.lineTo(-0.2, -0.85); // Foot bottom
    s.quadraticCurveTo(-0.4, -0.8, -0.4, -0.6); // Toe
    s.lineTo(-0.25, -0.5); // Top of foot
    s.lineTo(-0.05, -0.5); // Ankle
    s.lineTo(-0.1, 0); // Back up to leg
    s.closePath();
    return s;
  }, []);

  return (
    <group scale={1.8}>
       {/* Main Red Sock */}
      <mesh>
        <extrudeGeometry args={[shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 }]} />
        <MatteRedMaterial />
      </mesh>
      {/* White Cuff */}
      <mesh position={[0.1, 0.05, 0.1]} scale={[1, 1, 1]}>
        <boxGeometry args={[0.55, 0.2, 0.35]} />
        <FleeceWhiteMaterial />
      </mesh>
    </group>
  );
};

const GingerbreadGeometry = () => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const w = 0.3; // half torso width
    const h = 0.3; // torso height
    
    // Head circle (approx)
    s.absarc(0, 0.5, 0.25, 0, Math.PI * 2);
    return s;
  }, []);

  return (
    <group>
      {/* Head */}
      <mesh position={[0, 0.55, 0]}>
         <cylinderGeometry args={[0.25, 0.25, 0.1, 32]} rotation={[Math.PI/2, 0, 0]} />
         <CookieMaterial />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.15, 0]}>
         <boxGeometry args={[0.4, 0.5, 0.1]} />
         <CookieMaterial />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.35, 0.25, 0]} rotation={[0, 0, 0.5]}>
         <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
         <CookieMaterial />
      </mesh>
      <mesh position={[0.35, 0.25, 0]} rotation={[0, 0, -0.5]}>
         <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
         <CookieMaterial />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.15, -0.25, 0]} rotation={[0, 0, 0]}>
         <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
         <CookieMaterial />
      </mesh>
      <mesh position={[0.15, -0.25, 0]} rotation={[0, 0, 0]}>
         <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
         <CookieMaterial />
      </mesh>

      {/* Buttons */}
      <mesh position={[0, 0.25, 0.06]}>
        <sphereGeometry args={[0.04]} />
        <FleeceWhiteMaterial />
      </mesh>
      <mesh position={[0, 0.05, 0.06]}>
        <sphereGeometry args={[0.04]} />
        <FleeceWhiteMaterial />
      </mesh>
    </group>
  );
};

const SantaGeometry = () => {
  return (
    <group scale={0.8}>
      {/* Body */}
      <mesh position={[0, -0.3, 0]}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <MatteRedMaterial />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#ffdecb" roughness={0.3} />
      </mesh>
      {/* Beard */}
      <mesh position={[0, 0.25, 0.15]} scale={[1, 0.8, 0.5]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <FleeceWhiteMaterial />
      </mesh>
      {/* Hat Base (Rim) */}
      <mesh position={[0, 0.55, 0]} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[0.26, 0.08, 16, 32]} />
        <FleeceWhiteMaterial />
      </mesh>
      {/* Hat Cone */}
      <mesh position={[0, 0.8, 0]}>
        <coneGeometry args={[0.25, 0.6, 32]} />
        <MatteRedMaterial />
      </mesh>
      {/* Pom Pom */}
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.08]} />
        <FleeceWhiteMaterial />
      </mesh>
    </group>
  );
};

export const Ornament: React.FC<OrnamentProps> = ({ data, isTreeForm, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  // Convert arrays to vectors once
  const treePos = useMemo(() => new THREE.Vector3(...data.treePosition), [data.treePosition]);
  const scatterPos = useMemo(() => new THREE.Vector3(...data.scatterPosition), [data.scatterPosition]);
  const treeRot = useMemo(() => new THREE.Euler(...data.treeRotation), [data.treeRotation]);
  const scatterRot = useMemo(() => new THREE.Euler(...data.scatterRotation), [data.scatterRotation]);

  // Random idle movement params
  const randomPhase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // 1. Determine Target State
    const targetPos = isTreeForm ? treePos : scatterPos;
    
    // 2. Interpolate Position (Morphing)
    // Using a simple lerp for smooth transition. 
    // Speed factor 3.0 gives a nice snappy but smooth feel.
    meshRef.current.position.lerp(targetPos, delta * 3.0);

    // 3. Interpolate Rotation
    // We can lerp quaternions, but for simple euler rotations independent axes lerp is often visually fine here
    if (isTreeForm) {
         // Lerp towards tree rotation
         meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, treeRot.x, delta * 3.0);
         meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, treeRot.y, delta * 3.0);
         meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, treeRot.z, delta * 3.0);
    } else {
         // Lerp towards scatter rotation + continuous slow spin
         meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, scatterRot.x + state.clock.elapsedTime * 0.1, delta * 1.0);
         meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, scatterRot.y + state.clock.elapsedTime * 0.1, delta * 1.0);
         meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, scatterRot.z, delta * 1.0);
    }

    // 4. Hover & Idle Animation overrides
    if (!data.isStatic) {
      if (hovered) {
        meshRef.current.scale.lerp(new THREE.Vector3(data.scale * 1.3, data.scale * 1.3, data.scale * 1.3), 0.1);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(data.scale, data.scale, data.scale), 0.1);
        
        // Add gentle bobbing ONLY if in Tree form to simulate hanging on a branch
        if (isTreeForm) {
             meshRef.current.position.y += Math.sin(state.clock.elapsedTime + randomPhase) * 0.001;
        }
      }
    }
  });

  const handlePointerOver = (e: any) => {
    if (data.isStatic) return;
    e.stopPropagation();
    setHovered(true);
    onHover(data.id);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    if (data.isStatic) return;
    setHovered(false);
    onHover(null);
    document.body.style.cursor = 'auto';
  };

  const renderContent = () => {
      switch (data.type) {
        case OrnamentType.STOCKING:
            return <StockingGeometry />;
        case OrnamentType.GINGERBREAD:
            return <GingerbreadGeometry />;
        case OrnamentType.SANTA:
            return <SantaGeometry />;
        case OrnamentType.CUBE:
            return (
                <>
                    <boxGeometry args={[1, 1, 1]} />
                    {renderStandardMaterial()}
                </>
            );
        case OrnamentType.SPHERE:
        default:
            return (
                <>
                    <sphereGeometry args={[0.6, 16, 16]} />
                    {renderStandardMaterial()}
                </>
            );
      }
  }

  const renderStandardMaterial = () => {
    switch (data.style) {
      case MaterialStyle.GOLD: return <GoldMaterial />;
      case MaterialStyle.EMERALD: return <EmeraldMaterial />;
      case MaterialStyle.RUBY: return <RubyMaterial />;
      case MaterialStyle.PEARL: return <PearlMaterial />;
      case MaterialStyle.OBSIDIAN: return <ObsidianMaterial />;
      case MaterialStyle.SILVER: return <SilverMaterial />;
      case MaterialStyle.LEAF: return <LeafMaterial />;
      case MaterialStyle.MATTE_RED: return <MatteRedMaterial />;
      case MaterialStyle.COOKIE: return <CookieMaterial />;
      case MaterialStyle.FLEECE: return <FleeceWhiteMaterial />;
      default: return <GoldMaterial />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      // Initial position handled by ref logic in useFrame, but providing initial avoids jump
      position={data.treePosition} 
      castShadow
      receiveShadow
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {renderContent()}
    </mesh>
  );
};
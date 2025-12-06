import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Ornament } from './Ornament';
import { TreeItemData, OrnamentType, MaterialStyle } from '../types';
import { Float, Center } from '@react-three/drei';
import * as THREE from 'three';

const TREE_HEIGHT = 12;
const BASE_RADIUS = 5.0;

// Counts - Increased for density
const STATIC_COUNT = 2500; // Denser core to prevent "hollow" look
const ACTIVE_COUNT = 350;  // Foreground interactive items

interface TreeGeneratorProps {
  isTreeForm: boolean;
}

// Helper to generate a random scatter point
const getScatterPoint = () => {
    const r = 12 + Math.random() * 15; 
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    ] as [number, number, number];
};

const getScatterRotation = () => {
   return [
       Math.random() * Math.PI * 2,
       Math.random() * Math.PI * 2,
       Math.random() * Math.PI * 2
   ] as [number, number, number];
};

// --- 1. Static Layer: The Volume & Texture ---
// Denser configuration to fill gaps
const StaticOrnaments = ({ isTreeForm }: { isTreeForm: boolean }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const { data, colors } = useMemo(() => {
    const temp = [];
    const colorArray = new Float32Array(STATIC_COUNT * 3);
    
    // Palette
    const cGreen1 = new THREE.Color("#003311"); // Deep
    const cGreen2 = new THREE.Color("#004b2c"); // Emerald
    const cGreen3 = new THREE.Color("#006622"); // Leaf
    const cSilver = new THREE.Color("#cccccc"); // Silver
    const cRed    = new THREE.Color("#8a0303"); // Ruby
    const cGold   = new THREE.Color("#b8860b"); // Dark Gold

    for (let i = 0; i < STATIC_COUNT; i++) {
       // Distribution - slightly more linear to fill bottom well
       const yProgress = Math.pow(Math.random(), 0.85); 
       const y = yProgress * TREE_HEIGHT - TREE_HEIGHT / 2 + 1.5;
       const maxR = (1 - yProgress) * BASE_RADIUS;
       
       // Mix of depths:
       const isCore = Math.random() > 0.25; // 75% Core filler
       const rMult = isCore ? Math.random() * 0.85 : 0.85 + Math.random() * 0.15;
       const r = maxR * rMult;
       
       const theta = Math.random() * Math.PI * 2;
       const treePos = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
       
       // Scatter
       const sp = getScatterPoint();
       const scatterPos = new THREE.Vector3(sp[0], sp[1], sp[2]);

       // Color Logic
       let c = cGreen1;
       if (isCore) {
           const rnd = Math.random();
           c = rnd < 0.4 ? cGreen1 : rnd < 0.7 ? cGreen2 : cGreen3;
       } else {
           const rnd = Math.random();
           if (rnd < 0.4) c = cGreen2;      
           else if (rnd < 0.6) c = cSilver; 
           else if (rnd < 0.8) c = cRed;    
           else c = cGold;                  
       }
       
       c.toArray(colorArray, i * 3);

       // Increased scale for fuller look
       const baseScale = isCore ? 0.3 : 0.25; 
       temp.push({
         treePos,
         scatterPos,
         scale: baseScale + Math.random() * 0.25, 
         phase: Math.random() * Math.PI * 2
       });
    }
    return { data: temp, colors: colorArray };
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const lerpSpeed = delta * 2.0; 
    
    data.forEach((inst, i) => {
       const target = isTreeForm ? inst.treePos : inst.scatterPos;
       
       if (!inst.currentPos) inst.currentPos = inst.scatterPos.clone();
       inst.currentPos.lerp(target, lerpSpeed);
       
       dummy.position.copy(inst.currentPos);
       
       if (isTreeForm) {
         dummy.position.y += Math.sin(state.clock.elapsedTime * 1.5 + inst.phase) * 0.03;
       }

       dummy.scale.setScalar(inst.scale);
       dummy.updateMatrix();
       meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, STATIC_COUNT]} castShadow receiveShadow>
      <sphereGeometry args={[1, 10, 10]} /> 
      {/* Lower poly for static spheres to keep FPS up with 2500 count */}
      <meshStandardMaterial 
        roughness={0.25} 
        metalness={0.6} 
        envMapIntensity={1.0}
        color="#ffffff" 
      />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
};

// --- 2. Active Layer: Hero Ornaments & Gifts ---
export const TreeGenerator: React.FC<TreeGeneratorProps> = ({ isTreeForm }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const starGroupRef = useRef<THREE.Group>(null);
  
  const ornamentsData = useMemo(() => {
    const items: TreeItemData[] = [];
    
    for (let i = 0; i < ACTIVE_COUNT; i++) {
        const yProgress = Math.pow(Math.random(), 1.2); 
        const y = yProgress * TREE_HEIGHT;
        const maxR = (1 - yProgress) * BASE_RADIUS;
        
        // SURFACE POP
        const r = maxR * (0.95 + Math.random() * 0.3);
        const theta = Math.random() * Math.PI * 2;
        
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        const treePos: [number, number, number] = [x, y - TREE_HEIGHT/2 + 1.5, z];

        // Type Distribution
        const randType = Math.random();
        let type = OrnamentType.SPHERE;
        let scale = 0.35 + Math.random() * 0.3; 
        
        if (randType > 0.8) {
            const subRand = Math.random();
            if (subRand > 0.6) type = OrnamentType.STOCKING;
            else if (subRand > 0.35) type = OrnamentType.SANTA;
            else type = OrnamentType.GINGERBREAD;
            scale = 0.5 + Math.random() * 0.2;
        } else if (randType > 0.70) {
            type = OrnamentType.CUBE; 
            scale = 0.45 + Math.random() * 0.25;
        }

        const randStyle = Math.random();
        let style = MaterialStyle.GOLD;
        
        if (type === OrnamentType.SPHERE || type === OrnamentType.CUBE) {
            if (randStyle > 0.90) style = MaterialStyle.SILVER;
            else if (randStyle > 0.80) style = MaterialStyle.PEARL;
            else if (randStyle > 0.65) style = MaterialStyle.RUBY; 
            else if (randStyle > 0.50) style = MaterialStyle.EMERALD;
            else style = MaterialStyle.GOLD; 
        } else {
            if (type === OrnamentType.STOCKING || type === OrnamentType.SANTA) style = MaterialStyle.MATTE_RED;
            if (type === OrnamentType.GINGERBREAD) style = MaterialStyle.COOKIE;
        }

        const rotY = -theta + Math.PI / 2;

        items.push({
            id: `active-${i}`,
            treePosition: treePos,
            scatterPosition: getScatterPoint(),
            treeRotation: [0, rotY, 0],
            scatterRotation: getScatterRotation(),
            scale,
            type,
            style,
            isStatic: false
        });
    }
    return items;
  }, []);

  // Star Animation
  const starTreePos = new THREE.Vector3(0, TREE_HEIGHT / 2 + 2.8, 0);
  const starScatterPos = useMemo(() => new THREE.Vector3(0, 15, 0), []);
  
  useFrame((state, delta) => {
    if (starGroupRef.current) {
        const target = isTreeForm ? starTreePos : starScatterPos;
        starGroupRef.current.position.lerp(target, delta * 2.5);
        if (isTreeForm) {
            starGroupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
        } else {
            starGroupRef.current.rotation.y += delta * 0.5;
        }
    }
  });

  // Fixed Star Shape
  const starShape = useMemo(() => {
    const s = new THREE.Shape();
    const points = 5;
    const outer = 1.3;
    const inner = 0.6;
    
    // Start at top point (Angle = PI/2)
    s.moveTo(outer * Math.cos(Math.PI/2), outer * Math.sin(Math.PI/2));
    
    for (let i = 1; i <= points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        // Adjust angle calculation to rotate correctly
        const a = Math.PI / 2 + i * Math.PI / points; 
        s.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    // No need to manually close if we loop fully, but closePath is safer
    s.closePath();
    return s;
  }, []);

  return (
    <group>
      {/* 1. The Dense Volume (Static Layer) */}
      <StaticOrnaments isTreeForm={isTreeForm} />

      {/* 2. The Interactive Jewelry (Active Layer) */}
      {ornamentsData.map((data) => (
         <Ornament 
            key={data.id} 
            data={data} 
            isTreeForm={isTreeForm} 
            onHover={setHoveredId} 
         />
      ))}

      {/* 3. The Grand Star */}
      <group ref={starGroupRef}>
         <pointLight intensity={100} distance={20} color="#ffaa00" decay={2} />
         <Center>
            <group>
                <mesh castShadow receiveShadow>
                    <extrudeGeometry args={[starShape, { depth: 0.4, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1 }]} />
                    <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={3} metalness={1} roughness={0} />
                </mesh>
                {/* Decorative inner star */}
                <mesh position={[0,0,0.2]} scale={0.5}>
                    <extrudeGeometry args={[starShape, { depth: 0.4, bevelEnabled: true }]} />
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={5} />
                </mesh>
            </group>
         </Center>
      </group>
    </group>
  );
};
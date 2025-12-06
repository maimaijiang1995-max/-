import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COUNT = 800; // Increased count for more luxury
const BOUNDS = 15;
const COLOR = new THREE.Color("#FFD700"); // Trump Gold

export const MagicDust = () => {
  const mesh = useRef<THREE.Points>(null);
  
  // Initialize particles with position and velocity
  const { positions, velocities, phases } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const ph = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // Random spread around the tree
      pos[i * 3] = (Math.random() - 0.5) * BOUNDS;     
      pos[i * 3 + 1] = (Math.random() - 0.5) * BOUNDS + 2; 
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS; 

      // Initial slight drift
      vel[i * 3] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;

      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, velocities: vel, phases: ph };
  }, []);

  // Reusable vectors to avoid GC
  const mouse3D = useRef(new THREE.Vector3(0, 0, 0));
  const dummyVec = useRef(new THREE.Vector3());

  useFrame((state) => {
    if (!mesh.current) return;

    // 1. Calculate Mouse Position in World Space
    // Improve target finding: Raycast to a virtual plane at the tree center facing camera
    dummyVec.current.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
    const dir = dummyVec.current.sub(state.camera.position).normalize();
    const distance = -state.camera.position.z / dir.z; 
    
    // Smoothly interpolate the attraction point for less jitter
    const targetX = state.camera.position.x + dir.x * distance;
    const targetY = state.camera.position.y + dir.y * distance;
    const targetZ = state.camera.position.z + dir.z * distance;
    
    // Clamp to reasonable bounds to keep interaction near the tree
    mouse3D.current.lerp(new THREE.Vector3(
        THREE.MathUtils.clamp(targetX, -10, 10),
        THREE.MathUtils.clamp(targetY, -5, 15),
        THREE.MathUtils.clamp(targetZ, -10, 10)
    ), 0.1);


    const positionsAttr = mesh.current.geometry.attributes.position;
    const array = positionsAttr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
        const idx = i * 3;
        
        // Current Pos
        const px = array[idx];
        const py = array[idx + 1];
        const pz = array[idx + 2];

        // 2. Physics: Idle Float (Sine waves)
        const t = state.clock.elapsedTime;
        const phase = phases[i];
        
        // Curl noise approximation for organic movement
        const noiseX = Math.sin(t * 0.5 + phase) * 0.005;
        const noiseY = Math.cos(t * 0.3 + py * 0.5) * 0.005;
        const noiseZ = Math.sin(t * 0.4 + px * 0.5) * 0.005;

        velocities[idx] += noiseX;
        velocities[idx + 1] += noiseY;
        velocities[idx + 2] += noiseZ;

        // 3. Physics: Interaction (Magical Attraction & Swirl)
        // Vector to mouse
        const dx = mouse3D.current.x - px;
        const dy = mouse3D.current.y - py;
        const dz = mouse3D.current.z - pz;
        const distSq = dx*dx + dy*dy + dz*dz;

        // Extended range for "Magical" feel
        if (distSq < 50) {
            const force = 0.015 / (distSq * 0.1 + 1); // Stronger pull when close
            
            // Attraction
            velocities[idx] += dx * force;
            velocities[idx + 1] += dy * force;
            velocities[idx + 2] += dz * force;

            // Swirl (Cross product with Up vector roughly)
            // This makes them orbit the cursor instead of just collapsing in
            const swirlForce = 0.02;
            velocities[idx] += -dz * swirlForce; // Rotate around Y-ish axis relative to cursor? 
            // Simple swirl around the attraction center axis (assume View direction or Y axis)
            // Let's swirl around Y for a tornado effect
            velocities[idx] += (mouse3D.current.z - pz) * swirlForce;
            velocities[idx + 2] -= (mouse3D.current.x - px) * swirlForce;
        }

        // 4. Physics: Friction & Update
        velocities[idx] *= 0.95;     // Friction
        velocities[idx + 1] *= 0.95;
        velocities[idx + 2] *= 0.95;

        array[idx] += velocities[idx];
        array[idx + 1] += velocities[idx + 1];
        array[idx + 2] += velocities[idx + 2];

        // 5. Bounds Reset (keep them in the volume)
        // Soft boundaries
        if (Math.abs(array[idx]) > BOUNDS) velocities[idx] -= array[idx] * 0.02;
        if (Math.abs(array[idx+1] - 4) > BOUNDS) velocities[idx+1] -= (array[idx+1]-4) * 0.02;
        if (Math.abs(array[idx+2]) > BOUNDS) velocities[idx+2] -= array[idx+2] * 0.02;
    }

    positionsAttr.needsUpdate = true;
  });

  // Create a soft glow texture for particles
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 223, 0, 1)'); // Brighter Gold
        gradient.addColorStop(0.2, 'rgba(255, 215, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.3)'); // Orangeish glow
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 32, 32);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.25}
        color={COLOR}
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.9}
        sizeAttenuation={true}
      />
    </points>
  );
};
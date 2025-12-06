import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { TreeGenerator } from './TreeGenerator';
import { MagicDust } from './MagicDust';
import { GestureHandler } from './GestureHandler';

interface SceneProps {
  isTreeForm: boolean;
  setTreeForm: (val: boolean) => void;
}

export const Scene: React.FC<SceneProps> = ({ isTreeForm, setTreeForm }) => {
  const controlsRef = useRef<any>(null);
  
  // Physics State
  const lastAzimuth = useRef(0);
  const azimuthVelocity = useRef(0);
  const isInteracting = useRef(false);

  // Physics Loop: Handles Inertia and Momentum Handoff
  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const currentAzimuth = controls.getAzimuthalAngle();
    
    // Check if system is in "Manual Control" mode (AutoRotate is OFF)
    // This happens during Mouse Drag OR Gesture Control
    const isManualControl = !controls.autoRotate;

    if (isManualControl) {
        // 1. MEASURE VELOCITY
        // Calculate how fast the user is spinning it manually
        let diff = currentAzimuth - lastAzimuth.current;
        
        // Handle wrap-around (e.g. going from 359 to 1 degree)
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        
        // Instantaneous velocity (radians per second)
        const rawVelocity = diff / delta;
        
        // Smooth out the measurement to avoid jitter
        azimuthVelocity.current = THREE.MathUtils.lerp(azimuthVelocity.current, rawVelocity, 0.4);
        
        isInteracting.current = true;
    } else {
        // 2. APPLY INERTIA (Auto Pilot)
        // The user let go. Now we use the measured velocity to drive the spin.
        
        // Target Idle Speed (Slow spin when energy dissipates)
        // 0.5 autoRotateSpeed is roughly 3 deg/frame approx.
        const baseIdleSpeed = isTreeForm ? 0.5 : 0.0;
        
        if (isInteracting.current) {
            // Just transitioned from manual to auto. 
            // Convert physical angular velocity (rad/s) to OrbitControls 'autoRotateSpeed' units.
            // Heuristic: 1 rad/s is approx speed 10.0 in OrbitControls
            const initialSpeed = azimuthVelocity.current * 10.0;
            controls.autoRotateSpeed = initialSpeed;
            isInteracting.current = false;
        }

        // 3. FRICTION / DECAY
        // Slowly blend current speed towards the base idle speed
        // Lower factor = Slower decay (Longer spin)
        const friction = 1.0 * delta; 
        
        controls.autoRotateSpeed = THREE.MathUtils.lerp(
            controls.autoRotateSpeed, 
            baseIdleSpeed, 
            friction
        );
    }

    lastAzimuth.current = currentAzimuth;
  });

  const onStartInteraction = () => {
    if (controlsRef.current) {
        controlsRef.current.autoRotate = false;
        azimuthVelocity.current = 0;
    }
  };

  const onEndInteraction = () => {
    if (controlsRef.current) {
        controlsRef.current.autoRotate = true;
    }
  };

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 4, 20]} fov={45} />
      
      <OrbitControls 
        ref={controlsRef}
        minPolarAngle={0} 
        maxPolarAngle={Math.PI / 2 - 0.05} 
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.05} 
        rotateSpeed={0.6}
        autoRotate={true}
        autoRotateSpeed={0.5} 
        maxDistance={35}
        minDistance={12}
        onStart={onStartInteraction}
        onEnd={onEndInteraction}
      />

      {/* Logic Component for Gestures */}
      <GestureHandler setTreeForm={setTreeForm} controlsRef={controlsRef} />

      <ambientLight intensity={0.1} color="#001a00" />
      
      <spotLight 
        position={[15, 20, 15]} 
        angle={0.4} 
        penumbra={1} 
        intensity={300} 
        castShadow 
        shadow-bias={-0.0001}
        color="#fff0c0"
      />
      
      <spotLight 
        position={[-15, 10, -10]} 
        angle={0.5} 
        penumbra={1} 
        intensity={200} 
        color="#ffcc00"
      />
      
      <pointLight position={[0, -2, -5]} intensity={50} color="#00ff44" distance={20} />

      <Environment preset="lobby" backgroundBlurriness={0.6} envMapIntensity={1.2} />

      <MagicDust />

      <group position={[0, -4, 0]}>
        <TreeGenerator isTreeForm={isTreeForm} />
      </group>

      <ContactShadows 
        resolution={1024} 
        scale={30} 
        blur={2.5} 
        opacity={0.6} 
        far={10} 
        color="#000000" 
      />

      <EffectComposer disableNormalPass>
        <Bloom 
          luminanceThreshold={0.8} 
          mipmapBlur 
          intensity={1.2} 
          radius={0.5} 
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
      </EffectComposer>
    </>
  );
};
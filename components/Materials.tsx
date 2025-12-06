import React from 'react';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';

// --- Custom Shader Material for Points (Foliage) ---
// This handles the morphing on the GPU for maximum performance with thousands of particles
const FoliageShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uProgress: 0, // 0 = Tree, 1 = Exploded
    uColorBase: new THREE.Color("#003311"), // Dark Emerald
    uColorTip: new THREE.Color("#006622"), // Lighter Emerald
    uColorGold: new THREE.Color("#FFD700"), // Gold sparkles
  },
  // Vertex Shader
  `
    uniform float uTime;
    uniform float uProgress;
    attribute vec3 aPositionScatter;
    attribute float aSize;
    attribute float aRandom;
    
    varying float vRandom;
    varying vec3 vPos;

    // Cubic bezier ease-in-out approximation for smoother transition
    float easeInOutCubic(float t) {
      return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
    }

    void main() {
      vRandom = aRandom;
      
      // Calculate mixed position
      float t = easeInOutCubic(uProgress);
      vec3 pos = mix(position, aPositionScatter, t);
      
      // Add some idle noise movement
      float noise = sin(uTime * 2.0 + aRandom * 10.0) * 0.05;
      if(uProgress < 0.1) {
         pos.x += cos(uTime + pos.y) * 0.02;
         pos.z += sin(uTime + pos.y) * 0.02;
      } else {
         pos.y += noise * 0.5;
         pos.x += noise * 0.2;
      }

      vPos = pos;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Size attenuation
      gl_PointSize = aSize * (30.0 / -mvPosition.z);
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uColorGold;
    uniform float uTime;
    varying float vRandom;
    varying vec3 vPos;

    void main() {
      // Circular particle
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;

      // Gradient color
      vec3 color = mix(uColorBase, uColorTip, vRandom);
      
      // Add occasional gold sparkles based on view or time
      float sparkle = step(0.95, sin(uTime * 3.0 + vRandom * 100.0));
      color = mix(color, uColorGold, sparkle);

      // Fake lighting/shading
      float light = 1.0 - dist * 1.5;
      gl_FragColor = vec4(color * light * 2.5, 1.0);
    }
  `
);

extend({ FoliageShaderMaterial });

// --- Standard Materials for Instanced Meshes ---
// We return raw THREE materials for use in InstancedMesh logic
export const getGoldMaterial = () => new THREE.MeshStandardMaterial({
  color: "#FFD700",
  roughness: 0.1,
  metalness: 1.0,
  envMapIntensity: 1.5
});

export const getRedMaterial = () => new THREE.MeshPhysicalMaterial({
  color: "#8a0303",
  roughness: 0.15,
  metalness: 0.2,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  envMapIntensity: 1.5
});

export const getBoxMaterial = () => new THREE.MeshStandardMaterial({
  color: "#b00b1e", // Richer red for gifts
  roughness: 0.3,
  metalness: 0.4,
});

export const getWhiteMaterial = () => new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.9,
  metalness: 0.1,
  emissive: "#222222"
});

// --- React Components for Declarative Usage ---
export const GoldMaterial = (props: any) => <meshStandardMaterial color="#FFD700" roughness={0.1} metalness={1.0} envMapIntensity={1.5} {...props} />;
export const EmeraldMaterial = (props: any) => <meshPhysicalMaterial color="#004b2c" roughness={0.15} metalness={0.2} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={1.5} {...props} />;
export const PearlMaterial = (props: any) => <meshPhysicalMaterial color="#fcfcfc" roughness={0.2} metalness={0.1} clearcoat={1} clearcoatRoughness={0.1} envMapIntensity={1.2} {...props} />;
export const ObsidianMaterial = (props: any) => <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.8} envMapIntensity={2.0} {...props} />;
export const SilverMaterial = (props: any) => <meshStandardMaterial color="#e0e0e0" roughness={0.2} metalness={1.0} envMapIntensity={1.5} {...props} />;
export const LeafMaterial = (props: any) => <meshStandardMaterial color="#006622" roughness={0.8} metalness={0.1} {...props} />;
export const RubyMaterial = (props: any) => <meshPhysicalMaterial color="#e0115f" roughness={0.1} metalness={0.1} transmission={0.2} thickness={1} clearcoat={1} {...props} />;
export const MatteRedMaterial = (props: any) => <meshStandardMaterial color="#b00b1e" roughness={0.8} metalness={0.1} {...props} />;
export const CookieMaterial = (props: any) => <meshStandardMaterial color="#c77b47" roughness={0.9} metalness={0.0} {...props} />;
export const FleeceWhiteMaterial = (props: any) => <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} {...props} />;
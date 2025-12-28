import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface EarthProps {
  frequencyData?: number[];
}

export default function Earth({ frequencyData }: EarthProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);
  const globeRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    // React to audio frequencies (e.g., pulse opacity/emissive)
    if (materialRef.current && frequencyData && frequencyData.length > 0) {
      const avgBass = frequencyData.slice(0, 10).reduce((a, b) => a + b, 0) / 10 / 255;
      materialRef.current.opacity = 0.4 + avgBass * 0.3; 
      materialRef.current.emissiveIntensity = 0.5 + avgBass * 0.5;
    }
  });

  return (
    <mesh ref={globeRef}>
      <sphereGeometry args={[2.5, 64, 64]} />
      <meshStandardMaterial 
        ref={materialRef}
        wireframe 
        color="#22c55e" 
        transparent 
        opacity={0.4} 
        emissive="#114422"
        emissiveIntensity={0.5}
      />
    </mesh>
  );
}

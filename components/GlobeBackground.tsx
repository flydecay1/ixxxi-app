// components/GlobeBackground.tsx
// Rotating 3D globe that highlights song origin locations for TV mode

'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface GlobeBackgroundProps {
  targetLocation?: [number, number]; // [lat, lng]
  isTransitioning?: boolean;
}

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function Globe({ targetLocation, isTransitioning }: GlobeBackgroundProps) {
  const globeRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  
  const [targetRotation, setTargetRotation] = useState({ x: 0, y: 0 });
  
  // Calculate rotation to show target location
  useEffect(() => {
    if (targetLocation) {
      const [lat, lng] = targetLocation;
      // Rotate globe so location faces camera
      setTargetRotation({
        x: lat * (Math.PI / 180) * 0.5,
        y: -lng * (Math.PI / 180) - Math.PI / 2,
      });
    }
  }, [targetLocation]);

  // Marker position
  const markerPosition = useMemo(() => {
    if (!targetLocation) return new THREE.Vector3(0, 0, 2.1);
    return latLngToVector3(targetLocation[0], targetLocation[1], 2.05);
  }, [targetLocation]);

  useFrame((state, delta) => {
    if (!globeRef.current) return;
    
    // Slow ambient rotation
    globeRef.current.rotation.y += delta * 0.03;
    
    // Smooth transition to target rotation
    if (targetLocation) {
      globeRef.current.rotation.x = THREE.MathUtils.lerp(
        globeRef.current.rotation.x,
        targetRotation.x,
        delta * 0.5
      );
    }
    
    // Glow pulse
    if (glowRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
      glowRef.current.scale.setScalar(scale);
    }
    
    // Marker pulse
    if (markerRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
      markerRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Main Globe */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial 
          color="#0a1628"
          wireframe={false}
        />
        
        {/* Grid lines */}
        <lineSegments>
          <edgesGeometry args={[new THREE.SphereGeometry(2.01, 24, 24)]} />
          <lineBasicMaterial color="#1e3a5f" transparent opacity={0.3} />
        </lineSegments>
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={glowRef} scale={1.15}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial 
          color="#06b6d4"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Location Marker */}
      {targetLocation && !isTransitioning && (
        <group position={markerPosition}>
          {/* Marker dot */}
          <mesh ref={markerRef}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#06b6d4" />
          </mesh>
          
          {/* Marker ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.08, 0.12, 32]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          
          {/* Ping effect */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.15, 0.18, 32]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.2} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* Continent outlines (simplified) */}
      <ContinentOutlines />
    </group>
  );
}

function ContinentOutlines() {
  // Simplified continent points for visual effect
  const continentData = useMemo(() => {
    return {
      northAmerica: [
        [49, -125], [49, -95], [45, -75], [40, -74], [25, -80], [25, -97], [32, -117], [49, -125]
      ],
      southAmerica: [
        [10, -75], [5, -60], [-5, -35], [-23, -43], [-35, -58], [-55, -68], [-45, -75], [-15, -75], [10, -75]
      ],
      europe: [
        [60, -10], [60, 30], [45, 40], [35, 25], [36, -10], [45, -10], [60, -10]
      ],
      africa: [
        [35, -10], [35, 35], [10, 50], [-15, 40], [-35, 20], [-35, 15], [5, -15], [35, -10]
      ],
      asia: [
        [60, 30], [75, 100], [60, 140], [35, 140], [20, 100], [10, 105], [5, 95], [25, 65], [35, 45], [60, 30]
      ],
      australia: [
        [-15, 130], [-25, 153], [-38, 145], [-35, 115], [-20, 115], [-15, 130]
      ]
    };
  }, []);

  return (
    <group>
      {Object.values(continentData).map((points, continentIdx) => {
        const linePoints: THREE.Vector3[] = [];
        points.forEach(([lat, lng]) => {
          linePoints.push(latLngToVector3(lat, lng, 2.02));
        });
        
        const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        
        return (
          <line key={continentIdx}>
            <bufferGeometry attach="geometry" {...geometry} />
            <lineBasicMaterial attach="material" color="#0ea5e9" transparent opacity={0.4} />
          </line>
        );
      })}
    </group>
  );
}

// Data stream particles around the globe
function DataParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 200;

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.3 + Math.random() * 0.5;
      
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      
      vel[i * 3] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    
    return [pos, vel];
  }, []);

  useFrame(() => {
    if (!particlesRef.current) return;
    
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];
      
      // Keep particles in orbital range
      const dist = Math.sqrt(
        positions[i * 3] ** 2 + 
        positions[i * 3 + 1] ** 2 + 
        positions[i * 3 + 2] ** 2
      );
      
      if (dist > 3 || dist < 2.2) {
        velocities[i * 3] *= -1;
        velocities[i * 3 + 1] *= -1;
        velocities[i * 3 + 2] *= -1;
      }
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02} 
        color="#06b6d4" 
        transparent 
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function GlobeBackground({ targetLocation, isTransitioning }: GlobeBackgroundProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        
        <Globe targetLocation={targetLocation} isTransitioning={isTransitioning} />
        <DataParticles />
      </Canvas>
    </div>
  );
}

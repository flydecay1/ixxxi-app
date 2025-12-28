"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import type { AudioAsset } from "@/app/types";

// Fresnel rim glow sphere (using standard material with glow approximation)
function FresnelGlobe({ radius, audioIntensity }: { radius: number; audioIntensity: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.15 + audioIntensity * 0.2;
    }
    if (meshRef.current) {
      // Subtle scale pulse for glow effect
      const scale = 1.01 + Math.sin(state.clock.elapsedTime * 2) * 0.005 + audioIntensity * 0.01;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#22c55e"
        transparent={true}
        opacity={0.15}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Utility to convert Lat/Lon to 3D positions
const get3DPos = (lat: number, lon: number, radius: number) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
};

// Utility to parse coordinates string like "35.6762° N, 139.6503° E"
function parseCoordinates(coordStr: string | undefined): { lat: number, lon: number } | null {
  if (!coordStr) return null;
  const match = coordStr.match(/([\d.]+)[°]?\s*([NS]),?\s*([\d.]+)[°]?\s*([EW])/i);
  if (!match) return null;
  let lat = parseFloat(match[1]);
  let lon = parseFloat(match[3]);
  if (match[2].toUpperCase() === 'S') lat = -lat;
  if (match[4].toUpperCase() === 'W') lon = -lon;
  return { lat, lon };
}

// Simplified continent outlines (lat/lon coordinates) - tactical wireframe style
const CONTINENT_DATA: { name: string; paths: [number, number][][] }[] = [
  {
    name: "North America",
    paths: [[
      [49, -125], [60, -140], [70, -140], [72, -130], [70, -100], [65, -90], [60, -80],
      [55, -65], [45, -65], [43, -70], [40, -74], [35, -75], [30, -82], [25, -80],
      [25, -97], [20, -105], [25, -110], [30, -115], [35, -120], [40, -125], [49, -125]
    ], [
      // Mexico/Central America
      [25, -97], [20, -97], [18, -95], [15, -92], [10, -84], [8, -80], [10, -75],
      [20, -87], [22, -90], [25, -97]
    ]]
  },
  {
    name: "South America", 
    paths: [[
      [10, -75], [5, -77], [0, -80], [-5, -81], [-10, -78], [-15, -75], [-20, -70],
      [-25, -70], [-30, -72], [-35, -72], [-40, -73], [-45, -74], [-50, -73], [-55, -68],
      [-55, -66], [-50, -58], [-45, -60], [-40, -62], [-35, -58], [-30, -50], [-25, -48],
      [-20, -40], [-15, -39], [-10, -35], [-5, -35], [0, -50], [5, -60], [10, -62],
      [12, -72], [10, -75]
    ]]
  },
  {
    name: "Europe",
    paths: [[
      [36, -10], [38, -8], [43, -9], [44, -1], [46, 3], [48, 0], [50, 2], [52, 5],
      [54, 10], [55, 12], [58, 10], [60, 5], [62, 5], [65, 12], [70, 20], [72, 28],
      [70, 30], [68, 35], [65, 32], [60, 30], [55, 22], [54, 18], [52, 14],
      [50, 14], [48, 17], [46, 15], [44, 12], [42, 14], [40, 18], [38, 22],
      [36, 22], [34, 25], [35, 28], [38, 28], [40, 26], [42, 28], [44, 28],
      [42, 22], [40, 20], [38, 15], [36, 15], [36, -10]
    ]]
  },
  {
    name: "Africa",
    paths: [[
      [35, -5], [37, -1], [37, 10], [32, 32], [30, 33], [22, 37], [15, 43], [12, 44],
      [10, 50], [5, 45], [0, 42], [-5, 40], [-10, 40], [-15, 35], [-20, 35], [-25, 33],
      [-30, 30], [-35, 20], [-35, 18], [-30, 17], [-25, 15], [-20, 12], [-15, 12],
      [-10, 14], [-5, 8], [0, 5], [5, -5], [5, -10], [10, -15], [15, -17], [20, -17],
      [25, -15], [30, -10], [32, -8], [35, -5]
    ]]
  },
  {
    name: "Asia",
    paths: [[
      [42, 28], [45, 35], [40, 50], [38, 55], [35, 52], [32, 50], [28, 50], [25, 55],
      [22, 60], [20, 65], [18, 75], [15, 80], [10, 80], [8, 90], [5, 100], [2, 103],
      [5, 105], [10, 107], [15, 110], [22, 115], [25, 120], [30, 122], [35, 130],
      [40, 130], [42, 132], [45, 135], [43, 145], [50, 155], [55, 160], [60, 165],
      [65, 175], [70, 180], [75, 100], [72, 80], [75, 70], [72, 55], [68, 55],
      [65, 60], [60, 58], [55, 60], [50, 55], [45, 50], [42, 45], [42, 28]
    ], [
      // Indian Subcontinent
      [25, 68], [30, 70], [32, 75], [28, 77], [22, 88], [20, 92], [15, 80],
      [10, 76], [8, 77], [10, 80], [15, 80], [18, 75], [22, 68], [25, 68]
    ]]
  },
  {
    name: "Australia",
    paths: [[
      [-12, 130], [-15, 125], [-20, 118], [-25, 113], [-30, 115], [-35, 117],
      [-35, 138], [-38, 145], [-38, 148], [-35, 151], [-30, 153], [-25, 153],
      [-20, 148], [-15, 145], [-12, 142], [-10, 143], [-12, 136], [-12, 130]
    ]]
  },
  {
    name: "Japan",
    paths: [[
      [31, 130], [33, 130], [35, 135], [36, 140], [40, 140], [42, 145], [45, 145],
      [45, 142], [42, 140], [38, 138], [35, 137], [33, 133], [31, 130]
    ]]
  },
  {
    name: "UK/Ireland",
    paths: [[
      [50, -5], [51, 1], [53, 0], [55, -2], [58, -5], [58, -7], [56, -7], [55, -5],
      [53, -4], [52, -5], [50, -5]
    ], [
      [52, -10], [53, -6], [54, -8], [53, -10], [52, -10]
    ]]
  },
  {
    name: "Indonesia",
    paths: [[
      [-6, 105], [-8, 110], [-8, 115], [-6, 120], [-2, 125], [0, 127], [2, 127],
      [0, 120], [-2, 115], [-5, 110], [-6, 105]
    ]]
  },
  {
    name: "New Zealand",
    paths: [[
      [-35, 173], [-38, 175], [-42, 174], [-45, 168], [-47, 167], [-45, 170],
      [-40, 176], [-37, 178], [-35, 173]
    ]]
  },
  {
    name: "Greenland",
    paths: [[
      [60, -45], [65, -40], [70, -25], [75, -20], [80, -25], [82, -35], [80, -55],
      [75, -58], [70, -55], [65, -50], [60, -45]
    ]]
  },
  {
    name: "Madagascar",
    paths: [[
      [-12, 49], [-15, 50], [-20, 44], [-25, 45], [-25, 47], [-20, 48], [-15, 50],
      [-12, 49]
    ]]
  }
];

// Component to render continent outlines
function ContinentOutlines({ radius, opacity }: { radius: number; opacity: number }) {
  const linesRef = useRef<THREE.Group>(null!);
  
  const continentLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    
    CONTINENT_DATA.forEach(continent => {
      continent.paths.forEach(path => {
        const points: THREE.Vector3[] = [];
        path.forEach(([lat, lon]) => {
          points.push(get3DPos(lat, lon, radius));
        });
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
          color: "#22c55e", 
          transparent: true, 
          opacity: opacity,
          linewidth: 2
        });
        lines.push(new THREE.Line(geometry, material));
      });
    });
    
    return lines;
  }, [radius, opacity]);

  return (
    <group ref={linesRef}>
      {continentLines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

// Filled continent shapes for realistic look
function FilledContinents({ radius }: { radius: number }) {
  const meshes = useMemo(() => {
    const result: THREE.Mesh[] = [];
    
    CONTINENT_DATA.forEach(continent => {
      continent.paths.forEach(path => {
        // Create a shape from the path points
        const shape = new THREE.Shape();
        
        // Project points onto a 2D plane first (using equirectangular projection)
        const points2D = path.map(([lat, lon]) => ({
          x: (lon + 180) * (Math.PI / 180),
          y: (lat + 90) * (Math.PI / 180)
        }));
        
        if (points2D.length < 3) return;
        
        shape.moveTo(points2D[0].x, points2D[0].y);
        points2D.slice(1).forEach(p => shape.lineTo(p.x, p.y));
        shape.closePath();
        
        // Create geometry from shape
        const geometry = new THREE.ShapeGeometry(shape);
        
        // Map 2D shape vertices back to 3D sphere
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          
          // Convert back to lat/lon
          const lon = (x * 180 / Math.PI) - 180;
          const lat = (y * 180 / Math.PI) - 90;
          
          // Convert to 3D position
          const pos = get3DPos(lat, lon, radius);
          positions.setXYZ(i, pos.x, pos.y, pos.z);
        }
        
        geometry.computeVertexNormals();
        
        const material = new THREE.MeshBasicMaterial({
          color: "#166534", // Dark green for land
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide
        });
        
        result.push(new THREE.Mesh(geometry, material));
      });
    });
    
    return result;
  }, [radius]);

  return (
    <group>
      {meshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}

// Lat/Lon grid lines for tactical look
function GridLines({ radius }: { radius: number }) {
  const gridLines = useMemo(() => {
    const lines: THREE.Line[] = [];
    const material = new THREE.LineBasicMaterial({ 
      color: "#22c55e", 
      transparent: true, 
      opacity: 0.08 
    });
    
    // Latitude lines (every 30 degrees)
    for (let lat = -60; lat <= 60; lat += 30) {
      const points: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        points.push(get3DPos(lat, lon, radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      lines.push(new THREE.Line(geometry, material));
    }
    
    // Longitude lines (every 30 degrees)
    for (let lon = -180; lon < 180; lon += 30) {
      const points: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        points.push(get3DPos(lat, lon, radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      lines.push(new THREE.Line(geometry, material));
    }
    
    // Equator (brighter)
    const equatorPoints: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      equatorPoints.push(get3DPos(0, lon, radius));
    }
    const equatorGeometry = new THREE.BufferGeometry().setFromPoints(equatorPoints);
    const equatorMaterial = new THREE.LineBasicMaterial({ 
      color: "#22c55e", 
      transparent: true, 
      opacity: 0.15 
    });
    lines.push(new THREE.Line(equatorGeometry, equatorMaterial));
    
    // Prime meridian (brighter)
    const primePoints: THREE.Vector3[] = [];
    for (let lat = -90; lat <= 90; lat += 2) {
      primePoints.push(get3DPos(lat, 0, radius));
    }
    const primeGeometry = new THREE.BufferGeometry().setFromPoints(primePoints);
    lines.push(new THREE.Line(primeGeometry, equatorMaterial));
    
    return lines;
  }, [radius]);

  return (
    <group>
      {gridLines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

// Data stream particles flowing between hotspots
function DataStreams({ 
  activeCoords, 
  bassLevel 
}: { 
  activeCoords: { lat: number; lon: number } | null;
  bassLevel: number;
}) {
  const particlesRef = useRef<THREE.Points>(null!);
  const PARTICLE_COUNT = 200;
  const GLOBE_RADIUS = 2.5;
  
  // Create particle system
  const { positions, velocities, targets } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities: THREE.Vector3[] = [];
    const targets: THREE.Vector3[] = [];
    
    // Initialize particles around hotspots
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const hotspot = HOTSPOT_NODES[i % HOTSPOT_NODES.length];
      const startPos = get3DPos(
        hotspot.lat + (Math.random() - 0.5) * 10,
        hotspot.lon + (Math.random() - 0.5) * 10,
        GLOBE_RADIUS + 0.1 + Math.random() * 0.3
      );
      
      positions[i * 3] = startPos.x;
      positions[i * 3 + 1] = startPos.y;
      positions[i * 3 + 2] = startPos.z;
      
      // Random target hotspot
      const targetHotspot = HOTSPOT_NODES[(i + 1) % HOTSPOT_NODES.length];
      targets.push(get3DPos(targetHotspot.lat, targetHotspot.lon, GLOBE_RADIUS + 0.15));
      velocities.push(new THREE.Vector3());
    }
    
    return { positions, velocities, targets };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const posAttr = particlesRef.current.geometry.attributes.position;
    const time = state.clock.elapsedTime;
    const speed = 0.02 + bassLevel * 0.03;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      const currentPos = new THREE.Vector3(
        posAttr.array[idx],
        posAttr.array[idx + 1],
        posAttr.array[idx + 2]
      );
      
      // Update target if active track
      const target = activeCoords 
        ? get3DPos(activeCoords.lat, activeCoords.lon, GLOBE_RADIUS + 0.15)
        : targets[i];
      
      // Move toward target
      const direction = target.clone().sub(currentPos).normalize();
      currentPos.add(direction.multiplyScalar(speed));
      
      // Keep on sphere surface (with slight offset)
      const surfaceRadius = GLOBE_RADIUS + 0.1 + Math.sin(time * 2 + i) * 0.05;
      currentPos.normalize().multiplyScalar(surfaceRadius);
      
      // Reset if too close to target
      if (currentPos.distanceTo(target) < 0.3) {
        const hotspot = HOTSPOT_NODES[Math.floor(Math.random() * HOTSPOT_NODES.length)];
        const newPos = get3DPos(
          hotspot.lat + (Math.random() - 0.5) * 20,
          hotspot.lon + (Math.random() - 0.5) * 20,
          surfaceRadius
        );
        currentPos.copy(newPos);
      }
      
      posAttr.array[idx] = currentPos.x;
      posAttr.array[idx + 1] = currentPos.y;
      posAttr.array[idx + 2] = currentPos.z;
    }
    
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        color="#22c55e"
        size={0.03}
        transparent
        opacity={0.6 + bassLevel * 0.3}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Hotspot node data (global active nodes)
const HOTSPOT_NODES = [
  { lat: 35.6762, lon: 139.6503, label: "TOKYO" },
  { lat: 52.5200, lon: 13.4050, label: "BERLIN" },
  { lat: 25.7617, lon: -80.1918, label: "MIAMI" },
  { lat: 40.7128, lon: -74.0060, label: "NYC" },
  { lat: -33.8688, lon: 151.2093, label: "SYDNEY" },
  { lat: 51.5074, lon: -0.1278, label: "LONDON" },
];

// Audio-reactive hotspot marker
interface HotspotProps {
  lat: number;
  lon: number;
  isActive: boolean;
  bassLevel: number;
  midLevel: number;
}

function Hotspot({ lat, lon, isActive, bassLevel, midLevel }: HotspotProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const basePosition = useMemo(() => get3DPos(lat, lon, 2.52), [lat, lon]);

  useFrame((state) => {
    if (meshRef.current) {
      // Pulse with bass when active, subtle idle animation otherwise
      const bassScale = isActive ? 1 + bassLevel * 1.5 : 1;
      const idleScale = 1 + Math.sin(state.clock.elapsedTime * 2 + lat) * 0.1;
      meshRef.current.scale.setScalar(bassScale * idleScale);
    }
    
    if (ringRef.current && isActive) {
      // Expanding ring synced to mid frequencies
      const ringPhase = (state.clock.elapsedTime * 2 + midLevel * 5) % 2;
      ringRef.current.scale.setScalar(1 + ringPhase * 0.8);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - ringPhase * 0.6);
    }

    if (glowRef.current) {
      // Glow intensity follows bass
      const glowIntensity = isActive ? 0.3 + bassLevel * 0.5 : 0.1;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glowIntensity;
    }
  });

  return (
    <group position={basePosition}>
      {/* Core hotspot dot */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial 
          color={isActive ? "#ff3333" : "#22c55e"} 
          transparent 
          opacity={isActive ? 1 : 0.7} 
        />
      </mesh>
      
      {/* Expanding ring for active hotspot */}
      {isActive && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.06, 0.1, 32]} />
          <meshBasicMaterial color="#ff3333" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      
      {/* Glow effect */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial 
          color={isActive ? "#ff3333" : "#22c55e"} 
          transparent 
          opacity={0.15} 
        />
      </mesh>
    </group>
  );
}

// Targeting beam with audio reactivity
function TargetingBeam({ targetPos, bassLevel }: { targetPos: THREE.Vector3 | null; bassLevel: number }) {
  const lineRef = useRef<THREE.Line>(null!);
  
  useFrame((state) => {
    if (lineRef.current && targetPos) {
      // Beam pulses with bass
      const opacity = 0.3 + bassLevel * 0.4 + Math.sin(state.clock.elapsedTime * 8) * 0.1;
      (lineRef.current.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  });

  if (!targetPos) return null;

  const points = [new THREE.Vector3(0, 0, 0), targetPos];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <primitive 
      object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ 
        color: "#ff3333", 
        transparent: true, 
        opacity: 0.5 
      }))} 
      ref={lineRef} 
    />
  );
}

// Audio-reactive particle ring around the globe
function AudioRing({ bassLevel, midLevel, highLevel }: { bassLevel: number; midLevel: number; highLevel: number }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const ring3Ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Bass ring - horizontal, expands with bass
    if (ringRef.current) {
      const bassScale = 1 + bassLevel * 0.3;
      ringRef.current.scale.set(bassScale, bassScale, 1);
      ringRef.current.rotation.z = time * 0.2;
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.1 + bassLevel * 0.3;
    }
    
    // Mid ring - tilted, pulses with mids
    if (ring2Ref.current) {
      const midScale = 1 + midLevel * 0.2;
      ring2Ref.current.scale.set(midScale, midScale, 1);
      ring2Ref.current.rotation.z = -time * 0.15;
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + midLevel * 0.2;
    }
    
    // High ring - outer, shimmer with highs
    if (ring3Ref.current) {
      const highScale = 1.1 + highLevel * 0.15;
      ring3Ref.current.scale.set(highScale, highScale, 1);
      ring3Ref.current.rotation.z = time * 0.1;
      (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.05 + highLevel * 0.15;
    }
  });

  return (
    <group>
      {/* Bass ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 2.65, 64]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Mid ring - tilted */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2.5, 0.3, 0]}>
        <ringGeometry args={[2.7, 2.73, 64]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      
      {/* High ring - outer */}
      <mesh ref={ring3Ref} rotation={[Math.PI / 3, -0.2, 0]}>
        <ringGeometry args={[2.85, 2.87, 64]} />
        <meshBasicMaterial color="#86efac" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Camera controller for dynamic zoom that respects user input
function CameraController({ 
  activeTrack, 
  activeCoords 
}: { 
  activeTrack: AudioAsset | null; 
  activeCoords: { lat: number; lon: number } | null;
}) {
  const { camera } = useThree();
  const isUserInteracting = useRef(false);
  const lastInteractionTime = useRef(0);
  const targetCameraPos = useRef(new THREE.Vector3(0, 0, 8));
  
  // Detect user interaction (zoom/rotate)
  useEffect(() => {
    const handleInteractionStart = () => {
      isUserInteracting.current = true;
      lastInteractionTime.current = Date.now();
    };
    
    const handleInteractionEnd = () => {
      isUserInteracting.current = false;
      lastInteractionTime.current = Date.now();
    };
    
    // Listen for mouse/touch events on canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', handleInteractionStart);
      canvas.addEventListener('mouseup', handleInteractionEnd);
      canvas.addEventListener('wheel', () => {
        lastInteractionTime.current = Date.now();
      });
      canvas.addEventListener('touchstart', handleInteractionStart);
      canvas.addEventListener('touchend', handleInteractionEnd);
    }
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('mousedown', handleInteractionStart);
        canvas.removeEventListener('mouseup', handleInteractionEnd);
        canvas.removeEventListener('touchstart', handleInteractionStart);
        canvas.removeEventListener('touchend', handleInteractionEnd);
      }
    };
  }, []);

  useFrame(() => {
    // Only auto-move camera if user hasn't interacted for 3 seconds
    const timeSinceInteraction = Date.now() - lastInteractionTime.current;
    const shouldAutoMove = timeSinceInteraction > 3000 && !isUserInteracting.current;
    
    if (shouldAutoMove) {
      // Calculate target camera position based on active track
      const targetDistance = activeTrack ? 5.5 : 8;
      
      if (activeCoords) {
        targetCameraPos.current = get3DPos(activeCoords.lat, activeCoords.lon, targetDistance);
      } else {
        targetCameraPos.current.set(0, 0, 8);
      }
      
      // Smooth lerp to target position
      camera.position.lerp(targetCameraPos.current, 0.02);
    }
    
    // Always look at center
    camera.lookAt(0, 0, 0);
  });

  return null;
}

interface TacticalGlobeProps {
  activeTrack: AudioAsset | null;
  audioIntensity?: number;
  bassLevel?: number;
  midLevel?: number;
  highLevel?: number;
}

function TacticalGlobe({ 
  activeTrack, 
  audioIntensity = 0,
  bassLevel = 0,
  midLevel = 0,
  highLevel = 0
}: TacticalGlobeProps) {
  const globeRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);
  const atmosphereRef = useRef<THREE.Mesh>(null!);
  const atmosphere2Ref = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const continentGroupRef = useRef<THREE.Group>(null!);

  const GLOBE_RADIUS = 2.5;

  // Parse active track coordinates
  const activeCoords = useMemo(() => {
    if (!activeTrack?.coordinates) return null;
    return parseCoordinates(activeTrack.coordinates);
  }, [activeTrack]);

  const targetPosition = useMemo(() => {
    if (!activeCoords) return null;
    return get3DPos(activeCoords.lat, activeCoords.lon, GLOBE_RADIUS + 0.02);
  }, [activeCoords]);

  // Logic for audio reactivity and rotation
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // 1. Slow rotation when idle, subtle wobble when playing
    if (groupRef.current) {
      if (!activeTrack) {
        groupRef.current.rotation.y += 0.001;
      } else {
        // Subtle wobble synced to bass
        groupRef.current.rotation.x = Math.sin(time * 2) * bassLevel * 0.05;
        groupRef.current.rotation.z = Math.cos(time * 1.5) * bassLevel * 0.03;
      }
    }

    // 2. Globe material reacts to audio
    if (materialRef.current) {
      // Emissive intensity follows overall intensity
      const baseEmissive = activeTrack ? 0.5 : 0.3;
      materialRef.current.emissiveIntensity = baseEmissive + audioIntensity * 0.8;
      
      // Opacity pulses with bass
      materialRef.current.opacity = 0.15 + bassLevel * 0.15;
    }

    // 3. Globe scale pulses with bass (subtle)
    if (globeRef.current) {
      const pulseScale = 1 + bassLevel * 0.02;
      globeRef.current.scale.setScalar(pulseScale);
    }

    // 4. Continent group scales with globe
    if (continentGroupRef.current) {
      const pulseScale = 1 + bassLevel * 0.02;
      continentGroupRef.current.scale.setScalar(pulseScale);
    }

    // 5. Atmosphere glow responds to mids and highs
    if (atmosphereRef.current) {
      const atmosphereScale = 1.02 + midLevel * 0.03;
      atmosphereRef.current.scale.setScalar(atmosphereScale);
      (atmosphereRef.current.material as THREE.MeshBasicMaterial).opacity = 0.05 + midLevel * 0.1;
    }

    if (atmosphere2Ref.current) {
      const atmosphere2Scale = 1.08 + highLevel * 0.04;
      atmosphere2Ref.current.scale.setScalar(atmosphere2Scale);
      (atmosphere2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.02 + highLevel * 0.08;
    }

    // 6. Point light intensity follows audio
    if (lightRef.current) {
      lightRef.current.intensity = 0.8 + audioIntensity * 1.5;
    }
  });

  return (
    <>
      {/* Camera Controller - handles auto fly-to while respecting user zoom/rotate */}
      <CameraController activeTrack={activeTrack} activeCoords={activeCoords} />
      
      <group ref={groupRef}>
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.3} />
        <pointLight ref={lightRef} position={[10, 10, 10]} intensity={1} color="#22c55e" />
        
        {/* The Core Wireframe Globe - subtle grid */}
        <mesh ref={globeRef}>
          <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
          <meshStandardMaterial 
            ref={materialRef}
            wireframe 
            color="#22c55e" 
            transparent 
            opacity={0.12} 
            emissive="#22c55e"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Inner solid core - ocean */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS - 0.02, 32, 32]} />
          <meshBasicMaterial color="#0a1628" transparent opacity={0.98} />
        </mesh>

        {/* Lat/Lon Grid Lines */}
        <GridLines radius={GLOBE_RADIUS + 0.005} />

        {/* Filled Continents - land masses */}
        <FilledContinents radius={GLOBE_RADIUS + 0.008} />

        {/* Continent Outlines - borders */}
        <group ref={continentGroupRef}>
          <ContinentOutlines radius={GLOBE_RADIUS + 0.01} opacity={0.9} />
        </group>

        {/* Fresnel Rim Glow */}
        <FresnelGlobe radius={GLOBE_RADIUS} audioIntensity={audioIntensity} />

        {/* Data Stream Particles */}
        <DataStreams activeCoords={activeCoords} bassLevel={bassLevel} />

        {/* Atmospheric Outer Glow - Layer 1 */}
        <mesh ref={atmosphereRef} scale={[1.02, 1.02, 1.02]}>
          <sphereGeometry args={[GLOBE_RADIUS, 32, 32]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.05} side={THREE.BackSide} />
        </mesh>

        {/* Atmospheric Outer Glow - Layer 2 (larger) */}
        <mesh ref={atmosphere2Ref} scale={[1.08, 1.08, 1.08]}>
          <sphereGeometry args={[GLOBE_RADIUS, 32, 32]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.02} side={THREE.BackSide} />
        </mesh>

        {/* Audio-reactive rings */}
        {activeTrack && (
          <AudioRing bassLevel={bassLevel} midLevel={midLevel} highLevel={highLevel} />
        )}

        {/* Hotspot Nodes */}
        {HOTSPOT_NODES.map((node, i) => {
          const isActive = activeCoords 
            ? Math.abs(node.lat - activeCoords.lat) < 1 && Math.abs(node.lon - activeCoords.lon) < 1
            : false;
          return (
            <Hotspot 
              key={i} 
              lat={node.lat} 
              lon={node.lon} 
              isActive={isActive}
              bassLevel={bassLevel}
              midLevel={midLevel}
            />
          );
        })}

        {/* Targeting Beam to Active Location */}
        <TargetingBeam targetPos={targetPosition} bassLevel={bassLevel} />
      </group>
    </>
  );
}

interface GlobeViewProps {
  activeTrack: AudioAsset | null;
  audioIntensity?: number;
  bassLevel?: number;
  midLevel?: number;
  highLevel?: number;
}

export default function GlobeView({ 
  activeTrack, 
  audioIntensity,
  bassLevel,
  midLevel,
  highLevel
}: GlobeViewProps) {
  return (
    <div className="w-full h-full bg-black relative">
      {/* Scan lines overlay for terminal aesthetic */}
      <div 
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.5) 2px, rgba(0, 0, 0, 0.5) 4px)',
        }}
      />
      
      <Canvas gl={{ antialias: true, alpha: false }}>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
        <TacticalGlobe 
          activeTrack={activeTrack} 
          audioIntensity={audioIntensity}
          bassLevel={bassLevel}
          midLevel={midLevel}
          highLevel={highLevel}
        />
        <OrbitControls 
          enablePan={false} 
          maxDistance={20}
          minDistance={3.2}
          rotateSpeed={0.5}
          zoomSpeed={1.2}
          enableDamping={true}
          dampingFactor={0.05}
        />
        
        {/* Post-processing effects - temporarily disabled for compatibility */}
        {/* <EffectComposer multisampling={0}>
          <Bloom 
            intensity={0.8}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
          />
          <Vignette 
            offset={0.3}
            darkness={0.6}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer> */}
      </Canvas>
    </div>
  );
}
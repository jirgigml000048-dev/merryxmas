import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, AppConfig, FormationType, ParticleData, TopperType } from '../types';
import { BRAND_LOGOS } from '../constants/assets';

// Shaders
const vertexShader = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5, 0.5));
    if (r > 0.5) discard;
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);
    gl_FragColor = vec4(vColor, glow);
  }
`;

interface SceneProps {
  state: AppState;
  config: AppConfig;
  dragDelta: React.MutableRefObject<{ x: number; y: number }>;
  gestureState: React.MutableRefObject<{ rotationY: number; rotationX: number; zoomDistance: number; isZooming: boolean }>;
}

export const Scene: React.FC<SceneProps> = ({ state, config, dragDelta, gestureState }) => {
  const { viewport } = useThree();
  const particleSystem = useRef<THREE.Points>(null);
  const particlesData = useRef<ParticleData[]>([]);
  
  // 生成目标位置逻辑
  const targetPositions = useMemo(() => {
    const positions: Record<string, Float32Array> = {};
    const count = config.particles.count;

    // Helper: Generate Tree (Cone)
    const generateTree = (height: number, radius: number, spirals: number, tightness: number, xOff: number, yOff: number) => {
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const progress = i / count;
        const y = (progress * height) - (height / 2) + yOff;
        const radiusAtHeight = radius * (1 - progress);
        const angle = progress * Math.PI * 2 * spirals + (Math.random() * Math.PI * 2); // Randomness for volume
        const r = radiusAtHeight * Math.sqrt(Math.random()); // Uniform distribution in circle
        
        arr[i3] = r * Math.cos(angle) + xOff;
        arr[i3 + 1] = y;
        arr[i3 + 2] = r * Math.sin(angle);
      }
      return arr;
    };

    // Helper: Generate Text or Logo from Image Data
    // 注意：虽然这个函数保留了，但下面的调用中去掉了 Anker 等品牌
    const generateFromLogo = (imgUrl: string, scale: number = 1.0, type: FormationType) => {
        // Mock implementation since we don't have actual image processing in this snippet
        // In a real app, this would parse pixel data. 
        // Returning sphere as fallback for safety.
        const arr = new Float32Array(count * 3);
        const r = 5 * scale;
        for(let i=0; i<count; i++) {
            const i3 = i * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            arr[i3] = r * Math.sin(phi) * Math.cos(theta);
            arr[i3+1] = r * Math.sin(phi) * Math.sin(theta);
            arr[i3+2] = r * Math.cos(phi);
        }
        return arr;
    };
    
    // Helper: Generate Specific Shapes (Hardcoded for demo)
    const generateShape = (type: FormationType) => {
        const arr = new Float32Array(count * 3);
        // ... simplistic shape generation placeholders ...
        for(let i=0; i<count; i++) {
            const i3 = i * 3;
            // Default Sphere
            const r = 6;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            arr[i3] = r * Math.sin(phi) * Math.cos(theta);
            arr[i3+1] = r * Math.sin(phi) * Math.sin(theta);
            arr[i3+2] = r * Math.cos(phi);
        }
        return arr;
    };

    // --- 核心修复点 1：移除了 deleted brands 的 case ---
    switch (config.formation) {
      case FormationType.TREE:
        positions[FormationType.TREE] = generateTree(config.tree.height, config.tree.radius, config.tree.spirals, config.tree.spiralTightness, config.tree.xOffset, config.tree.yOffset);
        break;
      case FormationType.PINK_TREE:
         positions[FormationType.PINK_TREE] = generateTree(config.tree.height, config.tree.radius, config.tree.spirals, config.tree.spiralTightness, config.tree.xOffset, config.tree.yOffset);
         break;
      case FormationType.RED_TREE:
         positions[FormationType.RED_TREE] = generateTree(config.tree.height, config.tree.radius, config.tree.spirals, config.tree.spiralTightness, config.tree.xOffset, config.tree.yOffset);
         break;
      case FormationType.TEXT:
        // Text generation logic placeholder
        positions[FormationType.TEXT] = generateShape(FormationType.TEXT);
        break;
      
      // 其他保留的场景
      case FormationType.HAT:
      case FormationType.STOCKING:
      case FormationType.ELK:
      case FormationType.SANTA:
      case FormationType.GIFT:
         positions[config.formation] = generateShape(config.formation);
         break;

      // ⚠️ 已删除：ANKER, ANKERMAKER, SOUNDCORE, EUFY 的 case 语句
    }

    return positions;
  }, [config.particles.count, config.tree, config.formation]); 

  // 初始化粒子
  useEffect(() => {
    if (!particleSystem.current) return;
    
    const count = config.particles.count;
    const geometry = particleSystem.current.geometry;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    particlesData.current = [];

    const colorEmerald = new THREE.Color(config.colors.emerald);
    const colorGold = new THREE.Color(config.colors.gold);
    const colorRed = new THREE.Color(config.colors.red);
    const colorText = new THREE.Color(config.colors.text);

    // --- 核心修复点 2：移除了 deleted brands 的颜色定义 ---
    // const colorAnkermaker = new THREE.Color(config.colors.ankermaker); <-- 删除
    // const colorAnker = new THREE.Color(config.colors.anker); <-- 删除
    // const colorSoundcore = new THREE.Color(config.colors.soundcore); <-- 删除
    // const colorEufy = new THREE.Color(config.colors.eufy); <-- 删除

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      
      let c = colorEmerald;
      if (Math.random() > 0.6) c = colorGold;
      if (Math.random() > 0.9) c = colorRed;
      
      if (config.formation === FormationType.TEXT) c = colorText;
      if (config.formation === FormationType.PINK_TREE) c = new THREE.Color('#ffb7c5'); 
      if (config.formation === FormationType.RED_TREE) c = colorRed;
      
      // --- 核心修复点 3：移除了 deleted brands 的颜色赋值逻辑 ---
      // if (config.formation === FormationType.ANKERMAKER) c = colorAnkermaker; <-- 删除
      // if (config.formation === FormationType.ANKER) c = colorAnker; <-- 删除
      // ... 等等

      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
      
      sizes[i] = config.particles.size * (Math.random() * 0.5 + 0.5);

      particlesData.current.push({
        chaosPos: new THREE.Vector3(x, y, z),
        targetPos: new THREE.Vector3(0, 0, 0),
        currentPos: new THREE.Vector3(x, y, z),
        color: c.clone(),
        size: sizes[i],
        speed: config.particles.speed * (0.5 + Math.random() * 0.5),
        type: 0 
      });
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
  }, [config.particles.count, config.colors, config.formation]); 

  useFrame((state, delta) => {
    if (!particleSystem.current) return;

    const time = state.clock.getElapsedTime();
    const count = config.particles.count;
    
    // Rotation & Zoom Logic (Unchanged)
    const group = particleSystem.current;
    if (gestureState.current.isZooming) {
        group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, gestureState.current.zoomDistance, 0.1));
    } else {
        group.rotation.y += config.particles.rotationSpeed * delta * 0.1;
    }
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, gestureState.current.rotationX, 0.1);

    const positionsArray = particleSystem.current.geometry.attributes.position.array as Float32Array;
    const currentTargetPositions = targetPositions[config.formation] || targetPositions[FormationType.TREE]; 

    const isChaos = state === AppState.CHAOS;

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const particle = particlesData.current[i];
        
        let targetX = 0, targetY = 0, targetZ = 0;

        if (isChaos) {
            targetX = particle.chaosPos.x + Math.sin(time + i) * 0.05;
            targetY = particle.chaosPos.y + Math.cos(time + i * 0.5) * 0.05;
            targetZ = particle.chaosPos.z;
        } else {
            // 安全的获取目标位置，如果某种原因越界，回退到 0
            targetX = currentTargetPositions[i3] || 0;
            targetY = currentTargetPositions[i3 + 1] || 0;
            targetZ = currentTargetPositions[i3 + 2] || 0;
        }

        particle.currentPos.x += (targetX - particle.currentPos.x) * delta * particle.speed;
        particle.currentPos.y += (targetY - particle.currentPos.y) * delta * particle.speed;
        particle.currentPos.z += (targetZ - particle.currentPos.z) * delta * particle.speed;
        
        positionsArray[i3] = particle.currentPos.x;
        positionsArray[i3 + 1] = particle.currentPos.y;
        positionsArray[i3 + 2] = particle.currentPos.z;
    }
    
    particleSystem.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particleSystem}>
      <bufferGeometry />
      <shaderMaterial 
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

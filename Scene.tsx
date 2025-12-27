import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, AppConfig, FormationType, ParticleData } from '../types';

// Shaders (保持不变)
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
  const particleSystem = useRef<THREE.Points>(null);
  const particlesData = useRef<ParticleData[]>([]);
  
  // 生成目标位置逻辑
  const targetPositions = useMemo(() => {
    const positions: Record<string, Float32Array> = {};
    const count = config.particles.count;

    // 通用形状生成器（球体），作为兜底
    const generateSphere = () => {
        const arr = new Float32Array(count * 3);
        const r = 6;
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

    // 树形生成器
    const generateTree = (height: number, radius: number, spirals: number, tightness: number, xOff: number, yOff: number) => {
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const progress = i / count;
        const y = (progress * height) - (height / 2) + yOff;
        const radiusAtHeight = radius * (1 - progress);
        const angle = progress * Math.PI * 2 * spirals + (Math.random() * Math.PI * 2);
        const r = radiusAtHeight * Math.sqrt(Math.random());
        
        arr[i3] = r * Math.cos(angle) + xOff;
        arr[i3 + 1] = y;
        arr[i3 + 2] = r * Math.sin(angle);
      }
      return arr;
    };

    // 根据 config.formation 生成对应的数据
    // 即使类型是 TEXT 或其他，这里也会确保有数据生成
    switch (config.formation) {
      case FormationType.TREE:
      case FormationType.PINK_TREE:
      case FormationType.RED_TREE:
        positions[config.formation] = generateTree(config.tree.height, config.tree.radius, config.tree.spirals, config.tree.spiralTightness, config.tree.xOffset, config.tree.yOffset);
        break;
        
      case FormationType.HAT:
      case FormationType.STOCKING:
      case FormationType.ELK:
      case FormationType.SANTA:
      case FormationType.GIFT:
      case FormationType.TEXT:
        // 这里暂时用球体代替复杂形状，防止因缺少 specific shape 逻辑导致崩溃
        positions[config.formation] = generateSphere(); 
        break;

      default:
        // 关键兜底：如果是不识别的类型，也生成一个球体
        positions[config.formation] = generateSphere();
        break;
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
    
    // 清空并重新填充
    particlesData.current = [];

    const colorEmerald = new THREE.Color(config.colors.emerald);
    const colorGold = new THREE.Color(config.colors.gold);
    const colorRed = new THREE.Color(config.colors.red);
    const colorText = new THREE.Color(config.colors.text);

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
    geometry.attributes.position.needsUpdate = true;
    
  }, [config.particles.count, config.colors, config.formation]); 

  useFrame((state, delta) => {
    // 1. 基础安全检查
    if (!particleSystem.current || !particleSystem.current.geometry.attributes.position) return;

    const time = state.clock.getElapsedTime();
    const count = config.particles.count;
    
    // 旋转控制
    const group = particleSystem.current;
    if (gestureState.current.isZooming) {
        group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, gestureState.current.zoomDistance, 0.1));
    } else {
        group.rotation.y += config.particles.rotationSpeed * delta * 0.1;
    }
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, gestureState.current.rotationX, 0.1);

    const positionsArray = particleSystem.current.geometry.attributes.position.array as Float32Array;
    
    // 2. 获取目标位置，并做空值保护
    // 如果当前 formation 没有生成位置数据，默认给一个空数组防止崩溃
    const currentTargetPositions = targetPositions[config.formation]; 
    
    // 如果真的拿不到目标位置（极端情况），直接退出本次渲染，防止闪屏
    if (!currentTargetPositions && state === AppState.FORMED) return;

    const isChaos = state === AppState.CHAOS;

    for (let i = 0; i < count; i++) {
        // 3. 核心防崩保护：检查 particlesData 是否存在
        // 当粒子数量变化时，particlesData 可能还没更新，这里直接跳过
        const particle = particlesData.current[i];
        if (!particle) continue;

        const i3 = i * 3;
        
        let targetX = 0, targetY = 0, targetZ = 0;

        if (isChaos) {
            targetX = particle.chaosPos.x + Math.sin(time + i) * 0.05;
            targetY = particle.chaosPos.y + Math.cos(time + i * 0.5) * 0.05;
            targetZ = particle.chaosPos.z;
        } else {
            // 安全读取数组
            targetX = currentTargetPositions ? currentTargetPositions[i3] || 0 : 0;
            targetY = currentTargetPositions ? currentTargetPositions[i3 + 1] || 0 : 0;
            targetZ = currentTargetPositions ? currentTargetPositions[i3 + 2] || 0 : 0;
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

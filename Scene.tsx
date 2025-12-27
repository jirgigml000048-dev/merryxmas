import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AppState, AppConfig, FormationType, ParticleData, OrnamentData } from '../types';
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
  
  // 生成目标形状的逻辑
  const targetPositions = useMemo(() => {
    const positions: Float32Array[] = [];
    const count = config.particles.count;

    // Helper: Generate Tree
    const treePositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const progress = i / count;
      const height = config.tree.height;
      const y = (progress * height) - (height / 2) + config.tree.yOffset;
      
      const radiusAtHeight = config.tree.radius * (1 - progress);
      const angle = progress * Math.PI * 2 * config.tree.spirals + (Math.random() * Math.PI * 2);
      
      const r = radiusAtHeight * Math.sqrt(Math.random()); 
      
      treePositions[i3] = r * Math.cos(angle) + config.tree.xOffset;
      treePositions[i3 + 1] = y;
      treePositions[i3 + 2] = r * Math.sin(angle);
    }
    positions[0] = treePositions; // Index corresponding to FormationType

    // Helper Function for Image/Text Formations (Generic)
    const generateFromShape = (scale: number = 1.0, type: FormationType) => {
       const arr = new Float32Array(count * 3);
       // 默认回落到球体或随机分布，因为我们移除了具体的图片处理逻辑
       // 如果你有通用的图片处理逻辑保留在这里，确保不要引用已删除的 FormationType
       for(let i=0; i<count; i++) {
         const i3 = i * 3;
         const theta = Math.random() * Math.PI * 2;
         const phi = Math.acos((Math.random() * 2) - 1);
         const r = 5 * Math.cbrt(Math.random());
         arr[i3] = r * Math.sin(phi) * Math.cos(theta);
         arr[i3+1] = r * Math.sin(phi) * Math.sin(theta);
         arr[i3+2] = r * Math.cos(phi);
       }
       return arr;
    };
    
    // 这里非常关键：我们需要确保返回的数组没有引用被删除的类型
    // 根据你的 FormationType enum 顺序，我们需要重新构建这个映射逻辑
    // 为了简单起见，且避免复杂的索引对齐问题，我们在渲染循环里直接根据 config.formation 判断生成逻辑
    // 所以这里我们主要关注那些需要预计算的复杂形状。
    // 由于你删除了特定品牌的 Logo，我们只需确保这里的逻辑不会崩溃。
    
    return {
       [FormationType.TREE]: treePositions,
       // 其他类型的生成逻辑如果在这个 useMemo 里，请确保没有引用已删除的类型
       // 如果之前有类似 [FormationType.ANKER]: generateLogo(...) 的代码，必须删掉
    };
  }, [config.particles.count, config.tree, config.formation]); // 依赖项

  // 初始化粒子
  useEffect(() => {
    if (!particleSystem.current) return;
    
    const count = config.particles.count;
    const geometry = particleSystem.current.geometry;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    particlesData.current = [];

    const color1 = new THREE.Color(config.colors.emerald);
    const color2 = new THREE.Color(config.colors.gold);
    const color3 = new THREE.Color(config.colors.red);
    const colorText = new THREE.Color(config.colors.text);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // 初始随机位置 (Chaos)
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      
      // 颜色分配逻辑
      let c = color1;
      if (Math.random() > 0.6) c = color2;
      if (Math.random() > 0.9) c = color3;
      
      // 根据当前 Formation 覆盖颜色
      if (config.formation === FormationType.TEXT) c = colorText;
      // 删除了 ANKER 等颜色的判断
      
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
      
      sizes[i] = config.particles.size * (Math.random() * 0.5 + 0.5);

      particlesData.current.push({
        chaosPos: new THREE.Vector3(x, y, z),
        targetPos: new THREE.Vector3(0, 0, 0), // 初始目标占位
        currentPos: new THREE.Vector3(x, y, z),
        color: c.clone(),
        size: sizes[i],
        speed: config.particles.speed * (0.5 + Math.random() * 0.5),
        type: 0 // 0: normal, 1: ornament
      });
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
  }, [config.particles.count, config.colors, config.formation]); // 当 formation 改变时重新初始化颜色

  useFrame((state, delta) => {
    if (!particleSystem.current) return;

    const positions = particleSystem.current.geometry.attributes.position.array as Float32Array;
    const time = state.clock.getElapsedTime();
    
    // 更新目标位置逻辑
    // 这里我们动态计算目标位置，或者从 useMemo 的 targetPositions 里取
    // 为了简化，我们在这里写几个核心形状的逻辑，并确保没有已删除的品牌
    
    const count = config.particles.count;
    
    // 旋转和缩放控制
    const rotationSpeed = 0.2;
    const group = particleSystem.current;
    
    // 手势控制
    if (gestureState.current.isZooming) {
        group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, gestureState.current.zoomDistance, 0.1));
    } else {
        // 自动旋转或归位
        group.rotation.y += config.particles.rotationSpeed * delta * 0.1;
    }
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, gestureState.current.rotationX, 0.1);

    // 粒子动画循环
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const particle = particlesData.current[i];
        
        let targetX = 0, targetY = 0, targetZ = 0;

        if (isChaos) {
            targetX = particle.chaosPos.x;
            targetY = particle.chaosPos.y;
            targetZ = particle.chaosPos.z;
            
            // 添加一点噪点运动
            targetX += Math.sin(time + i) * 0.05;
            targetY += Math.cos(time + i * 0.5) * 0.05;
        } else {
            // FORMED 状态：根据 config.formation 计算目标
            // 这里是之前报错的高发区，我们必须移除 case FormationType.ANKER 等
            
            // 简单的形状生成示例 (你需要根据你的实际形状逻辑替换这里的 calculateTarget)
            // 假设 targetPositions 已经准备好了数据，或者在这里实时计算
            
            if (config.formation === FormationType.TREE) {
                 // 使用 useMemo 里算好的树数据，或者重新计算
                 // 这里为了演示，假设我们简单地形成一个圆锥
                 const progress = i / count;
                 const h = 12;
                 const y = (progress * h) - h/2;
                 const r = 4 * (1 - progress);
                 const angle = progress * 20 + time * 0.1;
                 targetX = Math.cos(angle) * r;
                 targetY = y;
                 targetZ = Math.sin(angle) * r;
            } 
            else if (config.formation === FormationType.GIFT) {
                 // 立方体逻辑
                 const side = 6;
                 const perFace = count / 6;
                 const face = Math.floor(i / perFace);
                 // ... 简化的盒子逻辑 ...
                 targetX = (Math.random() - 0.5) * side;
                 targetY = (Math.random() - 0.5) * side;
                 targetZ = (Math.random() - 0.5) * side;
            }
            // ... 其他保留的形状 (HAT, STOCKING 等) ...
            
            // 关键：绝对不要写 else if (config.formation === FormationType.ANKER)
            
            else {
                 // 默认球体，防止未知类型导致错误
                 const r = 5;
                 const theta = Math.random() * Math.PI * 2;
                 const phi = Math.acos(2 * Math.random() - 1);
                 targetX = r * Math.sin(phi) * Math.cos(theta);
                 targetY = r * Math.sin(phi) * Math.sin(theta);
                 targetZ = r * Math.cos(phi);
            }
        }

        // 差值移动逻辑
        particle.currentPos.x += (targetX - particle.currentPos.x) * delta * particle.speed;
        particle.currentPos.y += (targetY - particle.currentPos.y) * delta * particle.speed;
        particle.currentPos.z += (targetZ - particle.currentPos.z) * delta * particle.speed;
        
        positions[i3] = particle.currentPos.x;
        positions[i3 + 1] = particle.currentPos.y;
        positions[i3 + 2] = particle.currentPos.z;
    }
    
    particleSystem.current.geometry.attributes.position.needsUpdate = true;
  });

  const isChaos = state === AppState.CHAOS;

  return (
    <points ref={particleSystem}>
      <bufferGeometry />
      <shaderMaterial 
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
            // 如果有 uniforms 需要传递
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

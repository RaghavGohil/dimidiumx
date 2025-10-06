// components/SolarSystemRenderer.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { CSS2DRenderer, CSS2DObject } from 'three-stdlib';
import { ExoplanetSystem } from '@/lib/exoplanetSystemData';
import { getSolarSystemBodies, SolarSystemBody } from '@/lib/solarSystemData';
import { scaleCoordinates } from '@/lib/coordinateUtils';

interface SolarSystemRendererProps {
  allExoplanetSystems: ExoplanetSystem[];
  onSystemClick: (system: ExoplanetSystem) => void;
}

export default function SolarSystemRenderer({
  allExoplanetSystems,
  onSystemClick,
}: SolarSystemRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredSystem, setHoveredSystem] = useState<ExoplanetSystem | null>(null);
  const [hoveredOrbit, setHoveredOrbit] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [focusedPlanet, setFocusedPlanet] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialCameraPosRef = useRef(new THREE.Vector3(0, 200, 400));
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // ===== SCENE SETUP =====
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // ===== CAMERA SETUP =====
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 50000);
    camera.position.copy(initialCameraPosRef.current);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // ===== RENDERER SETUP =====
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // ===== LABEL RENDERER SETUP =====
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    // ===== CONTROLS SETUP =====
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 5000;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // ===== LIGHTING =====
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffffff, 8, 0, 2);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // ===== TEXTURE LOADER =====
    const textureLoader = new THREE.TextureLoader();

    // ===== REALISTIC SIZE RATIOS =====
    const realRadii: { [key: string]: number } = {
      Sun: 696000,
      Mercury: 2440,
      Venus: 6052,
      Earth: 6371,
      Mars: 3390,
      Jupiter: 69911,
      Saturn: 58232,
      Uranus: 25362,
      Neptune: 24622,
    };

    // Real orbital distances in AU
    const realOrbitalDistances: { [key: string]: number } = {
      Mercury: 0.39,
      Venus: 0.72,
      Earth: 1.0,
      Mars: 1.52,
      Jupiter: 5.2,
      Saturn: 9.54,
      Uranus: 19.19,
      Neptune: 30.07,
    };

    const SUN_DISPLAY_RADIUS = 10;
    const AU_SCALE = 40; // Scale for orbital distances
    const sunRealRadius = realRadii.Sun;

    // ===== RENDER SUN =====
    const sunData = getSolarSystemBodies()[0];
    const sunGeometry = new THREE.SphereGeometry(SUN_DISPLAY_RADIUS, 64, 64);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 1.5,
    });

    textureLoader.load(
      sunData.texturePath,
      (texture) => {
        sunMaterial.map = texture;
        sunMaterial.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.warn(`Failed to load Sun texture: ${sunData.texturePath}`);
      }
    );

    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.userData = { type: 'sun', name: 'Sun' };
    scene.add(sun);

    // ===== SUN GLOW =====
    const glowGeometry = new THREE.SphereGeometry(SUN_DISPLAY_RADIUS * 2, 64, 64);
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        c: { value: 0.6 },
        p: { value: 3.0 },
        glowColor: { value: new THREE.Color(0xffaa00) },
        viewVector: { value: camera.position }
      },
      vertexShader: `
        uniform vec3 viewVector;
        uniform float c;
        uniform float p;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormel = normalize(normalMatrix * viewVector);
          intensity = pow(c - dot(vNormal, vNormel), p);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          vec3 glow = glowColor * intensity;
          gl_FragColor = vec4(glow, intensity * 0.5);
        }
      `,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(sunGlow);

    // Sun label
    const sunLabelDiv = document.createElement('div');
    sunLabelDiv.textContent = 'Sun';
    sunLabelDiv.style.color = '#ffff00';
    sunLabelDiv.style.fontSize = '16px';
    sunLabelDiv.style.fontWeight = 'bold';
    sunLabelDiv.style.fontFamily = 'Arial, sans-serif';
    sunLabelDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    const sunLabel = new CSS2DObject(sunLabelDiv);
    sunLabel.position.set(0, SUN_DISPLAY_RADIUS + 3, 0);
    sun.add(sunLabel);

    // ===== RENDER PLANETS WITH CORRECT RATIOS =====
    const planets = getSolarSystemBodies().slice(1);
    const planetMeshes: THREE.Mesh[] = [];
    const invisibleHitboxes: THREE.Mesh[] = [];
    const orbitLines: THREE.Line[] = [];
    const planetData: SolarSystemBody[] = [];

    const planetColors: { [key: string]: number } = {
      Mercury: 0xd6d6d6,
      Venus: 0xffe8b8,
      Earth: 0x78b4ff,
      Mars: 0xff9070,
      Jupiter: 0xffd89a,
      Saturn: 0xfff4d6,
      Uranus: 0xa6f0ff,
      Neptune: 0x6c9cff,
    };

    planets.forEach((pData: SolarSystemBody) => {
      // Correct size ratio
      const planetRealRadius = realRadii[pData.name] || 6371;
      const radiusRatio = planetRealRadius / sunRealRadius;
      const displayRadius = Math.max(0.15, radiusRatio * SUN_DISPLAY_RADIUS);

      const geometry = new THREE.SphereGeometry(displayRadius, 64, 64);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.05,
        roughness: 0.3,
        emissive: 0x555555,
        emissiveIntensity: 0.3,
      });

      textureLoader.load(
        pData.texturePath,
        (texture) => {
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        (error) => {
          console.warn(`Failed to load texture for ${pData.name}: ${pData.texturePath}`);
          material.color.setHex(planetColors[pData.name] || 0xffffff);
        }
      );

      const planet = new THREE.Mesh(geometry, material);

      // Correct orbital distance
      const orbitalRadius = (realOrbitalDistances[pData.name] || pData.orbitalRadius) * AU_SCALE;

      planet.userData = {
        type: 'planet',
        name: pData.name,
        radius: displayRadius,
        orbitalRadius: orbitalRadius,
      };

      planet.position.set(orbitalRadius, 0, 0);
      scene.add(planet);
      planetMeshes.push(planet);
      planetData.push(pData);

      // ===== CREATE INVISIBLE HITBOX FOR EASIER CLICKING =====
      const hitboxRadius = Math.max(displayRadius * 3, 2.5);
      const hitboxGeometry = new THREE.SphereGeometry(hitboxRadius, 16, 16);
      const hitboxMaterial = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
      });
      
      const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
      hitbox.userData = {
        type: 'planet-hitbox',
        name: pData.name,
        radius: displayRadius,
        orbitalRadius: orbitalRadius,
        parentPlanet: planet,
      };
      
      planet.add(hitbox);
      invisibleHitboxes.push(hitbox);

      // PERMANENT PLANET LABEL
      const planetLabelDiv = document.createElement('div');
      planetLabelDiv.textContent = pData.name;
      planetLabelDiv.style.color = '#ffffff';
      planetLabelDiv.style.fontSize = '14px';
      planetLabelDiv.style.fontWeight = 'bold';
      planetLabelDiv.style.fontFamily = 'Arial, sans-serif';
      planetLabelDiv.style.textShadow = '1px 1px 3px rgba(0,0,0,0.9)';
      planetLabelDiv.style.pointerEvents = 'none';
      const planetLabel = new CSS2DObject(planetLabelDiv);
      planetLabel.position.set(0, displayRadius + 1, 0);
      planet.add(planetLabel);

      // Draw orbital path
      const orbitGeometry = new THREE.BufferGeometry();
      const orbitPoints: THREE.Vector3[] = [];
      const segments = 128;

      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const x = orbitalRadius * Math.cos(theta);
        const z = orbitalRadius * Math.sin(theta);
        orbitPoints.push(new THREE.Vector3(x, 0, z));
      }

      orbitGeometry.setFromPoints(orbitPoints);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.4,
      });

      const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
      orbitLine.userData = { type: 'orbit', planetName: pData.name };
      scene.add(orbitLine);
      orbitLines.push(orbitLine);
    });

    // ===== BACKGROUND STARFIELD =====
    const starfieldGeometry = new THREE.BufferGeometry();
    const starfieldPositions: number[] = [];
    const starfieldColors: number[] = [];

    for (let i = 0; i < 8000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 5000 + Math.random() * 5000;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      starfieldPositions.push(x, y, z);

      const brightness = 0.5 + Math.random() * 0.5;
      starfieldColors.push(brightness, brightness, 1);
    }

    starfieldGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starfieldPositions, 3)
    );
    starfieldGeometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(starfieldColors, 3)
    );

    const starfieldMaterial = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    const starfield = new THREE.Points(starfieldGeometry, starfieldMaterial);
    scene.add(starfield);

    // ===== EXOPLANET SYSTEM MARKERS =====
    const systemMarkers: THREE.Mesh[] = [];
    const systemData: ExoplanetSystem[] = [];
    const PARSEC_SCALE = 5;

    allExoplanetSystems.forEach((system) => {
      const scaledPos = scaleCoordinates(system.position, PARSEC_SCALE);

      const markerGeometry = new THREE.SphereGeometry(3, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(system.color),
        emissive: new THREE.Color(system.color),
        emissiveIntensity: 0.8,
      });

      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(scaledPos.x, scaledPos.y, scaledPos.z);
      marker.userData = { type: 'exoplanet-system', systemIndex: systemData.length };

      scene.add(marker);
      systemMarkers.push(marker);
      systemData.push(system);
    });

    // ===== RAYCASTER FOR INTERACTION =====
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 2 };
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      setMousePos({ x: event.clientX, y: event.clientY });

      raycaster.setFromCamera(mouse, camera);

      // Check hitbox hover
      const hitboxIntersects = raycaster.intersectObjects(invisibleHitboxes);
      if (hitboxIntersects.length > 0) {
        document.body.style.cursor = 'pointer';
        return;
      }

      // Check orbit hover
      const orbitIntersects = raycaster.intersectObjects(orbitLines);
      if (orbitIntersects.length > 0) {
        const orbitObj = orbitIntersects[0].object as THREE.Line;
        const planetName = orbitObj.userData.planetName;
        setHoveredOrbit(planetName);
        document.body.style.cursor = 'pointer';
        return;
      } else {
        setHoveredOrbit(null);
      }

      // Check system hover
      const systemIntersects = raycaster.intersectObjects(systemMarkers);
      if (systemIntersects.length > 0) {
        const intersectedMarker = systemIntersects[0].object as THREE.Mesh;
        const index = intersectedMarker.userData.systemIndex;
        if (index !== undefined && systemData[index]) {
          setHoveredSystem(systemData[index]);
          document.body.style.cursor = 'pointer';
          return;
        }
      }

      setHoveredSystem(null);
      document.body.style.cursor = 'default';
    };

    // ===== FIXED: CAMERA ANIMATION THAT STOPS AFTER COMPLETION =====
    const focusPlanet = (planetName: string, planetPosition: THREE.Vector3, planetRadius: number) => {
      console.log('🪐 Focusing on planet:', planetName);
      
      setFocusedPlanet(planetName);
      setIsTransitioning(true);

      const distance = Math.max(planetRadius * 8, 5);
      const newCameraPos = new THREE.Vector3(
        planetPosition.x + distance,
        planetPosition.y + distance * 0.5,
        planetPosition.z + distance
      );

      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      let progress = 0;

      // Cancel any existing animation
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const animateCamera = () => {
        progress += 0.04;
        
        if (progress < 1) {
          // Still animating
          camera.position.lerpVectors(startPos, newCameraPos, progress);
          controls.target.lerpVectors(startTarget, planetPosition, progress);
          controls.update();
          animationFrameRef.current = requestAnimationFrame(animateCamera);
        } else {
          // Animation complete - set final position and STOP
          camera.position.copy(newCameraPos);
          controls.target.copy(planetPosition);
          controls.update();
          setIsTransitioning(false);
          animationFrameRef.current = null;
          console.log('✅ Camera animation complete - controls now free');
        }
      };

      animateCamera();
    };

    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      console.log('🖱️ Click detected');

      // PRIORITY 1: Check invisible hitboxes
      const hitboxIntersects = raycaster.intersectObjects(invisibleHitboxes);
      if (hitboxIntersects.length > 0) {
        const clickedHitbox = hitboxIntersects[0].object as THREE.Mesh;
        const planetName = clickedHitbox.userData.name;
        const parentPlanet = clickedHitbox.userData.parentPlanet as THREE.Mesh;
        const planetRadius = clickedHitbox.userData.radius;
        
        console.log('✅ Planet hitbox clicked:', planetName);
        
        const worldPos = new THREE.Vector3();
        parentPlanet.getWorldPosition(worldPos);
        
        focusPlanet(planetName, worldPos, planetRadius);
        return;
      }

      // PRIORITY 2: Check actual planet meshes
      const planetIntersects = raycaster.intersectObjects(planetMeshes);
      if (planetIntersects.length > 0) {
        const clickedPlanet = planetIntersects[0].object as THREE.Mesh;
        const planetName = clickedPlanet.userData.name;
        const planetRadius = clickedPlanet.userData.radius;
        
        console.log('✅ Planet mesh clicked:', planetName);
        
        const worldPos = new THREE.Vector3();
        clickedPlanet.getWorldPosition(worldPos);
        
        focusPlanet(planetName, worldPos, planetRadius);
        return;
      }

      // PRIORITY 3: Check exoplanet system markers
      const systemIntersects = raycaster.intersectObjects(systemMarkers);
      if (systemIntersects.length > 0) {
        const intersectedMarker = systemIntersects[0].object as THREE.Mesh;
        const index = intersectedMarker.userData.systemIndex;
        
        console.log('🌟 Exoplanet system clicked');
        
        if (index !== undefined && systemData[index]) {
          const targetSystem = systemData[index];
          const markerPos = systemMarkers[index].position.clone();

          setIsTransitioning(true);

          if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
          }

          const startPos = camera.position.clone();
          const startTarget = controls.target.clone();
          const zoomDistance = 50;
          const newCameraPos = markerPos.clone().add(new THREE.Vector3(zoomDistance, zoomDistance * 0.5, zoomDistance));

          let progress = 0;
          const transitionDuration = 60;

          const animateTransition = () => {
            progress += 1 / transitionDuration;
            if (progress < 1) {
              camera.position.lerpVectors(startPos, newCameraPos, progress);
              controls.target.lerpVectors(startTarget, markerPos, progress);
              controls.update();
              animationFrameRef.current = requestAnimationFrame(animateTransition);
            } else {
              console.log('🚀 Transition complete, switching view');
              animationFrameRef.current = null;
              onSystemClick(targetSystem);
            }
          };

          animateTransition();
          return;
        }
      }

      console.log('❌ No object clicked');
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    // ===== WINDOW RESIZE =====
    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      labelRenderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // ===== ANIMATION LOOP =====
    let mainAnimationId: number;

    const animate = () => {
      mainAnimationId = requestAnimationFrame(animate);

      // Only update planet positions, NOT camera
      planetMeshes.forEach((planet, index) => {
        const pData = planetData[index];
        const speed = 0.0001 / pData.orbitalPeriod;
        const angle = Date.now() * speed;
        const orbitalRadius = planet.userData.orbitalRadius;

        planet.position.x = orbitalRadius * Math.cos(angle);
        planet.position.z = orbitalRadius * Math.sin(angle);
        planet.rotation.y += 0.005;
      });

      sun.rotation.y += 0.001;

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    animate();

    // ===== CLEANUP =====
    return () => {
      cancelAnimationFrame(mainAnimationId);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
      renderer.dispose();
      controls.dispose();
    };
  }, [allExoplanetSystems, onSystemClick]);

  const handleBackToSystem = () => {
    console.log('🔙 Returning to solar system view');
    setFocusedPlanet(null);
    setIsTransitioning(true);

    // Cancel any ongoing animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (cameraRef.current && controlsRef.current) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const targetPos = new THREE.Vector3(0, 0, 0);
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();

      let progress = 0;

      const animateCamera = () => {
        progress += 0.04;
        if (progress < 1) {
          camera.position.lerpVectors(startPos, initialCameraPosRef.current, progress);
          controls.target.lerpVectors(startTarget, targetPos, progress);
          controls.update();
          animationFrameRef.current = requestAnimationFrame(animateCamera);
        } else {
          camera.position.copy(initialCameraPosRef.current);
          controls.target.copy(targetPos);
          controls.update();
          setIsTransitioning(false);
          animationFrameRef.current = null;
        }
      };

      animateCamera();
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
        }}
      />

      {/* Orbit Hover Tooltip */}
      {hoveredOrbit && !focusedPlanet && (
        <div
          style={{
            position: 'fixed',
            left: mousePos.x + 15,
            top: mousePos.y + 15,
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            pointerEvents: 'none',
            zIndex: 1000,
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          {hoveredOrbit}'s Orbit
        </div>
      )}

      {/* Back to System Button */}
      {focusedPlanet && (
        <button
          onClick={handleBackToSystem}
          disabled={isTransitioning}
          style={{
            position: 'fixed',
            top: '80px',
            left: '20px',
            padding: '12px 24px',
            background: isTransitioning ? 'rgba(100, 100, 100, 0.5)' : 'rgba(0, 120, 255, 0.8)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: isTransitioning ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            zIndex: 1000,
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            if (!isTransitioning) {
              e.currentTarget.style.background = 'rgba(0, 150, 255, 1)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isTransitioning) {
              e.currentTarget.style.background = 'rgba(0, 120, 255, 0.8)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          ← Back to System
        </button>
      )}

      {/* System Hover Tooltip */}
      {hoveredSystem && !focusedPlanet && (
        <div
          style={{
            position: 'fixed',
            left: mousePos.x + 15,
            top: mousePos.y + 15,
            background: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            pointerEvents: 'none',
            zIndex: 1000,
            border: `2px solid ${hoveredSystem.color}`,
            minWidth: '200px',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{hoveredSystem.hostname}</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            {hoveredSystem.distance.toFixed(1)} pc | {hoveredSystem.planetCount} planet
            {hoveredSystem.planetCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Info Panel */}
      {!focusedPlanet && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: '20px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '20px',
            borderRadius: '12px',
            fontSize: '14px',
            zIndex: 1000,
            minWidth: '250px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#ffd700' }}>
            Solar System
          </h2>
          <p style={{ margin: '5px 0', fontSize: '14px' }}>8 Planets</p>
          <p style={{ margin: '10px 0 5px 0', fontSize: '12px', opacity: 0.7 }}>
            {allExoplanetSystems.length} exoplanet systems loaded
          </p>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
            <strong>Click</strong> colored markers to explore exoplanets
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
            <strong>Click</strong> planets to zoom in
          </p>
        </div>
      )}

      {/* Focused Planet Info */}
      {focusedPlanet && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '20px',
            borderRadius: '12px',
            fontSize: '14px',
            zIndex: 1000,
            minWidth: '200px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#4a9eff' }}>
            {focusedPlanet}
          </h2>
          <p style={{ margin: '5px 0', fontSize: '12px', opacity: 0.7 }}>Solar System</p>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
            <strong>Click another planet</strong> to switch view
          </p>
          {/* <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.9, color: '#4ade80' }}>
            ✓ Camera controls are free
          </p> */}
        </div>
      )}
    </>
  );
}

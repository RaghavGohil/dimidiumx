// components/StarRenderer.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { CSS2DRenderer, CSS2DObject } from 'three-stdlib';
import { ExoplanetSystem } from '@/lib/exoplanetSystemData';
import { PlanetRecord, getPlanetsForSystem } from '@/lib/parseExoplanetData';
import {
  temperatureToColor,
  calculateGlowIntensity,
} from '@/lib/starUtils';
import {
  generate3DOrbit,
  getPeriapsisPosition,
} from '@/lib/orbitalMechanics';
import { getHabitableZoneForStar } from '@/lib/habitableZone';

interface StarRendererProps {
  system: ExoplanetSystem;
  planetsData: PlanetRecord[];
  onBack: () => void;
}

export default function StarRenderer({ system, planetsData, onBack }: StarRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scaleIndicatorRef = useRef<HTMLDivElement | null>(null);
  const [focusedPlanet, setFocusedPlanet] = useState<string | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const initialCameraPosRef = useRef<THREE.Vector3 | null>(null);

  // Get planets for this specific system from CSV data
  const planets = getPlanetsForSystem(system.hostname, planetsData);

  console.log(`🌟 StarRenderer: Rendering system "${system.hostname}" with ${planets.length} planets`);

  // Convert ExoplanetSystem to StarData format with defaults
  const starData = {
    hostname: system.hostname,
    st_rad: system.st_rad ?? 1.0,
    st_teff: system.st_teff ?? 5778,
    st_mass: system.st_mass ?? 1.0,
    st_lum: system.st_lum ?? 0,
  };

  // FALLBACK UI when no planets found
  if (planets.length === 0) {
    console.warn(`⚠️ No planet data found for system: ${system.hostname}`);
    
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#fff',
        fontFamily: 'Arial, sans-serif'
      }}>
        <button
          onClick={onBack}
          style={{
            position: 'fixed',
            top: '80px',
            left: '20px',
            padding: '12px 24px',
            background: 'rgba(59, 130, 246, 0.8)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            zIndex: 1000,
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 1)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ← Back to Solar System
        </button>
        
        <div style={{
          textAlign: 'center',
          maxWidth: '500px',
          padding: '40px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌟</div>
          <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#3b82f6' }}>
            {system.hostname}
          </h2>
          <p style={{ fontSize: '16px', opacity: 0.7, marginBottom: '20px' }}>
            No detailed orbital data available for this system
          </p>
          <div style={{ 
            fontSize: '14px', 
            opacity: 0.5,
            background: 'rgba(255,255,255,0.05)',
            padding: '15px',
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Distance:</strong> {system.distance.toFixed(2)} parsecs
            </div>
            <div>
              <strong>Known Planets:</strong> {system.planetCount}
            </div>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000511);

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      10000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const SOLAR_RADIUS_AU = 0.00465047;
    const EARTH_RADIUS_AU = 0.0000426;
    const AU_TO_SCENE_UNITS = 100;
    const SYSTEM_SCALE = 0.5;

    let maxOrbitRadius_AU = 0;
    planets.forEach(planet => {
      if (planet.pl_orbsmax && planet.pl_orbsmax > maxOrbitRadius_AU) {
        maxOrbitRadius_AU = planet.pl_orbsmax;
      }
    });
    if (maxOrbitRadius_AU === 0) maxOrbitRadius_AU = 2;

    const starRadius_AU = starData.st_rad * SOLAR_RADIUS_AU;
    const starRadius_scene = starRadius_AU * AU_TO_SCENE_UNITS * SYSTEM_SCALE;
    const starColor = temperatureToColor(starData.st_teff);
    const glowIntensity = calculateGlowIntensity(starData.st_lum);
    const baseColor = new THREE.Color(starColor);

    const simplexNoise = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

    const starVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vViewPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

    const starFragmentShader = `
uniform vec3 baseColor;
uniform float time;
uniform vec3 highTemp;
uniform vec3 lowTemp;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vViewPosition;

${simplexNoise}

vec3 temperatureToRGB(float temp) {
  return mix(lowTemp, highTemp, temp);
}

void main() {
  vec3 pos = vPosition * 0.8;
  float noiseBase = snoise(pos + time * 0.05) * 0.5 + 0.5;
  float convection = snoise(pos * 1.5 + time * 0.08) * 0.3;
  float granulation = snoise(pos * 4.0 + time * 0.12) * 0.15;
  float brightNoise = snoise(pos * 0.5 + time * 0.03) * 1.4 - 0.7;
  float brightSpot = max(0.0, brightNoise) * 0.6;
  float darkNoise = snoise(pos * 2.0 - time * 0.04) * 1.3 - 0.6;
  float sunspot = max(0.0, darkNoise) * 0.4;
  float surfaceTemp = 0.5 + noiseBase * 0.3 + convection + granulation + brightSpot - sunspot;
  surfaceTemp = clamp(surfaceTemp, 0.0, 1.0);
  vec3 color = temperatureToRGB(surfaceTemp);
  vec3 viewDir = normalize(vViewPosition);
  float rimFactor = abs(dot(vNormal, viewDir));
  float limbDarkening = smoothstep(0.0, 1.0, rimFactor);
  limbDarkening = mix(0.6, 1.0, limbDarkening);
  color *= limbDarkening;
  float edgeGlow = pow(1.0 - rimFactor, 3.0) * 0.5;
  color += baseColor * edgeGlow;
  color *= 1.8;
  gl_FragColor = vec4(color, 1.0);
}
`;

    const starGeometry = new THREE.SphereGeometry(starRadius_scene, 128, 128);
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: baseColor },
        highTemp: { value: baseColor },
        lowTemp: { value: new THREE.Color(baseColor.r * 0.7, baseColor.g * 0.7, baseColor.b * 0.7) },
        time: { value: 0.0 }
      },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader
    });

    const starMesh = new THREE.Mesh(starGeometry, starMaterial);
    scene.add(starMesh);

    const labelDiv = document.createElement('div');
    labelDiv.textContent = starData.hostname;
    labelDiv.style.color = '#fff';
    labelDiv.style.fontFamily = 'Arial, sans-serif';
    labelDiv.style.fontSize = '13px';
    labelDiv.style.fontWeight = '600';
    labelDiv.style.padding = '6px 12px';
    labelDiv.style.background = 'rgba(0,0,0,0.85)';
    labelDiv.style.borderRadius = '6px';
    labelDiv.style.border = '1px solid rgba(59,130,246,0.5)';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.visibility = 'hidden';
    labelDiv.style.opacity = '0';
    labelDiv.style.transition = 'opacity 0.2s';
    const label = new CSS2DObject(labelDiv);
    label.position.set(0, starRadius_scene + 10, 0);
    starMesh.add(label);

    scene.add(new THREE.PointLight(baseColor, glowIntensity * 2.5, 10000));
    scene.add(new THREE.AmbientLight(0x111122, 0.1));

    const habitableZoneData = getHabitableZoneForStar(starData);
    if (habitableZoneData) {
      const { boundaries, innerCircle, outerCircle } = habitableZoneData;
      
      const innerPoints = innerCircle.map(p =>
        new THREE.Vector3(p.x * AU_TO_SCENE_UNITS * SYSTEM_SCALE, 0, p.y * AU_TO_SCENE_UNITS * SYSTEM_SCALE)
      );
      const innerGeom = new THREE.BufferGeometry().setFromPoints(innerPoints);
      const innerMat = new THREE.LineBasicMaterial({ color: 0x00ff88, opacity: 0.6, transparent: true, linewidth: 2 });
      scene.add(new THREE.Line(innerGeom, innerMat));

      const outerPoints = outerCircle.map(p =>
        new THREE.Vector3(p.x * AU_TO_SCENE_UNITS * SYSTEM_SCALE, 0, p.y * AU_TO_SCENE_UNITS * SYSTEM_SCALE)
      );
      const outerGeom = new THREE.BufferGeometry().setFromPoints(outerPoints);
      const outerMat = new THREE.LineBasicMaterial({ color: 0x00ff88, opacity: 0.6, transparent: true, linewidth: 2 });
      scene.add(new THREE.Line(outerGeom, outerMat));

      const hzShape = new THREE.Shape();
      outerCircle.forEach((p, i) => {
        const x = p.x * AU_TO_SCENE_UNITS * SYSTEM_SCALE;
        const y = p.y * AU_TO_SCENE_UNITS * SYSTEM_SCALE;
        if (i === 0) hzShape.moveTo(x, y);
        else hzShape.lineTo(x, y);
      });
      hzShape.closePath();

      const innerHole = new THREE.Path();
      innerCircle.forEach((p, i) => {
        const x = p.x * AU_TO_SCENE_UNITS * SYSTEM_SCALE;
        const y = p.y * AU_TO_SCENE_UNITS * SYSTEM_SCALE;
        if (i === 0) innerHole.moveTo(x, y);
        else innerHole.lineTo(x, y);
      });
      innerHole.closePath();
      hzShape.holes.push(innerHole);

      const hzGeom = new THREE.ShapeGeometry(hzShape);
      const hzMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, opacity: 0.15, transparent: true, side: THREE.DoubleSide });
      const hzMesh = new THREE.Mesh(hzGeom, hzMat);
      hzMesh.rotation.x = -Math.PI / 2;
      scene.add(hzMesh);
    }

    const planetVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

    const planetFragmentShader = `
uniform vec3 planetColor;
uniform float time;
uniform vec3 starPosition;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

${simplexNoise}

void main() {
  vec3 pos = vPosition * 3.0;
  float surface = snoise(pos) + snoise(pos * 2.0) * 0.5 + snoise(pos * 5.0) * 0.25;
  float landMask = smoothstep(-0.1, 0.1, surface);
  vec3 surfaceColor = mix(vec3(0.05, 0.2, 0.4), planetColor * 0.6, landMask);
  surfaceColor = mix(surfaceColor, planetColor * 0.4, smoothstep(0.3, 0.6, surface) * landMask);
  float clouds = smoothstep(0.3, 0.7, snoise(vPosition * 2.0 + vec3(time * 0.02, 0.0, 0.0)));
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(starPosition - vWorldPosition);
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 dayColor = mix(surfaceColor, vec3(1.0), clouds * 0.6);
  vec3 nightColor = surfaceColor * 0.5;
  float terminator = smoothstep(-0.15, 0.15, diff);
  vec3 finalColor = mix(nightColor, dayColor, terminator);
  vec3 viewDir = normalize(vViewPosition);
  float spec = pow(max(dot(viewDir, reflect(-lightDir, normal)), 0.0), 32.0);
  finalColor += vec3(0.3) * spec * (1.0 - landMask) * terminator;
  finalColor = max(finalColor, surfaceColor * 0.02);
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

    const planetColorPalette = [
      new THREE.Color(0.3, 0.5, 0.8),
      new THREE.Color(0.8, 0.6, 0.4),
      new THREE.Color(0.7, 0.7, 0.6),
      new THREE.Color(0.5, 0.7, 0.9),
      new THREE.Color(0.9, 0.7, 0.5),
    ];

    const planetMeshes: { mesh: THREE.Mesh, name: string, label: CSS2DObject }[] = [];

    planets.forEach((planet, idx) => {
      if (!planet.pl_orbsmax || planet.pl_orbsmax <= 0) return;

      const orbit3D = generate3DOrbit({
        pl_orbsmax: planet.pl_orbsmax,
        pl_orbeccen: planet.pl_orbeccen || 0,
        pl_orbincl: planet.pl_orbincl,
        pl_orblper: planet.pl_orblper
      });

      const orbitPoints = orbit3D.map(p =>
        new THREE.Vector3(
          p.x * AU_TO_SCENE_UNITS * SYSTEM_SCALE,
          p.z * AU_TO_SCENE_UNITS * SYSTEM_SCALE,
          p.y * AU_TO_SCENE_UNITS * SYSTEM_SCALE
        )
      );

      const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({ color: 0x555555, opacity: 0.4, transparent: true });
      scene.add(new THREE.Line(orbitGeom, orbitMat));

      const periapsisPos = getPeriapsisPosition({
        pl_orbsmax: planet.pl_orbsmax,
        pl_orbeccen: planet.pl_orbeccen || 0,
        pl_orbincl: planet.pl_orbincl,
        pl_orblper: planet.pl_orblper
      });

      const planetRadius_earthRadii = planet.pl_rade || 1;
      const planetRadius_AU = planetRadius_earthRadii * EARTH_RADIUS_AU;
      let planetRadius_scene = planetRadius_AU * AU_TO_SCENE_UNITS * SYSTEM_SCALE;
      const MIN_PLANET_SIZE = 0.5;
      if (planetRadius_scene < MIN_PLANET_SIZE) planetRadius_scene = MIN_PLANET_SIZE;

      const planetGeom = new THREE.SphereGeometry(planetRadius_scene, 64, 64);
      const planetColor = planetColorPalette[idx % planetColorPalette.length];
      const planetMat = new THREE.ShaderMaterial({
        uniforms: {
          planetColor: { value: planetColor },
          time: { value: 0.0 },
          starPosition: { value: new THREE.Vector3(0, 0, 0) }
        },
        vertexShader: planetVertexShader,
        fragmentShader: planetFragmentShader
      });

      const planetMesh = new THREE.Mesh(planetGeom, planetMat);
      planetMesh.position.set(
        periapsisPos.x * AU_TO_SCENE_UNITS * SYSTEM_SCALE,
        periapsisPos.z * AU_TO_SCENE_UNITS * SYSTEM_SCALE,
        periapsisPos.y * AU_TO_SCENE_UNITS * SYSTEM_SCALE
      );
      planetMesh.userData = { name: planet.pl_name || 'Planet', type: 'planet' };
      scene.add(planetMesh);

      const planetLabelDiv = document.createElement('div');
      planetLabelDiv.textContent = planet.pl_name || 'Planet';
      planetLabelDiv.style.color = '#fff';
      planetLabelDiv.style.fontFamily = 'Arial, sans-serif';
      planetLabelDiv.style.fontSize = '11px';
      planetLabelDiv.style.padding = '4px 8px';
      planetLabelDiv.style.background = 'rgba(0,0,0,0.7)';
      planetLabelDiv.style.borderRadius = '4px';
      planetLabelDiv.style.border = '1px solid #666';
      planetLabelDiv.style.pointerEvents = 'none';
      planetLabelDiv.style.visibility = 'hidden';
      planetLabelDiv.style.opacity = '0';
      planetLabelDiv.style.transition = 'opacity 0.2s';
      const planetLabel = new CSS2DObject(planetLabelDiv);
      planetLabel.position.set(0, planetRadius_scene + 5, 0);
      planetMesh.add(planetLabel);

      planetMeshes.push({ mesh: planetMesh, name: planet.pl_name || 'Planet', label: planetLabel });
    });

    const starFieldGeom = new THREE.BufferGeometry();
    const verts: number[] = [];
    const cols: number[] = [];
    for (let i = 0; i < 8000; i++) {
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      const d = maxOrbitRadius_AU * AU_TO_SCENE_UNITS * 10 + Math.random() * maxOrbitRadius_AU * AU_TO_SCENE_UNITS * 20;
      verts.push(d * Math.sin(p) * Math.cos(t), d * Math.sin(p) * Math.sin(t), d * Math.cos(p));
      const r = Math.random();
      cols.push(r > 0.95 ? 0.7 : 1, r > 0.95 ? 0.8 : r > 0.9 ? 0.9 : r > 0.85 ? 0.7 : 1, r > 0.95 || r < 0.85 ? 1 : 0.7);
    }
    starFieldGeom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    starFieldGeom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const starField = new THREE.Points(starFieldGeom, new THREE.PointsMaterial({ size: 1, vertexColors: true, transparent: true, opacity: 0.9 }));
    scene.add(starField);

    const systemRadius = maxOrbitRadius_AU * AU_TO_SCENE_UNITS;
    const cameraDistance = systemRadius * 3.3;
    camera.position.set(0, cameraDistance * 0.3, cameraDistance);
    camera.lookAt(0, 0, 0);
    controls.minDistance = systemRadius * 0.05;
    controls.maxDistance = systemRadius * 20;
    initialCameraPosRef.current = camera.position.clone();

    const updateScaleIndicator = () => {
      if (!scaleIndicatorRef.current) return;
      const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
      const fov = camera.fov * Math.PI / 180;
      const viewHeight = 2 * Math.tan(fov / 2) * distance;
      const pixelsPerUnit = container.clientHeight / viewHeight;
      const auPixelSize = AU_TO_SCENE_UNITS * SYSTEM_SCALE * pixelsPerUnit;
      const scaleBarPixels = 100;
      const scaleBarAU = scaleBarPixels / auPixelSize;
      let scaleText = scaleBarAU >= 1 ? `${scaleBarAU.toFixed(1)} AU` : scaleBarAU >= 0.001 ? `${(scaleBarAU * 1000).toFixed(1)} million km` : `${(scaleBarAU * 149597870.7).toFixed(0)} km`;
      scaleIndicatorRef.current.innerHTML = `${scaleText}`;
    };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredPlanet: THREE.Mesh | null = null;

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const planetObjects = planetMeshes.map(p => p.mesh);
      const intersects = raycaster.intersectObjects(planetObjects);

      if (intersects.length > 0) {
        const clickedPlanet = intersects[0].object as THREE.Mesh;
        const planetName = clickedPlanet.userData.name;
        setFocusedPlanet(planetName);

        const targetPos = clickedPlanet.position.clone();
        const distance = 50;
        const newCameraPos = new THREE.Vector3(
          targetPos.x + distance,
          targetPos.y + distance * 0.5,
          targetPos.z + distance
        );

        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        let progress = 0;

        const animateCamera = () => {
          progress += 0.02;
          if (progress <= 1) {
            camera.position.lerpVectors(startPos, newCameraPos, progress);
            controls.target.lerpVectors(startTarget, targetPos, progress);
            requestAnimationFrame(animateCamera);
          }
        };

        animateCamera();
      }
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    let req = 0;
    let time = 0;

    const animate = () => {
      req = requestAnimationFrame(animate);
      time += 0.016;

      controls.update();
      starMaterial.uniforms.time.value = time;

      planetMeshes.forEach(({ mesh }) => {
        if (mesh.material instanceof THREE.ShaderMaterial) mesh.material.uniforms.time.value = time;
      });

      updateScaleIndicator();

      raycaster.setFromCamera(mouse, camera);
      const planetObjects = planetMeshes.map(p => p.mesh);
      const intersects = raycaster.intersectObjects(planetObjects);

      if (intersects.length > 0) {
        const planet = intersects[0].object as THREE.Mesh;
        if (hoveredPlanet !== planet) {
          if (hoveredPlanet) {
            const prevPlanet = planetMeshes.find(p => p.mesh === hoveredPlanet);
            if (prevPlanet) {
              prevPlanet.label.element.style.visibility = 'hidden';
              prevPlanet.label.element.style.opacity = '0';
            }
          }
          hoveredPlanet = planet;
          const currentPlanet = planetMeshes.find(p => p.mesh === planet);
          if (currentPlanet) {
            currentPlanet.label.element.style.visibility = 'visible';
            currentPlanet.label.element.style.opacity = '1';
          }
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        if (hoveredPlanet) {
          const prevPlanet = planetMeshes.find(p => p.mesh === hoveredPlanet);
          if (prevPlanet) {
            prevPlanet.label.element.style.visibility = 'hidden';
            prevPlanet.label.element.style.opacity = '0';
          }
          hoveredPlanet = null;
        }
        renderer.domElement.style.cursor = 'default';
      }

      const starIntersects = raycaster.intersectObject(starMesh);
      if (starIntersects.length > 0) {
        labelDiv.style.visibility = 'visible';
        labelDiv.style.opacity = '1';
      } else {
        labelDiv.style.visibility = 'hidden';
        labelDiv.style.opacity = '0';
      }

      starMesh.rotation.y += 0.0008;
      starField.rotation.y += 0.00005;

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      labelRenderer.setSize(container.clientWidth, container.clientHeight);
      updateScaleIndicator();
    };

    window.addEventListener('resize', onResize);
    updateScaleIndicator();

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      cancelAnimationFrame(req);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
    };
  }, [starData, planets, system]);

  const handleBackToSystem = () => {
    if (cameraRef.current && controlsRef.current && initialCameraPosRef.current) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const targetPos = new THREE.Vector3(0, 0, 0);
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      let progress = 0;

      const animateCamera = () => {
        progress += 0.02;
        if (progress <= 1) {
          camera.position.lerpVectors(startPos, initialCameraPosRef.current!, progress);
          controls.target.lerpVectors(startTarget, targetPos, progress);
          requestAnimationFrame(animateCamera);
        } else {
          setFocusedPlanet(null);
        }
      };

      animateCamera();
    } else {
      setFocusedPlanet(null);
    }
  };

  return (
    <>
      <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }} />
      
      <button
        onClick={onBack}
        style={{
          position: 'fixed',
          top: '80px',
          left: '20px',
          padding: '10px 20px',
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          border: '1px solid rgba(59,130,246,0.5)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 1000,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(59,130,246,0.3)';
          e.currentTarget.style.borderColor = 'rgba(59,130,246,1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
        }}
      >
        ← Back to Solar System
      </button>

      {focusedPlanet && (
        <button
          onClick={handleBackToSystem}
          style={{
            position: 'fixed',
            top: '120px',
            left: '20px',
            padding: '10px 20px',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            border: '1px solid rgba(59,130,246,0.5)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 1000,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.3)';
            e.currentTarget.style.borderColor = 'rgba(59,130,246,1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
          }}
        >
          ← Back to System
        </button>
      )}

      <div
        ref={scaleIndicatorRef}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'monospace',
          border: '1px solid rgba(255,255,255,0.2)',
          zIndex: 1000,
        }}
      >
        Scale: ...
      </div>
    </>
  );
}

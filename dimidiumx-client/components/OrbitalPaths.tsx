"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// The shape of a single orbit's data - adapt as per your CSV parsing if needed
interface OrbitData {
  plname?: string;
  pl_orbsmax?: number;     // semi-major axis (AU)
  pl_orbeccen?: number;    // eccentricity
  pl_orbincl?: number;     // inclination (degrees)
  pl_orblper?: number;     // argument of periastron (degrees)
}

interface OrbitalPathsProps {
  orbits: OrbitData[];
  starRadius: number;
}

export default function OrbitalPaths({ orbits, starRadius }: OrbitalPathsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Create scene and camera per instance for modular mounting
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 10, 20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);

    // Draw each orbit
    orbits.forEach((orbit, index) => {
      if (!orbit.pl_orbsmax || orbit.pl_orbsmax <= 0) return;

      const a = orbit.pl_orbsmax * 3 + starRadius; // Scale for scene
      const ecc = Math.min(orbit.pl_orbeccen || 0, 0.95);
      const b = a * Math.sqrt(1 - ecc * ecc);

      const inclination = (orbit.pl_orbincl || 0) * (Math.PI / 180);
      const argPeriastron = (orbit.pl_orblper || 0) * (Math.PI / 180);

      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 180; i++) {
        const theta = (i / 180) * 2 * Math.PI;
        // Parametric ellipse (x, y) then rotate for inclination and periastron
        let x = a * Math.cos(theta);
        let y = b * Math.sin(theta);

        // Periastron argument rotation around Z
        let px = x * Math.cos(argPeriastron) - y * Math.sin(argPeriastron);
        let py = x * Math.sin(argPeriastron) + y * Math.cos(argPeriastron);
        let pz = 0;

        // Incline the orbit around X axis
        let inc_py = py * Math.cos(inclination) - pz * Math.sin(inclination);
        let inc_pz = py * Math.sin(inclination) + pz * Math.cos(inclination);

        points.push(new THREE.Vector3(px, inc_py, inc_pz));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x44bbff + (index * 9999) % 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.7,
      });
      const ellipse = new THREE.Line(geometry, material);
      scene.add(ellipse);
    });

    // Lighting and a central sphere for the star
    const starGeometry = new THREE.SphereGeometry(starRadius, 32, 32);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const starMesh = new THREE.Mesh(starGeometry, starMaterial);
    scene.add(starMesh);

    // Lights for visibility
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Simple controls
    let frame = 0;
    const animate = () => {
      frame++;
      camera.position.x = 20 * Math.sin(frame * 0.001);
      camera.position.z = 20 * Math.cos(frame * 0.001);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [orbits, starRadius]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

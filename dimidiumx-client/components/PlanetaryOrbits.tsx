// components/PlanetaryOrbits.tsx
"use client";

import React, { useEffect, useState } from "react";
import Papa from "papaparse";

export interface ExoplanetRecord {
  pl_name?: string;
  hostname?: string;
  pl_orbper?: number;
  pl_orbsmax?: number;
  pl_orbeccen?: number;
  pl_orbincl?: number;        // ADDED: Inclination
  pl_orblper?: number;        // ADDED: Argument of periastron
  pl_orbtper?: number;
  pl_tranmid?: number;
  pl_imppar?: number;
  pl_ratdor?: number;
  pl_trandur?: number;
  pl_occdep?: number;
  rastr?: number;
  decstr?: number;
  sy_dist?: number;
  pl_bmasse?: number;
  pl_rade?: number;
  pl_eqt?: number;
  pl_angsep?: number;
  pl_dens?: number;
  pl_ratror?: number;
  pl_trandep?: number;
}

const CSV_PATH = "/PSCompPars_2025.10.04_07.39.22.csv";

export function fetchPlanetData(): Promise<ExoplanetRecord[]> {
  console.log("Fetching planet data from:", CSV_PATH);
  return fetch(CSV_PATH)
    .then((response) => {
      console.log("Response status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then((csvText) => {
      return new Promise<ExoplanetRecord[]>((resolve) => {
        Papa.parse<ExoplanetRecord>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (result) => {
            console.log("Parsed CSV, total rows:", result.data.length);
            
            if (result.data.length > 0) {
              console.log("First row sample:", result.data[0]);
            }
            
            const planets = result.data.filter((planet) => planet.pl_name && planet.pl_name.trim() !== '');
            console.log("Filtered planets with names:", planets.length);
            
            if (planets.length > 0) {
              console.log("Sample planet:", planets[0].pl_name, planets[0].hostname);
            }
            
            resolve(planets);
          },
        });
      });
    })
    .catch((error) => {
      console.error("Error fetching planet data:", error);
      return [];
    });
}

const PlanetaryOrbits: React.FC = () => {
  const [planets, setPlanets] = useState<ExoplanetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlanetData().then((planets) => {
      setPlanets(planets);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading exoplanet data...</div>;

  return (
    <div>
      <h2>Loaded Exoplanets ({planets.length})</h2>
      <ul style={{ maxHeight: 300, overflowY: "auto", background: "#eee", padding: 10 }}>
        {planets.slice(0, 50).map((planet, i) => (
          <li key={i}>
            <strong>{planet.pl_name}</strong> — Host: <em>{planet.hostname}</em>
            {planet.pl_orbper && <> | Period: {planet.pl_orbper} days</>}
            {planet.pl_orbsmax && <> | Semi-major: {planet.pl_orbsmax} AU</>}
            {planet.pl_orbincl && <> | Inclination: {planet.pl_orbincl}°</>}
          </li>
        ))}
      </ul>
      <small>Showing only the first 50 planets.</small>
    </div>
  );
};

export default PlanetaryOrbits;

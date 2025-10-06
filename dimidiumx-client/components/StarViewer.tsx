'use client';

import { useEffect, useState } from 'react';
import { fetchPlanetData, ExoplanetRecord } from './PlanetaryOrbits';
import StarRenderer from './StarRenderer';
import { StarData, getFirstStar } from '../lib/starData';

export default function StarViewer() {
  const [starData, setStarData] = useState<StarData | null>(null);
  const [planets, setPlanets] = useState<ExoplanetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFirstStar().then((star) => {
      setStarData(star);
      setLoading(false);
    });
    fetchPlanetData().then(setPlanets);
  }, []);

  if (loading || !starData) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <StarRenderer starData={starData} planets={planets} />
      
      {/* Info panel */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        color: 'white', 
        background: 'rgba(0,0,0,0.7)', 
        padding: '10px',
        borderRadius: '5px',
        zIndex: 1000,
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px'
      }}>
        <div><strong>System:</strong> {starData.hostname}</div>
        <div><strong>Star:</strong> {starData.st_rad.toFixed(2)} R☉</div>
        <div><strong>Planets:</strong> {planets.length}</div>
        <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.8 }}>
          Scale: 1 AU = 100 units<br/>
          Right-click + drag to rotate<br/>
          Scroll to zoom
        </div>
      </div>
    </div>
  );
}

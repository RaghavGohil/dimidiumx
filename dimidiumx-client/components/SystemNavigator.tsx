// components/SystemNavigator.tsx

'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ExoplanetSystem, loadAllExoplanetSystems } from '@/lib/exoplanetSystemData';
import { PlanetRecord } from '@/lib/parseExoplanetData';

const SolarSystemRenderer = dynamic(() => import('./SolarSystemRenderer'), {
  ssr: false,
});

const StarRenderer = dynamic(() => import('./StarRenderer'), {
  ssr: false,
});

export default function SystemNavigator() {
  const [currentView, setCurrentView] = useState<'solar' | 'exoplanet'>('solar');
  const [selectedSystem, setSelectedSystem] = useState<ExoplanetSystem | null>(null);
  const [exoplanetSystems, setExoplanetSystems] = useState<ExoplanetSystem[]>([]);
  const [planetsData, setPlanetsData] = useState<PlanetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // First check for uploaded data in sessionStorage
        const uploadedSystemsData = sessionStorage.getItem('uploadedExoplanetSystems');
        const uploadedPlanetsData = sessionStorage.getItem('uploadedPlanetsData');

        if (uploadedSystemsData && uploadedPlanetsData) {
          // Use uploaded data
          const parsedSystems = JSON.parse(uploadedSystemsData);
          const parsedPlanets = JSON.parse(uploadedPlanetsData);
          setExoplanetSystems(parsedSystems);
          setPlanetsData(parsedPlanets);
          console.log(`✅ Loaded ${parsedSystems.length} uploaded exoplanet systems`);
        } else {
          // Load from CSV file
          console.log('📂 Loading exoplanet data from CSV...');
          
          // Load exoplanet systems
          const systems = await loadAllExoplanetSystems();
          setExoplanetSystems(systems);
          console.log(`✅ Loaded ${systems.length} exoplanet systems from CSV`);

          // Load planet data from CSV
          const response = await fetch('/PSCompPars_2025.10.04_07.39.22.csv');
          const text = await response.text();
          const lines = text.split('\n').filter(line => !line.startsWith('#') && line.trim());
          
          if (lines.length > 1) {
            const headers = lines[0].split(',');
            
            // Find column indices
            const colIndices = {
              pl_name: headers.indexOf('pl_name'),
              hostname: headers.indexOf('hostname'),
              pl_orbsmax: headers.indexOf('pl_orbsmax'),
              pl_orbeccen: headers.indexOf('pl_orbeccen'),
              pl_orbincl: headers.indexOf('pl_orbincl'),
              pl_orblper: headers.indexOf('pl_orblper'),
              pl_rade: headers.indexOf('pl_rade'),
              pl_bmasse: headers.indexOf('pl_bmasse'),
            };

            const planets: PlanetRecord[] = [];
            
            for (let i = 1; i < lines.length; i++) {
              const row = lines[i].split(',');
              
              const planet: PlanetRecord = {
                pl_name: row[colIndices.pl_name]?.trim() || '',
                hostname: row[colIndices.hostname]?.trim() || '',
                pl_orbsmax: parseFloat(row[colIndices.pl_orbsmax]) || undefined,
                pl_orbeccen: parseFloat(row[colIndices.pl_orbeccen]) || undefined,
                pl_orbincl: parseFloat(row[colIndices.pl_orbincl]) || undefined,
                pl_orblper: parseFloat(row[colIndices.pl_orblper]) || undefined,
                pl_rade: parseFloat(row[colIndices.pl_rade]) || undefined,
                pl_bmasse: parseFloat(row[colIndices.pl_bmasse]) || undefined,
              };

              if (planet.pl_name && planet.hostname) {
                planets.push(planet);
              }
            }

            setPlanetsData(planets);
            console.log(`✅ Loaded ${planets.length} planets from CSV`);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load exoplanet data:', error);
        setExoplanetSystems([]);
        setPlanetsData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSystemClick = (system: ExoplanetSystem) => {
    console.log('🎯 System clicked:', system.hostname);
    console.log('📊 Available planets for this system:', planetsData.filter(p => p.hostname === system.hostname).length);
    setSelectedSystem(system);
    setCurrentView('exoplanet');
  };

  const handleBackToSolar = () => {
    console.log('🔙 Returning to solar system');
    setCurrentView('solar');
    setSelectedSystem(null);
  };

  if (isLoading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#fff',
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div>
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>Loading Exoplanet Data...</div>
          <div style={{ 
            width: '200px', 
            height: '4px', 
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              animation: 'loading 1.5s ease-in-out infinite'
            }} />
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      {currentView === 'solar' ? (
        <SolarSystemRenderer
          allExoplanetSystems={exoplanetSystems}
          onSystemClick={handleSystemClick}
        />
      ) : selectedSystem ? (
        <StarRenderer
          system={selectedSystem}
          planetsData={planetsData}
          onBack={handleBackToSolar}
        />
      ) : null}
    </div>
  );
}

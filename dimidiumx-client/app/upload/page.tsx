// app/upload/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { parseExoplanetCSV } from '@/lib/parseExoplanetData';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a valid CSV file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();
      
      // Parse the CSV - returns { systems: [], planets: [] }
      const result = parseExoplanetCSV(text);
      console.log('Parse result:', result);
      
      const systems = result.systems;
      const planets = result.planets;

      if (!systems || systems.length === 0) {
        setError('No valid exoplanet systems found in the CSV file');
        setIsProcessing(false);
        return;
      }

      // Store BOTH systems and planets in sessionStorage
      sessionStorage.setItem('uploadedExoplanetSystems', JSON.stringify(systems));
      sessionStorage.setItem('uploadedPlanetsData', JSON.stringify(planets));
      
      setPreviewData({
        systemCount: systems.length,
        planetCount: planets.length,
        sample: systems.slice(0, 3),
      });

      // Navigate to home and force refresh
      setTimeout(() => {
        window.location.href = '/'; // This forces a full page reload
      }, 2000);
    } catch (err) {
      setError(`Failed to parse CSV file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Upload error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [file]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== 'text/csv' && !droppedFile.name.endsWith('.csv')) {
        setError('Please drop a valid CSV file');
        return;
      }
      setFile(droppedFile);
      setError(null);
    }
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #000000 0%, #1a1a2e 50%, #16213e 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
      }}
    >
      <div
        style={{
          maxWidth: '700px',
          width: '100%',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px',
          padding: '50px',
          color: '#ffffff',
        }}
      >
        <h1
          style={{
            fontSize: '42px',
            fontWeight: 'bold',
            marginBottom: '15px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #4da6ff 0%, #00d4ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Upload Exoplanet Data
        </h1>

        <p style={{ textAlign: 'center', color: '#b0b0b0', marginBottom: '40px', fontSize: '16px' }}>
          Upload a CSV file containing exoplanet system data to visualize custom planetary systems
        </p>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: '3px dashed rgba(77, 166, 255, 0.5)',
            borderRadius: '15px',
            padding: '60px 40px',
            textAlign: 'center',
            marginBottom: '30px',
            background: 'rgba(77, 166, 255, 0.05)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(77, 166, 255, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(77, 166, 255, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(77, 166, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(77, 166, 255, 0.5)';
          }}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📁</div>
          <p style={{ fontSize: '18px', marginBottom: '10px', color: '#ffffff' }}>
            {file ? file.name : 'Drag & drop your CSV file here'}
          </p>
          <p style={{ fontSize: '14px', color: '#b0b0b0' }}>or click to browse</p>
        </div>

        <input
          id="fileInput"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {error && (
          <div
            style={{
              padding: '15px',
              background: 'rgba(255, 77, 77, 0.2)',
              border: '1px solid rgba(255, 77, 77, 0.5)',
              borderRadius: '10px',
              color: '#ff6b6b',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {previewData && (
          <div
            style={{
              padding: '20px',
              background: 'rgba(0, 255, 136, 0.1)',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              borderRadius: '10px',
              marginBottom: '20px',
            }}
          >
            <p style={{ color: '#00ff88', marginBottom: '10px', fontWeight: 'bold' }}>
              ✓ Successfully parsed!
            </p>
            <p style={{ color: '#e0e0e0' }}>
              Found {previewData.systemCount} systems with {previewData.planetCount} planets
            </p>
            <p style={{ color: '#b0b0b0', fontSize: '14px', marginTop: '10px' }}>
              Redirecting to visualization...
            </p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || isProcessing}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#ffffff',
            background: file && !isProcessing ? 'linear-gradient(135deg, #4da6ff 0%, #0088ff 100%)' : '#555555',
            border: 'none',
            borderRadius: '12px',
            cursor: file && !isProcessing ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
            opacity: file && !isProcessing ? 1 : 0.5,
          }}
          onMouseEnter={(e) => {
            if (file && !isProcessing) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(77, 166, 255, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {isProcessing ? 'Processing...' : 'Upload & Visualize'}
        </button>

        <div
          style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            fontSize: '14px',
            color: '#b0b0b0',
          }}
        >
          <p style={{ fontWeight: 'bold', color: '#4da6ff', marginBottom: '10px' }}>
            CSV Format Requirements:
          </p>
          <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
            <li>Required: hostname, rastr, decstr, sy_dist, pl_name, pl_orbsmax</li>
            <li>Optional: pl_orbeccen, pl_orbincl, pl_orblper, pl_rade, st_teff, st_rad, st_mass, st_lum</li>
            <li>Use NASA Exoplanet Archive format</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

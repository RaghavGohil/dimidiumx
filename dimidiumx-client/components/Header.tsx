// components/Header.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '60px',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      padding: '0 2rem'
    }}>
      <Link href="/" style={{
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#fff',
        textDecoration: 'none'
      }}>
        DimidiumX
      </Link>
      
      <nav style={{
        marginLeft: 'auto',
        display: 'flex',
        gap: '2rem'
      }}>
        <Link href="/" style={{
          color: pathname === '/' ? '#3b82f6' : '#fff',
          textDecoration: 'none',
          fontWeight: pathname === '/' ? 'bold' : 'normal'
        }}>
          Home
        </Link>
        <Link href="/upload" style={{
          color: pathname === '/upload' ? '#3b82f6' : '#fff',
          textDecoration: 'none',
          fontWeight: pathname === '/upload' ? 'bold' : 'normal'
        }}>
          Upload Data
        </Link>
      </nav>
    </header>
  );
}

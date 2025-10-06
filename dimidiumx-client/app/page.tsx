// app/page.tsx

'use client';

import dynamic from 'next/dynamic';

const SystemNavigator = dynamic(() => import('@/components/SystemNavigator'), {
  ssr: false,
});

export default function Home() {
  return <SystemNavigator />;
}

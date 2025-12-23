'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import LandingPage from './landing/page';
import Dashboard from '@/components/dashboard/Dashboard';

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">🎬</div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Loading...</h2>
      </div>
    </div>
  );
}

// Main home content component
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useUser();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Handle automatic redirect from browser extension
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get('sessionId') || searchParams.get('session');

    if (sessionIdFromUrl && isSignedIn) {
      console.log('Session ID received from extension:', sessionIdFromUrl);
      setIsRedirecting(true);
      router.push(`/recording/${sessionIdFromUrl}`);
    }
  }, [searchParams, router, isSignedIn]);

  // Show landing page if not signed in
  if (isLoaded && !isSignedIn) {
    return <LandingPage />;
  }

  // Show loading screen when redirecting from extension
  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎬</div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Redirecting to Recording...</h2>
          <p className="text-[var(--color-text-secondary)]">Loading your recording session</p>
          <div className="mt-6 flex justify-center gap-2">
            <div className="w-3 h-3 bg-[var(--color-accent-primary)] rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-[var(--color-accent-secondary)] rounded-full animate-pulse delay-75"></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse delay-150"></div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to dashboard when signed in
  if (isLoaded && isSignedIn) {
    router.push('/dashboard');
    return <LoadingFallback />;
  }

  // Loading state
  return <LoadingFallback />;
}

// Main export with Suspense wrapper
export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}

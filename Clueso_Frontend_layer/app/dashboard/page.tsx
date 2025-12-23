'use client';

import { useRouter } from 'next/navigation';
import { useInstallModal } from './layout';

export default function HomePage() {
  const router = useRouter();
  const { setShowInstallModal } = useInstallModal();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0a0a1a] via-[#1a0a2e] to-[#0a0a1a] mb-8">
        {/* Left decorative plants */}
        <div className="absolute left-0 bottom-0 w-32 h-full">
          <svg viewBox="0 0 120 80" className="w-full h-full" preserveAspectRatio="xMinYMax meet">
            {/* Purple leaves */}
            <ellipse cx="20" cy="60" rx="15" ry="25" fill="#6b21a8" transform="rotate(-30 20 60)" />
            <ellipse cx="35" cy="55" rx="12" ry="22" fill="#7c3aed" transform="rotate(-15 35 55)" />
            <ellipse cx="50" cy="65" rx="10" ry="18" fill="#8b5cf6" transform="rotate(10 50 65)" />
            {/* Grass blades */}
            <path d="M10 80 Q15 50 20 80" stroke="#6b21a8" strokeWidth="3" fill="none" />
            <path d="M25 80 Q30 45 35 80" stroke="#7c3aed" strokeWidth="2" fill="none" />
            <path d="M40 80 Q45 55 50 80" stroke="#8b5cf6" strokeWidth="2" fill="none" />
          </svg>
        </div>
        
        {/* Right decorative plants */}
        <div className="absolute right-0 bottom-0 w-40 h-full">
          <svg viewBox="0 0 150 80" className="w-full h-full" preserveAspectRatio="xMaxYMax meet">
            {/* Large purple/pink leaves */}
            <ellipse cx="130" cy="50" rx="20" ry="35" fill="#c026d3" transform="rotate(20 130 50)" />
            <ellipse cx="115" cy="55" rx="18" ry="30" fill="#a855f7" transform="rotate(35 115 55)" />
            <ellipse cx="100" cy="60" rx="15" ry="25" fill="#d946ef" transform="rotate(50 100 60)" />
            <ellipse cx="140" cy="65" rx="12" ry="20" fill="#e879f9" transform="rotate(10 140 65)" />
            {/* Accent leaves */}
            <ellipse cx="90" cy="70" rx="8" ry="15" fill="#7c3aed" transform="rotate(60 90 70)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 py-8 px-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Make something awesome</h2>
          <p className="text-sm text-gray-400">Create stunning product videos and docs</p>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-white mb-6">Home</h1>
      
      {/* Getting Started Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Getting started</h2>
        <div className="grid grid-cols-1 gap-6">
          {/* User Documentation Card */}
          <a 
            href="/CLUESOUSERDOCUMENTATION.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-[#13131a] border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500 transition-all cursor-pointer"
          >
            {/* Preview Image Area */}
            <div className="relative h-48 bg-gradient-to-br from-purple-900/50 via-pink-900/30 to-purple-900/50 flex items-center justify-center">
              {/* Decorative background */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5QzkyQUMiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
              
              {/* Clueso Logo */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">C</span>
                </div>
                <span className="text-white text-sm font-medium">clueso</span>
              </div>
              
              {/* Document Icon */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-24 bg-white rounded-lg shadow-xl flex flex-col items-center justify-center relative">
                  {/* Document fold */}
                  <div className="absolute top-0 right-0 w-6 h-6 bg-gray-200 rounded-bl-lg"></div>
                  {/* PDF icon */}
                  <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v4H8.5v-4zm2.5 0h1.5v4H11v-4zm2.5 0H15v4h-1.5v-4z"/>
                  </svg>
                  <span className="text-xs font-bold text-red-500 mt-1">PDF</span>
                </div>
                <span className="text-white text-lg font-semibold mt-3">User Documentation</span>
              </div>
              
              {/* Arrow indicator */}
              <div className="absolute bottom-4 right-4 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all">
                <svg className="w-4 h-4 text-white transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            
            {/* Card Content */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Clueso User Guide</h3>
                <p className="text-sm text-gray-400">Complete documentation for getting started</p>
              </div>
              <div className="w-8 h-8 flex items-center justify-center text-gray-400 group-hover:text-purple-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </div>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Recent Recordings card */}
        <div 
          onClick={() => router.push('/dashboard/projects')}
          className="bg-[#13131a] border border-gray-800 rounded-xl p-6 hover:border-purple-500 transition-all cursor-pointer"
        >
          <div className="text-4xl mb-4">🎬</div>
          <h3 className="text-lg font-semibold text-white mb-2">Recent Recordings</h3>
          <p className="text-sm text-gray-400">View your latest recording sessions</p>
        </div>
      </div>

      {/* Empty state */}
      <div className="mt-12 text-center py-16 bg-[#13131a] border border-gray-800 rounded-xl">
        <div className="text-6xl mb-4">🎥</div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Clueso</h2>
        <p className="text-gray-400 mb-6">Start creating amazing video content</p>
        <button 
          onClick={() => setShowInstallModal(true)}
          className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all mx-auto"
        >
          <span className="text-lg">+</span>
          <span>New Video</span>
        </button>
      </div>
    </div>
  );
}

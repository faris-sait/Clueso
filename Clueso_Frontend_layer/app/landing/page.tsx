'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { RadialOrbitalTimeline } from '@/components/ui/radial-orbital-timeline';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { UserPlus, Plug, Video, Bot, BarChart3, Share2 } from 'lucide-react';
import { SignIn, SignUp } from '@clerk/nextjs';

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/');
    }
  }, [isLoaded, isSignedIn, router]);

  const timelineItems = [
    {
      id: 1,
      title: "Sign Up",
      description: "Create your Clueso account in seconds with email or social login.",
      icon: UserPlus,
    },
    {
      id: 2,
      title: "Install",
      description: "Add the Clueso browser extension to capture your screen seamlessly.",
      icon: Plug,
    },
    {
      id: 3,
      title: "Record",
      description: "Click record and start capturing your screen interactions.",
      icon: Video,
    },
    {
      id: 4,
      title: "AI Process",
      description: "Our AI generates transcripts and intelligent voice-over narrations.",
      icon: Bot,
    },
    {
      id: 5,
      title: "Dashboard",
      description: "Access recordings with synchronized video, audio, and instructions.",
      icon: BarChart3,
    },
    {
      id: 6,
      title: "Share",
      description: "Share recordings with your team or export for documentation.",
      icon: Share2,
    }
  ];

  const clerkAppearance = {
    elements: {
      rootBox: "mx-auto",
      card: "bg-white shadow-none border-0",
      logoBox: "hidden",
      logoImage: "hidden",
      header: "hidden",
      headerTitle: "hidden",
      headerSubtitle: "hidden",
      socialButtonsBlockButton: "bg-white border-2 border-gray-200 hover:border-pink-300 text-gray-700 font-medium rounded-xl py-3 transition-all",
      socialButtonsBlockButtonText: "font-medium text-gray-700",
      formButtonPrimary: "bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl",
      formFieldInput: "border-2 border-gray-200 rounded-xl py-3 px-4 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all",
      formFieldLabel: "text-gray-700 font-medium mb-2",
      footerActionLink: "text-pink-600 hover:text-pink-700 font-medium",
      footer: "hidden",
      footerAction: "hidden",
      internal: "hidden",
      badge: "hidden",
      dividerLine: "bg-gray-200",
      dividerText: "text-gray-400",
    },
    layout: {
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
      showOptionalFields: false,
    },
  };

  return (
    <div className="min-h-screen flex">
      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSignIn(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4"
          >
            <button
              onClick={() => setShowSignIn(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-pink-700 bg-clip-text text-transparent">
                Welcome Back
              </h2>
              <p className="text-gray-600 mt-2">Sign in to access your Clueso dashboard</p>
            </div>
            <SignIn 
              appearance={clerkAppearance}
              routing="hash"
            />
          </motion.div>
        </div>
      )}

      {/* Sign Up Modal */}
      {showSignUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSignUp(false)}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4"
          >
            <button
              onClick={() => setShowSignUp(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-pink-700 bg-clip-text text-transparent">
                Get Started
              </h2>
              <p className="text-gray-600 mt-2">Create your Clueso account</p>
            </div>
            <SignUp 
              appearance={clerkAppearance}
              routing="hash"
            />
          </motion.div>
        </div>
      )}

      {/* Left Side - Branding */}
      <div className="w-1/2 bg-white flex items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, #ec4899 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative z-10 max-w-xl">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="text-6xl font-bold bg-gradient-to-r from-pink-600 to-pink-800 bg-clip-text text-transparent mb-8">
              Clueso
            </h1>
            
            <h2 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">
              Screen Recording
              <br />
              Powered by AI
            </h2>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">
              Capture, transcribe, and narrate your screen recordings with AI-powered intelligence
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(236, 72, 153, 0.3)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSignUp(true)}
              className="px-8 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-pink-500 to-pink-700 hover:from-pink-600 hover:to-pink-800 transition-all shadow-xl"
            >
              Get Started
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSignIn(true)}
              className="px-8 py-4 rounded-xl font-bold text-lg text-pink-600 bg-white border-2 border-pink-300 hover:border-pink-500 transition-all shadow-lg"
            >
              Sign In
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Radial Orbital Timeline */}
      <div className="w-1/2 bg-gradient-to-br from-pink-50 via-pink-100 to-pink-200 flex items-center justify-center p-12 relative overflow-hidden">
        {/* Animated background elements */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-0 right-0 w-96 h-96 bg-pink-300 rounded-full opacity-20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-0 left-0 w-96 h-96 bg-pink-400 rounded-full opacity-20 blur-3xl"
        />

        <div className="relative z-10 w-full flex items-center justify-center">
          <RadialOrbitalTimeline items={timelineItems} />
        </div>
      </div>
    </div>
  );
}

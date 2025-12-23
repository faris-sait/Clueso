"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserPlus, Plug, Video, Bot, BarChart3, Share2 } from "lucide-react";

interface TimelineItem {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

interface RadialOrbitalTimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function RadialOrbitalTimeline({
  items,
  className,
}: RadialOrbitalTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isInView, items.length]);

  const size = 550;
  const center = size / 2;
  const orbitRadius = 220;
  const nodeSize = 56;

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center justify-center", className)}
    >
      <div 
        className="relative"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        {/* Outer orbital ring */}
        <div 
          className="absolute rounded-full border border-pink-300/50"
          style={{
            width: `${orbitRadius * 2}px`,
            height: `${orbitRadius * 2}px`,
            left: `${center - orbitRadius}px`,
            top: `${center - orbitRadius}px`,
          }}
        />

        {/* Inner ring (decorative) */}
        <div 
          className="absolute rounded-full border border-pink-300/30"
          style={{
            width: `${orbitRadius * 1.2}px`,
            height: `${orbitRadius * 1.2}px`,
            left: `${center - orbitRadius * 0.6}px`,
            top: `${center - orbitRadius * 0.6}px`,
          }}
        />

        {/* Center glowing orb */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="absolute"
          style={{
            width: '90px',
            height: '90px',
            left: `${center - 45}px`,
            top: `${center - 45}px`,
          }}
        >
          <div className="w-full h-full rounded-full bg-gradient-to-br from-pink-400 to-pink-600 shadow-[0_0_80px_rgba(236,72,153,0.6)]" />
        </motion.div>

        {/* Timeline nodes */}
        {items.map((item, index) => {
          const angle = (index / items.length) * 2 * Math.PI - Math.PI / 2;
          const x = center + orbitRadius * Math.cos(angle);
          const y = center + orbitRadius * Math.sin(angle);
          const Icon = item.icon;
          const isActive = activeIndex === index;

          return (
            <motion.div
              key={item.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={isInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
              className="absolute cursor-pointer"
              style={{
                left: `${x - nodeSize / 2}px`,
                top: `${y - nodeSize / 2}px`,
              }}
              onClick={() => setActiveIndex(index)}
            >
              {/* Node circle */}
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  boxShadow: isActive 
                    ? "0 0 30px rgba(236, 72, 153, 0.8)" 
                    : "0 0 15px rgba(236, 72, 153, 0.3)",
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "rounded-full flex items-center justify-center transition-all border-2",
                  isActive
                    ? "bg-pink-500 border-pink-400"
                    : "bg-transparent border-pink-400/70"
                )}
                style={{ width: `${nodeSize}px`, height: `${nodeSize}px` }}
              >
                <Icon
                  className={cn(
                    "w-6 h-6",
                    isActive ? "text-white" : "text-pink-400"
                  )}
                />
              </motion.div>

              {/* Label below node */}
              <motion.div
                animate={{ opacity: 1 }}
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap mt-2"
                style={{ top: `${nodeSize}px` }}
              >
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  isActive ? "text-pink-600" : "text-pink-400/80"
                )}>
                  {item.title}
                </span>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

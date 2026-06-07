import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dimension } from '../types';

export default function DimensionBar({ dimension, index }: { dimension: Dimension, index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative flex flex-col gap-2 cursor-default group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      <div className="flex justify-between text-[11px] uppercase tracking-wider font-semibold">
        <span className="opacity-80 group-hover:opacity-100 transition-opacity">{dimension.name}</span>
        <span className="mono">{dimension.score * 10}%</span>
      </div>
      
      <div className="dimension-bar">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(dimension.score / 10) * 100}%` }}
          transition={{ duration: 1.2, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="dimension-fill"
        />
      </div>

      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 bottom-[calc(100%+10px)] left-0 w-full p-4 bg-bg-card border border-line rounded text-xs font-medium text-app-text shadow-2xl pointer-events-none origin-bottom serif italic"
          >
            {dimension.text}
            {/* Subtle arrow pointing down */}
            <div className="absolute top-[calc(100%-8px)] left-8 w-4 h-4 bg-bg-card border-r border-b border-line rotate-45 shadow-md pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

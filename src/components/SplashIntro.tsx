import React from 'react';
import { motion } from 'motion/react';

export function SplashIntro() {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #0a0f1a 0%, #0c1222 40%, #111827 100%)' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(59,130,246,0.35) 0%, transparent 55%)',
        }}
      />

      <motion.div
        className="relative flex flex-col items-center"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl text-5xl font-black text-white shadow-2xl shadow-blue-500/40 sm:h-28 sm:w-28 sm:text-6xl"
          style={{
            background: 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)',
          }}
          initial={{ rotate: -8, y: 20 }}
          animate={{ rotate: 0, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 18 }}
        >
          G
        </motion.div>

        <div className="flex items-baseline justify-center gap-1">
          {['G', 'S', 'I'].map((letter, i) => (
            <motion.span
              key={letter + i}
              className="text-5xl font-black tracking-tight text-white sm:text-6xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08, duration: 0.4, ease: 'easeOut' }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        <motion.p
          className="mt-3 text-sm font-bold uppercase tracking-[0.35em] text-blue-400/90 sm:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.4 }}
        >
          Tracker
        </motion.p>

        <motion.p
          className="mt-2 max-w-xs px-6 text-center text-[11px] font-medium uppercase tracking-widest text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.35 }}
        >
          Ponto digital
        </motion.p>
      </motion.div>

      <motion.div
        className="absolute bottom-12 left-1/2 h-1 w-32 -translate-x-1/2 overflow-hidden rounded-full bg-white/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="h-full rounded-full bg-blue-500"
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ delay: 0.6, duration: 1.6, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  );
}

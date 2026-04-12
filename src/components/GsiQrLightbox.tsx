import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  qrDataUrl: string;
  label?: string;
};

export function GsiQrLightbox({ open, onClose, qrDataUrl, label }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[300] bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Fechar"
          />
          <motion.div
            className="fixed left-1/2 top-1/2 z-[301] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#151d32] p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                {label ?? 'Código do colaborador'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-white/10"
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex justify-center rounded-2xl bg-white p-4">
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="h-auto w-full max-w-[min(72vw,420px)]"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Mostre ao encarregado para marcação de ponto
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

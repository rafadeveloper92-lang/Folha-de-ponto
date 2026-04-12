import React from 'react';
import { Camera } from 'lucide-react';
import { cn } from '../../lib/utils';

type Props = {
  name: string;
  setName: (v: string) => void;
  role: string;
  setRole: (v: 'Oficial' | 'Ajudante') => void;
  profilePhoto: string | null;
  onPickPhoto: () => void;
  isDark: boolean;
  roleLocked?: boolean;
  /** Imagem do QR (recortada do PDF da ficha) */
  qrDataUrl?: string | null;
  onQrClick?: () => void;
};

export function GsiDashboardHero({
  name,
  setName,
  role,
  setRole,
  profilePhoto,
  onPickPhoto,
  isDark,
  roleLocked,
  qrDataUrl,
  onQrClick,
}: Props) {
  return (
    <div
      className={cn(
        'rounded-3xl border p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-5',
        isDark
          ? 'border-blue-500/20 bg-[#151d32]'
          : 'border-slate-200 bg-white shadow-sm',
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onPickPhoto}
          className={cn(
            'relative h-24 w-24 rounded-full border-4 overflow-hidden group',
            isDark ? 'border-blue-500/40' : 'border-blue-200',
          )}
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              className={cn(
                'h-full w-full flex items-center justify-center text-2xl font-black',
                isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400',
              )}
            >
              {name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <span
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden
          >
            <Camera className="text-white" size={28} />
          </span>
        </button>
        {qrDataUrl && onQrClick && (
          <button
            type="button"
            onClick={onQrClick}
            className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white p-1 shadow-lg transition-transform active:scale-95"
            title="Ampliar QR da ficha"
          >
            <img
              src={qrDataUrl}
              alt="QR da ficha GSI"
              className="h-full w-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome completo"
          className={cn(
            'w-full text-xl font-black uppercase tracking-tight bg-transparent border-none outline-none focus:ring-0',
            isDark ? 'text-slate-100 placeholder:text-slate-600' : 'text-slate-900',
          )}
        />
        <div className="flex flex-wrap gap-2">
          {roleLocked && (role === 'Oficial' || role === 'Ajudante') ? (
            <span
              className={cn(
                'px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest',
                'bg-blue-600 text-white shadow-lg shadow-blue-600/30',
              )}
            >
              {role}
            </span>
          ) : (
            (['Oficial', 'Ajudante'] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={roleLocked}
                onClick={() => !roleLocked && setRole(r)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
                  role === r
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : isDark
                      ? 'bg-white/5 text-slate-500 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-500',
                  roleLocked && 'opacity-90 cursor-default',
                )}
              >
                {r}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

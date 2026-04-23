import React, {useId} from 'react';
import {cn} from '../lib/utils';

type Props = {
  /** 0–1 fração do arco preenchido */
  fraction: number;
  label: string;
  valueText: string;
  sublabel?: string;
  theme: 'dark' | 'light';
  /** 'rose' ou 'emerald' */
  accent?: 'rose' | 'emerald';
};

/** Semicírculo com agulha (0 = esquerda, 1 = direita do arco). */
export function SemiGauge({fraction, label, valueText, sublabel, theme, accent = 'rose'}: Props) {
  const uid = useId().replace(/:/g, '');
  const isDark = theme === 'dark';
  const t = Math.max(0, Math.min(1, fraction));
  const angle = Math.PI * (1 - t);
  const cx = 50;
  const cy = 50;
  const rArc = 38;
  const rNeedle = 28;
  const nx = cx + rNeedle * Math.cos(angle);
  const ny = cy - rNeedle * Math.sin(angle);

  const arcLen = Math.PI * rArc;
  const dash = t * arcLen;

  const gradId = accent === 'rose' ? `gg-rose-${uid}` : `gg-em-${uid}`;

  return (
    <div className="relative mx-auto h-[110px] w-full max-w-[160px]">
      <svg viewBox="0 0 100 58" className="h-full w-full overflow-visible">
        <defs>
          {accent === 'rose' ? (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c9a87c" />
              <stop offset="100%" stopColor="#6b522e" />
            </linearGradient>
          ) : (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          )}
        </defs>
        <path
          d={`M ${cx - rArc} ${cy} A ${rArc} ${rArc} 0 0 1 ${cx + rArc} ${cy}`}
          fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)'}
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - rArc} ${cy} A ${rArc} ${rArc} 0 0 1 ${cx + rArc} ${cy}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`}
        />
        <circle cx={cx} cy={cy} r={5} className={isDark ? 'fill-[#1a1a1f]' : 'fill-slate-100'} stroke={accent === 'rose' ? '#c9a87c' : '#10b981'} strokeWidth="1.5" />
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={isDark ? '#f5e6d3' : '#1e293b'}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx={nx} cy={ny} r={2.2} className={accent === 'rose' ? 'fill-[#c9a87c]' : 'fill-emerald-400'} />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-0.5">
        <p className={cn('text-[8px] font-black uppercase tracking-wider', isDark ? 'text-white/35' : 'text-slate-500')}>
          {label}
        </p>
        <p className={cn('text-2xl font-extralight tabular-nums leading-tight', isDark ? 'text-white' : 'text-slate-900')}>
          {valueText}
        </p>
        {sublabel ? (
          <p className={cn('text-[7px] uppercase tracking-wide', isDark ? 'text-white/30' : 'text-slate-400')}>{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}

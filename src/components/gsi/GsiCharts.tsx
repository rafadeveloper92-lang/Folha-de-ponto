import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
} from 'recharts';
import { gsi } from '../../gsi/colors';
import { cn } from '../../lib/utils';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DONUT_COLORS = [gsi.blue, gsi.greenNeon];

type DonutProps = {
  totalHours: number;
  targetHours?: number;
  className?: string;
};

export function HoursDonut({ totalHours, targetHours = 160, className }: DonutProps) {
  const rest = Math.max(0, targetHours - totalHours);
  const data = [
    { name: 'feitas', value: totalHours },
    { name: 'restante', value: rest },
  ];
  return (
    <div className={cn('h-36 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={58}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <p className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 -mt-2">
        {totalHours}h / meta {targetHours}h
      </p>
    </div>
  );
}

type RadarProps = { oficialPct: number; ajudantePct: number; className?: string };

export function TeamRadar({ oficialPct, ajudantePct, className }: RadarProps) {
  const data = [
    { subject: 'Oficial', v: oficialPct },
    { subject: 'Ajudante', v: ajudantePct },
    { subject: 'Equilíbrio', v: Math.round((oficialPct + ajudantePct) / 2) },
  ];
  return (
    <div className={cn('h-56 w-full', className)}>
      <p className="text-center text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
        Carga de trabalho (radar)
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke={gsi.navyBorder} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <Radar
            name="valor"
            dataKey="v"
            stroke={gsi.green}
            fill={gsi.green}
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

type HeatProps = {
  year: number;
  month: number;
  /** dia -> intensidade 0-4 */
  intensityByDay: Record<number, number>;
  className?: string;
};

export function MonthHeatmap({
  year,
  month,
  intensityByDay,
  className,
}: HeatProps) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const days = eachDayOfInterval({ start, end });
  const startPad = (getDay(start) + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  days.forEach((d) => {
    cells.push(intensityByDay[d.getDate()] ?? 0);
  });

  const bg = (level: number) => {
    const map = ['bg-slate-800', 'bg-emerald-900/80', 'bg-emerald-600/70', 'bg-emerald-500', 'bg-emerald-400'];
    return map[Math.min(4, level)] ?? map[0];
  };

  return (
    <div className={className}>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 text-center">
        {format(start, 'MMMM yyyy', { locale: ptBR })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-[8px] text-slate-500 text-center mb-1">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((level, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-sm',
              level === null ? 'bg-transparent' : bg(level),
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function MiniBarValue({
  label,
  value,
  isDark = true,
}: {
  label: string;
  value: string;
  isDark?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        isDark ? 'border-blue-500/20 bg-[#151d32]' : 'border-slate-200 bg-white shadow-sm',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-black uppercase tracking-widest mb-2',
          isDark ? 'text-slate-500' : 'text-slate-400',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'text-2xl font-black tabular-nums',
          isDark ? 'text-emerald-400' : 'text-emerald-600',
        )}
      >
        {value}
      </p>
      <div className="mt-3 h-8">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[{ v: 60 }, { v: 80 }, { v: 45 }, { v: 90 }]}>
            <Bar dataKey="v" fill={gsi.blue} radius={[2, 2, 0, 0]} />
            <XAxis hide />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BudgetBar({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 mb-1">
        <span>Orçamento utilizado</span>
        <span>{p.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

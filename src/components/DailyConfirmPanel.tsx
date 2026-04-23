import React from 'react';
import {format, getDay} from 'date-fns';
import {ptBR} from 'date-fns/locale';
import {Briefcase, Calendar, Check, Copy, Moon} from 'lucide-react';
import type {WorkDay} from '../types';
import {cn} from '../lib/utils';

type Props = {
  theme: 'dark' | 'light';
  days: Date[];
  entries: Record<string, Partial<WorkDay>>;
  focusDay: number;
  setFocusDay: (d: number) => void;
  hourOptions: string[];
  onHours: (day: number, v: string) => void;
  onProject: (day: number, v: string) => void;
  onConfirm: (day: number) => void;
  onOffDay: (day: number) => void;
  onCopyPrevious: (day: number) => void;
};

function parseHours(h?: string): number {
  if (!h) return 0;
  const m = h.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export function DailyConfirmPanel({
  theme,
  days,
  entries,
  focusDay,
  setFocusDay,
  hourOptions,
  onHours,
  onProject,
  onConfirm,
  onOffDay,
  onCopyPrevious,
}: Props) {
  const isDark = theme === 'dark';
  const dayDate = days.find((d) => d.getDate() === focusDay) ?? days[0]!;
  const dayNum = focusDay;
  const e = entries[dayNum];
  const isWeekend = getDay(dayDate) === 0 || getDay(dayDate) === 6;
  const hoursNum = parseHours(e?.hours);
  const canConfirm = !!e?.hours && !!e?.project && !e?.marked;

  const glass = isDark
    ? 'border border-[#c9a87c]/25 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[0_0_40px_rgba(201,168,124,0.08)] backdrop-blur-xl'
    : 'border border-amber-200/80 bg-white shadow-md';

  return (
    <section className={cn('mb-6 rounded-3xl p-5 sm:p-6', glass)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={cn('text-[10px] font-black uppercase tracking-[0.3em]', isDark ? 'text-[#c9a87c]' : 'text-amber-800')}>
            Confirmar dia
          </p>
          <p className={cn('text-sm', isDark ? 'text-white/45' : 'text-slate-500')}>Escolha o dia e confirme as horas</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="gsi-focus-day">
            Dia
          </label>
          <select
            id="gsi-focus-day"
            value={focusDay}
            onChange={(ev) => setFocusDay(Number(ev.target.value))}
            className={cn(
              'rounded-2xl border px-3 py-2 text-sm font-medium outline-none',
              isDark ? 'border-white/15 bg-black/40 text-white' : 'border-slate-200 bg-slate-50 text-slate-900',
            )}
          >
            {days.map((d) => {
              const n = d.getDate();
              return (
                <option key={n} value={n}>
                  {format(d, 'EEE d', {locale: ptBR})} — {format(d, 'd MMM', {locale: ptBR})}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col items-center lg:w-[140px]">
          <span
            className={cn(
              'font-extralight tabular-nums leading-none',
              isDark ? 'text-[4.5rem] text-white sm:text-[5.5rem]' : 'text-[4.5rem] text-slate-900 sm:text-[5.5rem]',
            )}
          >
            {String(dayNum).padStart(2, '0')}
          </span>
          <span className={cn('text-xs font-bold uppercase tracking-[0.2em]', isDark ? 'text-[#c9a87c]' : 'text-amber-800')}>
            {format(dayDate, 'EEEE', {locale: ptBR})}
          </span>
          <span className={cn('mt-1 text-sm', isDark ? 'text-white/50' : 'text-slate-500')}>
            {format(dayDate, "d 'de' MMMM", {locale: ptBR})}
          </span>
          {isWeekend && (
            <span className="mt-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200">
              Fim de semana
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div
            className={cn(
              'rounded-2xl border p-5 text-center',
              isDark ? 'border-white/10 bg-black/35' : 'border-slate-200 bg-slate-50/80',
            )}
          >
            <p className={cn('text-[10px] font-black uppercase tracking-widest', isDark ? 'text-white/40' : 'text-slate-500')}>
              Horas registadas
            </p>
            <p className={cn('mt-1 text-3xl font-extralight sm:text-4xl', isDark ? 'text-white' : 'text-slate-900')}>
              {e?.marked ? `${hoursNum} horas` : hoursNum > 0 ? `${hoursNum} horas` : '—'}
            </p>
            {e?.marked && e?.isOffDay && (
              <p className="mt-2 text-xs uppercase tracking-wide text-white/45">Folga / feriado</p>
            )}
          </div>

          {!e?.marked && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={cn('flex items-center gap-1 text-[10px] font-black uppercase tracking-widest', isDark ? 'text-white/35' : 'text-slate-500')}>
                    <Calendar size={10} /> Horas
                  </label>
                  <select
                    value={e?.hours || ''}
                    onChange={(ev) => onHours(dayNum, ev.target.value)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-3 text-sm outline-none',
                      isDark ? 'border-white/12 bg-black/50 text-white' : 'border-slate-200 bg-white text-slate-900',
                    )}
                  >
                    <option value="">Selecione</option>
                    {hourOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={cn('flex items-center gap-1 text-[10px] font-black uppercase tracking-widest', isDark ? 'text-white/35' : 'text-slate-500')}>
                    <Briefcase size={10} /> Obra / projeto
                  </label>
                  <input
                    type="text"
                    list="project-options"
                    value={e?.project || ''}
                    onChange={(ev) => onProject(dayNum, ev.target.value)}
                    placeholder="Nome da obra"
                    className={cn(
                      'w-full rounded-xl border px-3 py-3 text-sm outline-none',
                      isDark ? 'border-white/12 bg-black/50 text-white placeholder:text-white/25' : 'border-slate-200 bg-white text-slate-900',
                    )}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dayNum > 1 && (
                  <button
                    type="button"
                    onClick={() => onCopyPrevious(dayNum)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-wider',
                      isDark ? 'border-white/15 text-[#c9a87c] hover:bg-white/5' : 'border-slate-200 text-amber-800 hover:bg-slate-50',
                    )}
                  >
                    <Copy size={12} /> Repetir dia anterior
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOffDay(dayNum)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-wider',
                    isDark ? 'border-white/15 text-white/55 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <Moon size={12} /> Marcar folga
                </button>
              </div>
            </>
          )}

          {!e?.marked ? (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(dayNum)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold uppercase tracking-[0.15em] transition-all active:scale-[0.99]',
                canConfirm
                  ? isDark
                    ? 'border border-[#c9a87c]/50 bg-gradient-to-r from-[#8b6914]/90 to-[#c9a87c] text-white shadow-[0_0_28px_rgba(201,168,124,0.25)] hover:brightness-110'
                    : 'border border-amber-400 bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md hover:brightness-105'
                  : isDark
                    ? 'cursor-not-allowed border border-white/10 bg-white/5 text-white/30'
                    : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400',
              )}
            >
              <Check size={20} strokeWidth={2.5} />
              Confirmar
            </button>
          ) : (
            <div
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-bold uppercase tracking-wider',
                e?.isOffDay
                  ? 'border-slate-500/40 bg-slate-600/30 text-slate-200'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
              )}
            >
              <Check size={20} />
              {e?.isOffDay ? 'Dia marcado como folga' : 'Dia confirmado'}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

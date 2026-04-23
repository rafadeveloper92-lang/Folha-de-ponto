import React, {useMemo} from 'react';
import {
  format,
  getISOWeek,
  startOfWeek,
  addDays,
  isSameMonth,
  endOfMonth,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns';
import {ptBR} from 'date-fns/locale';
import {Clock, MapPin, TrendingUp, Target, Sparkles, CalendarDays, Wallet} from 'lucide-react';
import type {WorkDay} from '../types';
import {cn} from '../lib/utils';
import {SemiGauge} from './SemiGauge';

function parseHours(h?: string): number {
  if (!h) return 0;
  const m = h.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

type Props = {
  currentDate: Date;
  days: Date[];
  entries: Record<string, Partial<WorkDay>>;
  defaultProject: string;
  setDefaultProject: (v: string) => void;
  applyDefaultProject: () => void;
  totalHours: number;
  totalEarnings: number;
  hourlyRate: number;
  changeMonth: (o: number) => void;
  theme: 'dark' | 'light';
};

export function PremiumDashboard({
  currentDate,
  days,
  entries,
  defaultProject,
  setDefaultProject,
  applyDefaultProject,
  totalHours,
  totalEarnings,
  hourlyRate,
  changeMonth,
  theme,
}: Props) {
  const isDark = theme === 'dark';

  const markedDays = useMemo(() => {
    let c = 0;
    days.forEach((d) => {
      const dn = d.getDate();
      const e = entries[dn];
      if (e?.marked) c += 1;
    });
    return c;
  }, [days, entries]);

  const hoursByDay = useMemo(() => {
    return days.map((d) => ({
      day: d.getDate(),
      hours: parseHours(entries[d.getDate()]?.hours),
      marked: !!entries[d.getDate()]?.marked,
    }));
  }, [days, entries]);

  const maxDayH = Math.max(1, ...hoursByDay.map((x) => x.hours));

  const weekTotals = useMemo(() => {
    const map = new Map<number, number>();
    days.forEach((d) => {
      const dn = d.getDate();
      const h = parseHours(entries[dn]?.hours);
      const e = entries[dn];
      if (!e?.marked && h <= 0) return;
      const wk = getISOWeek(d);
      map.set(wk, (map.get(wk) || 0) + (e?.isOffDay ? 0 : h));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, hours]) => ({week, hours}));
  }, [days, entries]);

  const displayWeekStart = useMemo(() => {
    const today = new Date();
    const sameMonth =
      today.getMonth() === currentDate.getMonth() &&
      today.getFullYear() === currentDate.getFullYear();
    const start = days[0]!;
    if (sameMonth) {
      return startOfWeek(today, {weekStartsOn: 1});
    }
    return startOfWeek(start, {weekStartsOn: 1});
  }, [currentDate, days]);

  const weekTrend = useMemo(() => {
    return Array.from({length: 7}, (_, i) => {
      const d = addDays(displayWeekStart, i);
      const inMonth = isSameMonth(d, currentDate);
      const dn = d.getDate();
      const h = inMonth ? parseHours(entries[dn]?.hours) : 0;
      return {
        label: format(d, 'EEE', {locale: ptBR}).slice(0, 3),
        hours: h,
        inMonth,
      };
    });
  }, [displayWeekStart, currentDate, entries]);

  const maxWeekH = Math.max(1, ...weekTrend.map((x) => x.hours));
  const avgDaily =
    markedDays > 0 ? Math.round((totalHours / markedDays) * 100) / 100 : 0;
  const goalHours = 160;
  const fracMonth = Math.min(1, totalHours / goalHours);
  const fracAvg = Math.min(1, avgDaily / 12);

  const today = startOfDay(new Date());
  const nowY = today.getFullYear();
  const nowM = today.getMonth();
  const lastOfRealMonth = endOfMonth(today).getDate();
  const closingDayNum = Math.min(30, lastOfRealMonth);
  const closingThisMonthReal = startOfDay(new Date(nowY, nowM, closingDayNum));

  const nextPayDate = (from: Date) => {
    const d = startOfDay(from);
    const y = d.getFullYear();
    const m = d.getMonth();
    const fifteenth = startOfDay(new Date(y, m, 15));
    if (d.getTime() <= fifteenth.getTime()) return fifteenth;
    return startOfDay(new Date(y, m + 1, 15));
  };
  const nextPayment = nextPayDate(today);

  const daysToClose = differenceInCalendarDays(closingThisMonthReal, today);
  const daysToPay = differenceInCalendarDays(nextPayment, today);

  const glass = isDark
    ? 'border border-white/[0.08] bg-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl'
    : 'border border-slate-200/90 bg-white shadow-md';

  const rose = isDark ? 'text-[#c9a87c]' : 'text-amber-800';
  const roseBorder = isDark ? 'border-[#c9a87c]/40' : 'border-amber-400';
  const roseGlow = isDark ? 'shadow-[0_0_24px_rgba(201,168,124,0.15)]' : '';
  const t = (a: string, b: string) => (isDark ? a : b);

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={cn('text-[10px] font-black uppercase tracking-[0.35em]', rose)}>
            Resumo
          </p>
          <h2 className={cn('text-2xl font-light tracking-wide', t('text-white', 'text-slate-900'))}>
            {format(currentDate, 'MMMM yyyy', {locale: ptBR})}
          </h2>
        </div>
        <div
          className={cn(
            'flex rounded-full border p-0.5',
            t('border-white/10 bg-black/30', 'border-slate-200 bg-slate-100'),
          )}
        >
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className={cn('rounded-full px-3 py-1.5 text-xs', t('text-white/70 hover:bg-white/10', 'text-slate-600 hover:bg-slate-200'))}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className={cn('rounded-full px-3 py-1.5 text-xs', t('text-white/70 hover:bg-white/10', 'text-slate-600 hover:bg-slate-200'))}
          >
            ›
          </button>
        </div>
      </div>

      <div className={cn('rounded-3xl p-5', glass, roseGlow)}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <div
            className={cn(
              'flex min-w-0 flex-1 items-start gap-2 rounded-2xl border p-3',
              t('border-white/10 bg-black/25', 'border-slate-200 bg-slate-50'),
            )}
          >
            <CalendarDays className={cn('mt-0.5 h-4 w-4 shrink-0', rose)} />
            <div className="min-w-0">
              <p className={cn('text-[9px] font-black uppercase tracking-wider', rose)}>Fecho da folha</p>
              <p className={cn('text-xs font-medium leading-snug', t('text-white/85', 'text-slate-800'))}>
                A empresa fecha a folha no <span className="font-semibold">final do mês (dia {closingDayNum})</span>.
              </p>
              <p className={cn('mt-1 text-[10px]', t('text-white/40', 'text-slate-500'))}>
                {daysToClose > 0
                  ? `Faltam ${daysToClose} dia${daysToClose !== 1 ? 's' : ''} para o fecho (${format(closingThisMonthReal, "d 'de' MMMM", {locale: ptBR})}).`
                  : daysToClose === 0
                    ? 'Hoje é o dia de fecho — confirme as marcações.'
                    : `O fecho deste mês (${format(closingThisMonthReal, 'd MMM', {locale: ptBR})}) já passou.`}
              </p>
            </div>
          </div>
          <div
            className={cn(
              'flex min-w-0 flex-1 items-start gap-2 rounded-2xl border p-3',
              t('border-emerald-500/20 bg-emerald-500/5', 'border-emerald-200 bg-emerald-50/80'),
            )}
          >
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400/90">Pagamento</p>
              <p className={cn('text-xs font-medium leading-snug', t('text-white/85', 'text-slate-800'))}>
                O pagamento é efetuado no <span className="font-semibold">dia 15</span> de cada mês.
              </p>
              <p className={cn('mt-1 text-[10px]', t('text-white/40', 'text-slate-500'))}>
                {daysToPay > 0
                  ? `Próximo pagamento: ${format(nextPayment, "d 'de' MMMM yyyy", {locale: ptBR})} — faltam ${daysToPay} dia${daysToPay !== 1 ? 's' : ''}.`
                  : daysToPay === 0
                    ? 'Hoje é dia de pagamento.'
                    : 'O último dia 15 já passou; o próximo será no mês seguinte.'}
              </p>
            </div>
          </div>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <span className={cn('text-[10px] font-black uppercase tracking-widest', rose)}>
            Dias registados
          </span>
          <Sparkles className={cn('h-4 w-4', rose)} />
        </div>
        <p className={cn('text-5xl font-extralight tabular-nums', isDark ? 'text-white' : 'text-slate-900')}>
          {markedDays}
        </p>
        <p className={cn('mt-1 text-[10px] uppercase tracking-wider', t('text-white/35', 'text-slate-500'))}>
          de {days.length} dias no mês
        </p>
        <div className="mt-4 flex h-10 items-end gap-0.5">
          {hoursByDay.map(({day, hours, marked}) => (
            <div
              key={day}
              title={`Dia ${day}: ${hours}h`}
              className="min-w-[3px] flex-1 rounded-t-sm transition-all"
              style={{
                height: `${Math.max(8, (hours / maxDayH) * 100)}%`,
                backgroundColor:
                  marked && hours > 0
                    ? '#10b981'
                    : marked
                      ? isDark
                        ? 'rgba(201,168,124,0.35)'
                        : 'rgba(180,83,9,0.35)'
                      : isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(15,23,42,0.12)',
              }}
            />
          ))}
        </div>
      </div>

      <div className={cn('rounded-3xl p-5', glass)}>
        <p className={cn('mb-3 text-[10px] font-black uppercase tracking-widest', rose)}>Calendário</p>
        <div
          className={cn(
            'grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase',
            t('text-white/30', 'text-slate-400'),
          )}
        >
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
            <span key={d} className="truncate">
              {d.slice(0, 3)}
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {(() => {
            const first = days[0]!;
            const startPad = (first.getDay() + 6) % 7;
            const cells: (number | null)[] = [...Array(startPad).fill(null), ...days.map((d) => d.getDate())];
            return cells.map((dn, i) => (
              <div
                key={i}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-semibold',
                  dn == null
                    ? 'opacity-0'
                    : entries[dn]?.marked && parseHours(entries[dn]?.hours) > 0
                      ? 'bg-emerald-500/25 text-emerald-700 ring-1 ring-emerald-500/50 dark:text-emerald-300 dark:ring-emerald-500/40'
                      : entries[dn]?.marked
                        ? t('bg-white/[0.06] text-white/50', 'bg-slate-100 text-slate-500')
                        : t('text-white/40', 'text-slate-400'),
                )}
              >
                {dn != null ? dn : ''}
              </div>
            ));
          })()}
        </div>
        <p className={cn('mt-4 text-center text-[10px] font-medium uppercase tracking-wider', rose)}>
          Próximos passos: finalize as marcações
        </p>
      </div>

      <div className={cn('rounded-3xl p-5', glass)}>
        <p className={cn('mb-2 text-[10px] font-black uppercase tracking-widest', rose)}>Obra padrão</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={defaultProject}
            onChange={(e) => setDefaultProject(e.target.value)}
            placeholder="Ex: San Carlos Can Brisa"
            className={cn(
              'min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm',
              t('border-white/10 bg-black/40 text-white/90 placeholder:text-white/25', 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'),
            )}
          />
          <button
            type="button"
            onClick={applyDefaultProject}
            className={cn(
              'shrink-0 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98]',
              roseBorder,
              t('text-[#c9a87c] hover:bg-[#c9a87c]/10', 'text-amber-800 hover:bg-amber-50'),
            )}
          >
            Aplicar a todos
          </button>
        </div>
      </div>

      <div className={cn('rounded-3xl p-5', glass)}>
        <div className="mb-3 flex items-center justify-between">
          <p className={cn('text-[10px] font-black uppercase tracking-widest', rose)}>Horas por semana (mês)</p>
          <Clock className={cn('h-4 w-4', t('text-white/30', 'text-slate-400'))} />
        </div>
        <div className="space-y-3">
          {weekTotals.length === 0 ? (
            <p className={cn('text-sm', t('text-white/35', 'text-slate-500'))}>Sem semanas com registos ainda.</p>
          ) : (
            weekTotals.map(({week, hours}) => (
              <div key={week} className="flex items-center gap-3">
                <span className={cn('w-14 shrink-0 text-[10px] font-bold', t('text-white/45', 'text-slate-500'))}>
                  Sem. {week}
                </span>
                <div
                  className={cn(
                    'h-2 min-w-0 flex-1 overflow-hidden rounded-full',
                    t('bg-white/[0.06]', 'bg-slate-200'),
                  )}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                    style={{
                      width: `${Math.min(100, (hours / Math.max(...weekTotals.map((w) => w.hours), 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span className={cn('w-10 shrink-0 text-right text-sm font-light tabular-nums', t('text-white/90', 'text-slate-900'))}>
                  {hours}h
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={cn('rounded-3xl p-4', glass)}>
          <SemiGauge
            theme={theme}
            accent="rose"
            fraction={fracMonth}
            label="Horas no mês"
            valueText={`${totalHours} h`}
            sublabel={`meta ${goalHours} h`}
          />
        </div>
        <div className={cn('rounded-3xl p-4', glass)}>
          <SemiGauge
            theme={theme}
            accent="emerald"
            fraction={fracAvg}
            label="Média / dia marc."
            valueText={`${avgDaily}`}
            sublabel="máx. ref. 12 h"
          />
        </div>
      </div>

      <div className={cn('rounded-3xl p-5', glass)}>
        <div className="mb-3 flex items-center justify-between">
          <p className={cn('text-[10px] font-black uppercase tracking-widest', rose)}>Tendência semanal</p>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </div>
        <p className={cn('mb-3 text-2xl font-extralight', t('text-white', 'text-slate-900'))}>
          {weekTrend.reduce((s, x) => s + x.hours, 0)}
          <span className={cn('ml-1 text-sm font-normal', t('text-white/40', 'text-slate-500'))}>h esta semana</span>
        </p>
        <div className="flex h-28 items-end gap-1">
          {weekTrend.map((d, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'w-full max-w-[36px] rounded-t-lg bg-gradient-to-t',
                  isDark ? 'from-[#c9a87c]/30 to-[#c9a87c]/90' : 'from-amber-200 to-amber-600',
                )}
                style={{height: `${Math.max(6, (d.hours / maxWeekH) * 100)}%`}}
              />
              <span className={cn('text-[8px] font-bold uppercase', t('text-white/35', 'text-slate-500'))}>
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={cn('grid grid-cols-2 gap-3 rounded-3xl p-5', glass)}>
        <div className="flex items-start gap-2">
          <Target className={cn('mt-0.5 h-5 w-5 shrink-0', rose)} />
          <div>
            <p className={cn('text-[9px] font-black uppercase tracking-wider', t('text-white/40', 'text-slate-500'))}>
              Total mês
            </p>
            <p className={cn('text-lg font-light', t('text-white', 'text-slate-900'))}>{totalHours} h</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <p className={cn('text-[9px] font-black uppercase tracking-wider', t('text-white/40', 'text-slate-500'))}>
              Estimado
            </p>
            <p className="text-lg font-light text-emerald-600 dark:text-emerald-400">€{totalEarnings.toFixed(2)}</p>
            {hourlyRate > 0 && (
              <p className={cn('text-[8px]', t('text-white/30', 'text-slate-400'))}>{hourlyRate} €/h</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

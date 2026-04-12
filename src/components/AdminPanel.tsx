import React, {useCallback, useEffect, useRef, useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {X, Users, MessageSquareWarning, Trash2, CheckCheck, LogOut} from 'lucide-react';
import {format} from 'date-fns';
import {ptBR} from 'date-fns/locale';
import {cn} from '../lib/utils';
import {setAdminSession} from '../lib/adminAuth';
import type {Supervisor, SupportTicket} from '../lib/db';
import {
  deleteSupervisor,
  deleteSupportTicket,
  loadAllSupervisors,
  loadAllSupportTickets,
  markSupportTicketRead,
  saveSupervisor,
} from '../lib/storage';
import {fileToCompressedDataUrl} from '../lib/profilePhoto';

type Props = {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onDataChanged: () => void;
};

export function AdminPanel({open, onClose, theme, onDataChanged}: Props) {
  const [tab, setTab] = useState<'support' | 'supervisors'>('support');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const [t, s] = await Promise.all([loadAllSupportTickets(), loadAllSupervisors()]);
    setTickets(t);
    setSupervisors(s);
  }, []);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const handleLogout = () => {
    setAdminSession(false);
    onClose();
  };

  const handlePickPhoto = async (file: File | null) => {
    const n = newName.trim();
    if (!file) return;
    if (!n) {
      alert('Indique o nome do encarregado.');
      return;
    }
    setAdding(true);
    try {
      const photo = await fileToCompressedDataUrl(file, 512, 0.85);
      const maxOrder =
        supervisors.length > 0 ? Math.max(...supervisors.map((x) => x.sortOrder)) : 0;
      const s: Supervisor = {
        id: `sup-${Date.now()}`,
        name: n,
        photoDataUrl: photo,
        sortOrder: maxOrder + 1,
        createdAt: Date.now(),
      };
      await saveSupervisor(s);
      setNewName('');
      await reload();
      onDataChanged();
    } catch {
      alert('Erro ao processar a foto.');
    } finally {
      setAdding(false);
    }
  };

  const handleAddSupervisorClick = () => {
    const n = newName.trim();
    if (!n) {
      alert('Indique o nome do encarregado.');
      return;
    }
    fileRef.current?.click();
  };

  const handleDeleteSupervisor = async (id: string) => {
    if (!confirm('Remover este encarregado?')) return;
    await deleteSupervisor(id);
    await reload();
    onDataChanged();
  };

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 20}}
            className={cn(
              'fixed inset-4 z-[121] flex flex-col overflow-hidden rounded-3xl border shadow-2xl sm:inset-8 md:left-1/2 md:top-1/2 md:h-[85vh] md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:inset-auto',
              isDark ? 'border-white/10 bg-[#0f1419]' : 'border-slate-200 bg-white',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between border-b px-4 py-3',
                isDark ? 'border-white/10 bg-red-950/30' : 'border-red-100 bg-red-50',
              )}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600">
                  Área administrativa
                </p>
                <h2 className={cn('text-lg font-black', isDark ? 'text-white' : 'text-slate-900')}>
                  Suporte & encarregados
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    'flex items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase',
                    isDark ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800',
                  )}
                >
                  <LogOut size={14} /> Sair
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={cn('rounded-full p-2', isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100')}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="flex border-b">
              {(
                [
                  ['support', 'Mensagens suporte', MessageSquareWarning] as const,
                  ['supervisors', 'Encarregados', Users] as const,
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-wider',
                    tab === id
                      ? isDark
                        ? 'border-b-2 border-amber-400 text-amber-400'
                        : 'border-b-2 border-blue-600 text-blue-600'
                      : isDark
                        ? 'text-slate-500'
                        : 'text-slate-400',
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'support' && (
                <div className="space-y-3">
                  {tickets.length === 0 ? (
                    <p className={cn('py-8 text-center text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      Nenhuma mensagem de utilizadores.
                    </p>
                  ) : (
                    tickets.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          'rounded-2xl border p-4',
                          t.readByAdmin
                            ? isDark
                              ? 'border-white/5 bg-white/[0.02]'
                              : 'border-slate-100 bg-slate-50'
                            : isDark
                              ? 'border-amber-500/40 bg-amber-500/10'
                              : 'border-amber-200 bg-amber-50',
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className={cn('text-xs font-black', isDark ? 'text-white' : 'text-slate-900')}>
                              {t.userName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {t.userEmployeeCode && `Cód: ${t.userEmployeeCode} · `}
                              {t.userWorkplace && `Obra: ${t.userWorkplace}`}
                            </p>
                            <p className="text-[9px] uppercase text-slate-500">
                              {format(t.createdAt, "d MMM yyyy, HH:mm", {locale: ptBR})}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {!t.readByAdmin && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await markSupportTicketRead(t.id, true);
                                  await reload();
                                  onDataChanged();
                                }}
                                className="rounded-lg p-2 text-emerald-500"
                                title="Marcar lida"
                              >
                                <CheckCheck size={16} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Apagar esta mensagem?')) return;
                                await deleteSupportTicket(t.id);
                                await reload();
                                onDataChanged();
                              }}
                              className="rounded-lg p-2 text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p className={cn('whitespace-pre-wrap text-sm', isDark ? 'text-slate-300' : 'text-slate-700')}>
                          {t.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'supervisors' && (
                <div className="space-y-4">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handlePickPhoto(e.target.files?.[0] ?? null);
                      e.target.value = '';
                    }}
                  />
                  <div
                    className={cn(
                      'rounded-2xl border p-4',
                      isDark ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-slate-50',
                    )}
                  >
                    <p className="mb-2 text-[10px] font-black uppercase text-slate-500">Novo encarregado</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Nome completo"
                        className={cn(
                          'min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm',
                          isDark
                            ? 'border-white/10 bg-black text-white'
                            : 'border-slate-200 bg-white',
                        )}
                      />
                      <button
                        type="button"
                        disabled={adding}
                        onClick={handleAddSupervisorClick}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50"
                      >
                        {adding ? '…' : 'Adicionar + foto'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {supervisors.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border p-3',
                          isDark ? 'border-white/10' : 'border-slate-100',
                        )}
                      >
                        <img
                          src={s.photoDataUrl}
                          alt=""
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn('font-bold', isDark ? 'text-white' : 'text-slate-900')}>{s.name}</p>
                          <p className="text-[9px] uppercase text-slate-500">Encarregado</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSupervisor(s.id)}
                          className="text-red-500"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

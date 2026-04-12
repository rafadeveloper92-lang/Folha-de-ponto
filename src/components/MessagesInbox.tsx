import React, {useCallback, useEffect, useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {
  Bell,
  X,
  RefreshCw,
  Trash2,
  CheckCheck,
  Radio,
} from 'lucide-react';
import {format} from 'date-fns';
import {ptBR} from 'date-fns/locale';
import type {InAppMessage} from '../lib/db';
import {cn} from '../lib/utils';
import {fetchRemoteMessages} from '../lib/messagesApi';
import {
  getNotificationPermission,
  getVapidPublicKey,
  isPushSupported,
  subscribeToPush,
  unsubscribePush,
} from '../lib/notifications';
import {
  deleteMessage,
  loadAllMessages,
  markAllMessagesRead,
  markMessageRead,
  upsertMessages,
} from '../lib/storage';

type Props = {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  defaultSyncUrl: string;
  onMessagesChanged?: () => void;
};

export function MessagesInbox({
  open,
  onClose,
  theme,
  defaultSyncUrl,
  onMessagesChanged,
}: Props) {
  const [items, setItems] = useState<InAppMessage[]>([]);
  const [syncUrl, setSyncUrl] = useState(defaultSyncUrl);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<'idle' | 'on' | 'unsupported'>('idle');

  const reload = useCallback(async () => {
    const list = await loadAllMessages();
    setItems(list);
  }, []);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  useEffect(() => {
    setSyncUrl(defaultSyncUrl);
  }, [defaultSyncUrl]);

  useEffect(() => {
    if (!isPushSupported() || !getVapidPublicKey()) {
      setPushState('unsupported');
      return;
    }
    void getNotificationPermission().then((p) =>
      setPushState(p === 'granted' ? 'on' : 'idle'),
    );
  }, [open]);

  const handleSync = async () => {
    setSyncError(null);
    setSyncing(true);
    try {
      const remote = await fetchRemoteMessages(syncUrl);
      const now = Date.now();
      const mapped: InAppMessage[] = remote.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt ?? now,
        read: false,
        source: 'sync',
      }));
      await upsertMessages(mapped);
      await reload();
      onMessagesChanged?.();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Falha ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleRead = async (m: InAppMessage) => {
    await markMessageRead(m.id, !m.read);
    await reload();
    onMessagesChanged?.();
  };

  const handleDelete = async (id: string) => {
    await deleteMessage(id);
    await reload();
    onMessagesChanged?.();
  };

  const handleMarkAllRead = async () => {
    await markAllMessagesRead();
    await reload();
    onMessagesChanged?.();
  };

  const handlePushToggle = async () => {
    if (pushState === 'unsupported') return;
    if (pushState === 'on') {
      await unsubscribePush();
      setPushState('idle');
      return;
    }
    const ok = await subscribeToPush();
    setPushState(ok ? 'on' : 'idle');
  };

  const unread = items.filter((m) => !m.read).length;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onClick={onClose}
            className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{x: '100%'}}
            animate={{x: 0}}
            exit={{x: '100%'}}
            transition={{type: 'spring', damping: 28, stiffness: 220}}
            className={cn(
              'fixed right-0 top-0 bottom-0 z-[90] flex w-full max-w-md flex-col border-l shadow-2xl',
              theme === 'dark'
                ? 'border-white/10 bg-[#141414]'
                : 'border-slate-200 bg-white',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between border-b p-4',
                theme === 'dark' ? 'border-white/10' : 'border-slate-100',
              )}
            >
              <div className="flex items-center gap-2">
                <Bell
                  size={22}
                  className={theme === 'dark' ? 'text-amber-400' : 'text-blue-600'}
                />
                <div>
                  <h2
                    className={cn(
                      'text-sm font-black uppercase tracking-tight',
                      theme === 'dark' ? 'text-white' : 'text-slate-900',
                    )}
                  >
                    Mensagens
                  </h2>
                  {unread > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                      {unread} não lida{unread !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'rounded-full p-2 transition-colors',
                  theme === 'dark'
                    ? 'text-white/50 hover:bg-white/10'
                    : 'text-slate-400 hover:bg-slate-100',
                )}
              >
                <X size={22} />
              </button>
            </div>

            <div
              className={cn(
                'space-y-3 border-b p-4',
                theme === 'dark' ? 'border-white/10 bg-black/30' : 'border-slate-100 bg-slate-50',
              )}
            >
              <p
                className={cn(
                  'text-[10px] font-black uppercase tracking-widest',
                  theme === 'dark' ? 'text-white/40' : 'text-slate-500',
                )}
              >
                Sincronizar (JSON remoto)
              </p>
              <input
                type="url"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                placeholder="https://…/mensagens.json"
                className={cn(
                  'w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2',
                  theme === 'dark'
                    ? 'border-white/10 bg-black text-white focus:ring-amber-500/50'
                    : 'border-slate-200 bg-white text-slate-900 focus:ring-blue-500/40',
                )}
              />
              <button
                type="button"
                disabled={syncing || !syncUrl.trim()}
                onClick={() => void handleSync()}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50',
                  theme === 'dark'
                    ? 'bg-amber-500 text-black'
                    : 'bg-blue-600 text-white',
                )}
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                Atualizar mensagens
              </button>
              {syncError && (
                <p className="text-[10px] font-medium text-red-500">{syncError}</p>
              )}

              {pushState !== 'unsupported' && (
                <button
                  type="button"
                  onClick={() => void handlePushToggle()}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[10px] font-black uppercase tracking-widest',
                    theme === 'dark'
                      ? 'border-white/15 text-white hover:bg-white/5'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <Radio
                    size={14}
                    className={pushState === 'on' ? 'text-emerald-500' : undefined}
                  />
                  {pushState === 'on'
                    ? 'Notificações ativas'
                    : 'Ativar notificações push'}
                </button>
              )}
              {pushState === 'unsupported' && (
                <p
                  className={cn(
                    'text-[9px] uppercase tracking-wider',
                    theme === 'dark' ? 'text-white/30' : 'text-slate-400',
                  )}
                >
                  Push requer HTTPS, chave VAPID no build e browser compatível.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-b px-4 py-2">
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={items.length === 0}
                className={cn(
                  'flex items-center gap-1 text-[10px] font-black uppercase tracking-widest disabled:opacity-40',
                  theme === 'dark' ? 'text-amber-400' : 'text-blue-600',
                )}
              >
                <CheckCheck size={14} />
                Marcar todas lidas
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {items.length === 0 ? (
                <p
                  className={cn(
                    'px-2 py-8 text-center text-xs',
                    theme === 'dark' ? 'text-white/35' : 'text-slate-400',
                  )}
                >
                  Sem mensagens. Sincronize ou aguarde uma notificação push.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li
                      key={m.id}
                      className={cn(
                        'rounded-xl border p-3',
                        m.read
                          ? theme === 'dark'
                            ? 'border-white/5 bg-white/[0.03]'
                            : 'border-slate-100 bg-slate-50'
                          : theme === 'dark'
                            ? 'border-amber-500/30 bg-amber-500/10'
                            : 'border-blue-200 bg-blue-50/80',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleRead(m)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={cn(
                              'text-xs font-black uppercase tracking-tight',
                              theme === 'dark' ? 'text-white' : 'text-slate-900',
                            )}
                          >
                            {m.title}
                          </p>
                          <p
                            className={cn(
                              'mt-1 whitespace-pre-wrap text-[11px] leading-snug',
                              theme === 'dark' ? 'text-white/70' : 'text-slate-600',
                            )}
                          >
                            {m.body}
                          </p>
                          <p
                            className={cn(
                              'mt-2 text-[9px] font-bold uppercase tracking-wider',
                              theme === 'dark' ? 'text-white/35' : 'text-slate-400',
                            )}
                          >
                            {format(m.createdAt, "d MMM yyyy, HH:mm", {locale: ptBR})}
                            {m.source ? ` · ${m.source}` : ''}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(m.id)}
                          className={cn(
                            'shrink-0 rounded-lg p-2 transition-colors',
                            theme === 'dark'
                              ? 'text-white/40 hover:bg-white/10'
                              : 'text-slate-400 hover:bg-slate-200',
                          )}
                          title="Apagar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

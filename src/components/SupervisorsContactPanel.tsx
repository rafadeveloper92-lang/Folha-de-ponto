import React, {useCallback, useEffect, useState} from 'react';
import {ShieldCheck, Send} from 'lucide-react';
import {cn} from '../lib/utils';
import type {Supervisor} from '../lib/db';
import {loadAllSupervisors, saveSupportTicket} from '../lib/storage';

type Props = {
  theme: 'dark' | 'light';
  isDarkUi: boolean;
  userName: string;
  userEmployeeCode?: string | null;
  userWorkplace: string;
  onTicketSent: () => void;
};

export function SupervisorsContactPanel({
  theme,
  isDarkUi,
  userName,
  userEmployeeCode,
  userWorkplace,
  onTicketSent,
}: Props) {
  const [list, setList] = useState<Supervisor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const reload = useCallback(async () => {
    const s = await loadAllSupervisors();
    setList(s);
    setSelectedId((prev) =>
      prev && s.some((x) => x.id === prev) ? prev : s[0]?.id ?? null,
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = list.find((x) => x.id === selectedId);

  const handleSend = async () => {
    const text = message.trim();
    if (!text) {
      alert('Escreva a sua mensagem.');
      return;
    }
    setSending(true);
    try {
      await saveSupportTicket({
        id: `tix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        supervisorId: selectedId ?? undefined,
        message: text,
        userName: userName || '—',
        userEmployeeCode: userEmployeeCode ?? undefined,
        userWorkplace: userWorkplace || undefined,
        createdAt: Date.now(),
        readByAdmin: false,
      });
      setMessage('');
      onTicketSent();
      alert('Mensagem enviada. A equipa de suporte irá ver no painel administrativo.');
    } finally {
      setSending(false);
    }
  };

  const card = cn(
    'rounded-3xl border p-5 sm:p-6 mb-6',
    isDarkUi ? 'border-blue-500/20 bg-[#151d32]' : 'bg-white border-slate-200',
  );

  if (list.length === 0) {
    return (
      <div className={card}>
        <p className={cn('text-center text-sm', isDarkUi ? 'text-slate-400' : 'text-slate-500')}>
          Ainda não há encarregados registados. Contacte a administração.
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="text-blue-500" size={24} />
        <div>
          <h2 className={cn('text-sm font-black uppercase', isDarkUi ? 'text-white' : 'text-slate-900')}>
            Encarregados
          </h2>
          <p className={cn('text-[11px]', isDarkUi ? 'text-slate-400' : 'text-slate-600')}>
            Escolha um encarregado e envie uma mensagem de suporte ou dúvida.
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-3 overflow-x-auto pb-2">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={cn(
              'flex shrink-0 flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all',
              selectedId === s.id
                ? isDarkUi
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-blue-600 bg-blue-50'
                : isDarkUi
                  ? 'border-white/10 bg-black/20'
                  : 'border-slate-100 bg-slate-50',
            )}
          >
            <div className="relative">
              <img src={s.photoDataUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <span
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white shadow-md"
                title="Administrador / encarregado"
              >
                <ShieldCheck size={12} strokeWidth={2.5} />
              </span>
            </div>
            <span
              className={cn(
                'max-w-[100px] text-center text-[10px] font-black uppercase leading-tight',
                isDarkUi ? 'text-white' : 'text-slate-900',
              )}
            >
              {s.name}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className={cn(
            'mb-4 rounded-2xl border p-4',
            isDarkUi ? 'border-white/10 bg-black/25' : 'border-slate-100',
          )}
        >
          <p className="text-[10px] font-black uppercase text-slate-500">Mensagem para</p>
          <p className={cn('flex items-center gap-2 font-bold', isDarkUi ? 'text-white' : 'text-slate-900')}>
            <ShieldCheck size={16} className="shrink-0 text-blue-500" />
            {selected.name}
          </p>
        </div>
      )}

      <label className={cn('mb-2 block text-[10px] font-black uppercase text-slate-500')}>
        A sua mensagem
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Descreva a sua dúvida ou pedido de suporte…"
        className={cn(
          'mb-4 w-full rounded-xl border px-3 py-2 text-sm',
          isDarkUi ? 'border-white/10 bg-black/40 text-white' : 'border-slate-200',
        )}
      />

      <button
        type="button"
        disabled={sending}
        onClick={() => void handleSend()}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase text-white',
          theme === 'dark' ? 'bg-blue-600' : 'bg-blue-600',
        )}
      >
        {sending ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Send size={18} />
        )}
        Enviar mensagem
      </button>
    </div>
  );
}

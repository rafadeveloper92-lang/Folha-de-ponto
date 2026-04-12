import React, {useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {X, Shield} from 'lucide-react';
import {cn} from '../lib/utils';
import {setAdminSession, verifyAdminPassword} from '../lib/adminAuth';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  theme: 'dark' | 'light';
};

export function AdminLoginModal({open, onClose, onSuccess, theme}: Props) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState(false);
  const isDark = theme === 'dark';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPassword(pwd)) {
      setAdminSession(true);
      setPwd('');
      setErr(false);
      onSuccess();
      onClose();
    } else {
      setErr(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-[115] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{opacity: 0, scale: 0.95}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.95}}
            className={cn(
              'fixed left-1/2 top-1/2 z-[116] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 shadow-2xl',
              isDark ? 'border-white/10 bg-[#1a1f26]' : 'border-slate-200 bg-white',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="text-red-500" size={22} />
                <span className={cn('font-black uppercase tracking-tight', isDark ? 'text-white' : 'text-slate-900')}>
                  Acesso admin
                </span>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit}>
              <label className={cn('mb-2 block text-[10px] font-black uppercase text-slate-500')}>Senha</label>
              <input
                type="password"
                autoComplete="current-password"
                value={pwd}
                onChange={(e) => {
                  setPwd(e.target.value);
                  setErr(false);
                }}
                className={cn(
                  'mb-3 w-full rounded-xl border px-3 py-3 text-sm',
                  isDark ? 'border-white/10 bg-black text-white' : 'border-slate-200',
                )}
                placeholder="••••••••"
              />
              {err && <p className="mb-2 text-xs text-red-500">Senha incorreta.</p>}
              <button
                type="submit"
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-black uppercase text-white"
              >
                Entrar
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

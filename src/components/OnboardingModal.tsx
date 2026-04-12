import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, FileUp, Loader2, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { fileToCompressedDataUrl } from '../lib/profilePhoto';
import { extractEmployeeCodeFromPdf } from '../lib/extractEmployeeCodeFromPdf';
import { extractQrFromPdf, isLikelyIos } from '../lib/extractQrFromPdf';
import { qrDataUrlFromPayload } from '../lib/qrPlaceholder';

/** Tenta obter código GF… a partir do texto do QR ou do URL. */
function normalizeManualCode(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s/g, '');
  if (/^GF\d{4,}$/.test(s)) return s;
  if (/^[A-Z]{2}\d{6,}$/.test(s)) return s;
  return null;
}

function codeFromQrPayload(payload: string): string | null {
  const trimmed = payload.trim();
  const direct = trimmed.match(/\b(GF\d{4,})\b/i);
  if (direct) return direct[1]!.toUpperCase();
  const alt = trimmed.match(/\b([A-Z]{2}\d{6,})\b/);
  if (alt) return alt[1]!.toUpperCase();
  try {
    const u = new URL(trimmed);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    if (/^[A-Z0-9]{4,}$/i.test(last)) return last.toUpperCase();
  } catch {
    /* não é URL */
  }
  return null;
}

type Props = {
  onComplete: (data: {
    name: string;
    role: 'Oficial' | 'Ajudante';
    hourlyRate: number;
    profilePhoto: string;
    employeePdfBase64: string;
    employeeCode: string;
    qrDataUrl: string;
  }) => void | Promise<void>;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(',')[1] ?? s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function OnboardingModal({ onComplete }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Oficial' | 'Ajudante' | ''>('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [manualEmployeeCode, setManualEmployeeCode] = useState('');
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    name.trim().length > 1 &&
    (role === 'Oficial' || role === 'Ajudante') &&
    photo &&
    pdfFile &&
    parseFloat(hourlyRate.replace(',', '.')) > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !pdfFile || !photo) return;
    setBusy(true);
    setPdfError('');
    try {
      let qrFromDoc: {payload: string; qrImageDataUrl: string} | null = null;
      try {
        qrFromDoc = await extractQrFromPdf(pdfFile);
      } catch (err) {
        console.warn('extractQrFromPdf', err);
        /* iOS Safari pode falhar por memória — tentar código manual */
      }

      const manualNorm = normalizeManualCode(manualEmployeeCode);
      if (!qrFromDoc && manualNorm) {
        try {
          const qrImageDataUrl = await qrDataUrlFromPayload(manualNorm);
          qrFromDoc = {payload: manualNorm, qrImageDataUrl};
        } catch (e) {
          console.error(e);
          setPdfError(
            'Não foi possível gerar o QR online. Verifique a internet ou tente noutro dispositivo.',
          );
          setBusy(false);
          return;
        }
      }

      if (!qrFromDoc) {
        setPdfError(
          isLikelyIos()
            ? 'No iPhone o PDF por vezes não é lido. Escreva abaixo o código da ficha (ex. GF123456) — o mesmo que aparece no papel — e tente de novo.'
            : 'Não foi possível ler o QR neste PDF. Use o ficheiro original, ou escreva o código GF manualmente no campo abaixo.',
        );
        setBusy(false);
        return;
      }

      let code =
        (await extractEmployeeCodeFromPdf(pdfFile)) ??
        codeFromQrPayload(qrFromDoc.payload) ??
        manualNorm;
      if (!code) {
        setPdfError(
          'Código do colaborador não encontrado no PDF. Escreva o código GF no campo “Código manual (iPhone)”.',
        );
        setBusy(false);
        return;
      }
      if (manualNorm && manualNorm !== code && /^GF\d/.test(manualNorm)) {
        code = manualNorm;
      }
      const pdfB64 = await fileToBase64(pdfFile);
      await onComplete({
        name: name.trim(),
        role: role as 'Oficial' | 'Ajudante',
        hourlyRate: parseFloat(hourlyRate.replace(',', '.')),
        profilePhoto: photo,
        employeePdfBase64: pdfB64,
        employeeCode: code,
        qrDataUrl: qrFromDoc.qrImageDataUrl,
      });
    } catch (e) {
      console.error(e);
      setPdfError('Erro ao processar o PDF. Tente outro ficheiro ou o código manual no iPhone.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[250] flex items-center justify-center overflow-y-auto p-4"
      style={{
        background: 'linear-gradient(165deg, #0a0f1a 0%, #0c1222 50%, #111827 100%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-full max-w-lg rounded-3xl border border-blue-500/25 bg-[#151d32] p-6 shadow-2xl">
        <h2 className="text-center text-lg font-black uppercase tracking-[0.2em] text-white">
          Ficha de cadastro
        </h2>
        <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Preencha uma vez. O cargo não poderá ser alterado depois.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <User size={12} /> Nome completo
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como na ficha GSI"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Cargo (definitivo)
            </label>
            <div className="flex gap-3">
              {(['Oficial', 'Ajudante'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-all',
                    role === r
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white/5 text-slate-500 hover:bg-white/10',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Valor por hora (€)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="ex: 10,50"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Camera size={12} /> Foto de perfil (obrigatório)
            </label>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f?.type.startsWith('image/')) return;
                setPhoto(await fileToCompressedDataUrl(f));
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-500/40 py-8 text-sm text-slate-400"
            >
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <>Toque para enviar foto</>
              )}
            </button>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <FileUp size={12} /> PDF da ficha GSI (obrigatório)
            </label>
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPdfFile(f || null);
                setPdfError('');
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => pdfRef.current?.click()}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-slate-300"
            >
              {pdfFile ? pdfFile.name : 'Selecionar PDF da ficha…'}
            </button>
            {pdfError && (
              <p className="mt-2 text-xs text-red-400">{pdfError}</p>
            )}
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-amber-200/90">
                Código manual (iPhone / QR não lido)
              </label>
              <p className="mb-2 text-[10px] leading-relaxed text-slate-400">
                Se o telemóvel não ler o QR do PDF (comum no Safari iOS), escreva aqui o código da
                ficha, ex. <span className="font-mono text-slate-300">GF123456</span>. O PDF continua
                obrigatório; será criada uma imagem de QR para o seu perfil.
              </p>
              <input
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                value={manualEmployeeCode}
                onChange={(e) => setManualEmployeeCode(e.target.value)}
                placeholder="ex: GF123456"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm uppercase text-slate-100 placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={handleSubmit}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" size={18} /> A processar…
            </>
          ) : (
            'Concluir cadastro'
          )}
        </button>
      </div>
    </motion.div>
  );
}

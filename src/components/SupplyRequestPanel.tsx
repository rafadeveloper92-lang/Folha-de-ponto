import React, {useCallback, useState} from 'react';
import {Camera, Plus, Send, Trash2, Package} from 'lucide-react';
import {cn} from '../lib/utils';
import {fileToCompressedDataUrl} from '../lib/profilePhoto';
import {
  CONSTRUCTION_ITEM_PRESETS,
  EU_PANTS_SIZES,
  EU_TOP_SIZES,
  EU_VEST_SIZES,
  EU_SHOE_SIZES,
} from '../constants/supplyPresets';
import {
  buildSupplyRequestText,
  shareSupplyRequest,
  type ConstructionLine,
  type ClothingSelection,
} from '../lib/supplyRequestShare';

type LineDraft = {
  id: string;
  preset: string;
  customLabel: string;
  photoDataUrl: string;
};

function newLine(): LineDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    preset: CONSTRUCTION_ITEM_PRESETS[0],
    customLabel: '',
    photoDataUrl: '',
  };
}

type Props = {
  theme: 'dark' | 'light';
  isDarkUi: boolean;
  workerName: string;
  employeeCode?: string | null;
  defaultObra: string;
};

export function SupplyRequestPanel({
  theme,
  isDarkUi,
  workerName,
  employeeCode,
  defaultObra,
}: Props) {
  const [obra, setObra] = useState(defaultObra);
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [clothing, setClothing] = useState<ClothingSelection>({});
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    setObra((prev) => (prev.trim() ? prev : defaultObra));
  }, [defaultObra]);

  const cardClass = cn(
    'rounded-3xl border p-5 sm:p-6 mb-6',
    isDarkUi ? 'border-blue-500/20 bg-[#151d32]' : 'bg-white border-slate-200',
  );
  const labelClass = cn(
    'text-[10px] font-black uppercase tracking-widest mb-1.5 block',
    isDarkUi ? 'text-slate-500' : 'text-slate-500',
  );
  const inputClass = cn(
    'w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2',
    isDarkUi
      ? 'border-white/10 bg-black/40 text-white focus:ring-blue-500/40'
      : 'border-slate-200 bg-white text-slate-900 focus:ring-blue-500/30',
  );
  const selectClass = inputClass + ' cursor-pointer';

  const addLine = () => setLines((L) => [...L, newLine()]);
  const removeLine = (id: string) =>
    setLines((L) => (L.length <= 1 ? L : L.filter((x) => x.id !== id)));

  const updateLine = (id: string, patch: Partial<LineDraft>) =>
    setLines((L) => L.map((x) => (x.id === id ? {...x, ...patch} : x)));

  const onPickPhoto = useCallback(
    async (id: string, file: File | null) => {
      if (!file) return;
      try {
        const dataUrl = await fileToCompressedDataUrl(file, 960, 0.85);
        updateLine(id, {photoDataUrl: dataUrl});
      } catch {
        alert('Não foi possível carregar a foto. Tente outra imagem.');
      }
    },
    [],
  );

  const resolveLabel = (line: LineDraft) =>
    line.preset === 'Outro (especificar)'
      ? line.customLabel.trim() || 'Outro'
      : line.preset;

  const handleSend = async () => {
    const withPhoto = lines.filter((l) => l.photoDataUrl);
    const withoutPhoto = lines.filter((l) => !l.photoDataUrl);

    const hasClothing = !!(
      clothing.calca ||
      clothing.blusa ||
      clothing.colete ||
      clothing.sapato
    );

    if (withoutPhoto.length && withPhoto.length) {
      alert(
        'Todas as linhas de material precisam de foto, ou remova as linhas que não vai usar.',
      );
      return;
    }

    if (withPhoto.length === 0 && !hasClothing) {
      alert('Adicione pelo menos um material com foto ou escolha tamanhos de roupa.');
      return;
    }

    for (const l of withPhoto) {
      if (l.preset === 'Outro (especificar)' && !l.customLabel.trim()) {
        alert('Especifique o nome do material em “Outro”.');
        return;
      }
    }

    const construction: ConstructionLine[] = withPhoto.map((l) => ({
      id: l.id,
      label: resolveLabel(l),
      photoDataUrl: l.photoDataUrl,
    }));

    const text = buildSupplyRequestText({
      name: workerName,
      employeeCode: employeeCode ?? undefined,
      obra: obra.trim() || defaultObra || '—',
      construction,
      clothing,
      notes,
    });

    setSending(true);
    try {
      await shareSupplyRequest(text, construction);
    } catch (e) {
      console.error(e);
      alert('Falha ao abrir partilha. Tente de novo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cardClass}>
      <div className="mb-6 flex items-start gap-3">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            isDarkUi ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700',
          )}
        >
          <Package size={24} />
        </div>
        <div>
          <h2
            className={cn(
              'text-sm font-black uppercase tracking-tight',
              isDarkUi ? 'text-white' : 'text-slate-900',
            )}
          >
            Pedido de materiais e roupa
          </h2>
          <p
            className={cn(
              'mt-1 text-[11px] leading-relaxed',
              isDarkUi ? 'text-slate-400' : 'text-slate-600',
            )}
          >
            Materiais de obra: escolha o tipo e envie <strong>uma foto</strong> de cada item em
            falta. Roupa: tamanhos em <strong>numeração europeia (EU)</strong>. O envio usa os dados
            do seu perfil e abre para o responsável (WhatsApp).
          </p>
        </div>
      </div>

      <div className="mb-5 space-y-1">
        <label className={labelClass}>Obra / projeto</label>
        <input
          type="text"
          className={inputClass}
          value={obra}
          onChange={(e) => setObra(e.target.value)}
          placeholder="Nome da obra"
        />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <label className={cn(labelClass, 'mb-0')}>Materiais de obra</label>
        <button
          type="button"
          onClick={addLine}
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider',
            isDarkUi ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700',
          )}
        >
          <Plus size={14} /> Linha
        </button>
      </div>

      <div className="space-y-4 mb-8">
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              'rounded-2xl border p-4',
              isDarkUi ? 'border-white/10 bg-black/25' : 'border-slate-100 bg-slate-50',
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <label className={labelClass}>Item</label>
                <select
                  className={selectClass}
                  value={line.preset}
                  onChange={(e) => updateLine(line.id, {preset: e.target.value})}
                >
                  {CONSTRUCTION_ITEM_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {line.preset === 'Outro (especificar)' && (
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Descreva o material"
                    value={line.customLabel}
                    onChange={(e) => updateLine(line.id, {customLabel: e.target.value})}
                  />
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:w-40">
                <label className={labelClass}>Foto (obrigatória)</label>
                <label
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed py-6 transition-colors',
                    line.photoDataUrl
                      ? isDarkUi
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-emerald-300 bg-emerald-50'
                      : isDarkUi
                        ? 'border-white/20 hover:border-blue-400/50'
                        : 'border-slate-300 hover:border-blue-400',
                  )}
                >
                  {line.photoDataUrl ? (
                    <img
                      src={line.photoDataUrl}
                      alt=""
                      className="max-h-24 w-full rounded-lg object-contain"
                    />
                  ) : (
                    <>
                      <Camera size={22} className={isDarkUi ? 'text-slate-500' : 'text-slate-400'} />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        Tirar / galeria
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      void onPickPhoto(line.id, f ?? null);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className={cn(
                    'self-end rounded-xl p-2 sm:self-center',
                    isDarkUi ? 'text-red-400 hover:bg-white/10' : 'text-red-500 hover:bg-red-50',
                  )}
                  title="Remover linha"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <h3
        className={cn(
          'mb-3 text-xs font-black uppercase tracking-widest',
          isDarkUi ? 'text-slate-400' : 'text-slate-600',
        )}
      >
        Roupa — tamanhos EU
      </h3>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(
          [
            ['calca', 'Calça', EU_PANTS_SIZES] as const,
            ['blusa', 'Blusa / camisola', EU_TOP_SIZES] as const,
            ['colete', 'Colete', EU_VEST_SIZES] as const,
            ['sapato', 'Sapato', EU_SHOE_SIZES] as const,
          ] as const
        ).map(([key, lbl, opts]) => (
          <div key={key}>
            <label className={labelClass}>{lbl}</label>
            <select
              className={selectClass}
              value={clothing[key] ?? ''}
              onChange={(e) =>
                setClothing((c) => ({
                  ...c,
                  [key]: e.target.value || undefined,
                }))
              }
            >
              <option value="">— Não pedir —</option>
              {opts.map((s) => (
                <option key={s} value={s}>
                  EU {s}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <label className={labelClass}>Notas (opcional)</label>
        <textarea
          className={cn(inputClass, 'min-h-[88px] resize-y')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Quantidades, urgência, referência interna…"
        />
      </div>

      <div
        className={cn(
          'rounded-2xl border p-4 mb-6 text-[11px]',
          isDarkUi ? 'border-white/10 bg-black/30 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-600',
        )}
      >
        <p className="font-bold uppercase tracking-wider text-[10px] mb-2">Resumo do remetente</p>
        <p>
          <span className="opacity-70">Nome:</span> {workerName || '—'}
        </p>
        <p>
          <span className="opacity-70">Código / ID:</span> {employeeCode || '—'}
        </p>
        <p>
          <span className="opacity-70">Obra:</span> {obra.trim() || defaultObra || '—'}
        </p>
      </div>

      <button
        type="button"
        disabled={sending}
        onClick={() => void handleSend()}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50',
          theme === 'dark'
            ? 'bg-[#25D366] text-white shadow-lg shadow-green-900/30'
            : 'bg-[#25D366] text-white shadow-md',
        )}
      >
        {sending ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <Send size={20} />
        )}
        Enviar pedido (WhatsApp)
      </button>
      <p
        className={cn(
          'mt-3 text-center text-[9px] uppercase tracking-wider',
          isDarkUi ? 'text-slate-500' : 'text-slate-400',
        )}
      >
        No telemóvel pode abrir o menu Partilhar — escolha WhatsApp. No PC abre chat web com o texto;
        fotos podem precisar de envio separado.
      </p>
    </div>
  );
}

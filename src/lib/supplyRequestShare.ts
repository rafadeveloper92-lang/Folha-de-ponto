import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {format} from 'date-fns';
import {buildSupplyRequestPdfBlob} from './buildSupplyRequestPdf';

const DEFAULT_WHATSAPP_E164 = '34641672023';

export function getSuppliesWhatsAppE164(): string {
  const raw =
    (import.meta.env.VITE_SUPPLIES_WHATSAPP as string | undefined)?.replace(/\D/g, '') ?? '';
  return raw.length >= 9 ? raw : DEFAULT_WHATSAPP_E164;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = r.result as string;
      resolve(s.split(',')[1] ?? s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export type ConstructionLine = {id: string; label: string; photoDataUrl: string};

export type ClothingSelection = {
  calca?: string;
  blusa?: string;
  colete?: string;
  sapato?: string;
};

export function buildSupplyRequestText(params: {
  name: string;
  employeeCode?: string;
  obra: string;
  construction: ConstructionLine[];
  clothing: ClothingSelection;
  notes?: string;
}): string {
  const lines: string[] = [
    '📋 *Pedido GSI — Materiais / Roupa*',
    '',
    `👤 *Nome:* ${params.name || '—'}`,
    `🪪 *Código / ID:* ${params.employeeCode || '—'}`,
    `🏗️ *Obra:* ${params.obra || '—'}`,
    '',
  ];
  if (params.construction.length) {
    lines.push('*Materiais (detalhe + fotos no PDF anexo):*');
    params.construction.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.label}`);
    });
    lines.push('');
  }
  const c = params.clothing;
  const hasClothing = !!(c.calca || c.blusa || c.colete || c.sapato);
  if (hasClothing) {
    lines.push('*Roupa (tamanhos EU — ver PDF):*');
    if (c.calca) lines.push(`• Calça: ${c.calca}`);
    if (c.blusa) lines.push(`• Blusa: ${c.blusa}`);
    if (c.colete) lines.push(`• Colete: ${c.colete}`);
    if (c.sapato) lines.push(`• Sapato: ${c.sapato}`);
    lines.push('');
  }
  if (params.notes?.trim()) {
    lines.push('*Notas:*');
    lines.push(params.notes.trim());
    lines.push('');
  }
  lines.push('_PDF com fotos dos materiais anexo._');
  lines.push('_Enviado pela app GSI Tracker_');
  lines.push('');
  lines.push(`📱 *Contacto materiais:* +34 641 67 20 23`);
  return lines.join('\n');
}

async function nativeSharePdfAndText(pdfBlob: Blob, text: string, fileName: string): Promise<void> {
  const base64 = await blobToBase64(pdfBlob);
  const path = `gsi_supply/${Date.now()}_${fileName.replace(/[^\w.\-]/g, '_')}`;
  const {uri} = await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  await Share.share({
    title: 'Pedido materiais GSI',
    text,
    files: [uri],
    dialogTitle: 'Enviar para WhatsApp',
  });
}

export type ShareSupplyRequestInput = {
  /** Texto curto para WhatsApp (resumo + indicação do PDF) */
  text: string;
  name: string;
  employeeCode?: string;
  obra: string;
  construction: ConstructionLine[];
  clothing: ClothingSelection;
  notes?: string;
};

/**
 * Gera PDF com layout (dados, roupa, fotos) e partilha (WhatsApp).
 */
export async function shareSupplyRequest(input: ShareSupplyRequestInput): Promise<void> {
  const pdfBlob = await buildSupplyRequestPdfBlob({
    name: input.name,
    employeeCode: input.employeeCode,
    obra: input.obra,
    construction: input.construction,
    clothing: input.clothing,
    notes: input.notes,
  });

  const safeName = (input.name || 'pedido').replace(/[^\w\s-]/g, '').slice(0, 24).trim() || 'pedido';
  const fileName = `GSI_pedido_materiais_${safeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      await nativeSharePdfAndText(pdfBlob, input.text, fileName);
      return;
    } catch (e) {
      console.warn('native share PDF failed', e);
    }
  }

  const file = new File([pdfBlob], fileName, {type: 'application/pdf'});

  try {
    if (navigator.share) {
      const data: ShareData = {
        text: input.text,
        files: [file],
        title: 'Pedido GSI',
      };
      if (!navigator.canShare || navigator.canShare(data)) {
        await navigator.share(data);
        return;
      }
    }
  } catch (e) {
    console.warn('web share PDF failed', e);
  }

  try {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    /* ignore */
  }

  const phone = getSuppliesWhatsAppE164();
  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(input.text)}`,
    '_blank',
    'noopener,noreferrer',
  );
  alert(
    'O PDF foi descarregado. Anexe-o na conversa do WhatsApp que abriu (ícone de clipe 📎).',
  );
}

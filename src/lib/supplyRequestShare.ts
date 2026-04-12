import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';

const DEFAULT_WHATSAPP_E164 = '34641672023';

export function getSuppliesWhatsAppE164(): string {
  const raw = (import.meta.env.VITE_SUPPLIES_WHATSAPP as string | undefined)?.replace(/\D/g, '') ?? '';
  return raw.length >= 9 ? raw : DEFAULT_WHATSAPP_E164;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bin = atob(b64 ?? '');
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], {type: mime});
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
    lines.push('*Materiais de obra (ver fotos anexas):*');
    params.construction.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.label}`);
    });
    lines.push('');
  }
  const c = params.clothing;
  const hasClothing = !!(c.calca || c.blusa || c.colete || c.sapato);
  if (hasClothing) {
    lines.push('*Roupa (tamanhos EU):*');
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
  lines.push('_Enviado pela app GSI Tracker_');
  lines.push('');
  lines.push(`📱 *Contacto materiais:* +34 641 67 20 23`);
  return lines.join('\n');
}

async function nativeShareWithFiles(
  text: string,
  files: {name: string; blob: Blob}[],
): Promise<boolean> {
  const uris: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const base64 = await blobToBase64(f.blob);
    const path = `gsi_supply/${Date.now()}_${i}_${f.name.replace(/[^\w.\-]/g, '_')}`;
    const {uri} = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    uris.push(uri);
  }
  await Share.share({
    title: 'Pedido materiais GSI',
    text,
    files: uris,
    dialogTitle: 'Enviar para WhatsApp',
  });
  return true;
}

/**
 * Abre partilha (ideal: WhatsApp) com texto + imagens. Fallback: só texto em wa.me.
 */
export async function shareSupplyRequest(
  text: string,
  construction: ConstructionLine[],
): Promise<void> {
  const fileBlobs = construction.map((c, i) => ({
    name: `material_${i + 1}_${c.label.slice(0, 20).replace(/\s+/g, '_')}.jpg`,
    blob: dataUrlToBlob(c.photoDataUrl),
  }));

  if (Capacitor.isNativePlatform()) {
    try {
      await nativeShareWithFiles(text, fileBlobs);
      return;
    } catch (e) {
      console.warn('native multi-file share failed', e);
    }
  }

  const imageFiles = fileBlobs.map(
    (f) => new File([f.blob], f.name, {type: f.blob.type || 'image/jpeg'}),
  );

  try {
    if (navigator.share && imageFiles.length > 0) {
      const data: ShareData = {
        text,
        files: imageFiles,
        title: 'Pedido GSI',
      };
      if (!navigator.canShare || navigator.canShare(data)) {
        await navigator.share(data);
        return;
      }
    }
  } catch (e) {
    console.warn('web share files failed', e);
  }

  try {
    if (navigator.share && imageFiles.length === 0) {
      await navigator.share({text, title: 'Pedido GSI'});
      return;
    }
  } catch {
    /* fall through */
  }

  const phone = getSuppliesWhatsAppE164();
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');

  if (imageFiles.length > 0) {
    alert(
      'O WhatsApp abriu só com o texto. As fotos dos materiais não puderam ser anexadas automaticamente neste dispositivo. Use Partilhar novamente ou envie as fotos numa segunda mensagem.',
    );
  }
}

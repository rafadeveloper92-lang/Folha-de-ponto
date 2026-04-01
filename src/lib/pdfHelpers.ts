import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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

/** Browser: descarga via âncora (no Android WebView pode ser bloqueado). */
export function downloadPdfBlobWeb(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Android/iOS: grava em cache e abre o diálogo nativo (WhatsApp, Ficheiros, Drive…). */
async function nativeSharePdfFile(
  blob: Blob,
  fileName: string,
  shareText: string,
): Promise<void> {
  const base64 = await blobToBase64(blob);
  const path = `gsi_exports/${fileName.replace(/[^\w.\-]/g, '_')}`;
  const { uri } = await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: 'Ponto GSI',
    text: shareText,
    files: [uri],
    dialogTitle: 'Partilhar PDF',
  });
}

export async function downloadPdfBlob(blob: Blob, fileName: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await nativeSharePdfFile(
        blob,
        fileName,
        'Relatório de ponto — escolha onde guardar ou com que app abrir.',
      );
      return;
    } catch (e) {
      console.warn('native share (download) failed', e);
    }
  }
  downloadPdfBlobWeb(blob, fileName);
}

export async function shareOrDownloadPdf(
  blob: Blob,
  fileName: string,
  shareTitle: string,
  shareText: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await nativeSharePdfFile(blob, fileName, shareText);
      return;
    } catch (e) {
      console.warn('native share failed', e);
      try {
        await downloadPdfBlob(blob, fileName);
        return;
      } catch (e2) {
        console.warn('fallback failed', e2);
      }
    }
  }

  const file = new File([blob], fileName, { type: 'application/pdf' });

  try {
    if (navigator.share) {
      const data: ShareData = {
        files: [file],
        title: shareTitle,
        text: shareText,
      };
      if (!navigator.canShare || navigator.canShare(data)) {
        await navigator.share(data);
        return;
      }
    }
  } catch (err) {
    console.warn('web share failed', err);
  }

  downloadPdfBlobWeb(blob, fileName);
}

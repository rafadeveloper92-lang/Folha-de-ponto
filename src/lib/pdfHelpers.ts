import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function renderElementToPdfBlob(el: HTMLElement): Promise<Blob> {
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 150));

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: el.offsetWidth || el.scrollWidth,
    height: el.offsetHeight || el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

  return pdf.output('blob');
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadPdf(
  blob: Blob,
  fileName: string,
  shareTitle: string,
  shareText: string,
): Promise<void> {
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
    console.warn('share failed', err);
  }

  downloadPdfBlob(blob, fileName);
}

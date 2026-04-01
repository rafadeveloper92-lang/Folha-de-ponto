import jsQR from 'jsqr';

type QrResult = {
  /** Conteúdo lido do QR (mesmo que no PDF) */
  payload: string;
  /** Imagem PNG do QR recortada do PDF — para exibir ao utilizador */
  qrImageDataUrl: string;
};

function cropQrFromCanvas(
  canvas: HTMLCanvasElement,
  location: NonNullable<ReturnType<typeof jsQR>>['location'],
): string {
  const pad = 6;
  const xs = [
    location.topLeftCorner.x,
    location.topRightCorner.x,
    location.bottomLeftCorner.x,
    location.bottomRightCorner.x,
  ];
  const ys = [
    location.topLeftCorner.y,
    location.topRightCorner.y,
    location.bottomLeftCorner.y,
    location.bottomRightCorner.y,
  ];
  const x = Math.max(0, Math.floor(Math.min(...xs) - pad));
  const y = Math.max(0, Math.floor(Math.min(...ys) - pad));
  const x2 = Math.min(canvas.width, Math.ceil(Math.max(...xs) + pad));
  const y2 = Math.min(canvas.height, Math.ceil(Math.max(...ys) + pad));
  const cw = Math.max(1, x2 - x);
  const ch = Math.max(1, y2 - y);
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (!octx) return canvas.toDataURL('image/png');
  octx.drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch);
  return out.toDataURL('image/png');
}

function tryDecodeQr(
  imageData: ImageData,
  sourceCanvas: HTMLCanvasElement,
): QrResult | null {
  const code = jsQR(
    imageData.data,
    imageData.width,
    imageData.height,
    { inversionAttempts: 'attemptBoth' },
  );
  if (!code?.data) return null;
  return {
    payload: code.data,
    qrImageDataUrl: cropQrFromCanvas(sourceCanvas, code.location),
  };
}

/** Varre a página em regiões (útil se o QR for pequeno). */
function scanCanvasRegions(canvas: HTMLCanvasElement): QrResult | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width: W, height: H } = canvas;

  const full = ctx.getImageData(0, 0, W, H);
  const hit = tryDecodeQr(full, canvas);
  if (hit) return hit;

  const grid = 2;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.floor((gx * W) / grid);
      const y = Math.floor((gy * H) / grid);
      const w = Math.floor(W / grid) + 2;
      const h = Math.floor(H / grid) + 2;
      const slice = ctx.getImageData(x, y, w, h);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.putImageData(slice, 0, 0);
      const r = tryDecodeQr(slice, c);
      if (r) return r;
    }
  }

  // Banda direita (muitas fichas colocam o QR à direita)
  const rw = Math.floor(W * 0.45);
  const rx = W - rw;
  const sliceR = ctx.getImageData(rx, 0, rw, H);
  const cR = document.createElement('canvas');
  cR.width = rw;
  cR.height = H;
  cR.getContext('2d')!.putImageData(sliceR, 0, 0);
  return tryDecodeQr(sliceR, cR);
}

/**
 * Extrai o QR **tal como está no PDF** (renderiza a página e descodifica a imagem).
 * Assim o encarregado lê o mesmo padrão/payload do documento original.
 */
export async function extractQrFromPdf(file: File): Promise<QrResult | null> {
  const buf = await file.arrayBuffer();
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const scales = [2, 2.75, 3.5];

  for (let pi = 1; pi <= Math.min(pdf.numPages, 3); pi++) {
    const page = await pdf.getPage(pi);
    for (const scale of scales) {
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page
        .render({
          canvas,
          viewport,
          /** AnnotationMode.ENABLE — inclui anotações (QR em muitas fichas). */
          annotationMode: 1,
        })
        .promise;

      const found = scanCanvasRegions(canvas);
      if (found) return found;
    }
  }

  return null;
}

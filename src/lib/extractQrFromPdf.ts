import jsQR from 'jsqr';

type QrResult = {
  /** Conteúdo lido do QR (mesmo que no PDF) */
  payload: string;
  /** Imagem PNG do QR — alta resolução para ecrã e leitores */
  qrImageDataUrl: string;
};

type JsLocation = NonNullable<ReturnType<typeof jsQR>>['location'];

/** Só os cantos — usado após escalar entre renders. */
type QrQuad = Pick<
  JsLocation,
  | 'topLeftCorner'
  | 'topRightCorner'
  | 'bottomLeftCorner'
  | 'bottomRightCorner'
>;

function decodeQrFromCanvas(
  canvas: HTMLCanvasElement,
): { payload: string; location: JsLocation } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width: W, height: H } = canvas;
  const full = ctx.getImageData(0, 0, W, H);
  let code = jsQR(full.data, full.width, full.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (code?.data) return { payload: code.data, location: code.location };

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
      code = jsQR(slice.data, slice.width, slice.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (code?.data) {
        const loc = { ...code.location };
        loc.topLeftCorner = {
          x: loc.topLeftCorner.x + x,
          y: loc.topLeftCorner.y + y,
        };
        loc.topRightCorner = {
          x: loc.topRightCorner.x + x,
          y: loc.topRightCorner.y + y,
        };
        loc.bottomLeftCorner = {
          x: loc.bottomLeftCorner.x + x,
          y: loc.bottomLeftCorner.y + y,
        };
        loc.bottomRightCorner = {
          x: loc.bottomRightCorner.x + x,
          y: loc.bottomRightCorner.y + y,
        };
        return { payload: code.data, location: loc };
      }
    }
  }

  const rw = Math.floor(W * 0.45);
  const rx = W - rw;
  const sliceR = ctx.getImageData(rx, 0, rw, H);
  const cR = document.createElement('canvas');
  cR.width = rw;
  cR.height = H;
  cR.getContext('2d')!.putImageData(sliceR, 0, 0);
  code = jsQR(sliceR.data, sliceR.width, sliceR.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (code?.data) {
    const loc = { ...code.location };
    const ox = rx;
    loc.topLeftCorner = { x: loc.topLeftCorner.x + ox, y: loc.topLeftCorner.y };
    loc.topRightCorner = { x: loc.topRightCorner.x + ox, y: loc.topRightCorner.y };
    loc.bottomLeftCorner = {
      x: loc.bottomLeftCorner.x + ox,
      y: loc.bottomLeftCorner.y,
    };
    loc.bottomRightCorner = {
      x: loc.bottomRightCorner.x + ox,
      y: loc.bottomRightCorner.y,
    };
    return { payload: code.data, location: loc };
  }
  return null;
}

/** Recorta e opcionalmente amplia com vizinho mais próximo (QR fica nítido em ecrã). */
function cropQrHighRes(
  source: HTMLCanvasElement,
  location: QrQuad,
  padFactor = 0.08,
): string {
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
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const qw = maxX - minX;
  const qh = maxY - minY;
  const pad = Math.max(8, Math.ceil(Math.max(qw, qh) * padFactor));

  let x = Math.max(0, Math.floor(minX - pad));
  let y = Math.max(0, Math.floor(minY - pad));
  let cw = Math.ceil(maxX - minX + pad * 2);
  let ch = Math.ceil(maxY - minY + pad * 2);
  cw = Math.min(cw, source.width - x);
  ch = Math.min(ch, source.height - y);
  cw = Math.max(1, cw);
  ch = Math.max(1, ch);

  const minExport = 420;
  const shortSide = Math.min(cw, ch);
  const integerScale = Math.max(
    1,
    Math.min(8, Math.ceil(minExport / shortSide)),
  );

  const out = document.createElement('canvas');
  out.width = cw * integerScale;
  out.height = ch * integerScale;
  const octx = out.getContext('2d');
  if (!octx) return source.toDataURL('image/png');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(
    source,
    x,
    y,
    cw,
    ch,
    0,
    0,
    cw * integerScale,
    ch * integerScale,
  );
  return out.toDataURL('image/png');
}

/**
 * Extrai o QR do PDF: localiza com várias escalas e devolve recorte em **alta resolução**
 * (re-render da página com zoom maior + upscaling por vizinho mais próximo).
 */
export async function extractQrFromPdf(file: File): Promise<QrResult | null> {
  const buf = await file.arrayBuffer();
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  /** Primeiro: encontrar em resolução moderada (rápido e fiável). */
  const findScales = [2, 2.5, 3, 3.5, 4];

  let foundPage = 0;
  let foundScale = 2;
  let decoded: { payload: string; location: JsLocation } | null = null;

  outer: for (let pi = 1; pi <= Math.min(pdf.numPages, 3); pi++) {
    const page = await pdf.getPage(pi);
    for (const scale of findScales) {
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
          annotationMode: 1,
        })
        .promise;

      const hit = decodeQrFromCanvas(canvas);
      if (hit) {
        foundPage = pi;
        foundScale = scale;
        decoded = hit;
        break outer;
      }
    }
  }

  if (!decoded) return null;

  /** Segundo: mesma página com escala alta para recorte nítido. */
  const page = await pdf.getPage(foundPage);
  let exportScale = Math.min(6, Math.max(4.2, foundScale * 1.85));
  const vpTry = page.getViewport({ scale: exportScale });
  const maxSide = 4096;
  if (vpTry.width > maxSide || vpTry.height > maxSide) {
    exportScale *= maxSide / Math.max(vpTry.width, vpTry.height);
  }
  const viewport = page.getViewport({ scale: exportScale });
  const hi = document.createElement('canvas');
  const hctx = hi.getContext('2d');
  if (!hctx) return null;
  hi.width = Math.floor(viewport.width);
  hi.height = Math.floor(viewport.height);
  await page
    .render({
      canvas: hi,
      viewport,
      annotationMode: 1,
    })
    .promise;

  const ratio = exportScale / foundScale;
  const locHi: QrQuad = {
    topLeftCorner: {
      x: decoded.location.topLeftCorner.x * ratio,
      y: decoded.location.topLeftCorner.y * ratio,
    },
    topRightCorner: {
      x: decoded.location.topRightCorner.x * ratio,
      y: decoded.location.topRightCorner.y * ratio,
    },
    bottomLeftCorner: {
      x: decoded.location.bottomLeftCorner.x * ratio,
      y: decoded.location.bottomLeftCorner.y * ratio,
    },
    bottomRightCorner: {
      x: decoded.location.bottomRightCorner.x * ratio,
      y: decoded.location.bottomRightCorner.y * ratio,
    },
  };

  return {
    payload: decoded.payload,
    qrImageDataUrl: cropQrHighRes(hi, locHi),
  };
}

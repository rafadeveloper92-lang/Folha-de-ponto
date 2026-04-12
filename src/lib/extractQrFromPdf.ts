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

function shiftLocation(loc: JsLocation, ox: number, oy: number): JsLocation {
  return {
    ...loc,
    topLeftCorner: {x: loc.topLeftCorner.x + ox, y: loc.topLeftCorner.y + oy},
    topRightCorner: {x: loc.topRightCorner.x + ox, y: loc.topRightCorner.y + oy},
    bottomLeftCorner: {x: loc.bottomLeftCorner.x + ox, y: loc.bottomLeftCorner.y + oy},
    bottomRightCorner: {x: loc.bottomRightCorner.x + ox, y: loc.bottomRightCorner.y + oy},
  };
}

/** Binarização em tons de cinza (melhora QRs com fundo colorido ou baixo contraste). */
function binarizeRgba(
  src: Uint8ClampedArray,
  threshold: number,
  invert: boolean,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const g =
      0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
    const dark = g < threshold;
    const v = invert ? (dark ? 255 : 0) : dark ? 0 : 255;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

function tryJsQR(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): {payload: string; location: JsLocation} | null {
  const code = jsQR(data, w, h, {inversionAttempts: 'attemptBoth'});
  return code?.data ? {payload: code.data, location: code.location} : null;
}

/** Ampliação por vizinho mais próximo (QR pequeno no PDF). */
function upscaleCanvasNearest(
  source: HTMLCanvasElement,
  factor: number,
): HTMLCanvasElement {
  const w = Math.floor(source.width * factor);
  const h = Math.floor(source.height * factor);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  if (!octx) return source;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(source, 0, 0, w, h);
  return out;
}

function decodeQrFromImageData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ox: number,
  oy: number,
): {payload: string; location: JsLocation} | null {
  const hit = tryJsQR(data, w, h);
  if (!hit) return null;
  return {payload: hit.payload, location: shiftLocation(hit.location, ox, oy)};
}

function decodeQrFromCanvas(
  canvas: HTMLCanvasElement,
): { payload: string; location: JsLocation } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width: W, height: H } = canvas;

  const variants: {data: Uint8ClampedArray; w: number; h: number; ox: number; oy: number}[] =
    [];

  const pushFull = (c: HTMLCanvasElement, ox: number, oy: number) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    variants.push({data: d.data, w: c.width, h: c.height, ox, oy});
    for (const th of [100, 120, 140, 160, 180]) {
      variants.push({
        data: binarizeRgba(d.data, th, false),
        w: c.width,
        h: c.height,
        ox,
        oy,
      });
      variants.push({
        data: binarizeRgba(d.data, th, true),
        w: c.width,
        h: c.height,
        ox,
        oy,
      });
    }
  };

  pushFull(canvas, 0, 0);
  for (const f of [2, 3] as const) {
    const up = upscaleCanvasNearest(canvas, f);
    pushFull(up, 0, 0);
  }

  for (const v of variants) {
    const hit = decodeQrFromImageData(v.data, v.w, v.h, v.ox, v.oy);
    if (hit) return hit;
  }

  const grid = 3;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.floor((gx * W) / grid);
      const y = Math.floor((gy * H) / grid);
      const w = Math.min(W - x, Math.ceil(W / grid) + 4);
      const h = Math.min(H - y, Math.ceil(H / grid) + 4);
      const slice = ctx.getImageData(x, y, w, h);
      let code = tryJsQR(slice.data, w, h);
      if (!code) {
        for (const th of [120, 140, 160]) {
          code = tryJsQR(binarizeRgba(slice.data, th, false), w, h);
          if (code) break;
          code = tryJsQR(binarizeRgba(slice.data, th, true), w, h);
          if (code) break;
        }
      }
      if (code) {
        return {
          payload: code.payload,
          location: shiftLocation(code.location, x, y),
        };
      }
    }
  }

  const tryStrip = (rx: number, rw: number) => {
    const slice = ctx.getImageData(rx, 0, rw, H);
    let code = tryJsQR(slice.data, rw, H);
    if (!code) {
      for (const th of [120, 140, 160]) {
        code = tryJsQR(binarizeRgba(slice.data, th, false), rw, H);
        if (code) break;
        code = tryJsQR(binarizeRgba(slice.data, th, true), rw, H);
        if (code) break;
      }
    }
    if (code) {
      return {payload: code.payload, location: shiftLocation(code.location, rx, 0)};
    }
    return null;
  };

  const rw = Math.floor(W * 0.45);
  const right = tryStrip(W - rw, rw);
  if (right) return right;
  const left = tryStrip(0, rw);
  if (left) return left;

  const cx = Math.floor(W * 0.2);
  const cy = Math.floor(H * 0.2);
  const cw = Math.floor(W * 0.6);
  const ch = Math.floor(H * 0.6);
  const mid = ctx.getImageData(cx, cy, cw, ch);
  let code = tryJsQR(mid.data, cw, ch);
  if (!code) {
    for (const th of [120, 140]) {
      code = tryJsQR(binarizeRgba(mid.data, th, false), cw, ch);
      if (code) break;
    }
  }
  if (code) {
    return {payload: code.payload, location: shiftLocation(code.location, cx, cy)};
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
  /** Escalas crescentes — QRs pequenos ou PDFs com artefactos precisam de mais pixels. */
  const findScales = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  const maxPagesScan = Math.min(pdf.numPages, 8);

  let foundPage = 0;
  let foundScale = 2;
  let decoded: { payload: string; location: JsLocation } | null = null;

  outer: for (let pi = 1; pi <= maxPagesScan; pi++) {
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
          annotationMode: 0,
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
      annotationMode: 0,
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

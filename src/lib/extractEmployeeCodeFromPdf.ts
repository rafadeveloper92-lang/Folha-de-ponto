/** Extrai código tipo GF123456 (primeira linha típica das fichas GSI) do PDF. */
export async function extractEmployeeCodeFromPdf(
  file: File,
): Promise<string | null> {
  const buf = await file.arrayBuffer();
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let fullText = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText +=
      content.items
        .map((it) => ('str' in it && typeof it.str === 'string' ? it.str : ''))
        .join(' ') + '\n';
  }

  const trimmed = fullText.trim();
  const patterns = [
    /\b(GF\d{4,})\b/i,
    /\b([A-Z]{2}\d{6,})\b/,
    /^[\s\n]*([A-Z0-9]{6,})/m,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  const firstLine = trimmed.split(/\s+/)[0];
  if (firstLine && /^[A-Z0-9]{4,}$/i.test(firstLine)) {
    return firstLine.toUpperCase();
  }
  return null;
}

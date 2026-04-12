import {jsPDF} from 'jspdf';
import {format} from 'date-fns';
import {ptBR} from 'date-fns/locale';
import type {ClothingSelection, ConstructionLine} from './supplyRequestShare';

const MM_PER_PX = 25.4 / 96;

function imageFormat(dataUrl: string): 'JPEG' | 'PNG' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  return 'JPEG';
}

async function naturalSize(dataUrl: string): Promise<{w: number; h: number}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({w: img.naturalWidth || 1, h: img.naturalHeight || 1});
    img.onerror = () => reject(new Error('imagem'));
    img.src = dataUrl;
  });
}

/** Desenha imagem centrada numa caixa (mm). */
async function addImageInBox(
  doc: jsPDF,
  dataUrl: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): Promise<number> {
  const fmt = imageFormat(dataUrl);
  const {w: pxW, h: pxH} = await naturalSize(dataUrl);
  const mmW = pxW * MM_PER_PX;
  const mmH = pxH * MM_PER_PX;
  const scale = Math.min(boxW / mmW, boxH / mmH, 1);
  const drawW = mmW * scale;
  const drawH = mmH * scale;
  const x = boxX + (boxW - drawW) / 2;
  const y = boxY + (boxH - drawH) / 2;
  try {
    doc.addImage(dataUrl, fmt, x, y, drawW, drawH);
  } catch {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text('(imagem não incluída)', boxX + 2, boxY + boxH / 2);
  }
  return boxY + boxH;
}

function clothingRows(c: ClothingSelection): string[][] {
  const rows: string[][] = [];
  if (c.calca) rows.push(['Calça', `EU ${c.calca}`]);
  if (c.blusa) rows.push(['Blusa / camisola', `EU ${c.blusa}`]);
  if (c.colete) rows.push(['Colete', `EU ${c.colete}`]);
  if (c.sapato) rows.push(['Sapato', `EU ${c.sapato}`]);
  return rows;
}

/**
 * PDF A4 com cabeçalho GSI, dados do colaborador, roupa e fotos dos materiais.
 */
export async function buildSupplyRequestPdfBlob(params: {
  name: string;
  employeeCode?: string;
  obra: string;
  construction: ConstructionLine[];
  clothing: ClothingSelection;
  notes?: string;
}): Promise<Blob> {
  const doc = new jsPDF({unit: 'mm', format: 'a4', orientation: 'portrait'});
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 14;
  let y = 0;

  // —— Cabeçalho ——
  doc.setFillColor(22, 40, 74);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 28, pageW, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('GSI TRACKER', pageW / 2, 12, {align: 'center'});
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Pedido de materiais e roupa', pageW / 2, 20, {align: 'center'});
  doc.setFontSize(8);
  doc.text(
    format(new Date(), "d 'de' MMMM yyyy, HH:mm", {locale: ptBR}),
    pageW / 2,
    25,
    {align: 'center'},
  );

  doc.setTextColor(0, 0, 0);
  y = 36;

  // —— Dados ——
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(m, y, pageW - 2 * m, 28, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('DADOS DO COLABORADOR', m + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  let ty = y + 12;
  doc.text(`Nome: ${params.name || '—'}`, m + 4, ty);
  ty += 5;
  doc.text(`Código / ID: ${params.employeeCode || '—'}`, m + 4, ty);
  ty += 5;
  doc.text(`Obra / projeto: ${params.obra || '—'}`, m + 4, ty);
  y += 32;

  // —— Roupa ——
  const clothRows = clothingRows(params.clothing);
  if (clothRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 40, 74);
    doc.text('Roupa — tamanhos europeus (EU)', m, y);
    y += 6;

    const tableW = pageW - 2 * m;
    const col1w = tableW * 0.45;
    const rowH = 8;
    doc.setDrawColor(220, 225, 232);
    doc.setFillColor(255, 255, 255);
    doc.rect(m, y, tableW, rowH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text('Peça', m + 3, y + 5.5);
    doc.text('Tamanho', m + col1w + 3, y + 5.5);
    y += rowH;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    for (const [a, b] of clothRows) {
      if (y > pageH - 40) {
        doc.addPage();
        y = m;
      }
      doc.rect(m, y, tableW, rowH, 'S');
      doc.text(a, m + 3, y + 5.5);
      doc.text(b, m + col1w + 3, y + 5.5);
      y += rowH;
    }
    y += 6;
  }

  // —— Materiais com fotos (cartões em coluna única, largura total) ——
  if (params.construction.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 40, 74);
    doc.text('Materiais em falta (com fotografia)', m, y);
    y += 7;

    const cardW = pageW - 2 * m;
    const imgBoxH = 52;
    const cardPad = 4;

    for (let i = 0; i < params.construction.length; i++) {
      const item = params.construction[i];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const titleLines = doc.splitTextToSize(
        `${i + 1}. ${item.label}`,
        cardW - 2 * cardPad - 2,
      );
      const labelH = Math.max(10, 4 + titleLines.length * 4.5);
      const cardH = labelH + imgBoxH + cardPad * 2;

      if (y + cardH > pageH - m) {
        doc.addPage();
        y = m;
      }

      doc.setDrawColor(200, 206, 214);
      doc.setFillColor(252, 252, 253);
      doc.roundedRect(m, y, cardW, cardH, 2, 2, 'FD');

      doc.setTextColor(22, 40, 74);
      doc.text(titleLines, m + cardPad, y + 6);

      const imgTop = y + labelH;
      doc.setDrawColor(230, 233, 238);
      doc.rect(m + cardPad, imgTop, cardW - 2 * cardPad, imgBoxH, 'S');
      await addImageInBox(
        doc,
        item.photoDataUrl,
        m + cardPad,
        imgTop,
        cardW - 2 * cardPad,
        imgBoxH,
      );

      y += cardH + 4;
    }
    y += 2;
  }

  // —— Notas ——
  if (params.notes?.trim()) {
    if (y > pageH - 35) {
      doc.addPage();
      y = m;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(22, 40, 74);
    doc.text('Notas', m, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const noteLines = doc.splitTextToSize(params.notes.trim(), pageW - 2 * m);
    for (const line of noteLines) {
      if (y > pageH - m) {
        doc.addPage();
        y = m;
      }
      doc.text(line, m, y);
      y += 4.5;
    }
  }

  // —— Rodapé ——
  const foot = `Contacto materiais: +34 641 67 20 23 · Documento gerado pela app GSI Tracker`;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(foot, pageW / 2, pageH - 8, {align: 'center'});
    doc.text(`Página ${p} / ${pages}`, pageW - m, pageH - 8, {align: 'right'});
  }

  return doc.output('blob');
}

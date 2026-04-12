import { jsPDF } from 'jspdf';
import { getDaysInMonth } from 'date-fns';
import type { WorkMonth } from '../types';

/** PDF 100% local (jsPDF). Não usa API Gemini nem rede. */
export function buildGsiPdfBlob(data: WorkMonth): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PROYECTOS GSI, S.L', pageW / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${data.name || '—'}`, margin, y);
  y += 5;
  doc.text(`Cargo: ${data.role || '—'}`, margin, y);
  y += 5;
  doc.text(
    `Mês / Ano: ${String(data.month).padStart(2, '0')} / ${data.year}`,
    margin,
    y,
  );
  y += 8;

  const daysInMonth = getDaysInMonth(new Date(data.year, data.month - 1));
  const colDia = margin;
  const colHoras = margin + 16;
  const colObra = margin + 38;
  const obraMaxW = pageW - colObra - margin;

  doc.setFont('helvetica', 'bold');
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 4, pageW - 2 * margin, 6, 'F');
  doc.text('DIA', colDia, y);
  doc.text('HORAS', colHoras, y);
  doc.text('OBRA', colObra, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = data.days.find((x) => x.day === d);
    const isOff = entry?.isOffDay;
    if (y > 275) {
      doc.addPage();
      y = 14;
    }

    doc.setTextColor(isOff ? 130 : 0);
    doc.text(String(d).padStart(2, '0'), colDia, y);
    doc.text(entry?.hours || '—', colHoras, y);
    const obra = entry?.project || '';
    const lines = doc.splitTextToSize(obra, obraMaxW);
    doc.text(lines, colObra, y);
    doc.setTextColor(0);
    y += Math.max(5, lines.length * 4.2);
  }

  y += 4;
  if (y > 265) {
    doc.addPage();
    y = 14;
  }
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${data.totalHours} h`, margin, y);
  y += 6;
  doc.setTextColor(5, 120, 90);
  doc.text(`VALOR A RECEBER: €${data.totalEarnings.toFixed(2)}`, margin, y);
  doc.setTextColor(0);

  if (data.signature) {
    y += 12;
    if (y > 240) {
      doc.addPage();
      y = 14;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Assinatura do colaborador', margin, y);
    y += 3;
    try {
      doc.addImage(data.signature, 'PNG', margin, y, 55, 20);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.text('(assinatura)', margin, y + 10);
    }
  }

  return doc.output('blob');
}

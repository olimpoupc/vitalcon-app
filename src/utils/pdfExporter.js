import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCOP } from './pharmaCalculator';

/**
 * Generates and downloads a clean, highly organized PDF price sheet for Droguería Vitalcon
 */
export function exportToPDF(items, invoiceTitle = 'Factura Vitalcon', totals = {}, marginPercent = 25) {
  if (!items || items.length === 0) return;

  // Create PDF document in letter / A4 format (portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. TOP HEADER BANNER (Emerald Green)
  doc.setFillColor(6, 95, 70); // #065f46
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DROGUERÍA VITALCON', 14, 12);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(209, 250, 229); // #d1fae5
  doc.text('Control Oficial de Precios de Venta al Público y Menudeo', 14, 17);
  doc.text('Concordia, Magdalena', 14, 22);

  // Document Info (Right side)
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  doc.text(`Fecha: ${dateStr}`, pageWidth - 14, 12, { align: 'right' });
  doc.text(`Margen Aplicado: +${marginPercent}%`, pageWidth - 14, 17, { align: 'right' });
  doc.text(`Doc: ${invoiceTitle.substring(0, 32)}`, pageWidth - 14, 22, { align: 'right' });

  // 2. FINANCIAL SUMMARY BOX
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(14, 32, pageWidth - 28, 14, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  
  const colW = (pageWidth - 28) / 4;
  doc.text('TOTAL PRODUCTOS', 18, 37);
  doc.text('INVERSIÓN FACTURA', 18 + colW, 37);
  doc.text('VENTA PROYECTADA', 18 + colW * 2, 37);
  doc.text('GANANCIA ESTIMADA', 18 + colW * 3, 37);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${items.length} ítems`, 18, 43);
  doc.text(formatCOP(totals.totalCost || 0), 18 + colW, 43);
  doc.text(formatCOP(totals.totalProjectedSale || 0), 18 + colW * 2, 43);

  doc.setTextColor(4, 120, 87); // Green profit
  doc.text(`+${formatCOP(totals.totalProfit || 0)}`, 18 + colW * 3, 43);

  // 3. TABLE DATA PREPARATION
  const tableRows = items.map((item, index) => {
    const menudeoText = item.hasMenudeo
      ? `${formatCOP(item.pillSalePrice)} c/u\n(${item.unitCount} ${item.presentation.unitName}s)`
      : '-';

    const ivaBadge = item.hasIva ? ' [IVA 19%]' : '';

    return [
      (index + 1).toString(),
      item.code || '-',
      `${item.description}${ivaBadge}`,
      item.quantity.toString(),
      formatCOP(item.costWithIva),
      formatCOP(item.boxSalePrice),
      menudeoText
    ];
  });

  // 4. AUTO-TABLE GENERATION
  autoTable(doc, {
    startY: 50,
    margin: { left: 14, right: 14, bottom: 15 },
    head: [[
      '#',
      'Cód.',
      'Descripción del Producto / Medicamento',
      'Cant.',
      'Costo c/IVA',
      'PRECIO CAJA',
      'PRECIO MENUDEO'
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // Slate 50
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', textColor: [100, 116, 139] },
      1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 'auto', fontStyle: 'bold' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 22, halign: 'right', textColor: [71, 85, 105] },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }, // Emerald bold
      6: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] }  // Amber bold
    },
    didDrawPage: (data) => {
      // Footer page numbering on every page
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount} • Droguería Vitalcon - Concordia, Magdalena`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 7,
        { align: 'center' }
      );
    }
  });

  // 5. DOWNLOAD PDF
  const cleanTitle = invoiceTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const fileName = `Precios_Vitalcon_${cleanTitle || 'Listado'}.pdf`;
  doc.save(fileName);
}

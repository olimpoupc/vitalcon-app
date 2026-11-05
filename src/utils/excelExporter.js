import * as XLSX from 'xlsx';

/**
 * Exports processed pharmacy invoice to a professionally formatted Excel (.xlsx) file
 */
export function exportToExcel(items, invoiceTitle = 'Factura Vitalcon', totals = {}) {
  if (!items || items.length === 0) return;

  // Prepare formatted rows for Excel
  const rows = items.map((item, index) => ({
    'No.': index + 1,
    'Código': item.code || '',
    'Descripción del Producto': item.description,
    'Cant. Facturada': item.quantity,
    'Presentación': item.presentation.label,
    'Costo Lista': item.baseCost,
    'IVA': item.hasIva ? '19%' : 'Exento (0%)',
    'Costo Real c/ IVA': item.costWithIva,
    'Margen Utilidad': `${item.marginPercent || 25}%`,
    'PRECIO VENTA CAJA': item.boxSalePrice,
    'PRECIO MENUDEO (Pastilla/Sobre)': item.hasMenudeo ? item.pillSalePrice : item.boxSalePrice,
    'Tipo Menudeo': item.hasMenudeo ? item.presentation.unitName : 'Unidad',
    'Unidades x Caja': item.unitCount,
    'Ganancia x Caja': item.boxSalePrice - item.costWithIva,
    'Descto. Proveedor': item.supplierDiscount ? `${item.supplierDiscount}%` : '0%'
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for comfortable reading
  worksheet['!cols'] = [
    { wch: 5 },   // No.
    { wch: 10 },  // Código
    { wch: 45 },  // Descripción
    { wch: 12 },  // Cant. Facturada
    { wch: 20 },  // Presentación
    { wch: 14 },  // Costo Lista
    { wch: 12 },  // IVA
    { wch: 16 },  // Costo Real c/ IVA
    { wch: 14 },  // Margen Utilidad
    { wch: 18 },  // PRECIO VENTA CAJA
    { wch: 22 },  // PRECIO MENUDEO
    { wch: 14 },  // Tipo Menudeo
    { wch: 14 },  // Unidades x Caja
    { wch: 16 },  // Ganancia x Caja
    { wch: 16 }   // Descto. Proveedor
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Precios Vitalcon');

  // File naming
  const cleanTitle = invoiceTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const fileName = `Precios_Vitalcon_${cleanTitle || 'Factura'}.xlsx`;

  // Download file in browser
  XLSX.writeFile(workbook, fileName);
}

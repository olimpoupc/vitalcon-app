import * as XLSX from 'xlsx';
import { parseColombianNumber, parseDrogasSSText, parseMomCsv } from './invoiceParser.js';

function normalizeHeader(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Universal Excel Parser (.xlsx, .xls) for ANY Pharmaceutical Wholesaler
 */
export function parseExcelFile(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to 2D array of rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) return [];

  // 1. Locate the Header Row (usually in the first 15 rows)
  let headerRowIndex = -1;
  let colMap = {
    desc: -1,
    qty: -1,
    unitCost: -1,
    iva: -1,
    total: -1,
    code: -1,
    discount: -1
  };

  for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
    const row = rawRows[r].map(normalizeHeader);
    
    // Check if this row looks like a header
    const descIdx = row.findIndex(c => /descri|prod|nombr|articu|detall|item|medicamento/i.test(c));
    const qtyIdx = row.findIndex(c => /cant|unid|und|piezas|ctdad/i.test(c));
    const costIdx = row.findIndex(c => /unit|cost|prec|vlr.*u|val.*u/i.test(c));

    if (descIdx !== -1 && (qtyIdx !== -1 || costIdx !== -1)) {
      headerRowIndex = r;
      colMap.desc = descIdx;
      colMap.qty = qtyIdx;
      colMap.unitCost = costIdx;
      colMap.iva = row.findIndex(c => /iva|imp/i.test(c));
      colMap.total = row.findIndex(c => /tot|subtot|neto|importe/i.test(c));
      colMap.code = row.findIndex(c => /cod|ref|plu/i.test(c));
      colMap.discount = row.findIndex(c => /dscto|descto|descuent|dto/i.test(c));
      break;
    }
  }

  const items = [];

  // If header found, extract based on mapped columns
  if (headerRowIndex !== -1 && colMap.desc !== -1) {
    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rawDesc = row[colMap.desc];
      if (!rawDesc || typeof rawDesc !== 'string' || rawDesc.trim().length < 2) continue;
      
      // Skip summary / footer rows
      const normDesc = normalizeHeader(rawDesc);
      if (/^(total|subtotal|iva|exento|gravado|son:|observac|elaborad|autoriz)/i.test(normDesc)) {
        continue;
      }

      const description = rawDesc.toString().trim();
      
      // Parse quantity
      let quantity = 1;
      if (colMap.qty !== -1 && row[colMap.qty] !== undefined) {
        const qVal = row[colMap.qty].toString().trim();
        // Handle formats like "4 - 0" or simple number "4"
        const qMatch = qVal.match(/^(\d+)\s*-\s*(\d+)$/);
        if (qMatch) {
          quantity = parseInt(qMatch[1], 10) + (parseInt(qMatch[2], 10) > 0 ? parseInt(qMatch[2], 10) : 0);
        } else {
          quantity = parseColombianNumber(qVal) || 1;
        }
      }

      // Parse unit cost or calculate from total
      let unitCost = 0;
      if (colMap.unitCost !== -1 && row[colMap.unitCost] !== undefined) {
        unitCost = parseColombianNumber(row[colMap.unitCost]);
      }

      let totalLine = 0;
      if (colMap.total !== -1 && row[colMap.total] !== undefined) {
        totalLine = parseColombianNumber(row[colMap.total]);
      }

      // If unit cost wasn't explicitly given but total is, calculate unitCost
      if (unitCost === 0 && totalLine > 0 && quantity > 0) {
        unitCost = Math.round(totalLine / quantity);
      } else if (totalLine === 0 && unitCost > 0) {
        totalLine = Math.round(unitCost * quantity);
      }

      // Parse IVA
      let ivaPercent = 0;
      if (colMap.iva !== -1 && row[colMap.iva] !== undefined) {
        const rawIva = parseColombianNumber(row[colMap.iva]);
        if (rawIva === 19 || rawIva === 0.19) {
          ivaPercent = 19;
        } else if (rawIva > 0 && rawIva < 1) {
          ivaPercent = Math.round(rawIva * 100);
        } else if (rawIva > 0) {
          ivaPercent = rawIva;
        }
      }

      // Parse Discount
      let supplierDiscount = 0;
      if (colMap.discount !== -1 && row[colMap.discount] !== undefined) {
        supplierDiscount = parseColombianNumber(row[colMap.discount]);
      }

      // Code
      let code = '';
      if (colMap.code !== -1 && row[colMap.code] !== undefined) {
        code = row[colMap.code].toString().trim();
      }

      // Ignore rows with no financial value
      if (unitCost > 0 || totalLine > 0) {
        items.push({
          code,
          description,
          quantity: quantity || 1,
          unitCost: Math.round(unitCost),
          supplierDiscount,
          ivaPercent,
          totalLine
        });
      }
    }
  } else {
    // Fallback: If no standard header was detected, try CSV-like or table heuristics
    for (const row of rawRows) {
      if (!row || row.length < 2) continue;
      // Look for a cell that has text (product name) and at least one numeric cell
      let textCell = '';
      const numCells = [];

      for (const cell of row) {
        if (!cell) continue;
        const num = parseColombianNumber(cell);
        if (typeof cell === 'string' && cell.trim().length > 3 && isNaN(cell)) {
          if (!textCell) textCell = cell.trim();
        } else if (!isNaN(num) && num > 0) {
          numCells.push(num);
        }
      }

      if (textCell && numCells.length >= 2) {
        const qty = numCells[0] < 1000 ? numCells[0] : 1;
        const cost = numCells.length >= 2 ? numCells[1] : numCells[0];
        items.push({
          code: '',
          description: textCell,
          quantity: qty,
          unitCost: Math.round(cost),
          supplierDiscount: 0,
          ivaPercent: 0,
          totalLine: Math.round(cost * qty)
        });
      }
    }
  }

  return items;
}

/**
 * Parser for Drogas S&S invoices, CSVs, and general supplier text
 */

// Clean Colombian number formats: "18,413" or "18.413" or "18413" -> 18413
export function parseColombianNumber(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  // Remove currency symbols and spaces
  let cleaned = str.toString().replace(/[\$\s]/g, '').trim();
  // In Colombian Drogas S&S invoices, comma is used as thousands separator: 15,496 or decimal in some exports
  // If it matches 12,345 or 123,456 (3 digits after comma/dot)
  if (/^\d{1,3}([,.]\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/[,.]/g, '');
    return parseFloat(cleaned);
  }
  // If comma is decimal (e.g. 19506.25 or 19506,25)
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses Drogas S&S text line
 * Format: CODIGO DESCRIPCION CANTIDAD VLR.UNITARIO [Dscto.] [%IVA] VALOR TOTAL
 * Example: 49074 ACOND.ALMA DE ROMERO ARGAN FCO X 500 ML 1 - 0 18,413 19 18,413
 * Example 2: 49363 CHAMPU MUSS ALTA NUTRICION X 220 ML + ACOND X 220ML 1 - 0 16,868 42 19 16,868
 * Example 3: 41457 ACETAMINOFEN 500 MG COASP CAJA X 300 TABS 4 - 0 15,496 61,984
 */
export function parseDrogasSSLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Skip header and footer lines
  if (/^(CODIGO|DESCRIPCION|VENDIDO|DOCUMENTO|Barranquilla|FECHA|TOTAL|SUBTOTAL|EXENTO|GRAVADO|IVA|Página|Obs:|Favor pagar)/i.test(trimmed)) {
    return null;
  }

  // Regex to match:
  // 1: Code (3 to 6 digits)
  // 2: Description (up to the quantity pattern \d+ - \d+)
  // 3: Quantity (e.g. "4 - 0" or "4-0" or "10 - 0")
  // 4: The rest of numbers (Unitario, Dscto, Iva, Total)
  const mainRegex = /^(\d{4,6})\s+(.+?)\s+(\d+)\s*-\s*(\d+)\s+([0-9.,\s]+)$/;
  const match = trimmed.match(mainRegex);

  if (!match) return null;

  const code = match[1];
  const description = match[2].trim();
  const qtyEnteros = parseInt(match[3], 10);
  const qtyFrac = parseInt(match[4], 10);
  const quantity = qtyEnteros + (qtyFrac > 0 ? qtyFrac : 0);
  const numTokens = match[5].trim().split(/\s+/).filter(Boolean);

  if (numTokens.length === 0) return null;

  // Let's decode the numeric tokens:
  // Could be:
  // [Unitario, Total] -> 2 tokens (No discount, No IVA)
  // [Unitario, 19, Total] -> 3 tokens (IVA 19%, No discount)
  // [Unitario, Dscto, Total] -> 3 tokens (Discount, No IVA)
  // [Unitario, Dscto, 19, Total] -> 4 tokens (Discount, IVA 19%)
  const unitCost = parseColombianNumber(numTokens[0]);
  let supplierDiscount = 0;
  let ivaPercent = 0;
  let totalLine = parseColombianNumber(numTokens[numTokens.length - 1]);

  if (numTokens.length === 3) {
    const midVal = parseColombianNumber(numTokens[1]);
    if (midVal === 19) {
      ivaPercent = 19;
    } else {
      supplierDiscount = midVal;
    }
  } else if (numTokens.length >= 4) {
    const mid1 = parseColombianNumber(numTokens[1]);
    const mid2 = parseColombianNumber(numTokens[2]);
    if (mid2 === 19) {
      supplierDiscount = mid1;
      ivaPercent = 19;
    } else if (mid1 === 19) {
      ivaPercent = 19;
      supplierDiscount = mid2;
    } else {
      supplierDiscount = mid1;
    }
  }

  return {
    code,
    description,
    quantity: quantity || 1,
    unitCost,
    supplierDiscount,
    ivaPercent,
    totalLine
  };
}

/**
 * Parses CSV format like the one provided by the mom
 * Header: Unidades,Nombre,Total Factura,0.25,Total Producto,Total Producto
 */
export function parseMomCsv(csvText) {
  const lines = csvText.split(/\r?\n/);
  const items = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Skip preamble or metadata
    if (line.includes('AUTORIZA') || line.includes('CASTRO TORNE') || line.includes('VITALCON') || line.includes('CR 32239')) {
      continue;
    }

    // Split by comma (ignoring commas inside quotes if any)
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;

    const units = parseFloat(cols[0]);
    const name = cols[1];

    if (isNaN(units) || !name || name.toUpperCase() === 'NOMBRE') continue;

    // cols[2] is Total Factura, cols[5] (if exists) is unit cost with profit, or compute unitCost
    const totalFactura = parseColombianNumber(cols[2]);
    const unitCost = units > 0 ? (totalFactura / units) : totalFactura;

    items.push({
      code: '',
      description: name,
      quantity: units || 1,
      unitCost: Math.round(unitCost),
      supplierDiscount: 0,
      ivaPercent: 0, // already included in Total Factura in this format
      totalLine: totalFactura
    });
  }

  return items;
}

/**
 * Parses full Drogas S&S raw text (from PDF or OCR)
 */
export function parseDrogasSSText(fullText) {
  const lines = fullText.split(/\r?\n/);
  const items = [];

  for (let line of lines) {
    const item = parseDrogasSSLine(line);
    if (item) {
      items.push(item);
    }
  }

  return items;
}

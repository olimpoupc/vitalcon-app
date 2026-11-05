/**
 * Pharma Price & Menudeo Calculator for Droguería Vitalcon
 */

// Rounding helper for Colombian Cash / Counter
export function roundToNearest(value, step = 100) {
  if (!value || isNaN(value)) return 0;
  if (step === 1) return Math.round(value);
  return Math.ceil(value / step) * step; // Pharmacies usually round UP to nearest $50 or $100
}

/**
 * Extracts packaging information for Menudeo (single pill/sachet pricing)
 * e.g. "ACETAMINOFEN 500 MG CAJA X 300 TABS" -> { count: 300, unitName: 'tableta', label: 'Caja x 300' }
 */
export function extractPresentation(description) {
  if (!description) return { count: 1, unitName: 'unidad', label: 'Unidad' };
  
  const desc = description.toUpperCase();

  // Pattern 1: CAJA X 300 TABS / CAJA X 20 CAPS / CAJA X 12 S/S / X 100 UNDS
  const matchX = desc.match(/(?:CAJA|DISPENSADOR|BOLSA|PQTE|PAQUETE)?\s*X\s*(\d+)\s*(TABS?|TABLETAS?|COMPRIMIDOS?|COMP|CAPS?|C[AÁ]PSULAS?|SOBRES?|S\/S|UNDS?|UNIDADES?|AMPS?|AMPOLLAS?|GRAG?|GRAGEAS?|VIAL|LATAS?|TUBOS?)/i);
  if (matchX) {
    const count = parseInt(matchX[1], 10);
    const rawType = matchX[2].toUpperCase();
    let unitName = 'unidad';
    if (rawType.startsWith('TAB') || rawType.startsWith('TABLE')) unitName = 'pastilla';
    else if (rawType.startsWith('CAP')) unitName = 'cápsula';
    else if (rawType.startsWith('COMP')) unitName = 'comprimido';
    else if (rawType.startsWith('AMP')) unitName = 'ampolla';
    else if (rawType.startsWith('S/') || rawType.startsWith('SOB')) unitName = 'sobre';
    else if (rawType.startsWith('LAT')) unitName = 'lata';
    else if (rawType.startsWith('GRAG')) unitName = 'gragea';

    if (count > 1) {
      return {
        count,
        unitName,
        label: `Caja x ${count} ${unitName}s`
      };
    }
  }

  // Pattern 2: OFERTA 2X1
  if (desc.includes('OFERTA 2X1') || desc.includes('OFERTA 2 X 1')) {
    return { count: 2, unitName: 'unidad', label: 'Pack x 2' };
  }

  // Pattern 3: Liquids / syrups
  const matchMl = desc.match(/(?:FCO|JARABE|JBE|SUSP|SOLUCION)\s*X\s*(\d+)\s*ML/i);
  if (matchMl) {
    return { count: 1, unitName: 'frasco', label: `Frasco ${matchMl[1]} ml` };
  }

  // Pattern 4: Creams / Ointments
  const matchGr = desc.match(/(?:TUBO|TARRO|CREMA)\s*X\s*(\d+)\s*GR/i);
  if (matchGr) {
    return { count: 1, unitName: 'tubo', label: `Tubo ${matchGr[1]} g` };
  }

  return { count: 1, unitName: 'unidad', label: 'Unidad' };
}

/**
 * Calculates complete price structure for a single line item
 */
export function calculateItemPricing(item, options = {}) {
  const marginPercent = options.marginPercent ?? 25; // default 25%
  const roundStep = options.roundStep ?? 100; // default round to $100 COP

  const baseCost = Number(item.unitCost || 0);
  const ivaRate = (item.ivaPercent === 19 || item.ivaPercent === 0.19) ? 0.19 : 0;
  const supplierDiscount = Number(item.supplierDiscount || 0);
  const quantity = Number(item.quantity || 1);

  // 1. Cost with IVA (The Mom's base calculation)
  // We use VLR.UNITARIO as list price (ignoring supplier discount for customer price)
  const costWithIva = baseCost * (1 + ivaRate);

  // 2. Total Sale Price for the Package / Box
  const marginMultiplier = 1 + (marginPercent / 100);
  const boxSalePriceRaw = costWithIva * marginMultiplier;
  const boxSalePrice = roundToNearest(boxSalePriceRaw, roundStep);

  // 3. Menudeo (Single Pill / Single Unit Price)
  const presentation = extractPresentation(item.description);
  const unitCount = presentation.count;
  
  let pillSalePriceRaw = boxSalePriceRaw;
  let pillSalePrice = boxSalePrice;

  if (unitCount > 1) {
    pillSalePriceRaw = boxSalePriceRaw / unitCount;
    // For cheap pills (e.g. $66 COP), rounding to $100 or $50
    // If pill price is under $500, round to nearest $50 or $100
    const pillRoundStep = pillSalePriceRaw < 200 ? 50 : roundStep;
    pillSalePrice = roundToNearest(pillSalePriceRaw, pillRoundStep);
  }

  // 4. Real profit if supplier gave discount
  const actualPaidCostWithIva = (baseCost * (1 - supplierDiscount / 100)) * (1 + ivaRate);
  const realProfitBox = boxSalePrice - actualPaidCostWithIva;
  const realMarginPercent = actualPaidCostWithIva > 0 
    ? Math.round(((boxSalePrice - actualPaidCostWithIva) / actualPaidCostWithIva) * 100) 
    : marginPercent;

  return {
    ...item,
    quantity,
    baseCost,
    ivaRate,
    hasIva: ivaRate > 0,
    costWithIva: Math.round(costWithIva),
    presentation,
    unitCount,
    // Package / Box Prices
    boxSalePriceRaw,
    boxSalePrice,
    // Menudeo Prices
    hasMenudeo: unitCount > 1,
    pillSalePriceRaw,
    pillSalePrice,
    // Supplier benefit
    supplierDiscount,
    hasExtraProfit: supplierDiscount > 0,
    actualPaidCostWithIva: Math.round(actualPaidCostWithIva),
    realProfitBox: Math.round(realProfitBox),
    realMarginPercent
  };
}

// Format COP currency with dots: $ 25.000
export function formatCOP(value) {
  if (value === undefined || value === null || isNaN(value)) return '$ 0';
  return '$ ' + Math.round(value).toLocaleString('es-CO');
}

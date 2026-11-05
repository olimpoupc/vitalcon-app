import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Upload, 
  FileSpreadsheet, 
  Printer, 
  Pill, 
  Package, 
  CheckCircle2, 
  Percent, 
  Sparkles, 
  X, 
  RotateCcw, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle, 
  FileText, 
  Tag, 
  ArrowRight, 
  TrendingUp, 
  Download, 
  Copy, 
  Check, 
  Coins, 
  Layers, 
  FileCheck2,
  DollarSign,
  Smartphone
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateItemPricing, formatCOP } from './utils/pharmaCalculator';
import { parseDrogasSSText, parseMomCsv } from './utils/invoiceParser';
import { parseExcelFile } from './utils/universalExcelParser';
import { exportToExcel } from './utils/excelExporter';
import { exportToPDF } from './utils/pdfExporter';
import { DROGAS_SS_RAW_TEXT, MOM_CSV_RAW } from './data/sampleInvoices';

export default function App() {
  // App state - Starts BLANK by default
  const [rawItems, setRawItems] = useState([]);
  const [invoiceTitle, setInvoiceTitle] = useState('');
  
  // Settings
  const [marginPercent, setMarginPercent] = useState(25);
  const [roundPrices, setRoundPrices] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  
  // Tagged items tracking (checklist for shelving / tagging prices)
  const [taggedCodes, setTaggedCodes] = useState({});
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  
  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already running as standalone installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsStandalone(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallGuide(true);
    }
  };
  
  const fileInputRef = useRef(null);

  // Calculate pricing for all items
  const processedItems = useMemo(() => {
    return rawItems.map(item => calculateItemPricing(item, {
      marginPercent,
      roundStep: roundPrices ? 100 : 1
    }));
  }, [rawItems, marginPercent, roundPrices]);

  // Totals
  const totals = useMemo(() => {
    let totalCost = 0;
    let totalProjectedSale = 0;
    let totalItemsCount = processedItems.length;

    processedItems.forEach(item => {
      const lineCost = (item.totalLine || (item.baseCost * item.quantity)) * (1 + item.ivaRate);
      const lineSale = item.boxSalePrice * item.quantity;
      totalCost += lineCost;
      totalProjectedSale += lineSale;
    });

    const totalProfit = totalProjectedSale - totalCost;
    return {
      totalCost,
      totalProjectedSale,
      totalProfit,
      totalItemsCount
    };
  }, [processedItems]);

  // Filtered items based on search and active tab
  const filteredItems = useMemo(() => {
    return processedItems.filter(item => {
      const matchesSearch = 
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === 'menudeo') return item.hasMenudeo;
      if (activeTab === 'conIva') return item.hasIva;
      if (activeTab === 'exentos') return !item.hasIva;
      if (activeTab === 'superProfit') return item.hasExtraProfit;
      if (activeTab === 'pending') return !taggedCodes[item.code || item.description];
      if (activeTab === 'done') return !!taggedCodes[item.code || item.description];

      return true;
    });
  }, [processedItems, searchTerm, activeTab, taggedCodes]);

  // Toggle item check
  const toggleTag = (id) => {
    setTaggedCodes(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (!prev[id] && navigator.vibrate) navigator.vibrate(40);
      return next;
    });
  };

  // Copy price to clipboard
  const handleCopyPrice = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    exportToExcel(processedItems, invoiceTitle || 'Vitalcon_Precios', totals);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.85 } });
  };

  // Export to PDF (.pdf)
  const handleExportPDF = () => {
    exportToPDF(processedItems, invoiceTitle || 'Vitalcon_Precios', totals, marginPercent);
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.85 } });
  };

  // Print or Save as PDF
  const handlePrint = () => {
    window.print();
  };

  // Reset back to blank
  const handleReset = () => {
    if (confirm('¿Deseas limpiar la pantalla para cargar una nueva factura?')) {
      setRawItems([]);
      setInvoiceTitle('');
      setTaggedCodes({});
      setSearchTerm('');
      setUploadError('');
    }
  };

  // Load sample invoices
  const loadDrogasSS = () => {
    const items = parseDrogasSSText(DROGAS_SS_RAW_TEXT);
    setRawItems(items);
    setInvoiceTitle('Pedido Drogas S&S S.A.S. (167 productos)');
    setTaggedCodes({});
    setUploadError('');
    confetti({ particleCount: 45, spread: 70, origin: { y: 0.8 } });
  };

  const loadMomCsv = () => {
    const items = parseMomCsv(MOM_CSV_RAW);
    setRawItems(items);
    setInvoiceTitle('Pedido Medicamentos Genéricos y de Marca (114 productos)');
    setTaggedCodes({});
    setUploadError('');
    confetti({ particleCount: 45, spread: 70, origin: { y: 0.8 } });
  };

  // File Processor
  const processSelectedFile = async (file) => {
    if (!file) return;

    setUploadError('');
    setIsProcessingFile(true);

    try {
      const fileNameLower = file.name.toLowerCase();

      // 1. EXCEL FILES (.xlsx, .xls)
      if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const parsed = parseExcelFile(arrayBuffer);

        if (parsed.length > 0) {
          setRawItems(parsed);
          setInvoiceTitle(file.name.replace(/\.[^/.]+$/, ''));
          setTaggedCodes({});
          confetti({ particleCount: 60, spread: 80, origin: { y: 0.7 } });
        } else {
          setUploadError('No se encontraron columnas de productos en la hoja de Excel. Asegúrate de que contenga nombres y precios.');
        }
        return;
      }

      // 2. CSV / TXT FILES
      if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          let parsed = parseMomCsv(text);
          if (parsed.length === 0) {
            parsed = parseDrogasSSText(text);
          }
          if (parsed.length > 0) {
            setRawItems(parsed);
            setInvoiceTitle(file.name.replace(/\.[^/.]+$/, ''));
            setTaggedCodes({});
            confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
          } else {
            setUploadError('No se reconocieron productos en el archivo CSV. Verifica el formato.');
          }
        };
        reader.readAsText(file);
        return;
      }

      // 3. PDF FILES
      if (file.type === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
        if (!window.pdfjsLib) {
          setUploadError('El motor lector de PDF está cargando. Intenta de nuevo en unos segundos.');
          return;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          const items = textContent.items;
          items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) > 5) return yDiff;
            return a.transform[4] - b.transform[4];
          });

          let lastY = null;
          let pageText = '';
          for (const item of items) {
            const currentY = item.transform[5];
            if (lastY !== null && Math.abs(currentY - lastY) > 5) {
              pageText += '\n';
            } else if (lastY !== null) {
              pageText += ' ';
            }
            pageText += item.str;
            lastY = currentY;
          }

          fullText += '\n' + pageText;
        }

        let parsed = parseDrogasSSText(fullText);
        if (parsed.length === 0) {
          parsed = parseMomCsv(fullText);
        }

        if (parsed.length > 0) {
          setRawItems(parsed);
          setInvoiceTitle(file.name.replace(/\.[^/.]+$/, ''));
          setTaggedCodes({});
          confetti({ particleCount: 60, spread: 80, origin: { y: 0.7 } });
        } else {
          setUploadError('No pudimos extraer los productos de este PDF. Asegúrate de que el PDF tenga texto seleccionable o súbelo en Excel.');
        }
        return;
      }

      setUploadError('Formato no soportado. Por favor sube un archivo Excel (.xlsx, .xls), PDF o CSV.');
    } catch (err) {
      console.error('Error al procesar archivo:', err);
      setUploadError('Error al leer el archivo: ' + err.message);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle shared files from WhatsApp / Android Share Target or File Handling API
  useEffect(() => {
    // 1. Check if app was opened via Android Share Sheet
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === 'true') {
      if ('caches' in window) {
        caches.open('vitalcon-shared-file').then(async (cache) => {
          const res = await cache.match('/shared-invoice');
          if (res) {
            const blob = await res.blob();
            const file = new File([blob], 'Factura_Recibida', { type: blob.type });
            processSelectedFile(file);
            await cache.delete('/shared-invoice');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        });
      }
    }

    // 2. LaunchQueue for File Handling API (Chrome on Android / Windows)
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files && launchParams.files.length > 0) {
          const fileHandle = launchParams.files[0];
          const file = await fileHandle.getFile();
          processSelectedFile(file);
        }
      });
    }
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
    if (e.target) e.target.value = '';
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file);
  };

  const markedCount = Object.values(taggedCodes).filter(Boolean).length;
  const progressPercent = processedItems.length > 0 
    ? Math.round((markedCount / processedItems.length) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 text-slate-800 antialiased font-sans">
      
      {/* Printable Report Header */}
      <div className="print-only p-8 border-b-2 border-black mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">DROGUERÍA VITALCON</h1>
            <p className="text-sm font-semibold text-slate-600">Listado General de Precios de Venta al Público y Menudeo</p>
            <p className="text-xs text-slate-500">Documento: {invoiceTitle || 'Factura de Pedido'} • Concordia, Magdalena</p>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <p className="font-semibold">Margen Aplicado: <b className="text-emerald-700">+{marginPercent}%</b></p>
            <p className="text-slate-500">Total Ítems: <b>{processedItems.length}</b></p>
          </div>
        </div>
      </div>

      {/* Main Top Navigation Bar (Sleek Apple Health / Medical Style) */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white shadow-lg no-print">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-950/30 text-white font-black text-lg">
              ✚
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black tracking-tight leading-none text-white">
                  Vitalcon
                </h1>
                <span className="text-[10px] bg-emerald-700/80 text-emerald-200 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Precios & Menudeo
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 font-medium">
                Droguería • Concordia, Magdalena
              </p>
            </div>
          </div>

          {/* Action buttons if invoice is loaded */}
          {rawItems.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md shadow-rose-950/20 active:scale-95 transition-all"
                title="Descargar listado en PDF listo para imprimir o enviar"
              >
                <Download size={14} className="stroke-[2.4]" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md shadow-emerald-950/20 active:scale-95 transition-all"
                title="Descargar archivo en Excel"
              >
                <FileSpreadsheet size={15} className="stroke-[2.2]" />
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-2.5 py-1.5 rounded-xl border border-white/10 active:scale-95 transition-all"
                title="Imprimir"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">Imprimir</span>
              </button>

              <button
                onClick={handleReset}
                className="flex items-center gap-1 bg-white/10 hover:bg-rose-500/80 text-emerald-200 hover:text-white text-xs font-medium p-1.5 sm:px-2.5 rounded-xl border border-white/10 active:scale-95 transition-all"
                title="Cargar otra factura"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Nueva</span>
              </button>
            </div>
          ) : (
            !isStandalone && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 bg-emerald-700/90 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-500/40 shadow-xs active:scale-95 transition-all"
                title="Instalar aplicación en tu celular"
              >
                <Smartphone size={14} className="stroke-[2.2]" />
                <span>Instalar App</span>
              </button>
            )
          )}
        </div>

        {/* Invoice Title & Progress (if active) */}
        {rawItems.length > 0 && (
          <>
            <div className="bg-emerald-950/70 backdrop-blur-md px-4 py-2 border-t border-emerald-700/40 flex items-center justify-between text-xs max-w-3xl mx-auto">
              <div className="flex items-center gap-2 truncate max-w-[70%]">
                <FileCheck2 size={14} className="text-emerald-400 shrink-0" />
                <span className="font-bold text-white truncate text-xs">
                  {invoiceTitle}
                </span>
                <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded-full font-mono-num font-semibold shrink-0">
                  {rawItems.length} productos
                </span>
              </div>

              <div className="text-right text-[11px] text-emerald-200/90 shrink-0 font-medium">
                Etiquetados: <b className="text-white font-mono-num">{markedCount}/{rawItems.length}</b> ({progressPercent}%)
              </div>
            </div>

            {/* Glowing progress line */}
            <div className="w-full bg-emerald-950 h-1">
              <div 
                className="bg-gradient-to-r from-emerald-400 to-teal-300 h-1 transition-all duration-300 ease-out shadow-sm shadow-emerald-400/50"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-3xl mx-auto p-4 sm:p-5 pb-32">

        {/* 1. BLANK STATE SCREEN: When no file is loaded */}
        {rawItems.length === 0 ? (
          <div className="py-4 sm:py-8 space-y-4 animate-in fade-in zoom-in-98 duration-300">
            
            {/* Install App Banner for Mobile */}
            {!isStandalone && (
              <div 
                onClick={handleInstallClick}
                className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-950 text-white rounded-3xl p-4 sm:p-5 flex items-center justify-between cursor-pointer shadow-lg shadow-emerald-950/20 hover:shadow-xl transition-all border border-emerald-600/30 group active:scale-98"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-2xl shadow-md shrink-0">
                    📲
                  </div>
                  <div className="text-left space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-black text-white group-hover:text-emerald-200 transition-colors">
                        ¿Instalar Vitalcon como App en tu celular?
                      </p>
                      <span className="text-[10px] bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded-md font-bold uppercase">
                        Gratis
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-200/90 leading-tight">
                      Funciona a pantalla completa igual que una app descargada de la tienda.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-black bg-white text-emerald-950 px-3.5 py-2 rounded-xl shrink-0 group-hover:bg-emerald-100 shadow-sm transition-colors"
                >
                  Instalar
                </button>
              </div>
            )}

            {/* Hero Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xl shadow-slate-200/50 text-center space-y-6 relative overflow-hidden">
              
              {/* Background ambient gradient */}
              <div className="absolute -top-24 -right-24 w-52 h-52 bg-emerald-100 rounded-full blur-3xl opacity-60 pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-teal-100 rounded-full blur-3xl opacity-60 pointer-events-none" />

              {/* Glowing icon */}
              <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 text-3xl">
                💊
              </div>

              <div className="space-y-2 max-w-md mx-auto relative z-10">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  Calculadora de Precios y Menudeo
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Sube el pedido de <b>cualquier distribuidor</b> (medicamentos genéricos, de marca, aseo o cosméticos). El sistema calcula el precio de venta por caja y por pastilla.
                </p>
              </div>

              {/* Error Banner */}
              {uploadError && (
                <div className="p-4 bg-red-50 text-red-700 text-xs rounded-2xl border border-red-200 flex items-start gap-3 max-w-md mx-auto text-left shadow-sm animate-in shake duration-200">
                  <AlertCircle size={20} className="shrink-0 text-red-500 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Error al procesar</p>
                    <p className="text-red-600">{uploadError}</p>
                  </div>
                </div>
              )}

              {/* Interactive Drag & Drop Upload Zone */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 cursor-pointer transition-all space-y-4 group max-w-md mx-auto relative ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-50 scale-102 shadow-lg shadow-emerald-500/20' 
                    : 'border-slate-300 hover:border-emerald-500 bg-gradient-to-b from-slate-50/50 to-emerald-50/20 hover:bg-emerald-50/40 shadow-inner'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-100 to-teal-100 group-hover:from-emerald-200 group-hover:to-teal-200 text-emerald-800 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 shadow-sm">
                  {isProcessingFile ? (
                    <RefreshCw size={28} className="animate-spin text-emerald-700" />
                  ) : (
                    <Upload size={28} className="stroke-[2.2] text-emerald-800" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-base font-extrabold text-slate-900 group-hover:text-emerald-900">
                    {isProcessingFile ? 'Leyendo factura...' : 'Arrastra o toca para subir tu archivo'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    Acepta archivos de cualquier droguería o distribuidor
                  </p>
                </div>

                {/* File format badges */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] font-bold bg-emerald-100/80 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                    📊 Excel (.xlsx, .xls)
                  </span>
                  <span className="text-[11px] font-bold bg-red-100/80 text-red-800 px-2.5 py-1 rounded-lg border border-red-200">
                    📄 PDF
                  </span>
                  <span className="text-[11px] font-bold bg-blue-100/80 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200">
                    📋 CSV / Texto
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.pdf,.csv,.txt"
                  onChange={handleFileUpload}
                  disabled={isProcessingFile}
                  className="hidden"
                />
              </div>

              {/* Feature Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left max-w-lg mx-auto">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    ✓
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">IVA Automático</p>
                    <p className="text-[11px] text-slate-500 leading-snug">Calcula el 19% o 0% exento para genéricos.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                    💊
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Menudeo</p>
                    <p className="text-[11px] text-slate-500 leading-snug">Precio exacto por pastilla, cápsula o sobre.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    📥
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Exportar Excel</p>
                    <p className="text-[11px] text-slate-500 leading-snug">Descarga tu pedido formateado en 1 clic.</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Demo Invoices */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-200/80 max-w-md mx-auto space-y-3.5 shadow-sm">
              <div className="text-center space-y-0.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  ¿Quieres ver cómo funciona de inmediato?
                </span>
                <p className="text-xs text-slate-600 font-medium">
                  Carga una de las facturas reales de prueba:
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={loadDrogasSS}
                  className="w-full p-3.5 bg-gradient-to-r from-slate-50 to-emerald-50/40 text-left rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all flex items-center justify-between group active:scale-98"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-900">
                        Factura Drogas S&S S.A.S.
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono-num">
                        167 ítems
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Con Acetaminofén, Acondicionador, Champú Muss, Winny
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-white group-hover:bg-emerald-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors shadow-xs">
                    <ArrowRight size={16} />
                  </div>
                </button>

                <button
                  onClick={loadMomCsv}
                  className="w-full p-3.5 bg-gradient-to-r from-slate-50 to-emerald-50/40 text-left rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all flex items-center justify-between group active:scale-98"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-900">
                        Factura Medicamentos Genéricos
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono-num">
                        114 ítems
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Con Dolex, Albendazol MK, Acetaminofén Laproff
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-white group-hover:bg-emerald-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors shadow-xs">
                    <ArrowRight size={16} />
                  </div>
                </button>
              </div>
            </div>

          </div>
        ) : (
          
          /* 2. LOADED INVOICE VIEW: Dashboard and Product List */
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* KPI Cards (Inversión, Venta, Utilidad, Marcados) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 no-print">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Inversión Factura
                </span>
                <span className="text-base sm:text-lg font-black text-slate-800 font-mono-num block leading-tight">
                  {formatCOP(totals.totalCost)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  {rawItems.length} productos
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Ganancia Estimada
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-700 font-mono-num block leading-tight">
                  +{formatCOP(totals.totalProfit)}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold block">
                  +{marginPercent}% utilidad
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Venta Total Proyectada
                </span>
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono-num block leading-tight">
                  {formatCOP(totals.totalProjectedSale)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Precio vitrina
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Progreso Mostrador
                </span>
                <span className="text-base sm:text-lg font-black text-teal-700 font-mono-num block leading-tight">
                  {progressPercent}%
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {markedCount} de {rawItems.length} listos
                </span>
              </div>
            </div>

            {/* Sticky Search & Settings Box */}
            <div className="no-print space-y-2.5">
              
              {/* Big Search Input */}
              <div className="relative shadow-xs rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar medicamento o producto (ej: Dolex, Winny, Acetaminofen, 41457)..."
                  className="w-full pl-10 pr-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Profit Margin & Rounding Controls */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs">
                      %
                    </div>
                    <span>Margen de Utilidad sobre Costo:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-emerald-800 font-mono-num bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                      +{marginPercent}%
                    </span>
                  </div>
                </div>

                {/* Segmented Button Control */}
                <div className="grid grid-cols-4 gap-2">
                  {[20, 25, 30, 35].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setMarginPercent(rate)}
                      className={`py-2 text-xs font-extrabold rounded-xl transition-all ${
                        marginPercent === rate
                          ? 'bg-gradient-to-r from-emerald-700 to-teal-800 text-white shadow-md shadow-emerald-900/20 scale-102'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {rate}% {rate === 25 ? '⭐' : ''}
                    </button>
                  ))}
                </div>

                {/* Rounding Checkbox */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={roundPrices}
                      onChange={(e) => setRoundPrices(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 accent-emerald-600"
                    />
                    <span className="text-slate-700 font-medium">
                      Redondear precios a los <span className="font-extrabold text-slate-900">$100 COP</span> (para evitar cambio en monedas)
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons Bar: Direct PDF + Excel Downloads */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-700 via-rose-800 to-red-800 hover:from-rose-600 hover:to-red-700 text-white text-xs font-extrabold py-3 px-3.5 rounded-2xl shadow-md shadow-rose-950/20 transition-all active:scale-98"
                >
                  <Download size={16} className="text-rose-200 stroke-[2.4]" />
                  <span>Descargar PDF (.pdf)</span>
                </button>

                <button
                  onClick={handleExportExcel}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-800 to-teal-900 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-extrabold py-3 px-3.5 rounded-2xl shadow-md shadow-emerald-950/20 transition-all active:scale-98"
                >
                  <FileSpreadsheet size={16} className="text-emerald-300 stroke-[2.2]" />
                  <span>Descargar Excel (.xlsx)</span>
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs">
                {[
                  { id: 'all', label: `Todos (${processedItems.length})`, icon: Package },
                  { id: 'menudeo', label: `Menudeo (${processedItems.filter(i => i.hasMenudeo).length})`, icon: Pill },
                  { id: 'pending', label: `Por Etiquetar (${processedItems.length - markedCount})`, icon: Tag },
                  { id: 'done', label: `Etiquetados (${markedCount})`, icon: CheckCircle2 },
                  { id: 'superProfit', label: `Descto. Proveedor (${processedItems.filter(i => i.hasExtraProfit).length})`, icon: Sparkles },
                  { id: 'conIva', label: `Con IVA 19% (${processedItems.filter(i => i.hasIva).length})`, icon: ShieldCheck },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl whitespace-nowrap font-extrabold text-xs transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Counter status */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-0.5 font-medium">
                <span>Mostrando <b>{filteredItems.length}</b> de {processedItems.length} productos</span>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Borrar búsqueda
                  </button>
                )}
              </div>

            </div>

            {/* Product Cards List (Screen view) */}
            <div className="no-print space-y-3.5">
              {filteredItems.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-2 shadow-sm">
                  <span className="text-4xl">🔍</span>
                  <h3 className="font-extrabold text-slate-800 text-base">No encontramos ningún producto</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Prueba buscando con otra palabra o selecciona otra pestaña de filtro.
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const itemId = item.code || item.description;
                  const isTagged = !!taggedCodes[itemId];

                  return (
                    <div
                      key={itemId}
                      className={`bg-white rounded-3xl border transition-all overflow-hidden relative ${
                        isTagged 
                          ? 'border-emerald-300 bg-emerald-50/20 shadow-sm opacity-95' 
                          : 'border-slate-200/90 shadow-sm hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {/* Left accent color bar */}
                      <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                        isTagged ? 'bg-emerald-500' : (item.hasMenudeo ? 'bg-amber-400' : 'bg-emerald-700')
                      }`} />

                      {/* Product Header */}
                      <div className="p-4 pl-5 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            
                            {/* Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.code && (
                                <span className="text-[10px] font-mono-num font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                                  #{item.code}
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100/80 px-2.5 py-0.5 rounded-full border border-slate-200">
                                Llegaron: <b className="text-slate-900">{item.quantity}</b> {item.quantity === 1 ? 'caja' : 'cajas'}
                              </span>
                              {item.hasIva ? (
                                <span className="text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                                  IVA 19%
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md">
                                  Exento (0%)
                                </span>
                              )}
                            </div>

                            {/* Product Title */}
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                              {item.description}
                            </h2>
                          </div>

                          {/* Check Button for labeling */}
                          <button
                            onClick={() => toggleTag(itemId)}
                            className={`shrink-0 p-2.5 rounded-2xl transition-all ${
                              isTagged
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                            }`}
                            title={isTagged ? 'Marcado como etiquetado' : 'Marcar como etiquetado en mostrador'}
                          >
                            <CheckCircle2 size={22} className={isTagged ? 'stroke-[2.5]' : ''} />
                          </button>
                        </div>
                      </div>

                      {/* Pricing Details Panel */}
                      <div className="bg-slate-50/70 p-4 pl-5 border-t border-slate-100 space-y-3">
                        
                        {/* BOX SALE PRICE */}
                        <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                          <div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block leading-tight">
                              PRECIO VENTA CAJA COMPLETA
                            </span>
                            <div className="text-xs text-slate-400 space-x-1 mt-0.5">
                              <span>Costo: <b className="text-slate-600">{formatCOP(item.costWithIva)}</b></span>
                              <span>•</span>
                              <span className="text-emerald-700 font-bold">
                                +{formatCOP(item.boxSalePrice - item.costWithIva)} utilidad
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xl sm:text-2xl font-black text-emerald-800 font-mono-num tracking-tight">
                              {formatCOP(item.boxSalePrice)}
                            </span>
                            <button
                              onClick={() => handleCopyPrice(itemId + '-box', formatCOP(item.boxSalePrice))}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              title="Copiar precio"
                            >
                              {copiedId === itemId + '-box' ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* MENUDEO (Pill / Sachet / Ampoule Sale Price) */}
                        {item.hasMenudeo && (
                          <div className="bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-200/90 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0 text-lg">
                                💊
                              </div>
                              <div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-950 block leading-tight">
                                  PRECIO MENUDEO ({item.presentation.unitName.toUpperCase()})
                                </span>
                                <span className="text-[11px] text-amber-800 font-semibold">
                                  Trae {item.unitCount} {item.presentation.unitName}s en la caja
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-right">
                              <div>
                                <span className="text-lg sm:text-xl font-black text-amber-900 font-mono-num tracking-tight block leading-tight">
                                  {formatCOP(item.pillSalePrice)}
                                </span>
                                <span className="text-[10px] font-extrabold text-amber-700 block">
                                  cada {item.presentation.unitName}
                                </span>
                              </div>
                              <button
                                onClick={() => handleCopyPrice(itemId + '-pill', formatCOP(item.pillSalePrice))}
                                className="p-1.5 rounded-lg text-amber-400 hover:text-amber-800 hover:bg-amber-100/60 transition-colors"
                                title="Copiar precio"
                              >
                                {copiedId === itemId + '-pill' ? (
                                  <Check size={14} className="text-emerald-600" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Extra supplier profit notice */}
                        {item.hasExtraProfit && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                              <Sparkles size={14} className="text-emerald-600" />
                              <span>Descuento proveedor: {item.supplierDiscount}%</span>
                            </div>
                            <span className="font-black text-emerald-800 font-mono-num bg-emerald-100/80 px-2 py-0.5 rounded-md">
                              ¡{item.realMarginPercent}% ganancia real!
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* PRINT-ONLY TABLE (When generating PDF or printing) */}
            <div className="print-only">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-black font-bold">
                    <th className="py-2 px-1">#</th>
                    <th className="py-2 px-1">Código</th>
                    <th className="py-2 px-2">Descripción del Producto</th>
                    <th className="py-2 px-1">Cant.</th>
                    <th className="py-2 px-1">Costo c/IVA</th>
                    <th className="py-2 px-2 text-right">PRECIO CAJA</th>
                    <th className="py-2 px-2 text-right">PRECIO MENUDEO</th>
                  </tr>
                </thead>
                <tbody>
                  {processedItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1 px-1 text-gray-500">{idx + 1}</td>
                      <td className="py-1 px-1 font-mono">{item.code || '-'}</td>
                      <td className="py-1 px-2 font-medium">{item.description}</td>
                      <td className="py-1 px-1">{item.quantity}</td>
                      <td className="py-1 px-1">{formatCOP(item.costWithIva)}</td>
                      <td className="py-1 px-2 text-right font-bold">{formatCOP(item.boxSalePrice)}</td>
                      <td className="py-1 px-2 text-right font-bold text-amber-900">
                        {item.hasMenudeo ? `${formatCOP(item.pillSalePrice)} c/u` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t-2 border-black flex justify-between text-xs font-bold">
                <div>Total Productos: {processedItems.length}</div>
                <div>Inversión: {formatCOP(totals.totalCost)}</div>
                <div>Venta Total: {formatCOP(totals.totalProjectedSale)}</div>
                <div>Ganancia Proyectada: {formatCOP(totals.totalProfit)}</div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Floating Bottom Glass Bar */}
      {rawItems.length > 0 && (
        <footer className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-slate-200/80 p-3.5 shadow-2xl z-30 pb-safe no-print">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Inversión
              </span>
              <span className="text-xs font-black text-slate-800 font-mono-num">
                {formatCOP(totals.totalCost)}
              </span>
            </div>

            <div className="text-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Ganancia Estimada
              </span>
              <span className="text-sm font-black text-emerald-800 font-mono-num">
                +{formatCOP(totals.totalProfit)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-600 hover:to-red-700 text-white font-black text-xs px-3.5 py-2.5 rounded-2xl shadow-md shadow-rose-950/20 active:scale-95 transition-all"
                title="Descargar en PDF organizado"
              >
                <Download size={15} />
                <span>PDF</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs px-3.5 py-2.5 rounded-2xl shadow-md shadow-emerald-950/20 active:scale-95 transition-all"
                title="Descargar en Excel"
              >
                <FileSpreadsheet size={15} />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* PWA Install Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-bold">
                  📲
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                    Instalar en tu Celular
                  </h3>
                  <p className="text-xs text-slate-500">
                    Úsala como una app normal sin entrar al navegador
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Android Instructions */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <p className="text-xs font-black text-slate-900">En Android (Celular de Mamá):</p>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside font-medium">
                <li>Abre el enlace en <b>Google Chrome</b>.</li>
                <li>Toca los <b>tres puntos (⋮)</b> arriba a la derecha.</li>
                <li>Selecciona <b>"Instalar aplicación"</b> (o *"Agregar a pantalla principal"*).</li>
                <li>¡Listo! Se creará el ícono en la pantalla con el logo de Vitalcon.</li>
              </ol>
            </div>

            {/* iPhone Instructions */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2">
                <span className="text-lg">🍏</span>
                <p className="text-xs font-black text-slate-900">En iPhone (Safari):</p>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside font-medium">
                <li>Abre el enlace en <b>Safari</b>.</li>
                <li>Toca el botón <b>Compartir ⎋</b> (el cuadro con flecha hacia arriba abajo).</li>
                <li>Baja en el menú y toca <b>"Agregar a pantalla de inicio" (+)</b>.</li>
                <li>Toca "Agregar" arriba a la derecha.</li>
              </ol>
            </div>

            {/* Security note */}
            <div className="p-3 bg-emerald-50 text-emerald-900 text-[11px] rounded-xl border border-emerald-200 leading-tight">
              💡 <b>Nota importante:</b> Para que el celular permita instalarla como app, asegúrate de abrirla desde tu enlace seguro de Vercel (con <b>https://</b>).
            </div>

            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md active:scale-98"
            >
              Entendido
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

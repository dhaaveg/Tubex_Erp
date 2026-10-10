'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Truck,
  Wrench,
  ShieldAlert,
  ShoppingCart,
  Receipt,
  Users,
  Building2,
  CheckCircle2,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  Database,
  Sparkles,
  Info
} from 'lucide-react';
import { exportToExcel, exportToCsv, exportSingleSheetToExcel } from '@/lib/export';
import { formatDate } from '@/lib/formatters';

interface DatasetMeta {
  key: string;
  name: string;
  category: string;
  description: string;
  icon: any;
  sheetName: string;
  filename: string;
  columns: string[];
}

const DATASETS: DatasetMeta[] = [
  {
    key: 'pipes',
    name: 'Raw Pipe Inventory & Heat Tally',
    category: 'Inventory & Receiving',
    description: 'Pipe-by-pipe serial numbers, heat & lot numbers, length, yield count, scrap mm, and allocation status.',
    icon: Truck,
    sheetName: 'Pipe_Inventory',
    filename: 'Pipe_Inventory_Tally',
    columns: ['Pipe Tag ID', 'Serial No', 'Heat Number', 'Length (mm)', 'Rounded Yield Pcs', 'End Scrap (mm)', 'Allocation Status', 'Steel Grade', 'OD (mm)'],
  },
  {
    key: 'routing',
    name: 'Shop Floor 8-Stage Routing Postings',
    category: 'Manufacturing Operations',
    description: 'Detailed stage-by-stage routing logs: Cutting, ID/OD Roughing, Threading, MPI, Phosphating, Painting, Packing with Accepted & Rejected quantities.',
    icon: Wrench,
    sheetName: 'Routing_Postings',
    filename: 'ShopFloor_Routing_Postings',
    columns: ['Posting ID', 'Work Order ID', 'Operation Seq', 'Process Stage', 'Input Quantity', 'Accepted Quantity', 'Rejected Quantity', 'Completion Date'],
  },
  {
    key: 'work-orders',
    name: 'Work Orders & Job Cards',
    category: 'Production Planning',
    description: 'Work order job cards, target heat numbers, quantity to produce, machine line assignments, shifts, and execution status.',
    icon: Layers,
    sheetName: 'Work_Orders',
    filename: 'Work_Orders_JobCards',
    columns: ['Work Order ID', 'Date', 'Source Type', 'Customer PO No', 'Product Description', 'Quantity to Produce (User Entry)', 'Allocated Pipe Tag', 'Status'],
  },
  {
    key: 'quality',
    name: 'Quality Rejections & Defect Dispositions',
    category: 'QA & Compliance',
    description: 'Defect logging by process stage, defect categories (MPI, Thread, M.F.), scrap vs rework disposition, and inspector remarks.',
    icon: ShieldAlert,
    sheetName: 'Quality_Rejections',
    filename: 'Quality_Defect_Rejections',
    columns: ['Rejection ID', 'Work Order ID', 'Process Stage', 'Defect Category', 'Defect Quantity', 'Disposition Action', 'Inspector Remarks', 'Logged Date'],
  },
  {
    key: 'procurement',
    name: 'Raw Material Purchase Orders (RM PO)',
    category: 'Supply Chain',
    description: 'Supplier RM PO details, ordered metric tons, agreed unit rates, delivery milestones, and line fulfillment status.',
    icon: ShoppingCart,
    sheetName: 'Purchase_Orders',
    filename: 'Purchase_Orders_Procurement',
    columns: ['RM PO Number', 'RM PO Date', 'Supplier Name', 'Status', 'Product Description', 'Ordered Qty (MT)', 'Unit Rate', 'Line Total'],
  },
  {
    key: 'grn',
    name: 'Goods Receipt Notes (GRN)',
    category: 'Supply Chain',
    description: 'Inbound weighbridge vs invoice weight reconciliation, transporter vehicles, tube tally match status, and receipt dates.',
    icon: Receipt,
    sheetName: 'Goods_Receipt_Notes',
    filename: 'Goods_Receipt_Notes_GRN',
    columns: ['GRN ID', 'GRN Date', 'RM PO Number', 'Supplier Name', 'Invoice Weight (MT)', 'Actual Weighbridge (MT)', 'Weight Variance (MT)', 'Tally Match Status'],
  },
  {
    key: 'customer-orders',
    name: 'Customer Sales Orders',
    category: 'Sales & Commercial',
    description: 'Customer purchase orders, project references, tube specifications, target delivery dates, and fulfillment progress.',
    icon: Users,
    sheetName: 'Customer_Orders',
    filename: 'Customer_Sales_Orders',
    columns: ['Customer PO No', 'Customer Name', 'Order Date', 'Delivery Due Date', 'Status', 'Size', 'Grade', 'Thread', 'Line Qty', 'Fulfilled Qty'],
  },
  {
    key: 'products',
    name: 'Product Master Catalog',
    category: 'Master Data',
    description: 'OCTG tubing & casing specifications, outer diameters, wall thicknesses, steel grades, thread connections, and CVN criteria.',
    icon: Building2,
    sheetName: 'Product_Catalog',
    filename: 'Product_Master_Catalog',
    columns: ['Product Code', 'Description', 'OD (mm)', 'WT (mm)', 'Steel Grade', 'Thread Connection', 'CVN Requirement', 'Nominal Weight (kg/m)'],
  },
  {
    key: 'suppliers',
    name: 'Supplier & Mill Master',
    category: 'Master Data',
    description: 'Approved steel mills and pipe suppliers, mill locations, GST/Tax identifiers, contact details, and onboarding statuses.',
    icon: Building2,
    sheetName: 'Supplier_Master',
    filename: 'Supplier_Mill_Master',
    columns: ['Supplier ID', 'Supplier Name', 'Mill Name', 'Mill Address', 'Contact Person', 'Email Address', 'Telephone', 'GST / Tax ID', 'Onboarding Date', 'Status'],
  },
];

export default function DataExportModule() {
  const [exportData, setExportData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingMaster, setIsExportingMaster] = useState(false);
  const [activeExportingKey, setActiveExportingKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const fetchExportData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/export');
      const json = await res.json();
      if (json.data) {
        setExportData(json.data);
        setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load export data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExportData();
  }, []);

  const showStatus = (text: string) => {
    setStatusMessage({ text, type: 'success' });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // 1-Click Master Excel Export (All 9 Tables in one workbook)
  const handleExportMasterExcel = () => {
    if (!exportData) return;
    setIsExportingMaster(true);

    try {
      const dateStr = formatDate(new Date());
      const sheets = [
        { sheetName: 'Pipe Inventory', rows: exportData['Pipe Inventory'] || [] },
        { sheetName: 'Routing Logs', rows: exportData['Shop Routing Logs'] || [] },
        { sheetName: 'Work Orders', rows: exportData['Work Orders'] || [] },
        { sheetName: 'Quality Postings', rows: exportData['Quality & Defect Postings'] || [] },
        { sheetName: 'Purchase Orders', rows: exportData['Purchase Orders'] || [] },
        { sheetName: 'Goods Receipts', rows: exportData['Goods Receipt (GRN)'] || [] },
        { sheetName: 'Customer Orders', rows: exportData['Customer Sales Orders'] || [] },
        { sheetName: 'Product Catalog', rows: exportData['Product Catalog'] || [] },
        { sheetName: 'Supplier Master', rows: exportData['Supplier Master'] || [] },
      ];

      exportToExcel(`TUBEX_ERP_Full_Database_Export_${dateStr}`, sheets);
      showStatus(`Master Excel Workbook (9 sheets) downloaded successfully!`);
    } catch (err: any) {
      console.error('Error generating master Excel export:', err);
    } finally {
      setIsExportingMaster(false);
    }
  };

  // Export All as Individual CSVs
  const handleExportAllCsv = () => {
    if (!exportData) return;
    const dateStr = formatDate(new Date());
    
    DATASETS.forEach((ds) => {
      const rows = getDatasetRows(ds.key);
      if (rows && rows.length > 0) {
        exportToCsv(`${ds.filename}_${dateStr}`, rows);
      }
    });

    showStatus(`Exported all 9 tables as individual CSV files!`);
  };

  // Helper to get rows by dataset key
  const getDatasetRows = (key: string): Record<string, any>[] => {
    if (!exportData) return [];
    switch (key) {
      case 'pipes': return exportData['Pipe Inventory'] || [];
      case 'routing': return exportData['Shop Routing Logs'] || [];
      case 'work-orders': return exportData['Work Orders'] || [];
      case 'quality': return exportData['Quality & Defect Postings'] || [];
      case 'procurement': return exportData['Purchase Orders'] || [];
      case 'grn': return exportData['Goods Receipt (GRN)'] || [];
      case 'customer-orders': return exportData['Customer Sales Orders'] || [];
      case 'products': return exportData['Product Catalog'] || [];
      case 'suppliers': return exportData['Supplier Master'] || [];
      default: return [];
    }
  };

  // Individual Excel Export
  const handleExportSingleExcel = (meta: DatasetMeta) => {
    setActiveExportingKey(`${meta.key}-excel`);
    const rows = getDatasetRows(meta.key);
    const dateStr = formatDate(new Date());
    exportSingleSheetToExcel(`${meta.filename}_${dateStr}`, meta.sheetName, rows);
    showStatus(`Exported ${meta.name} as Excel (.xlsx)`);
    setActiveExportingKey(null);
  };

  // Individual CSV Export
  const handleExportSingleCsv = (meta: DatasetMeta) => {
    setActiveExportingKey(`${meta.key}-csv`);
    const rows = getDatasetRows(meta.key);
    const dateStr = formatDate(new Date());
    exportToCsv(`${meta.filename}_${dateStr}`, rows);
    showStatus(`Exported ${meta.name} as CSV (.csv)`);
    setActiveExportingKey(null);
  };

  const totalRecordCount = summary
    ? summary.totalPipes +
      summary.totalRoutingPostings +
      summary.totalWorkOrders +
      summary.totalQualityRejections +
      summary.totalPurchaseOrderLines +
      summary.totalGRNs +
      summary.totalCustomerOrderLines +
      summary.totalProducts +
      summary.totalSuppliers
    : 0;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center space-x-2 px-4 py-3 bg-emerald-950 border border-emerald-500/50 rounded-xl shadow-2xl text-emerald-300 text-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Admin Data Export & Backup Center
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/60 font-semibold">
              ADMIN SECURE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Export production records, pipe inventory, work orders, 8-stage routing logs, and master catalog in Microsoft Excel (.xlsx) and CSV formats.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchExportData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh Counts</span>
          </button>
        </div>
      </div>

      {/* Hero Master Download Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900 border border-blue-800/50 p-6 shadow-xl shadow-blue-950/20">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-md bg-blue-900/60 border border-blue-700/60 text-blue-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Full System Snapshot</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Download Complete ERP Database Workbook (.xlsx)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Export all 9 system tables into a single formatted Microsoft Excel file. Each table is arranged in a dedicated worksheet with headers, optimal column widths, and proper number formatting.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <strong>{totalRecordCount}</strong> total records active
              </span>
              <span>•</span>
              <span>9 Worksheets Included</span>
              <span>•</span>
              <span>UTF-8 / Excel 2016+ Compatible</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              onClick={handleExportMasterExcel}
              disabled={isLoading || isExportingMaster}
              className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/50 transition-all border border-emerald-500/30 active:scale-[0.98]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExportingMaster ? 'Generating Workbook...' : 'Download Master Excel (.xlsx)'}</span>
            </button>

            <button
              onClick={handleExportAllCsv}
              disabled={isLoading}
              className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Download All Tables as CSVs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dataset Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-400" />
            Module-by-Module Data Exports
          </h3>
          <span className="text-xs text-slate-400">
            Download individual operational records in Excel (.xlsx) or CSV
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DATASETS.map((meta) => {
            const Icon = meta.icon;
            const rows = getDatasetRows(meta.key);
            const count = rows ? rows.length : 0;
            const isPreviewOpen = previewKey === meta.key;

            return (
              <div
                key={meta.key}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white tracking-wide">{meta.name}</h4>
                        <span className="text-[10px] text-slate-500 font-mono">{meta.category}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-semibold shrink-0">
                      {count} rows
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                    {meta.description}
                  </p>

                  {/* Columns Pill Preview */}
                  <div className="mb-4">
                    <div className="text-[10px] uppercase font-mono text-slate-500 mb-1.5">
                      Key Columns ({meta.columns.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {meta.columns.slice(0, 4).map((col) => (
                        <span
                          key={col}
                          className="text-[9px] font-mono bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800/80"
                        >
                          {col}
                        </span>
                      ))}
                      {meta.columns.length > 4 && (
                        <span className="text-[9px] font-mono bg-slate-950 text-blue-400 px-1 py-0.5 rounded border border-blue-900/40">
                          +{meta.columns.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleExportSingleExcel(meta)}
                      disabled={isLoading || count === 0}
                      className="flex items-center justify-center space-x-1 px-2.5 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-medium border border-emerald-800/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      onClick={() => handleExportSingleCsv(meta)}
                      disabled={isLoading || count === 0}
                      className="flex items-center justify-center space-x-1 px-2.5 py-2 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 text-xs font-medium border border-blue-800/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>CSV (.csv)</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setPreviewKey(isPreviewOpen ? null : meta.key)}
                    className="w-full flex items-center justify-center space-x-1 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Eye className="w-3 h-3 text-slate-500" />
                    <span>{isPreviewOpen ? 'Hide Preview' : 'Preview First 5 Rows'}</span>
                    {isPreviewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Inline Preview Table */}
                {isPreviewOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-800 overflow-x-auto">
                    <div className="text-[10px] text-slate-400 font-mono mb-2 flex items-center justify-between">
                      <span>Showing first {Math.min(rows.length, 5)} of {rows.length} records:</span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-[11px] text-slate-500 py-3 text-center">
                        No records found in this table.
                      </div>
                    ) : (
                      <table className="w-full text-left text-[10px] font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                            {Object.keys(rows[0]).slice(0, 5).map((col) => (
                              <th key={col} className="p-1.5 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/40 text-slate-300">
                              {Object.keys(rows[0]).slice(0, 5).map((col) => (
                                <td key={col} className="p-1.5 whitespace-nowrap truncate max-w-[140px]">
                                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin Notes & Instructions */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start space-x-3">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-300">Format & Compatibility Guide</div>
          <div className="text-slate-400 leading-relaxed text-[11px]">
            • <strong>Excel (.xlsx)</strong>: Native Microsoft Excel format. Numbers are formatted as numeric fields, dates are standardized, and column widths are auto-fitted.
            <br />
            • <strong>CSV (.csv)</strong>: Universal UTF-8 encoded text with Byte Order Mark (BOM). Fully compatible with Google Sheets, LibreOffice Calc, Python Pandas, and database import tools.
            <br />
            • All timestamps are localized to Indian Standard Time (IST / en-IN).
          </div>
        </div>
      </div>
    </div>
  );
}

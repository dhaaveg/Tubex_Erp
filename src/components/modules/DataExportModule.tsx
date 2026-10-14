'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Info,
  Search,
  Calendar,
  RotateCcw,
  Filter,
  X,
  AlertCircle,
} from 'lucide-react';
import { exportToExcel, exportToCsv, exportSingleSheetToExcel } from '@/lib/export';
import { apiUrl } from '@/lib/api';
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

const CATEGORIES = [
  'ALL',
  'Inventory & Receiving',
  'Manufacturing Operations',
  'Production Planning',
  'QA & Compliance',
  'Supply Chain',
  'Sales & Commercial',
  'Master Data',
] as const;

/**
 * Parses any date format present in ERP export records (DD-MM-YYYY, DD-MM-YYYY HH:mm, or ISO)
 */
function parseRowDate(row: Record<string, any>): Date | null {
  const dateVal =
    row['Date'] ||
    row['Tally Date'] ||
    row['Completion Date'] ||
    row['Logged Date'] ||
    row['PO Date'] ||
    row['GRN Date'] ||
    row['Order Date'] ||
    row['Onboarding Date'] ||
    row['Invoice Date'];

  if (!dateVal || typeof dateVal !== 'string') return null;

  // DD-MM-YYYY or DD-MM-YYYY HH:mm
  const match = dateVal.trim().match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (match) {
    const [, d, m, y, h, min] = match;
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      h ? Number(h) : 0,
      min ? Number(min) : 0
    );
    return isNaN(date.getTime()) ? null : date;
  }

  const fallbackDate = new Date(dateVal);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  hasRows: boolean;
  icon: React.ReactNode;
  label: string;
  variant: 'excel' | 'csv' | 'master-excel' | 'master-csv';
  count?: number;
  className?: string;
}

function ExportButton({
  onClick,
  disabled,
  isLoading,
  hasRows,
  icon,
  label,
  variant,
  count,
  className = '',
}: ExportButtonProps) {
  const isDisabled = !hasRows || Boolean(isLoading) || Boolean(disabled);
  const tooltipText = !hasRows
    ? 'No records found to export for the selected filter criteria.'
    : count !== undefined
    ? `Export ${count} ${count === 1 ? 'record' : 'records'} as ${label}`
    : `Export as ${label}`;

  let variantStyles = '';
  if (variant === 'excel') {
    variantStyles = isDisabled
      ? 'bg-emerald-950/20 text-emerald-500/40 border-emerald-900/30'
      : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800/60 hover:shadow-md hover:shadow-emerald-950/40 active:scale-[0.98] cursor-pointer';
  } else if (variant === 'csv') {
    variantStyles = isDisabled
      ? 'bg-blue-950/20 text-blue-500/40 border-blue-900/30'
      : 'bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border-blue-800/60 hover:shadow-md hover:shadow-blue-950/40 active:scale-[0.98] cursor-pointer';
  } else if (variant === 'master-excel') {
    variantStyles = isDisabled
      ? 'bg-slate-800 text-slate-500 border-slate-700'
      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-950/50 border-emerald-500/30 active:scale-[0.98] cursor-pointer';
  } else if (variant === 'master-csv') {
    variantStyles = isDisabled
      ? 'bg-slate-800/40 text-slate-600 border-slate-800'
      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-medium border-slate-700 hover:shadow-md active:scale-[0.98] cursor-pointer';
  }

  const disabledStyles = isDisabled
    ? 'opacity-40 cursor-not-allowed pointer-events-none grayscale-[40%] shadow-none hover:bg-transparent hover:shadow-none active:scale-100'
    : '';

  return (
    <div className="relative group w-full" title={tooltipText}>
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        aria-disabled={isDisabled ? 'true' : 'false'}
        className={`w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border text-xs transition-all duration-200 ease-in-out ${variantStyles} ${disabledStyles} ${className}`}
      >
        {icon}
        <span>{label}</span>
      </button>

      {/* Floating Hover Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex items-center px-2.5 py-1 text-[11px] font-medium rounded-lg shadow-2xl whitespace-nowrap z-30 pointer-events-none backdrop-blur-md border animate-in fade-in duration-150 bg-slate-900 text-slate-200 border-slate-700">
        {!hasRows && <AlertCircle className="w-3 h-3 text-amber-400 mr-1.5 shrink-0" />}
        <span>{tooltipText}</span>
      </div>
    </div>
  );
}

export default function DataExportModule() {
  const [exportData, setExportData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingMaster, setIsExportingMaster] = useState(false);
  const [activeExportingKey, setActiveExportingKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Filter & Search Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7d' | '30d' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchExportData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/export'));
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

  // Compute effective date filter window
  const { startDate, endDate } = useMemo(() => {
    if (datePreset === 'all') return { startDate: null, endDate: null };

    if (datePreset === 'custom') {
      const s = customStartDate ? new Date(`${customStartDate}T00:00:00`) : null;
      const e = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : null;
      return { startDate: s, endDate: e };
    }

    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (datePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }

    if (datePreset === '7d') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }

    if (datePreset === '30d') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }

    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { startDate: start, endDate: end };
    }

    return { startDate: null, endDate: null };
  }, [datePreset, customStartDate, customEndDate]);

  // Helper to get raw rows by dataset key
  const getDatasetRows = useCallback(
    (key: string): Record<string, any>[] => {
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
    },
    [exportData]
  );

  // Helper to get filtered rows by dataset key (respects date window & search term)
  const getFilteredRows = useCallback(
    (key: string): Record<string, any>[] => {
      const rawRows = getDatasetRows(key);
      if (!rawRows || rawRows.length === 0) return [];

      return rawRows.filter((row) => {
        // 1. Date Range Filter
        if (startDate || endDate) {
          const rowDate = parseRowDate(row);
          if (rowDate) {
            if (startDate && rowDate < startDate) return false;
            if (endDate && rowDate > endDate) return false;
          } else if (key !== 'products') {
            // For transactional tables with dates, if row has no date during a date filter, exclude
            return false;
          }
        }

        // 2. Search Query Filter
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const meta = DATASETS.find((d) => d.key === key);
          const metaMatches =
            meta &&
            (meta.name.toLowerCase().includes(q) ||
              meta.description.toLowerCase().includes(q) ||
              meta.category.toLowerCase().includes(q) ||
              meta.columns.some((c) => c.toLowerCase().includes(q)));

          if (!metaMatches) {
            const rowMatches = Object.values(row).some((val) =>
              val !== null && val !== undefined && String(val).toLowerCase().includes(q)
            );
            if (!rowMatches) return false;
          }
        }

        return true;
      });
    },
    [getDatasetRows, startDate, endDate, searchQuery]
  );

  // Active filter checks
  const isFilterActive =
    datePreset !== 'all' ||
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'ALL' ||
    customStartDate !== '' ||
    customEndDate !== '';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // Visible dataset cards based on category selection
  const visibleDatasets = useMemo(() => {
    if (selectedCategory === 'ALL') return DATASETS;
    return DATASETS.filter((d) => d.category === selectedCategory);
  }, [selectedCategory]);

  // Aggregate counts
  const totalFilteredCount = useMemo(() => {
    return visibleDatasets.reduce((sum, ds) => sum + getFilteredRows(ds.key).length, 0);
  }, [visibleDatasets, getFilteredRows]);

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

  const hasMasterRows = totalFilteredCount > 0;

  // 1-Click Master Excel Export (All filtered tables into one workbook)
  const handleExportMasterExcel = () => {
    if (!hasMasterRows) return;
    setIsExportingMaster(true);

    try {
      const dateStr = formatDate(new Date());
      const sheets = DATASETS.map((ds) => ({
        sheetName: ds.sheetName.replace(/_/g, ' '),
        rows: getFilteredRows(ds.key),
      })).filter((s) => s.rows.length > 0);

      if (sheets.length === 0) {
        setIsExportingMaster(false);
        return;
      }

      exportToExcel(`TUBEX_ERP_Export_${dateStr}`, sheets);
      showStatus(`Master Excel Workbook (${sheets.length} sheets, ${totalFilteredCount} records) downloaded successfully!`);
    } catch (err: any) {
      console.error('Error generating master Excel export:', err);
    } finally {
      setIsExportingMaster(false);
    }
  };

  // Export All as Individual CSVs
  const handleExportAllCsv = () => {
    if (!hasMasterRows) return;
    const dateStr = formatDate(new Date());

    let exportedCount = 0;
    DATASETS.forEach((ds) => {
      const rows = getFilteredRows(ds.key);
      if (rows && rows.length > 0) {
        exportToCsv(`${ds.filename}_${dateStr}`, rows);
        exportedCount++;
      }
    });

    showStatus(`Exported ${exportedCount} tables as individual CSV files!`);
  };

  // Individual Excel Export
  const handleExportSingleExcel = (meta: DatasetMeta) => {
    const rows = getFilteredRows(meta.key);
    if (!rows || rows.length === 0) return;

    setActiveExportingKey(`${meta.key}-excel`);
    const dateStr = formatDate(new Date());
    exportSingleSheetToExcel(`${meta.filename}_${dateStr}`, meta.sheetName, rows);
    showStatus(`Exported ${meta.name} (${rows.length} records) as Excel (.xlsx)`);
    setActiveExportingKey(null);
  };

  // Individual CSV Export
  const handleExportSingleCsv = (meta: DatasetMeta) => {
    const rows = getFilteredRows(meta.key);
    if (!rows || rows.length === 0) return;

    setActiveExportingKey(`${meta.key}-csv`);
    const dateStr = formatDate(new Date());
    exportToCsv(`${meta.filename}_${dateStr}`, rows);
    showStatus(`Exported ${meta.name} (${rows.length} records) as CSV (.csv)`);
    setActiveExportingKey(null);
  };

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
            type="button"
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
              Export all system tables into a single formatted Microsoft Excel file. Each table is arranged in a dedicated worksheet with headers, optimal column widths, and proper formatting.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${hasMasterRows ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <strong className={hasMasterRows ? 'text-white' : 'text-amber-300'}>
                  {totalFilteredCount} {totalFilteredCount === 1 ? 'record' : 'records'} selected
                </strong>
                {isFilterActive && (
                  <span className="text-slate-500">({totalRecordCount} total database records)</span>
                )}
              </span>
              <span>•</span>
              <span>{visibleDatasets.length} Worksheets</span>
              <span>•</span>
              <span>UTF-8 / Excel 2016+ Compatible</span>
            </div>

            {!hasMasterRows && !isLoading && (
              <div className="text-xs text-amber-300/90 flex items-center gap-1.5 pt-1 font-medium animate-in fade-in duration-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>No records found to export for the selected filter criteria.</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 min-w-[260px]">
            <ExportButton
              onClick={handleExportMasterExcel}
              hasRows={hasMasterRows}
              isLoading={isLoading || isExportingMaster}
              variant="master-excel"
              count={totalFilteredCount}
              icon={<FileSpreadsheet className="w-4 h-4" />}
              label={isExportingMaster ? 'Generating Workbook...' : 'Download Master Excel (.xlsx)'}
            />

            <ExportButton
              onClick={handleExportAllCsv}
              hasRows={hasMasterRows}
              isLoading={isLoading}
              variant="master-csv"
              count={totalFilteredCount}
              icon={<FileText className="w-4 h-4 text-blue-400" />}
              label="Download All Tables as CSVs"
            />
          </div>
        </div>
      </div>

      {/* Interactive Filter & Date Range Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by table name, heat #, PO #, serial #, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-600 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Date:</span>
            </span>
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: 'custom', label: 'Custom Range' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDatePreset(preset.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  datePreset === preset.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80'
                }`}
              >
                {preset.label}
              </button>
            ))}

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors ml-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Inputs (Shown when custom is selected) */}
        {datePreset === 'custom' && (
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
            <span className="text-xs text-slate-400 font-medium">From Date:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-600"
            />
            <span className="text-xs text-slate-400 font-medium">To Date:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-600"
            />
            <span className="text-[11px] text-slate-500 italic">
              Tip: Pick a future or past date range to observe disabled states when 0 records match.
            </span>
          </div>
        )}

        {/* Category Filter Pills */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Category:</span>
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-slate-700 text-white font-semibold border border-slate-600'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {cat === 'ALL' ? 'All Modules' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Dataset Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-400" />
            Module-by-Module Data Exports ({visibleDatasets.length})
          </h3>
          <span className="text-xs text-slate-400">
            Download individual operational records in Excel (.xlsx) or CSV
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDatasets.map((meta) => {
            const Icon = meta.icon;
            const rows = getFilteredRows(meta.key);
            const count = rows ? rows.length : 0;
            const hasRows = Array.isArray(rows) && rows.length > 0;
            const isPreviewOpen = previewKey === meta.key;

            return (
              <div
                key={meta.key}
                className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all shadow-sm ${
                  hasRows ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/60 bg-slate-900/60'
                }`}
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

                    {/* Row Counter Badge */}
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold shrink-0 transition-colors ${
                        count === 0
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                          : 'bg-slate-800 border border-slate-700 text-slate-300'
                      }`}
                    >
                      {count} records selected
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

                {/* Card Action Buttons & Feedback */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <ExportButton
                      onClick={() => handleExportSingleExcel(meta)}
                      hasRows={hasRows}
                      isLoading={isLoading || activeExportingKey === `${meta.key}-excel`}
                      variant="excel"
                      count={count}
                      icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      label="Excel (.xlsx)"
                    />

                    <ExportButton
                      onClick={() => handleExportSingleCsv(meta)}
                      hasRows={hasRows}
                      isLoading={isLoading || activeExportingKey === `${meta.key}-csv`}
                      variant="csv"
                      count={count}
                      icon={<FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      label="CSV (.csv)"
                    />
                  </div>

                  {/* Subtitle Hint when Empty / Filtered out */}
                  {!hasRows && (
                    <div className="text-[10.5px] text-amber-400/90 flex items-center justify-center gap-1.5 pt-1 font-medium animate-in fade-in duration-200 text-center">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>No records found to export for the selected filter criteria.</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPreviewKey(isPreviewOpen ? null : meta.key)}
                    className="w-full flex items-center justify-center space-x-1 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Eye className="w-3 h-3 text-slate-500" />
                    <span>{isPreviewOpen ? 'Hide Preview' : `Preview First 5 Rows (${count})`}</span>
                    {isPreviewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Inline Preview Table */}
                {isPreviewOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-800 overflow-x-auto">
                    <div className="text-[10px] text-slate-400 font-mono mb-2 flex items-center justify-between">
                      <span>
                        Showing {Math.min(rows.length, 5)} of {rows.length} {rows.length === 1 ? 'record' : 'records'}:
                      </span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-[11px] text-amber-300/80 py-4 text-center bg-slate-950/40 rounded-lg border border-slate-800/80 flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>No records found to export for the selected filter criteria.</span>
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
            • <strong>Dynamic Filtered Exports</strong>: Selecting date ranges or filtering by keyword directly scopes all exported workbooks and CSV files to the filtered records. When 0 records match, export buttons are disabled with assistive accessibility tags.
            <br />
            • All timestamps are localized to Indian Standard Time (IST / en-IN).
          </div>
        </div>
      </div>
    </div>
  );
}

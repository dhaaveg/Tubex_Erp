import * as XLSX from 'xlsx';

/**
 * CSV Exporter Utility for ERP Data Grids with UTF-8 BOM for Microsoft Excel compatibility
 */
export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent =
    '\uFEFF' +
    [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const val = row[header];
            if (val === null || val === undefined) return '""';
            const stringVal = String(val).replace(/"/g, '""');
            return `"${stringVal}"`;
          })
          .join(',')
      ),
    ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.endsWith('.csv') ? filename : `${filename}.csv`}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Multi-Sheet Excel Exporter (.xlsx) using SheetJS
 * Automatically calculates optimal column widths based on contents.
 */
export function exportToExcel(
  filename: string,
  sheets: { sheetName: string; rows: Record<string, any>[] }[]
) {
  if (!sheets || sheets.length === 0) return;

  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ sheetName, rows }) => {
    const validRows = rows && rows.length > 0 ? rows : [{ Note: 'No data records available' }];
    const worksheet = XLSX.utils.json_to_sheet(validRows);

    // Auto-calculate column widths
    const colWidths = Object.keys(validRows[0]).map((key) => {
      let maxLen = key.length;
      validRows.forEach((r) => {
        const val = r[key];
        const str = val !== null && val !== undefined ? String(val) : '';
        if (str.length > maxLen) maxLen = str.length;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
    });
    worksheet['!cols'] = colWidths;

    // SheetJS limits sheet names to 31 chars and bans : \ / ? * [ ]
    const safeSheetName = sheetName
      .replace(/[:\\/?*\[\]]/g, '_')
      .slice(0, 31) || 'Sheet1';

    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
  });

  const fullFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, fullFilename, { compression: true });
}

/**
 * Single-Sheet Excel Exporter (.xlsx)
 */
export function exportSingleSheetToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, any>[]
) {
  exportToExcel(filename, [{ sheetName, rows }]);
}

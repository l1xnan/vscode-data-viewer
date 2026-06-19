import * as XLSX from 'xlsx';

const sheetCache = new Map<string, string[]>();

export async function listXlsxSheets(filePath: string): Promise<string[]> {
  const cached = sheetCache.get(filePath);
  if (cached) {
    return cached;
  }

  const workbook = XLSX.readFile(filePath, { bookSheets: true, bookVBA: false });
  const names = workbook.SheetNames ?? [];
  sheetCache.set(filePath, names);
  return names;
}

export function clearXlsxSheetCache(filePath?: string): void {
  if (filePath) {
    sheetCache.delete(filePath);
    return;
  }
  sheetCache.clear();
}

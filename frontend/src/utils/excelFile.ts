import { invoke } from '@tauri-apps/api/core';
import * as XLSX from 'xlsx';

function isTauriApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function toUint8Array(workbook: XLSX.WorkBook) {
  const workbookBytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return Array.from(new Uint8Array(workbookBytes));
}

export async function saveWorkbook(workbook: XLSX.WorkBook, filename: string) {
  if (isTauriApp()) {
    const bytes = toUint8Array(workbook);
    return invoke<string>('save_excel_file', { filename, bytes });
  }

  XLSX.writeFile(workbook, filename);
  return filename;
}

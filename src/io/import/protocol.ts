export interface SheetInfo { name: string; rowCount: number; columnCount: number }
export interface ImportWorkbook { sheets: SheetInfo[] }
export interface ImportPreview {
  sheet: string;
  columns: { index: number; letter: string; header: string }[];
  firstRows: string[][];
  hasHeader: boolean;
}
export type Command =
  | { kind: 'open'; filename: string; bytes: ArrayBuffer }
  | { kind: 'preview'; sheet: string; hasHeader: boolean }
  | { kind: 'extract'; sheet: string; hasHeader: boolean; columnIndex: number };
export type Request = Command & { id: number };
export type Result = ImportWorkbook | ImportPreview | string[];
export type Response = { id: number; value: Result } | { id: number; error: string };
export interface ImportRunner {
  open(file: File): Promise<ImportWorkbook>;
  preview(sheet: string, hasHeader: boolean): Promise<ImportPreview>;
  extract(sheet: string, columnIndex: number, hasHeader: boolean): Promise<string[]>;
  cancel(): void;
  dispose(): void;
}

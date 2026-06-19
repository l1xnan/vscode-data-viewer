export interface ScannedDataFile {
  filePath: string;
  extension: string;
  fileName: string;
  kind: 'file' | 'workbook';
}

export type ExtensionMessage =
  | { type: 'files'; payload: { files: ScannedDataFile[]; workspaceOpen: boolean } }
  | { type: 'sheets'; payload: { filePath: string; sheets: string[] } }
  | { type: 'sheetsError'; payload: { filePath: string; message: string } };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'loadSheets'; payload: { filePath: string } }
  | {
      type: 'open';
      payload: { filePath: string; extension: string; sheetName?: string };
    };

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
};

export const vscode = acquireVsCodeApi();

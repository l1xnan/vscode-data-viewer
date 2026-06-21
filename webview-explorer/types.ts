export interface ScannedDataFile {
  filePath: string;
  extension: string;
  fileName: string;
  kind: 'file' | 'workbook';
}

export interface ScannedSqlFile {
  filePath: string;
  fileName: string;
}

export type ExtensionMessage =
  | {
      type: 'files';
      payload: {
        files: ScannedDataFile[];
        sqlFiles: ScannedSqlFile[];
        workspaceOpen: boolean;
      };
    }
  | { type: 'sheets'; payload: { filePath: string; sheets: string[] } }
  | { type: 'sheetsError'; payload: { filePath: string; message: string } };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'loadSheets'; payload: { filePath: string } }
  | {
      type: 'open';
      payload: { filePath: string; extension: string; sheetName?: string };
    }
  | { type: 'openSql'; payload: { filePath: string } }
  | { type: 'newSql' };

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
};

export const vscode = acquireVsCodeApi();

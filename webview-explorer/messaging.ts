import { vscode, WebviewMessage } from './types';

export function postMessage(message: WebviewMessage): void {
  vscode.postMessage(message);
}

export function notifyReady(): void {
  postMessage({ type: 'ready' });
}

export function requestSheets(filePath: string): void {
  postMessage({ type: 'loadSheets', payload: { filePath } });
}

export function openFile(filePath: string, extension: string, sheetName?: string): void {
  postMessage({ type: 'open', payload: { filePath, extension, sheetName } });
}

export function openSql(filePath: string): void {
  postMessage({ type: 'openSql', payload: { filePath } });
}

export function newSql(): void {
  postMessage({ type: 'newSql' });
}

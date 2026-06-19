import { WebviewMessage } from './types';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
};

const vscode = acquireVsCodeApi();

export function postTableQuery(payload: WebviewMessage & { type: 'tableQuery' }['payload']): void {
  vscode.postMessage({ type: 'tableQuery', payload });
}

export function notifyReady(): void {
  vscode.postMessage({ type: 'ready' });
}

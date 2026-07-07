import { QueryPayload, WebviewMessage } from './types';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
};

const vscode = acquireVsCodeApi();

export function postQuery(payload: QueryPayload): void {
  vscode.postMessage({ type: 'query', payload });
}

export function postSqlChanged(sql: string): void {
  vscode.postMessage({ type: 'sqlChanged', payload: { sql } });
}

export function notifyReady(): void {
  vscode.postMessage({ type: 'ready' });
}

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  distFolder = 'webview',
): string {
  const webviewDist = vscode.Uri.joinPath(extensionUri, 'dist', distFolder);
  const indexPath = path.join(webviewDist.fsPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return `<!DOCTYPE html><html><body><h1>Webview not built</h1><p>Run <code>npm run build</code> first.</p></body></html>`;
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  const nonce = getNonce();

  html = html.replace(/<script/g, `<script nonce="${nonce}"`);

  html = html.replace(/(href|src)="([^"]+)"/g, (match, attr, assetPath) => {
    if (assetPath.startsWith('http') || assetPath.startsWith('data:')) {
      return match;
    }
    const absoluteAsset = path.resolve(webviewDist.fsPath, assetPath);
    const assetUri = webview.asWebviewUri(vscode.Uri.file(absoluteAsset));
    return `${attr}="${assetUri}"`;
  });

  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    `img-src ${webview.cspSource} data:`,
  ].join('; ');

  html = html.replace(
    '<head>',
    `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );

  return html;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

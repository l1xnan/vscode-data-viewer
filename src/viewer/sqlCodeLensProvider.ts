import * as vscode from 'vscode';
import { SQL_SCHEME } from '../constants';
import { splitSqlStatements } from '../utils/sqlStatements';

export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    if (document.uri.scheme !== SQL_SCHEME) {
      return [];
    }

    const statements = splitSqlStatements(document.getText());
    return statements.map(
      (statement) =>
        new vscode.CodeLens(new vscode.Range(statement.startLine, 0, statement.startLine, 0), {
          title: '$(play) Run Statement',
          tooltip: 'Execute this SQL statement in Data Viewer',
          command: 'dataViewer.runStatement',
          arguments: [document.uri.toString(), statement.startOffset, statement.endOffset],
        }),
    );
  }
}

import * as vscode from 'vscode';
import { CompletionCatalogData } from './types';

const STORAGE_KEY = 'completionCatalog';
const CACHE_VERSION = 1;

interface CachedCompletionCatalog {
  version: number;
  data: CompletionCatalogData;
}

function isCompletionCatalogData(value: unknown): value is CompletionCatalogData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as CompletionCatalogData;
  return Array.isArray(candidate.keywords) && Array.isArray(candidate.functions);
}

export class CompletionCatalogCacheStore {
  constructor(private readonly globalState: vscode.Memento) {}

  get(): CompletionCatalogData | undefined {
    const cached = this.globalState.get<CachedCompletionCatalog>(STORAGE_KEY);
    if (!cached || cached.version !== CACHE_VERSION || !isCompletionCatalogData(cached.data)) {
      return undefined;
    }
    return cached.data;
  }

  async save(data: CompletionCatalogData): Promise<void> {
    await this.globalState.update(STORAGE_KEY, {
      version: CACHE_VERSION,
      data,
    } satisfies CachedCompletionCatalog);
  }
}

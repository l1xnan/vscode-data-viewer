export class FileFilterState {
  private searchText = '';
  private extensions: string[] | undefined;

  setSearchText(text: string): void {
    this.searchText = text.trim().toLowerCase();
  }

  getSearchText(): string {
    return this.searchText;
  }

  setExtensions(extensions: string[] | undefined): void {
    this.extensions = extensions;
  }

  clear(): void {
    this.searchText = '';
    this.extensions = undefined;
  }

  matches(fileName: string, extension: string): boolean {
    const lowerName = fileName.toLowerCase();
    const lowerExt = extension.toLowerCase();

    if (this.extensions && this.extensions.length > 0) {
      if (!this.extensions.some((ext) => ext.toLowerCase() === lowerExt)) {
        return false;
      }
    }

    if (!this.searchText) {
      return true;
    }

    return lowerName.includes(this.searchText);
  }
}

export const fileFilterState = new FileFilterState();

export class MemoryStorage {
  private store = new Map<string, string>();
  async read(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async write(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  keys(): string[] {
    return [...this.store.keys()];
  }
}

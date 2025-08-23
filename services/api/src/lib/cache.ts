interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly ttlMs: number;
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  async resolve(key: string, factory: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key);
    if (entry !== undefined && entry.expiresAt > Date.now()) {
      this.hits += 1;
      return entry.value;
    }

    const pending = this.inFlight.get(key);
    if (pending !== undefined) {
      return pending;
    }

    this.misses += 1;
    const promise = factory()
      .then((value) => {
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(key?: string): void {
    if (key === undefined) {
      this.entries.clear();
      return;
    }
    this.entries.delete(key);
  }

  get stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.entries.size };
  }
}

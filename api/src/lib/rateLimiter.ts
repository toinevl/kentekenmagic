export interface RateLimitOptions {
  readonly windowMs?: number;
  readonly maxHits?: number;
  readonly maxEntries?: number;
}

export class RateLimiter {
  private readonly options: Required<RateLimitOptions>;
  private readonly hits = new Map<string, { count: number; firstSeen: number }>();

  constructor(options: RateLimitOptions = {}) {
    this.options = {
      windowMs: options.windowMs ?? 60_000,
      maxHits: options.maxHits ?? 1,
      maxEntries: options.maxEntries ?? 2048
    };
  }

  allow(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry) {
      this.hits.set(key, { count: 1, firstSeen: now });
      this.evict(now);
      return true;
    }

    if (now - entry.firstSeen > this.options.windowMs) {
      this.hits.set(key, { count: 1, firstSeen: now });
      this.evict(now);
      return true;
    }

    if (entry.count >= this.options.maxHits) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  retryAfterSeconds(key: string): number {
    const entry = this.hits.get(key);
    if (!entry) return 0;
    const elapsed = Date.now() - entry.firstSeen;
    const remaining = this.options.windowMs - elapsed;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  private evict(now: number): void {
    if (this.hits.size <= this.options.maxEntries) return;

    const entries: [string, { count: number; firstSeen: number }][] = Array.from(this.hits.entries());
    entries.sort((a, b) => a[1].firstSeen - b[1].firstSeen);

    const evictCount = Math.max(1, Math.floor(this.options.maxEntries / 2));
    for (let i = 0; i < Math.min(evictCount, entries.length); i++) {
      this.hits.delete(entries[i][0]);
    }
  }
}
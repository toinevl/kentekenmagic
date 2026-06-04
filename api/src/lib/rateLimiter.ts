export interface RateLimitEntry {
  count: number;
  firstSeen: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, RateLimitEntry>();

  constructor(
    private readonly windowMs = 60_000,
    private readonly maxHits = 1
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry) {
      this.hits.set(key, { count: 1, firstSeen: now });
      return true;
    }

    if (now - entry.firstSeen > this.windowMs) {
      this.hits.set(key, { count: 1, firstSeen: now });
      return true;
    }

    if (entry.count >= this.maxHits) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  retryAfterSeconds(key: string): number {
    const entry = this.hits.get(key);
    if (!entry) return 0;
    const elapsed = Date.now() - entry.firstSeen;
    const remaining = this.windowMs - elapsed;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }
}

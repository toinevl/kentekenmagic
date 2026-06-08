import { HttpResponseInit } from "@azure/functions";

export interface RateLimitOptions {
  readonly minWindowSeconds?: number;
  readonly maxEntries?: number;
}

export interface RateLimitEntry {
  plate: string;
  token?: string;
  lastCallEpochSeconds: number;
}

export class RateLimiter {
  readonly #options: Required<RateLimitOptions>;
  readonly #entries: Map<string, RateLimitEntry>;

  constructor(options: RateLimitOptions = {}) {
    this.#options = {
      minWindowSeconds: options.minWindowSeconds ?? 60,
      maxEntries: options.maxEntries ?? 2048
    };
    this.#entries = new Map();
  }

  tokenKey(plate: string, token: string | null): string {
    return token ? `${plate}:${token}` : plate;
  }

  allow(plate: string, token: string): { ok: boolean; waitMs: number } {
    const key = this.tokenKey(plate, token);
    const entry = this.#entries.get(key);
    const nowEpoch = Math.floor(Date.now() / 1000);

    if (!entry) {
      this.#entries.set(key, { plate, lastCallEpochSeconds: nowEpoch, ...(token ? { token } : {}) });
      this.#evict(nowEpoch);
      return { ok: true, waitMs: 0 };
    }

    const elapsedSeconds = nowEpoch - entry.lastCallEpochSeconds;
    const remainingMs = Math.max(0, (this.#options.minWindowSeconds - elapsedSeconds) * 1000);
    if (remainingMs > 0) {
      return { ok: false, waitMs: remainingMs };
    }

    entry.lastCallEpochSeconds = nowEpoch;
    this.#evict(nowEpoch);
    return { ok: true, waitMs: 0 };
  }

  #evict(nowEpoch: number): void {
    if (this.#entries.size <= this.#options.maxEntries) return;

    const entries: [string, RateLimitEntry][] = Array.from(this.#entries.entries());
    entries.sort((a, b) => a[1].lastCallEpochSeconds - b[1].lastCallEpochSeconds);

    const evictCount = Math.max(1, Math.floor(this.#options.maxEntries / 2));
    for (let i = 0; i < Math.min(evictCount, entries.length); i += 1) {
      this.#entries.delete(entries[i][0]);
    }
  }
}

export function buildRateLimit429(waitMs: number): HttpResponseInit {
  const waitSeconds = Math.ceil(waitMs / 1000);
  return {
    status: 429,
    jsonBody: {
      error: "Te veel aanvragen voor dit kenteken. Probeer het later opnieuw.",
      retryAfterSeconds: waitSeconds
    }
  };
}

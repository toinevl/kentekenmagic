export type SourceStatus = "ok" | "empty" | "error";

export interface SourceResult<T = unknown> {
  status: SourceStatus;
  data: T | null;
  latencyMs: number;
  error?: string;
}

export interface DataSource<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly timeoutMs?: number;
  readonly cacheTtlSeconds?: number;
  fetch(plate: string): Promise<T | null>;
}

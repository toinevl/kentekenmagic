import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { nowIso } from "../lib/date.js";
import { formatPlate, validatePlate } from "../lib/plate.js";
import { getVehicleCached, setVehicleCached } from "../cache/tableCache.js";
import { sourceRegistry } from "../sources/registry.js";
import type { DataSource, SourceResult } from "../sources/types.js";
import { createVehicleSessionToken } from "./session.js";
export { createVehicleSessionToken } from "./session.js";

const DEFAULT_SOURCE_TIMEOUT_MS = 3000;
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60;

function timeout<T>(ms: number, sourceId: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${sourceId} timed out after ${ms}ms`)), ms);
  });
}

function requestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function runSource(
  source: DataSource,
  plate: string,
  requestIdV: string
): Promise<SourceResult> {
  const startedAt = performance.now();

  try {
    const data = await Promise.race([
      source.fetch(plate),
      timeout(source.timeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS, source.id)
    ]);

    return {
      status: data === null ? "empty" : "ok",
      data,
      latencyMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      status: "error",
      data: null,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : "Unknown source error"
    };
  }
}

function calculateFreshness(fetchedAt: string): string {
  const fetched = new Date(fetchedAt);
  if (isNaN(fetched.getTime())) return "onbekend";
  const now = new Date();
  const diffMs = now.getTime() - fetched.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "zojuist";
  if (diffMins < 60) return `${diffMins} min geleden`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} uur geleden`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} dagen geleden`;
}

export async function vehicleLookup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestIdValue = requestId();
  const validation = validatePlate(request.params.plate);

  if (!validation.ok) {
    return {
      status: 400,
      headers: { "x-request-id": requestIdValue },
      jsonBody: { error: validation.error }
    };
  }

  const plate = validation.plate;

  const cached = await getVehicleCached(plate);

  if (cached) {
    const cachedData = cached as Record<string, unknown>;
    const displayPlate = formatPlate(plate);
    const freshness = calculateFreshness(cachedData.fetchedAt as string);
    return {
      status: 200,
      headers: {
        "x-request-id": requestIdValue,
        "cache-control": "public, max-age=3600"
      },
      jsonBody: {
        ...cachedData,
        fromCache: true,
        displayPlate,
        freshness
      }
    };
  }

  const sourceResults = await Promise.all(
    sourceRegistry.map((source) => runSource(source, plate, requestIdValue))
  );

  const cards: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const manifest: string[] = [];

  for (let index = 0; index < sourceRegistry.length; index += 1) {
    const source = sourceRegistry[index];
    const result = sourceResults[index];

    if (result.status === "ok") {
      cards[source.id] = result.data;
      manifest.push(source.id);
      continue;
    }

    if (result.status === "empty") {
      cards[source.id] = null;
      continue;
    }

    errors[source.id] = result.error ?? "Source unavailable";
    context.warn(`Source ${source.id} failed for ${plate}: ${errors[source.id]}`);
  }

  if (!cards.rdw_vehicle) {
    return {
      status: 404,
      headers: { "x-request-id": requestIdValue },
      jsonBody: {
        error: "Geen voertuig gevonden voor dit kenteken.",
        plate,
        displayPlate: formatPlate(plate),
        errors
      }
    };
  }

  const sessionToken = createVehicleSessionToken();
  const TTL_MS = 1000 * 60 * 10;

  const payload = {
    plate,
    displayPlate: formatPlate(plate),
    fetchedAt: nowIso(),
    fromCache: false,
    manifest,
    cards,
    errors,
    sources: Object.fromEntries(sourceRegistry.map((source, index) => [source.id, sourceResults[index]])),
    requestId: requestIdValue,
    sessionToken
  };

  const ttl = Math.min(...sourceRegistry.map((source) => source.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS));
  setVehicleCached(plate, payload, ttl).catch((error) => context.warn("Vehicle cache write failed", error));

  return {
    status: 200,
    headers: {
      "x-request-id": requestIdValue,
      "cache-control": `public, max-age=${ttl}`
    },
    cookies: [{
      name: "vehicleSessionToken",
      value: sessionToken,
      httpOnly: true,
      path: "/",
      sameSite: "Lax" as const,
      maxAge: TTL_MS / 1000
    }],
    jsonBody: payload
  };
}

app.http("vehicle", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "vehicle/{plate}",
  handler: vehicleLookup
});
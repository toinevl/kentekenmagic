import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { nowIso } from "../lib/date.js";
import { formatPlate, validatePlate } from "../lib/plate.js";
import { getVehicleCached, setVehicleCached } from "../cache/tableCache.js";
import { sourceRegistry } from "../sources/registry.js";
import type { DataSource, SourceResult } from "../sources/types.js";

const DEFAULT_SOURCE_TIMEOUT_MS = 3000;
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60;

function timeout<T>(ms: number, sourceId: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${sourceId} timed out after ${ms}ms`)), ms);
  });
}

async function runSource(source: DataSource, plate: string): Promise<SourceResult> {
  const startedAt = performance.now();

  try {
    const data = await Promise.race([source.fetch(plate), timeout(source.timeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS, source.id)]);
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

export async function vehicleLookup(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const validation = validatePlate(request.params.plate);

  if (!validation.ok) {
    return {
      status: 400,
      jsonBody: { error: validation.error }
    };
  }

  const plate = validation.plate;
  const cached = await getVehicleCached(plate);

  if (cached) {
    return {
      status: 200,
      jsonBody: {
        ...(cached as Record<string, unknown>),
        fromCache: true
      }
    };
  }

  const sourceResults = await Promise.all(sourceRegistry.map((source) => runSource(source, plate)));
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
      jsonBody: {
        error: "Geen voertuig gevonden voor dit kenteken.",
        plate,
        displayPlate: formatPlate(plate),
        errors
      }
    };
  }

  const payload = {
    plate,
    displayPlate: formatPlate(plate),
    fetchedAt: nowIso(),
    fromCache: false,
    manifest,
    cards,
    errors,
    sources: Object.fromEntries(sourceRegistry.map((source, index) => [source.id, sourceResults[index]]))
  };

  const ttl = Math.min(...sourceRegistry.map((source) => source.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS));
  setVehicleCached(plate, payload, ttl).catch((error) => context.warn("Vehicle cache write failed", error));

  return {
    status: 200,
    jsonBody: payload
  };
}

app.http("vehicle", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "vehicle/{plate}",
  handler: vehicleLookup
});

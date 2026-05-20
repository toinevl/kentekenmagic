import { TableClient } from "@azure/data-tables";
import { nowIso } from "../lib/date.js";
import { normalizePlate, platePartitionKey } from "../lib/plate.js";

const VEHICLE_TABLE = "VehicleCache";
const LLM_TABLE = "LlmSummaryCache";

interface CacheEntity {
  partitionKey: string;
  rowKey: string;
  data: string;
  fetchedAt: string;
  expiresAt: string;
  dataHash?: string;
}

function connectionString(): string | null {
  return process.env.AZURE_STORAGE_CONNECTION_STRING ?? process.env.AzureWebJobsStorage ?? null;
}

function tableClient(tableName: string): TableClient | null {
  const connection = connectionString();
  if (!connection) return null;
  return TableClient.fromConnectionString(connection, tableName);
}

async function getCachedFrom(tableName: string, plate: string): Promise<unknown | null> {
  const normalized = normalizePlate(plate);
  const client = tableClient(tableName);
  if (!client) return null;

  try {
    const entity = await client.getEntity<CacheEntity>(platePartitionKey(normalized), normalized);
    if (new Date(entity.expiresAt).getTime() <= Date.now()) {
      client.deleteEntity(entity.partitionKey, entity.rowKey).catch(() => undefined);
      return null;
    }

    return JSON.parse(entity.data);
  } catch (error) {
    if (typeof error === "object" && error && "statusCode" in error && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

async function setCachedIn(tableName: string, plate: string, payload: unknown, ttlSeconds: number): Promise<void> {
  const normalized = normalizePlate(plate);
  const client = tableClient(tableName);
  if (!client) return;

  const fetchedAt = nowIso();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await client.upsertEntity(
    {
      partitionKey: platePartitionKey(normalized),
      rowKey: normalized,
      data: JSON.stringify(payload),
      fetchedAt,
      expiresAt
    },
    "Replace"
  );
}

export function getVehicleCached(plate: string): Promise<unknown | null> {
  return getCachedFrom(VEHICLE_TABLE, plate);
}

export function setVehicleCached(plate: string, payload: unknown, ttlSeconds: number): Promise<void> {
  return setCachedIn(VEHICLE_TABLE, plate, payload, ttlSeconds);
}

export function getLlmCached(plate: string): Promise<unknown | null> {
  return getCachedFrom(LLM_TABLE, plate);
}

export function setLlmCached(plate: string, payload: unknown, ttlSeconds: number): Promise<void> {
  return setCachedIn(LLM_TABLE, plate, payload, ttlSeconds);
}

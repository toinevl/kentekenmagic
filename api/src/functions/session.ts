import { randomBytes } from "node:crypto";

const TOKEN_SEGMENT_BYTES = 8;
const PREFIX = "veh_";

export type VehicleSessionToken = string;

export function createVehicleSessionToken(): VehicleSessionToken {
  return `${PREFIX}${randomBytes(TOKEN_SEGMENT_BYTES).toString("hex")}`;
}

export function isValidVehicleSessionToken(token: string): token is VehicleSessionToken {
  if (typeof token !== "string") return false;
  if (!token.startsWith(PREFIX)) return false;
  const suffix = token.slice(PREFIX.length);
  if (suffix.length !== TOKEN_SEGMENT_BYTES * 2) return false;
  return /^[0-9a-f]+$/i.test(suffix);
}

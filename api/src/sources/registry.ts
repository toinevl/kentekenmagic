import { rdwFuel } from "./rdwFuel.js";
import { rdwVehicle } from "./rdwVehicle.js";
import { rdwApkHistory } from "./rdwApkHistory.js";
import { rdwRecallStatus } from "./rdwRecallStatus.js";
import { rdwModifications } from "./rdwModifications.js";
import type { DataSource } from "./types.js";

export const sourceRegistry: DataSource[] = [rdwVehicle, rdwFuel, rdwApkHistory, rdwRecallStatus, rdwModifications];

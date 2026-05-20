import { rdwFuel } from "./rdwFuel.js";
import { rdwVehicle } from "./rdwVehicle.js";
import type { DataSource } from "./types.js";

export const sourceRegistry: DataSource[] = [rdwVehicle, rdwFuel];

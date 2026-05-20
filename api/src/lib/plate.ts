export function normalizePlate(raw: string | undefined): string {
  return (raw ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function formatPlate(raw: string): string {
  const plate = normalizePlate(raw);

  if (plate.length <= 2) return plate;
  if (plate.length <= 4) return `${plate.slice(0, 2)}-${plate.slice(2)}`;
  if (plate.length <= 6) return `${plate.slice(0, 2)}-${plate.slice(2, 4)}-${plate.slice(4)}`;

  return `${plate.slice(0, 2)}-${plate.slice(2, 5)}-${plate.slice(5)}`;
}

export function validatePlate(raw: string | undefined): { ok: true; plate: string } | { ok: false; error: string } {
  const plate = normalizePlate(raw);

  if (plate.length < 5) {
    return { ok: false, error: "Kenteken is te kort." };
  }

  if (plate.length > 8) {
    return { ok: false, error: "Kenteken is te lang." };
  }

  if (!/[0-9]/.test(plate) || !/[A-Z]/.test(plate)) {
    return { ok: false, error: "Ongeldig kenteken." };
  }

  return { ok: true, plate };
}

export function platePartitionKey(plate: string): string {
  return normalizePlate(plate).slice(0, 2);
}

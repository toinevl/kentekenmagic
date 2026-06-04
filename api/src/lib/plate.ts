export function normalizePlate(raw: string | undefined): string {
  return (raw ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function formatPlate(raw: string): string {
  const plate = normalizePlate(raw);
  if (plate.length <= 2) return plate;

  // Current accepted Dutch license-plate schemes
  // https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_the_Netherlands
  if (/^[A-Z]\d{3}[A-Z]{2}$/.test(plate)) return `${plate.slice(0,1)}-${plate.slice(1,4)}-${plate.slice(4)}`; // A-001-AA
  if (/^[A-Z]{2}\d{3}[A-Z]$/.test(plate)) return `${plate.slice(0,2)}-${plate.slice(2,5)}-${plate.slice(5)}`; // AA-001-A
  if (/^\d\d[A-Z]{3}\d$/.test(plate)) return `${plate.slice(0,2)}-${plate.slice(2,5)}-${plate.slice(5)}`; // 00-AAA-1
  if (/^\d[A-Z]{3}\d\d$/.test(plate)) return `${plate.slice(0,1)}-${plate.slice(1,4)}-${plate.slice(4)}`; // 0-AAA-01
  if (/^[A-Z]{3}\d{2}[A-Z]$/.test(plate)) return `${plate.slice(0,3)}-${plate.slice(3,5)}-${plate.slice(5)}`; // AAA-01-A
  if (/^[A-Z]\d{2}[A-Z]{3}$/.test(plate)) return `${plate.slice(0,1)}-${plate.slice(1,3)}-${plate.slice(3)}`; // A-01-AAA
  if (/^\d[A-Z]{2}\d{3}$/.test(plate)) return `${plate.slice(0,1)}-${plate.slice(1,3)}-${plate.slice(3)}`; // 0-AA-001

  // Fallback for unknown or legacy formats: keep stable length-based grouping
  if (plate.length <= 4) return `${plate.slice(0,2)}-${plate.slice(2)}`;
  if (plate.length <= 6) return `${plate.slice(0,2)}-${plate.slice(2,4)}-${plate.slice(4)}`;
  return `${plate.slice(0,2)}-${plate.slice(2,5)}-${plate.slice(5)}`;
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

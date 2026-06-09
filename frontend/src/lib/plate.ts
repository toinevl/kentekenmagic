export type PlateValidation =
  | { ok: true; normalized: string; display: string }
  | { ok: false; normalized: string; message: string };

const MIN_PLATE_LENGTH = 5;
const MAX_PLATE_LENGTH = 8;

export function normalizePlate(input: string): string {
  return input.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function formatPlate(input: string): string {
  const normalized = normalizePlate(input);

  if (normalized.length <= 2) return normalized;

  // Current accepted Dutch license-plate schemes
  // https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_the_Netherlands
  if (/^[A-Z]\d{3}[A-Z]{2}$/.test(normalized)) return `${normalized.slice(0, 1)}-${normalized.slice(1, 4)}-${normalized.slice(4)}`; // A-001-AA
  if (/^[A-Z]{2}\d{3}[A-Z]$/.test(normalized)) return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`; // AA-001-A
  if (/^\d{2}[A-Z]{3}\d$/.test(normalized)) return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`; // 00-AAA-1
  if (/^\d[A-Z]{3}\d{2}$/.test(normalized)) return `${normalized.slice(0, 1)}-${normalized.slice(1, 4)}-${normalized.slice(4)}`; // 0-AAA-01
  if (/^[A-Z]{3}\d{2}[A-Z]$/.test(normalized)) return `${normalized.slice(0, 3)}-${normalized.slice(3, 5)}-${normalized.slice(5)}`; // AAA-01-A
  if (/^[A-Z]\d{2}[A-Z]{3}$/.test(normalized)) return `${normalized.slice(0, 1)}-${normalized.slice(1, 3)}-${normalized.slice(3)}`; // A-01-AAA
  if (/^\d[A-Z]{2}\d{3}$/.test(normalized)) return `${normalized.slice(0, 1)}-${normalized.slice(1, 3)}-${normalized.slice(3)}`; // 0-AA-001

  // Fallback for unknown or legacy formats: keep stable length-based grouping
  if (normalized.length <= 4) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  if (normalized.length <= 6) return `${normalized.slice(0, 2)}-${normalized.slice(2, 4)}-${normalized.slice(4)}`;
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
}

export function validatePlate(input: string): PlateValidation {
  const normalized = normalizePlate(input);

  if (normalized.length < MIN_PLATE_LENGTH) {
    return {
      ok: false,
      normalized,
      message: "Vul minimaal 5 letters of cijfers in."
    };
  }

  if (normalized.length > MAX_PLATE_LENGTH) {
    return {
      ok: false,
      normalized,
      message: "Dit kenteken is te lang voor een Nederlandse lookup."
    };
  }

  if (!/[0-9]/.test(normalized) || !/[A-Z]/.test(normalized)) {
    return {
      ok: false,
      normalized,
      message: "Een kenteken bevat altijd letters én cijfers."
    };
  }

  return {
    ok: true,
    normalized,
    display: formatPlate(normalized)
  };
}

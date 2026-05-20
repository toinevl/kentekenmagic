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
  if (normalized.length <= 4) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  if (normalized.length <= 6) {
    return `${normalized.slice(0, 2)}-${normalized.slice(2, 4)}-${normalized.slice(4)}`;
  }

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

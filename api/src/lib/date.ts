export function parseRdwDate(value: string | undefined): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return `${year}-${month}-${day}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

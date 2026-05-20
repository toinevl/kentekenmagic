"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Calendar, CarFront, Droplet, Info, Loader2, Search, ShieldCheck, Sparkles, Weight } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { lookupVehicle, enrichVehicle, VehicleLookupResponse, EnrichmentResponse, EnrichmentInsight, RdwVehicle, RdwFuel } from "@/lib/api";
import { formatPlate, normalizePlate, validatePlate } from "@/lib/plate";

const queryClient = new QueryClient();

export function LookupExperience() {
  return (
    <QueryClientProvider client={queryClient}>
      <LookupShell />
    </QueryClientProvider>
  );
}

function LookupShell() {
  const [rawPlate, setRawPlate] = useState("");
  const [submittedPlate, setSubmittedPlate] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  const formattedInput = useMemo(() => formatPlate(rawPlate), [rawPlate]);

  const query = useQuery({
    queryKey: ["vehicle", submittedPlate],
    queryFn: () => lookupVehicle(submittedPlate ?? ""),
    enabled: Boolean(submittedPlate),
    retry: 1
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validatePlate(rawPlate);

    if (!validation.ok) {
      setValidationMessage(validation.message);
      setSubmittedPlate(null);
      return;
    }

    setValidationMessage(null);
    setSubmittedPlate(validation.normalized);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-8 lg:px-10">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl grid-rows-[auto_1fr] gap-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[var(--foreground)] text-[var(--plate)]">
              <CarFront size={21} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">KentekenMagic</p>
              <h1 className="text-2xl font-semibold sm:text-3xl">RDW inzicht, zonder zoekwerk</h1>
            </div>
          </div>
        </header>

        <div className="grid content-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-start">
          <motion.section
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6"
          >
            <form onSubmit={onSubmit} className="grid gap-5">
              <label htmlFor="plate" className="text-sm font-medium text-[var(--muted)]">
                Kenteken
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="plate"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={formattedInput}
                  onChange={(event) => setRawPlate(normalizePlate(event.target.value))}
                  className="h-16 min-w-0 flex-1 rounded-md border-2 border-[var(--plate-edge)] bg-[var(--plate)] px-4 text-center text-3xl font-black uppercase text-black outline-none transition focus:ring-4 focus:ring-teal-200"
                  placeholder="AB-12-CD"
                  aria-describedby={validationMessage ? "plate-error" : undefined}
                />
                <motion.button
                  type="submit"
                  whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                  className="inline-flex h-16 items-center justify-center gap-2 rounded-md bg-[var(--foreground)] px-6 font-semibold text-white transition hover:bg-black focus:outline-none focus:ring-4 focus:ring-teal-200"
                >
                  {query.isFetching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                  Zoek
                </motion.button>
              </div>
              {validationMessage ? (
                <p id="plate-error" className="flex items-center gap-2 text-sm font-medium text-[var(--danger)]">
                  <AlertTriangle size={16} />
                  {validationMessage}
                </p>
              ) : null}
            </form>
          </motion.section>

          <section className="grid gap-4">
            {!submittedPlate && !query.data ? <EmptyState /> : null}
            {query.isFetching ? <LoadingCards plate={submittedPlate ?? normalizePlate(rawPlate)} /> : null}
            {query.error ? <ErrorState message={(query.error as Error).message} /> : null}
            {query.data ? <ResultPreview data={query.data} /> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-white/55 p-6">
      <div className="mb-4 inline-grid size-10 place-items-center rounded-md bg-teal-50 text-[var(--accent)]">
        <Sparkles size={20} />
      </div>
      <h2 className="text-xl font-semibold">Begin met een kenteken.</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        De eerste versie toont RDW basisgegevens, APK-status, brandstofinformatie en de belangrijkste signalen in losse kaarten.
      </p>
    </div>
  );
}

function LoadingCards({ plate }: { plate: string }) {
  return (
    <>
      <article className="min-h-40 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-medium text-[var(--muted)]">{formatPlate(plate)}</p>
        <div className="h-8 w-2/3 animate-pulse rounded bg-stone-200" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="h-16 animate-pulse rounded-md bg-stone-100" />
          <div className="h-16 animate-pulse rounded-md bg-stone-100" />
          <div className="h-16 animate-pulse rounded-md bg-stone-100" />
        </div>
      </article>
      <article className="min-h-32 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded bg-stone-200" />
        <div className="mt-4 h-14 animate-pulse rounded-md bg-stone-100" />
      </article>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDutchDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatKg(value: string | undefined): string {
  if (!value) return "—";
  const n = parseInt(value, 10);
  return isNaN(n) ? "—" : `${n.toLocaleString("nl-NL")} kg`;
}

function formatCm(value: string | undefined): string {
  if (!value) return "—";
  const n = parseInt(value, 10);
  return isNaN(n) ? "—" : `${(n / 100).toFixed(1)} m`;
}

function apkStatus(apkExpiry: string | null): "valid" | "soon" | "expired" | "unknown" {
  if (!apkExpiry) return "unknown";
  const expiry = new Date(apkExpiry);
  if (isNaN(expiry.getTime())) return "unknown";
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "soon";
  return "valid";
}

// ── ResultPreview ─────────────────────────────────────────────────────────────

function ResultPreview({ data }: { data: VehicleLookupResponse }) {
  const plate = data.displayPlate ?? formatPlate(data.plate);
  const vehicle = data.cards.rdw_vehicle as RdwVehicle | undefined;
  const fuels = (data.cards.rdw_fuel ?? []) as RdwFuel[];

  const enrichQuery = useQuery({
    queryKey: ["enrich", data.plate],
    queryFn: () => enrichVehicle(data.plate),
    retry: 0,
    staleTime: 7 * 24 * 60 * 60 * 1000
  });

  return (
    <>
      <IdentityCard plate={plate} fromCache={data.fromCache} vehicle={vehicle} />
      <ApkCard vehicle={vehicle} />
      <TechCard vehicle={vehicle} />
      <FuelCard vehicle={vehicle} fuels={fuels} />
      <RegistrationCard vehicle={vehicle} />
      <EnrichmentCard query={enrichQuery} />
    </>
  );
}

// ── Card 1: Vehicle identity ──────────────────────────────────────────────────

function IdentityCard({
  plate,
  fromCache,
  vehicle,
}: {
  plate: string;
  fromCache?: boolean;
  vehicle: RdwVehicle | undefined;
}) {
  const makeModel = [vehicle?.merk, vehicle?.handelsbenaming].filter(Boolean).join(" ");

  const chips: string[] = [
    vehicle?.voertuigsoort,
    vehicle?.inrichting,
    vehicle?.eerste_kleur,
    vehicle?.tweede_kleur && vehicle.tweede_kleur !== vehicle.eerste_kleur ? vehicle.tweede_kleur : undefined,
    vehicle?.aantal_zitplaatsen ? `${vehicle.aantal_zitplaatsen} zitplaatsen` : undefined,
    vehicle?.aantal_deuren ? `${vehicle.aantal_deuren} deuren` : undefined,
  ].filter((v): v is string => Boolean(v));

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">Genormaliseerd kenteken</p>
          <h2 className="mt-2 inline-block rounded-md border-2 border-black bg-[var(--plate)] px-3 py-2 text-3xl font-black text-black">
            {plate}
          </h2>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 shrink-0">
          {fromCache ? "Cache" : "Live"}
        </span>
      </div>
      {makeModel ? (
        <p className="mt-4 text-2xl font-bold tracking-tight">{makeModel}</p>
      ) : null}
      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[var(--line)] bg-stone-50 px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--foreground)]"
            >
              {chip.toLowerCase()}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

// ── Card 2: APK status ────────────────────────────────────────────────────────

function ApkCard({ vehicle }: { vehicle: RdwVehicle | undefined }) {
  const expiry = vehicle?.dates?.apkExpiry ?? null;
  const status = apkStatus(expiry);
  const hasRecall = vehicle?.openstaande_terugroepactie_indicator === "Ja";

  const statusStyles = {
    valid: {
      border: "border-green-200",
      bg: "bg-green-50",
      icon: "text-green-600",
      label: "text-green-800",
      badge: "bg-green-100 text-green-800",
      text: "Geldig",
    },
    soon: {
      border: "border-amber-200",
      bg: "bg-amber-50",
      icon: "text-amber-600",
      label: "text-amber-800",
      badge: "bg-amber-100 text-amber-800",
      text: "Verloopt binnenkort",
    },
    expired: {
      border: "border-red-200",
      bg: "bg-red-50",
      icon: "text-red-600",
      label: "text-red-800",
      badge: "bg-red-100 text-red-800",
      text: "Verlopen",
    },
    unknown: {
      border: "border-[var(--line)]",
      bg: "bg-white",
      icon: "text-[var(--muted)]",
      label: "text-[var(--foreground)]",
      badge: "bg-stone-100 text-stone-600",
      text: "Onbekend",
    },
  }[status];

  return (
    <article className={`rounded-lg border ${statusStyles.border} ${statusStyles.bg} p-5 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`inline-grid size-8 place-items-center rounded-md bg-white/70 ${statusStyles.icon}`}>
            <ShieldCheck size={18} />
          </div>
          <p className={`text-sm font-semibold ${statusStyles.label}`}>APK</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles.badge}`}>
            {statusStyles.text}
          </span>
          {hasRecall ? (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
              Terugroepactie
            </span>
          ) : null}
        </div>
      </div>
      <p className={`mt-3 text-2xl font-bold ${statusStyles.label}`}>{formatDutchDate(expiry)}</p>
      <p className={`mt-0.5 text-xs ${statusStyles.label} opacity-70`}>Vervaldatum APK</p>
    </article>
  );
}

// ── Card 3: Technical specs ───────────────────────────────────────────────────

function TechCard({ vehicle }: { vehicle: RdwVehicle | undefined }) {
  const rows: { label: string; value: string }[] = [
    { label: "Gewicht", value: formatKg(vehicle?.massa_rijklaar) },
    { label: "Max gewicht", value: formatKg(vehicle?.toegestane_maximum_massa_voertuig) },
    { label: "Trekgewicht", value: formatKg(vehicle?.maximum_trekken_massa_geremd) },
    {
      label: "Afmetingen (l×b×h)",
      value:
        vehicle?.lengte || vehicle?.breedte || vehicle?.hoogte_voertuig
          ? `${formatCm(vehicle?.lengte)} × ${formatCm(vehicle?.breedte)} × ${formatCm(vehicle?.hoogte_voertuig)}`
          : "—",
    },
  ];

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="inline-grid size-8 place-items-center rounded-md bg-stone-100 text-[var(--foreground)]">
          <Weight size={18} />
        </div>
        <p className="text-sm font-semibold">Technische specs</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-[var(--muted)]">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

// ── Card 4: Fuel & environment ────────────────────────────────────────────────

function FuelCard({ vehicle, fuels }: { vehicle: RdwVehicle | undefined; fuels: RdwFuel[] }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="inline-grid size-8 place-items-center rounded-md bg-stone-100 text-[var(--foreground)]">
          <Droplet size={18} />
        </div>
        <p className="text-sm font-semibold">Brandstof & milieu</p>
      </div>
      {fuels.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Geen brandstofgegevens beschikbaar</p>
      ) : (
        <ul className="space-y-2">
          {fuels.map((fuel, i) => (
            <li key={fuel.brandstof_volgnummer ?? i} className="flex items-center justify-between gap-3 rounded-md bg-stone-50 px-3 py-2 text-sm">
              <span className="font-medium">{fuel.brandstof_omschrijving ?? "—"}</span>
              {fuel.emissiecode_omschrijving ? (
                <span className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-xs text-[var(--muted)]">
                  {fuel.emissiecode_omschrijving}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {vehicle?.zuinigheidsclassificatie ? (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Energielabel</span>
          <span className="inline-flex size-7 items-center justify-center rounded bg-green-600 text-xs font-black text-white">
            {vehicle.zuinigheidsclassificatie}
          </span>
        </div>
      ) : null}
    </article>
  );
}

// ── Card 5: Registration & history ────────────────────────────────────────────

function RegistrationCard({ vehicle }: { vehicle: RdwVehicle | undefined }) {
  const isExport = vehicle?.export_indicator === "Ja";

  const rows: { label: string; value: string }[] = [
    { label: "Eerste toelating", value: formatDutchDate(vehicle?.dates?.firstAdmission) },
    { label: "Eerste NL tenaamstelling", value: formatDutchDate(vehicle?.dates?.firstDutchRegistration) },
    { label: "Huidige tenaamstelling", value: formatDutchDate(vehicle?.dates?.currentRegistration) },
  ];

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-grid size-8 place-items-center rounded-md bg-stone-100 text-[var(--foreground)]">
            <Calendar size={18} />
          </div>
          <p className="text-sm font-semibold">Registratie & historie</p>
        </div>
        <div className="flex items-center gap-2">
          {vehicle?.tellerstandoordeel ? (
            <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
              <Info size={11} />
              {vehicle.tellerstandoordeel}
            </span>
          ) : null}
          {isExport ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Export
            </span>
          ) : null}
        </div>
      </div>
      <dl className="space-y-3">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0">
            <dt className="text-xs text-[var(--muted)]">{label}</dt>
            <dd className="text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

// ── Enrichment card (AI) ──────────────────────────────────────────────────────

const toneStyles = {
  positive: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  neutral: "bg-stone-50 border-[var(--line)] text-[var(--foreground)]"
} satisfies Record<EnrichmentInsight["tone"], string>;

function EnrichmentCard({ query }: { query: ReturnType<typeof useQuery<EnrichmentResponse>> }) {
  if (query.isLoading) {
    return (
      <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-grid size-8 place-items-center rounded-md bg-teal-50 text-[var(--accent)]">
            <Sparkles size={18} />
          </div>
          <p className="text-sm font-semibold">AI-verrijking</p>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-stone-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-stone-100" />
        </div>
      </article>
    );
  }

  if (query.isError || !query.data) return null;

  const { summary, insights, generated } = query.data;

  return (
    <article className="rounded-lg border border-teal-100 bg-teal-50/30 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-grid size-8 place-items-center rounded-md bg-teal-100 text-teal-700">
            <Sparkles size={18} />
          </div>
          <p className="text-sm font-semibold text-teal-900">AI-verrijking</p>
        </div>
        {generated ? (
          <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
            Gegenereerd
          </span>
        ) : null}
      </div>
      {summary ? <p className="text-sm leading-relaxed text-[var(--foreground)]">{summary}</p> : null}
      {insights.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {insights.map((insight, i) => (
            <li
              key={i}
              className={`rounded-md border px-3 py-2 text-xs font-medium ${toneStyles[insight.tone]}`}
            >
              {insight.text}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle size={18} />
        Lookup mislukt
      </div>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}

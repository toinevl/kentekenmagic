# Requirements

## User Stories

- As a curious visitor, I can enter a Dutch license plate in common formats and receive a clear vehicle result without creating an account.
- As a secondhand buyer, I can quickly see the highest-risk signals: APK status, open recall flag, odometer verdict, export/import context, and key specs.
- As a mobile user, I can complete the lookup comfortably with a large plate input, automatic normalization, and responsive result cards.
- As a maintainer, I can add a new public data source by creating a source module and registering a card, without rewriting the aggregator.
- As an operator, I can run the app on Azure low-cost services with caching, rate-limit protection, and no paid data dependencies.

## Functional Requirements

- Normalize Dutch plate input by stripping spaces and hyphens, uppercasing, and validating before lookup.
- Fetch core vehicle data from RDW `m9d7-ebf2` and fuel/emissions data from `8ys7-d773`.
- Return a single aggregate response from `/api/vehicle/{plate}` with a `manifest`, per-card data, source errors, timestamps, and cache metadata.
- Render core result sections as collapsible cards: overview, status, technical specs, fuel/environment, ownership context, and insights.
- Use RDW main-record fields for the v1 recall indicator and APK status before adding detailed recall/APK history.
- Cache vehicle aggregates in Azure Tables with TTL and a two-character plate-prefix `PartitionKey`.
- Provide `/api/enrich/{plate}` as a separate async LLM enrichment endpoint that reads cached vehicle data and caches output.
- Exclude user accounts, saved searches, owner identification, market price estimates, and paid data sources from v1.

## Non-Functional Requirements

- Perceived lookup should feel fast: skeletons appear immediately; warm core result target is under 2 seconds.
- Partial source failure must not fail the whole lookup; cards show unavailable/error states or hide gracefully.
- UI must use Dutch locale formatting for dates, numbers, units, and license plate presentation.
- Every external API response must be treated as optional/untrusted and validated before rendering.
- The app must support direct links and browser refreshes on result routes in Azure Static Web Apps.
- Secrets must live in local settings or Azure application settings, never in source.

## Acceptance Criteria

- A valid plate with hyphens, spaces, or lowercase characters resolves to the same normalized cache key and lookup result.
- Unknown or invalid plates produce clear UI states and non-500 API responses.
- A warm lookup returns a structured response containing at least `rdw_vehicle` and fuel/environment data when available.
- Cached lookup hits do not call RDW and include cache metadata useful for debugging.
- The frontend renders meaningful results when optional RDW fields are missing.
- LLM enrichment never blocks the main vehicle lookup and can be disabled without breaking the UI.
- New cards can be added through source/card registries with localized UI labels and isolated failure handling.

## Definition of Done

- Typecheck, lint, build, and focused tests pass locally.
- API source modules have unit tests for success, empty result, timeout/error, and normalization behavior.
- Frontend has component or integration coverage for loading, success, partial error, invalid plate, and missing-field states.
- Manual verification covers at least 10 diverse Dutch plates: recent car, older car, EV/hybrid, diesel, import, commercial van, export/special prefix, plate with open recall if available, APK-expired/near-expiry if available, and an invalid plate.
- Deployment configuration includes SWA routing, Functions settings documentation, and table creation notes.


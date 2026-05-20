# Verification

## Automated Checks

- Frontend typecheck: `npm run typecheck --workspace frontend` or equivalent once workspaces exist.
- Frontend lint: `npm run lint --workspace frontend`.
- Frontend build: `npm run build --workspace frontend`.
- API typecheck/build: `npm run build --workspace api`.
- Unit tests: `npm test` for normalization, RDW mappers, cache keys, source timeout handling, and card state rendering.

## Backend Test Matrix

| Area | Cases |
|------|-------|
| Plate normalization | Hyphens, spaces, lowercase, invalid characters, too short/long |
| RDW vehicle source | Success, empty array, 429/500, malformed payload, timeout |
| RDW fuel source | Single fuel, multiple fuels, empty result, malformed payload |
| Aggregator | All sources succeed, one source fails, all sources fail, cache hit, cache stale |
| Cache | Prefix partition key, row key normalization, TTL hit, TTL miss, JSON parse failure |
| Enrichment | Cache hit, vehicle cache missing, provider disabled, provider error, schema violation |

## Frontend Test Matrix

| Area | Cases |
|------|-------|
| Lookup form | Valid submit, invalid submit, paste formatted plate, keyboard submit |
| Loading | Skeleton dimensions stable, reduced-motion mode, retry state |
| Result cards | Full data, missing fields, partial source error, unknown card ID |
| Status logic | APK valid, APK expiring within 30 days, APK expired, recall flag yes/no |
| Locale | Dutch date format, Dutch number format, license plate display with hyphens |
| Responsive | Mobile 375px, tablet, desktop, large desktop |

## Manual Plate Set

Keep a running list while implementing. The final release should include at least:

- Recent passenger car.
- Older passenger car.
- Electric vehicle.
- Hybrid vehicle.
- Diesel vehicle.
- Imported vehicle.
- Commercial van.
- Plate with open recall, if found.
- APK expired or near-expiry, if found.
- Invalid plate and plausible but not found plate.

## Release Criteria

- All automated checks pass.
- Manual test matrix has evidence in notes or screenshots.
- Production smoke test confirms `/`, a valid lookup route, invalid lookup state, and `/api/vehicle/{plate}`.
- Azure Tables cache contains normalized keys and expected TTL fields.
- LLM enrichment is either verified working and cached, or explicitly disabled with graceful UI behavior.


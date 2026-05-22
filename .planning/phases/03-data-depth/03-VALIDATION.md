---
phase: 3
slug: data-depth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `api/` default Vitest + TypeScript esbuild |
| **Quick run command** | `npm run test:unit -- sources/rdw*.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -- sources/rdw*.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| rdwApkHistory loads inspections | TBD | 1 | D-01 | unit | `vitest api/src/__tests__/sources/rdwApkHistory.test.ts` | ❌ W0 | ⬜ pending |
| rdwApkHistory joins defects by compound key | TBD | 1 | D-03 | unit | (same) | ❌ W0 | ⬜ pending |
| rdwApkHistory sorts descending by date | TBD | 1 | D-02 | unit | (same) | ❌ W0 | ⬜ pending |
| rdwApkHistory timeout: partial data if defects time out | TBD | 1 | D-06 | unit | (same) | ❌ W0 | ⬜ pending |
| rdwApkHistory returns null if no inspections | TBD | 1 | D-01 | unit | (same) | ❌ W0 | ⬜ pending |
| rdwRecallStatus fetches and joins recall details | TBD | 1 | D-05 | unit | `vitest api/src/__tests__/sources/rdwRecallStatus.test.ts` | ❌ W0 | ⬜ pending |
| rdwRecallStatus returns empty recalls if no status | TBD | 1 | D-05 | unit | (same) | ❌ W0 | ⬜ pending |
| rdwModifications parses active/removed dates correctly | TBD | 1 | D-05 | unit | `vitest api/src/__tests__/sources/rdwModifications.test.ts` | ❌ W0 | ⬜ pending |
| rdwModifications filters "0" as "not removed" | TBD | 1 | D-05 | unit | (same) | ❌ W0 | ⬜ pending |
| ApkTimelineCard renders last 5 inspections | TBD | 2 | D-02 | integration | `vitest frontend/__tests__/components/ApkTimelineCard.test.tsx` | ❌ W0 | ⬜ pending |
| ApkTimelineCard "show more" toggle reveals older | TBD | 2 | D-02 | integration | (same) | ❌ W0 | ⬜ pending |
| RecallCard renders open/repaired status badges | TBD | 2 | D-05 | integration | `vitest frontend/__tests__/components/RecallCard.test.tsx` | ❌ W0 | ⬜ pending |
| ModificationsCard renders active and removed | TBD | 2 | D-05 | integration | `vitest frontend/__tests__/components/ModificationsCard.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/src/__tests__/sources/rdwApkHistory.test.ts` — success, empty, timeout, defect join
- [ ] `api/src/__tests__/sources/rdwRecallStatus.test.ts` — success, no recalls, missing details
- [ ] `api/src/__tests__/sources/rdwModifications.test.ts` — active/removed, null manufacturer
- [ ] `frontend/__tests__/components/ApkTimelineCard.test.tsx` — render, toggle, error state
- [ ] `frontend/__tests__/components/RecallCard.test.tsx` — open/repaired status
- [ ] `frontend/__tests__/components/ModificationsCard.test.tsx` — empty state, active filter
- [ ] `api/package.json` — verify `test` and `test:unit` scripts configured for Vitest

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| APK timeline visually replaces old ApkCard (no duplicate) | Visual confirmation | Load a known plate, verify only one APK section renders |
| Recall status badge color-coding (open=red, repaired=green) | Visual/color | Check RecallCard with `TESTPLATE` that has open recall |
| "Show more" toggle animation and scroll | Visual/motion | Expand inspections > 5, confirm smooth reveal |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

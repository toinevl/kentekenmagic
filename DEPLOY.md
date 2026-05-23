# KentekenMagic — Azure Provisioning Runbook

This runbook takes the project from zero Azure resources to a live production deployment.
Complete Steps 1–7 in order. All commands require Azure CLI installed and authenticated.

---

## Prerequisites

- **Azure CLI** installed and authenticated: run `az login`
- **GitHub repo access** with Settings > Secrets and variables > Actions write permission
- **Socrata RDW app token** — register at [data.overheid.nl](https://data.overheid.nl) (free)
- **Anthropic API key** — from [console.anthropic.com](https://console.anthropic.com)

---

## Step 1: Create Resource Group

```bash
az group create \
  --name kentekenmagic-rg \
  --location westeurope
```

**Verify:**

```bash
az group show --name kentekenmagic-rg --query "properties.provisioningState" -o tsv
# Expected: Succeeded
```

---

## Step 2: Create Static Web Apps Resource

```bash
az staticwebapp create \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --location westeurope \
  --sku Free
```

> **Important:** Do NOT link the SWA to GitHub via the Azure Portal. The Portal auto-generates
> a deployment workflow with a randomised secret name (e.g. `AZURE_STATIC_WEB_APPS_API_TOKEN_GENTLE_WATER_ABC123`)
> that will conflict with the manually-named secret in Step 3. Use the CLI only.

**Verify:**

```bash
az staticwebapp show \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --query "defaultHostname" -o tsv
# Expected: kentekenmagic.azurestaticapps.net (or similar)
```

---

## Step 3: Get Deployment Token and Add GitHub Secret

```bash
az staticwebapp secrets list \
  --name kentekenmagic \
  --query "properties.apiKey" \
  -o tsv
```

Copy the output value. Then add it as a GitHub repository secret:

1. Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Value: the token you copied

---

## Step 4: Create Storage Account

> Storage account names are globally unique, 3–24 characters, lowercase letters and digits only.
> If `kentekenmagicstorage` is already taken, append a short suffix (e.g. `kentekenmagic1234`).

```bash
az storage account create \
  --name kentekenmagicstorage \
  --resource-group kentekenmagic-rg \
  --location westeurope \
  --sku Standard_LRS \
  --kind StorageV2
```

**Verify:**

```bash
az storage account show \
  --name kentekenmagicstorage \
  --resource-group kentekenmagic-rg \
  --query "provisioningState" -o tsv
# Expected: Succeeded
```

---

## Step 5: Create Cache Tables

```bash
# Capture connection string into a shell variable
CONN_STR=$(az storage account show-connection-string \
  --name kentekenmagicstorage \
  --resource-group kentekenmagic-rg \
  -o tsv)

# Create both cache tables
az storage table create --name VehicleCache     --connection-string "$CONN_STR"
az storage table create --name LlmSummaryCache  --connection-string "$CONN_STR"
```

**Verify:**

```bash
az storage table list --connection-string "$CONN_STR" --query "[].name" -o tsv
# Expected: LlmSummaryCache and VehicleCache listed
```

---

## Step 6: Set Application Settings

Use the same `$CONN_STR` variable from Step 5 (or re-export it if you opened a new shell).
Replace the placeholder values with your real keys before running.

```bash
az staticwebapp appsettings set \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --setting-names \
    "FUNCTIONS_WORKER_RUNTIME=node" \
    "AZURE_STORAGE_CONNECTION_STRING=$CONN_STR" \
    "RDW_APP_TOKEN=<your-socrata-token>" \
    "ANTHROPIC_API_KEY=<your-anthropic-key>"
```

> `OPENAI_API_KEY` is intentionally omitted — the app uses Anthropic only (decision D-08).

**Verify:**

```bash
az staticwebapp appsettings list \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --query "[].name" -o tsv
# Expected: FUNCTIONS_WORKER_RUNTIME, AZURE_STORAGE_CONNECTION_STRING,
#           RDW_APP_TOKEN, ANTHROPIC_API_KEY
```

---

## Step 7: Trigger First Deploy

**Option A** — Push a commit to `main`. The `deploy.yml` workflow runs automatically.

**Option B** — Manual trigger: GitHub repo > **Actions** > **Deploy to Azure Static Web Apps** > **Run workflow** > select `main`.

Monitor progress in the **Actions** tab. The deploy step takes 2–4 minutes.

---

## Step 8: Verify Deployment

```bash
az staticwebapp show \
  --name kentekenmagic \
  --query "defaultHostname" -o tsv
```

Navigate to `https://<defaultHostname>` in a browser. The KentekenMagic homepage should load.

---

## Smoke Test (after Step 7)

Run after the first successful deploy. Replace `<hostname>` with the value from Step 8.

### 1. Deep-link fallback (routing)

Navigate directly in a browser — do not go via the homepage first:

```
https://<hostname>/kenteken/PF655T
```

Expected: the vehicle lookup page loads with data for plate PF655T.
Failure: 404 or blank page — `staticwebapp.config.json` did not land in `out/` (see Troubleshooting #1).

### 2. API response

```bash
curl -s https://<hostname>/api/vehicle/PF655T | head -100
```

Expected: JSON containing `"kenteken": "PF655T"` with vehicle fields populated.
Failure: 500 or worker startup error — `api/dist/` was not compiled (see Troubleshooting #2).

### 3. Cache hit

Run the same curl twice:

```bash
curl -s https://<hostname>/api/vehicle/PF655T > /dev/null
curl -s https://<hostname>/api/vehicle/PF655T
```

Expected: second response has `"cacheHit": true` (or equivalent cache metadata).

### 4. Enrichment endpoint

```bash
curl -s -X POST https://<hostname>/api/enrich/PF655T
```

Expected: JSON with `summary` and `insights` fields. First call may take 5–15 seconds.

### 5. Three diverse plates

Look up at least 3 different real Dutch plates in the browser (e.g. `PF655T`, an older plate
such as `AB1234`, a recent plate). All should return data and render without errors.

### 6. Cold start timing (recommended)

```bash
time curl -s https://<hostname>/api/vehicle/PF655T > /dev/null
# Wait 5 minutes idle, then repeat
time curl -s https://<hostname>/api/vehicle/PF655T > /dev/null
```

Note wall-clock time for the first call after an idle period vs. a warm call.
Document both times in this file or in README.md.

---

## Application Insights (optional)

Add the connection string as an application setting:

```bash
az staticwebapp appsettings set \
  --name kentekenmagic \
  --resource-group kentekenmagic-rg \
  --setting-names \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=<your-appinsights-connection-string>"
```

KQL query for cold start measurement (run in Azure Portal > Application Insights > Logs):

```kql
requests
| where name contains "vehicle"
| where timestamp > ago(24h)
| summarize count(), avg(duration), percentile(duration, 95), max(duration) by bin(timestamp, 1h)
| order by timestamp desc
```

First invocation after idle period = cold start. Compare `max` vs `avg` duration to see the delta.

---

## Troubleshooting

| # | Symptom | Root Cause | Fix |
|---|---------|------------|-----|
| 1 | Deep links return 404 | `staticwebapp.config.json` not in `out/` at deploy time | Confirm file is at `frontend/public/staticwebapp.config.json` — Next.js copies `public/` to `out/` automatically |
| 2 | Functions return 500 or are not found | `api/dist/` missing or stale | Confirm `npm run build --workspace api` runs before the SWA deploy action in `deploy.yml` |
| 3 | Cache always misses; every lookup hits RDW | `AZURE_STORAGE_CONNECTION_STRING` not set | Re-run Step 6 with the correct connection string |
| 4 | Deploy succeeds but site shows SWA placeholder page | `output_location` resolved to wrong path | Change `output_location` in `deploy.yml` from `"out"` to `"frontend/out"` |
| 5 | Deploy fails with "Deployment token is not valid" | Secret name mismatch | Do not use the Portal-linked workflow; use the manually created `AZURE_STATIC_WEB_APPS_API_TOKEN` secret from Step 3 |
| 6 | `az storage account create` fails | Storage account name taken globally | Append a short suffix: `kentekenmagic1234` (use last 4 chars of your subscription ID) |

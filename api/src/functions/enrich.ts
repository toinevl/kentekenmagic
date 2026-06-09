import Anthropic from "@anthropic-ai/sdk";
import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { generateRequestId } from "../lib/requestId.js";
import { getLlmCached, getVehicleCached, setLlmCached } from "../cache/tableCache.js";
import { RateLimiter } from "../lib/rateLimiter.js";
import { validatePlate } from "../lib/plate.js";
import { isValidVehicleSessionToken } from "../lib/session.js";

const LLM_TTL_SECONDS = 7 * 24 * 60 * 60;
const enrichLimiter = new RateLimiter();

export interface EnrichmentPayload {
  summary: string;
  insights: Array<{ tone: "neutral" | "positive" | "warning"; text: string }>;
  generated: boolean;
}

const SYSTEM_PROMPT = `Je bent een objectieve assistent die officiële RDW-voertuiggegevens samenvat.
Regels:
- Vat uitsluitend de aangeleverde feiten samen. Verzin geen specificaties.
- Noem nooit eigenaarsinformatie of eigenaarshistorie.
- Geef maximaal 3 inzichten. Elke inzicht is kort (max 15 woorden).
- Schrijf in helder, vriendelijk Nederlands.
- Gebruik tone "positive" voor voordelen, "warning" voor aandachtspunten, "neutral" voor overige feiten.`;

const TOOL_NAME = "vehicle_enrichment";

const ENRICHMENT_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Gestructureerde samenvatting van RDW-voertuiggegevens.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "Eén zin (max 25 woorden) die het voertuig objectief omschrijft."
      },
      insights: {
        type: "array",
        description: "Maximaal 3 feitelijke inzichten.",
        items: {
          type: "object",
          properties: {
            tone: { type: "string", enum: ["neutral", "positive", "warning"] },
            text: { type: "string" }
          },
          required: ["tone", "text"]
        }
      }
    },
    required: ["summary", "insights"]
  }
};

function buildUserPrompt(vehicleData: unknown): string {
  return `Voertuiggegevens (JSON):\n${JSON.stringify(vehicleData, null, 2)}\n\nGeef een gestructureerde samenvatting via het tool.`;
}

async function callClaude(vehicleData: unknown): Promise<EnrichmentPayload | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }
      }
    ],
    tools: [ENRICHMENT_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: buildUserPrompt(vehicleData) }]
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return null;

  const input = toolUse.input as { summary?: string; insights?: EnrichmentPayload["insights"] };

  return {
    summary: input.summary ?? "",
    insights: input.insights ?? [],
    generated: true
  };
}

function placeholderEnrichment(vehicleData: unknown): EnrichmentPayload {
  const data = vehicleData as { cards?: { rdw_vehicle?: { merk?: string; handelsbenaming?: string } } };
  const vehicle = data.cards?.rdw_vehicle;
  const name = [vehicle?.merk, vehicle?.handelsbenaming].filter(Boolean).join(" ");

  return {
    summary: name
      ? `${name} is gevonden in de RDW basisregistratie.`
      : "Het voertuig is gevonden in de RDW basisregistratie.",
    insights: [],
    generated: false
  };
}

export async function enrichVehicle(request: HttpRequest): Promise<HttpResponseInit> {
  const requestId = generateRequestId();
  const validation = validatePlate(request.params.plate);

  if (!validation.ok) {
    return {
      status: 400,
      headers: { "x-request-id": requestId },
      jsonBody: { error: validation.error }
    };
  }

  const plate = validation.plate;

  // Require valid session token - reject unauthenticated requests
  const cookieHeader = request.headers.get("cookie");
  const tokenFromCookie = cookieHeader?.match(/vehicleSessionToken=([^;]+)/)?.[1];
  const tokenFromHeader = request.headers.get("x-vehicle-token");
  const sessionToken = tokenFromCookie ?? tokenFromHeader;

  if (!sessionToken || !isValidVehicleSessionToken(sessionToken)) {
    return {
      status: 401,
      headers: {
        "x-request-id": requestId
      },
      jsonBody: {
        error: "Geen geldige sessietoken. Voert eerst een voertuigopzoeking uit."
      }
    };
  }

  const ratelimitKey = `${plate}:${sessionToken}`;

  if (!enrichLimiter.allow(ratelimitKey)) {
    return {
      status: 429,
      headers: {
        "x-request-id": requestId,
        "retry-after": String(enrichLimiter.retryAfterSeconds(ratelimitKey))
      },
      jsonBody: {
        error: "Te veel verrijkingsaanvragen. Wacht even en probeer het opnieuw.",
        retryAfterSeconds: enrichLimiter.retryAfterSeconds(ratelimitKey)
      }
    };
  }

  const cached = await getLlmCached(plate);
  if (cached) {
    return {
      status: 200,
      headers: { "x-request-id": requestId },
      jsonBody: { ...(cached as Record<string, unknown>), fromCache: true }
    };
  }

  const vehicleData = await getVehicleCached(plate);
  if (!vehicleData) {
    return {
      status: 404,
      headers: { "x-request-id": requestId },
      jsonBody: { error: "Voertuiggegevens staan nog niet in de cache." }
    };
  }

  let enrichment: EnrichmentPayload;
  try {
    enrichment = (await callClaude(vehicleData)) ?? placeholderEnrichment(vehicleData);
  } catch {
    enrichment = placeholderEnrichment(vehicleData);
  }

  if (enrichment.generated) {
    await setLlmCached(plate, enrichment, LLM_TTL_SECONDS);
  }

  return {
    status: 200,
    headers: { "x-request-id": requestId },
    jsonBody: { ...enrichment, fromCache: false }
  };
}

app.http("enrich", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "enrich/{plate}",
  handler: enrichVehicle
});
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { CATEGORY_OPTIONS, activitySchema, type Activity } from "./report-schema.js";

export class GeminiConfigurationError extends Error {
  constructor() {
    super("Gemini is not configured. Add GEMINI_API_KEY to backend/.env or enter a session key in Settings.");
    this.name = "GeminiConfigurationError";
  }
}

export class GeminiServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 502,
  ) {
    super(message);
    this.name = "GeminiServiceError";
  }
}

const rawAiActivitySchema = z.object({
  date: z.string().trim().optional(),
  categoryIndex: z.union([z.number(), z.string()]).optional(),
  category_id: z.union([z.number(), z.string()]).optional(),
  category: z.string().trim().optional(),
  details: z.string().trim().optional(),
  description: z.string().trim().optional(),
  accomplishment: z.string().trim().optional(),
  activity: z.string().trim().optional(),
  task: z.string().trim().optional(),
  output: z.string().trim().optional(),
  units: z.union([z.number(), z.string()]).optional(),
  quantity: z.union([z.number(), z.string()]).optional(),
  count: z.union([z.number(), z.string()]).optional(),
}).passthrough();

const aiActivitySchema = activitySchema.omit({ id: true });

export interface DraftRequest {
  notes: string;
  startDate: string;
  endDate: string;
  office: string;
  defaultDate?: string;
  defaultUnits?: number;
}

function geminiConfig(sessionApiKey?: string) {
  const apiKey = sessionApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiConfigurationError();

  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
  };
}

function toGeminiServiceError(error: unknown): GeminiServiceError {
  const raw = error instanceof Error ? error.message : String(error);

  if (/api.?key|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|\b401\b|\b403\b/i.test(raw)) {
    return new GeminiServiceError(
      "Gemini rejected this API key. Check the key in Settings and try again.",
      "GEMINI_KEY_INVALID",
      401,
    );
  }
  if (/RESOURCE_EXHAUSTED|quota|rate.?limit|\b429\b/i.test(raw)) {
    return new GeminiServiceError(
      "Gemini's request limit has been reached. Wait a moment or check the key's quota, then retry.",
      "GEMINI_QUOTA_EXCEEDED",
      429,
    );
  }
  if (/NOT_FOUND|not found|\b404\b/i.test(raw)) {
    return new GeminiServiceError(
      "The configured Gemini model is unavailable. Check GEMINI_MODEL and restart the server.",
      "GEMINI_MODEL_UNAVAILABLE",
    );
  }
  if (/fetch failed|network|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(raw)) {
    return new GeminiServiceError(
      "Could not reach Gemini. Check the internet connection and try again.",
      "GEMINI_NETWORK_ERROR",
    );
  }

  return new GeminiServiceError(
    "Gemini could not complete the request. Please try again.",
    "GEMINI_REQUEST_FAILED",
  );
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .map((word) => word.endsWith("s") ? word.slice(0, -1) : word);
}

function resolveCategory(categoryIndex?: string | number, categoryText?: string): string {
  const numericIndex = Number(categoryIndex ?? categoryText);
  if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= CATEGORY_OPTIONS.length) {
    return CATEGORY_OPTIONS[numericIndex - 1]!;
  }

  if (categoryText) {
    const normalizedText = normalizedWords(categoryText).join(" ");
    const exact = CATEGORY_OPTIONS.find((category) => normalizedWords(category).join(" ") === normalizedText);
    if (exact) return exact;

    const requestedWords = new Set(normalizedWords(categoryText));
    let closest: { category: string; score: number } | undefined;
    for (const category of CATEGORY_OPTIONS) {
      const approvedWords = new Set(normalizedWords(category));
      const overlap = [...requestedWords].filter((word) => approvedWords.has(word)).length;
      const score = requestedWords.size ? overlap / requestedWords.size : 0;
      if (!closest || score > closest.score) closest = { category, score };
    }
    if (closest && closest.score >= 0.34) return closest.category;
  }

  return CATEGORY_OPTIONS.at(-1)!;
}

function normalizeDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return value;
  return `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
}

function normalizeUnits(value?: string | number, fallback = 1): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value.match(/\d+/)?.[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function looksLikeActivity(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["details", "description", "accomplishment", "activity", "task", "output"]
    .some((key) => key in value);
}

function extractActivityRows(parsed: unknown): unknown[] | undefined {
  if (Array.isArray(parsed)) return parsed;
  if (looksLikeActivity(parsed)) return [parsed];
  if (typeof parsed === "string") {
    try {
      return extractActivityRows(JSON.parse(parsed));
    } catch {
      return undefined;
    }
  }
  if (!parsed || typeof parsed !== "object") return undefined;

  for (const value of Object.values(parsed)) {
    if (Array.isArray(value)) return value;
    if (looksLikeActivity(value)) return [value];
  }
  return undefined;
}

function normalizeActivities(parsed: unknown, request: DraftRequest): Omit<Activity, "id">[] {
  const candidate = extractActivityRows(parsed);

  if (!Array.isArray(candidate) || candidate.length === 0 || candidate.length > 40) {
    throw new GeminiServiceError(
      "Gemini returned an empty draft. Try again and describe what work was completed.",
      "GEMINI_RESPONSE_INVALID",
    );
  }

  const defaultDate = request.defaultDate || request.startDate;

  return candidate.map((value, index) => {
    const rawResult = rawAiActivitySchema.safeParse(value);
    if (!rawResult.success) {
      throw new GeminiServiceError(
        `Gemini could not read item ${index + 1} as a report entry. Describe the completed work and try again.`,
        "GEMINI_RESPONSE_INVALID",
      );
    }

    const raw = rawResult.data;
    const activity = {
      date: normalizeDate(raw.date || defaultDate),
      category: resolveCategory(raw.categoryIndex ?? raw.category_id, raw.category),
      details: (
        raw.details
        || raw.description
        || raw.accomplishment
        || raw.activity
        || raw.task
        || raw.output
        || ""
      ).trim(),
      units: normalizeUnits(raw.units ?? raw.quantity ?? raw.count, request.defaultUnits ?? 1),
    };
    const result = aiActivitySchema.safeParse(activity);
    if (!result.success) {
      throw new GeminiServiceError(
        `Gemini could not read item ${index + 1} as a report entry. Describe the completed work and try again.`,
        "GEMINI_RESPONSE_INVALID",
      );
    }
    if (result.data.date < request.startDate || result.data.date > request.endDate) {
      throw new GeminiServiceError(
        `The date in generated entry ${index + 1} is outside ${request.startDate} to ${request.endDate}. Update the note or reporting period, then retry.`,
        "GEMINI_DATE_OUTSIDE_PERIOD",
      );
    }
    return result.data;
  });
}

export async function testGeminiConnection(sessionApiKey?: string): Promise<{ model: string }> {
  const { apiKey, model } = geminiConfig(sessionApiKey);
  const ai = new GoogleGenAI({ apiKey });

  try {
    await ai.models.get({ model });
    return { model };
  } catch (error) {
    throw toGeminiServiceError(error);
  }
}

export async function draftActivities(
  request: DraftRequest,
  sessionApiKey?: string,
): Promise<Activity[]> {
  const { apiKey, model } = geminiConfig(sessionApiKey);
  const ai = new GoogleGenAI({ apiKey });
  const categories = CATEGORY_OPTIONS.map((category, index) => `${index + 1}. ${category}`).join("\n");

  const prompt = `You are an administrative writing assistant for ${request.office}, Municipality of Boac.
Turn the user's rough work notes into clean accomplishment-report activity rows.

Rules:
- Never invent an event, person, quantity, output, or result.
- The user may write naturally in English, Filipino, or Taglish. Understand the narrative as a whole; do not require a template or one item per line.
- Translate Filipino or Taglish work descriptions into concise professional English without changing their meaning.
- Correct spelling and grammar while keeping the original meaning.
- Use concise past-tense professional English for details and remove conversational filler.
- Split a paragraph into separate rows when it clearly describes distinct completed actions or outputs.
- Resolve explicit or relative dates from the narrative when possible. If an action has no date, use ${request.defaultDate || request.startDate}.
- Every date must be ISO YYYY-MM-DD and between ${request.startDate} and ${request.endDate}.
- Use an explicit quantity from the user's notes as units for that action.
- If an action has no stated quantity, use ${request.defaultUnits ?? 1} units, the user's selected fallback. Do not invent another quantity.
- Set categoryIndex to the number of the closest approved category. Use categoryIndex ${CATEGORY_OPTIONS.length} only when no specific category fits.
- Do not repeat the category inside details.

Approved categories:
${categories}

Rough notes:
${request.notes}`;

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "ISO date YYYY-MM-DD" },
              categoryIndex: { type: "integer", minimum: 1, maximum: CATEGORY_OPTIONS.length },
              details: { type: "string" },
              units: { type: "integer" },
            },
            required: ["date", "categoryIndex", "details", "units"],
          },
        },
      },
    });
  } catch (error) {
    throw toGeminiServiceError(error);
  }

  if (!response.text) {
    throw new Error("Gemini returned an empty response. Try adding clearer dates and quantities.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw new Error("Gemini returned an unreadable draft. Please try again.");
  }

  const activities = normalizeActivities(parsed, request);
  return activities.map((activity) => ({ ...activity, id: crypto.randomUUID() }));
}

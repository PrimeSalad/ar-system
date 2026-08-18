import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_OPTIONS } from "../src/report-schema.js";

const mocks = vi.hoisted(() => {
  const generateContent = vi.fn();
  const getModel = vi.fn();
  const GoogleGenAI = vi.fn(function MockGoogleGenAI() {
    return { models: { generateContent, get: getModel } };
  });
  return { generateContent, getModel, GoogleGenAI };
});

vi.mock("@google/genai", () => ({ GoogleGenAI: mocks.GoogleGenAI }));

import {
  draftActivities,
  GeminiServiceError,
  improveActivityDescription,
  improveActivityDescriptions,
  testGeminiConnection,
} from "../src/gemini.js";

const request = {
  notes: "Aug 17 - delivered four letters to municipal offices",
  startDate: "2026-08-16",
  endDate: "2026-08-31",
  office: "MSWDO",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GEMINI_MODEL", "gemini-3.5-flash");
});

describe("Gemini drafting", () => {
  it("improves one rough accomplishment without requesting invented details", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        details: "Prepared and distributed 12 meeting invitations to SK chairpersons.",
      }),
    });

    const details = await improveActivityDescription(
      "nag prepare at distribute ako ng 12 invitations sa SK chairpersons",
      "MSWDO",
      "session-key",
    );

    expect(details).toBe("Prepared and distributed 12 meeting invitations to SK chairpersons.");
    expect(mocks.generateContent.mock.calls[0]?.[0].contents).toContain("Never invent");
    expect(mocks.generateContent.mock.calls[0]?.[0].contents).toContain("one description only");
  });

  it("improves bulk accomplishments without merging or reordering them", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify([
        { index: 1, details: "Prepared meeting invitations." },
        { index: 2, details: "Distributed documents to four offices." },
      ]),
    });

    const details = await improveActivityDescriptions(
      ["nag prepare ng invitations", "nag distribute ng documents sa 4 offices"],
      "MSWDO",
      "session-key",
    );

    expect(details).toEqual([
      "Prepared meeting invitations.",
      "Distributed documents to four offices.",
    ]);
    expect(mocks.generateContent.mock.calls[0]?.[0].contents).toContain("exactly one description for every input item");
    expect(mocks.generateContent.mock.calls[0]?.[0].contents).toContain("Never merge two notes");
  });

  it("turns a valid structured provider response into editable activities", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        activities: [
          {
            date: "2026-8-17",
            categoryIndex: "3",
            description: "Delivered four letters to municipal offices",
            units: "4 units",
          },
        ],
      }),
    });

    const activities = await draftActivities(request, "session-key");

    expect(mocks.GoogleGenAI).toHaveBeenCalledWith({ apiKey: "session-key" });
    expect(mocks.generateContent).toHaveBeenCalledOnce();
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      date: "2026-08-17",
      category: CATEGORY_OPTIONS[2],
      details: "Delivered four letters to municipal offices",
      units: 4,
    });
    expect(activities[0]!.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("accepts a single conversational result and supplies the selected default date", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        accomplishment: "Coordinated with SK chairpersons regarding the quarterly meeting",
        quantity: "12 people",
      }),
    });

    const activities = await draftActivities(
      { ...request, defaultDate: "2026-08-20" },
      "session-key",
    );

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      date: "2026-08-20",
      details: "Coordinated with SK chairpersons regarding the quarterly meeting",
      units: 12,
      category: CATEGORY_OPTIONS.at(-1),
    });
  });

  it("uses the units selected by the user when Gemini returns no quantity", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        accomplishment: "Prepared the monthly accomplishment report",
      }),
    });

    const activities = await draftActivities(
      { ...request, defaultUnits: 7 },
      "session-key",
    );

    expect(activities[0]).toMatchObject({
      details: "Prepared the monthly accomplishment report",
      units: 7,
    });
    expect(mocks.generateContent.mock.calls[0]?.[0].contents).toContain(
      "use 7 units, the user's selected fallback",
    );
  });

  it("rejects provider rows outside the selected reporting period", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify([
        {
          date: "2026-09-01",
          category: CATEGORY_OPTIONS[2],
          details: "Delivered four letters to municipal offices",
          units: 4,
        },
      ]),
    });

    await expect(draftActivities(request, "session-key")).rejects.toMatchObject({
      code: "GEMINI_DATE_OUTSIDE_PERIOD",
    });
  });

  it("safely maps an unknown category to the approved catch-all category", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify([
        {
          date: "2026-08-17",
          category: "Made-up category",
          details: "Delivered four letters to municipal offices",
          units: 4,
        },
      ]),
    });

    const activities = await draftActivities(request, "session-key");
    expect(activities[0]!.category).toBe(CATEGORY_OPTIONS.at(-1));
  });
});

describe("Gemini connection check", () => {
  it("verifies that the configured model is reachable", async () => {
    mocks.getModel.mockResolvedValue({ name: "models/gemini-3.5-flash" });

    await expect(testGeminiConnection("session-key")).resolves.toEqual({
      model: "gemini-3.5-flash",
    });
    expect(mocks.getModel).toHaveBeenCalledWith({ model: "gemini-3.5-flash" });
  });

  it("returns a safe, actionable message for an invalid key", async () => {
    mocks.getModel.mockRejectedValue(new Error("API key not valid. API_KEY_INVALID"));

    await expect(testGeminiConnection("bad-key")).rejects.toEqual(
      expect.objectContaining<Partial<GeminiServiceError>>({
        code: "GEMINI_KEY_INVALID",
        status: 401,
      }),
    );
  });
});

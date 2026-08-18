import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clampDraftDate, createApp } from "../src/app.js";
import { buildAccomplishmentWorkbook } from "../src/excel.js";
import type { ReportInput } from "../src/report-schema.js";

const temporaryFiles: string[] = [];

function fixture(): ReportInput {
  return {
    id: "91d36ca4-78c6-4d94-938a-714f8615cfab",
    title: "Accomplishment Report",
    country: "Republic of the Philippines",
    province: "Province of Marinduque",
    municipality: "Municipality of Boac",
    office: "MSWDO",
    startDate: "2026-08-16",
    endDate: "2026-08-31",
    preparedBy: "Gene Elpie L. Landoy",
    preparedPosition: "Administrative Aide II",
    notedBy: "Hazel Maureen L. Gonzales",
    notedPosition: "MGDH I - MSWDO",
    status: "draft",
    activities: [
      {
        id: "c2a41e70-6fcb-4994-9f25-f5f043670d0a",
        date: "2026-08-17",
        category: "Receive Inquiries, concerns of LYDC and SK",
        details: "Communicated with 12 SK chairpersons regarding the upcoming meeting",
        units: 12,
      },
      {
        id: "caed31b6-6470-481c-bd8f-12e4983237f4",
        date: "2026-08-17",
        category: "Sort incoming and outgoing LYDC and SK communication",
        details: "Delivered pertinent documents to various offices",
        units: 4,
      },
    ],
  };
}

afterEach(async () => {
  await Promise.all(temporaryFiles.splice(0).map((file) => rm(file, { force: true })));
  vi.unstubAllEnvs();
});

describe("Gemini API", () => {
  it("clamps fallback dates into past reporting periods", () => {
    expect(clampDraftDate("2026-08-18", "2025-01-01", "2025-01-15")).toBe("2025-01-15");
    expect(clampDraftDate("2024-12-20", "2025-01-01", "2025-01-15")).toBe("2025-01-01");
  });

  it("reports missing configuration without attempting a provider request", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const app = createApp();

    await request(app).get("/api/ai/status").expect(200, {
      configured: false,
      model: "gemini-3.5-flash",
    });

    const connection = await request(app).post("/api/ai/test").expect(503);
    expect(connection.body.code).toBe("GEMINI_NOT_CONFIGURED");

    const description = await request(app)
      .post("/api/ai/description")
      .send({ notes: "Prepared the monthly report", office: "MSWDO" })
      .expect(503);
    expect(description.body.code).toBe("GEMINI_NOT_CONFIGURED");

    const descriptions = await request(app)
      .post("/api/ai/descriptions")
      .send({ notes: ["Prepared the monthly report", "Distributed four letters"], office: "MSWDO" })
      .expect(503);
    expect(descriptions.body.code).toBe("GEMINI_NOT_CONFIGURED");

    const draft = await request(app)
      .post("/api/ai/draft")
      .send({
        notes: "Aug 17 - delivered four letters",
        startDate: "2026-08-16",
        endDate: "2026-08-31",
        office: "MSWDO",
      })
      .expect(503);
    expect(draft.body.code).toBe("GEMINI_NOT_CONFIGURED");
  });
});

describe("frontend CORS", () => {
  it("allows the Vercel frontend and rejects unrelated browser origins", async () => {
    const app = createApp();

    const allowed = await request(app)
      .options("/api/health")
      .set("Origin", "https://accomplish-pro-boac.vercel.app")
      .set("Access-Control-Request-Method", "GET")
      .expect(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://accomplish-pro-boac.vercel.app",
    );

    const rejected = await request(app)
      .options("/api/health")
      .set("Origin", "https://unrelated.example")
      .set("Access-Control-Request-Method", "GET")
      .expect(404);
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("report API", () => {
  it("persists and returns a valid report", async () => {
    const dataFile = path.join(os.tmpdir(), `accomplish-pro-${crypto.randomUUID()}.json`);
    temporaryFiles.push(dataFile);
    const app = createApp({ dataFile });
    const report = fixture();

    await request(app).put(`/api/reports/${report.id}`).send(report).expect(200);
    const response = await request(app).get("/api/reports").expect(200);

    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0].activities).toHaveLength(2);
    expect(JSON.parse(await readFile(dataFile, "utf8"))).toHaveLength(1);
  });

  it("rejects activity dates outside the report period", async () => {
    const dataFile = path.join(os.tmpdir(), `accomplish-pro-${crypto.randomUUID()}.json`);
    temporaryFiles.push(dataFile);
    const app = createApp({ dataFile });
    const report = fixture();
    report.activities[0]!.date = "2026-09-01";

    const response = await request(app).put(`/api/reports/${report.id}`).send(report).expect(400);
    expect(response.body.issues[0].path).toContain("activities");
  });
});

describe("Excel export", () => {
  it("creates the supplied A-D template structure with grouped dates", async () => {
    const buffer = await buildAccomplishmentWorkbook(fixture());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    const sheet = workbook.getWorksheet("ACCOMPLISHMENT")!;

    expect(sheet.getCell("A1").value).toBe("Republic of the Philippines");
    expect(sheet.getCell("A7").value).toBe("ACCOMPLISHMENT REPORT");
    expect(sheet.getCell("B10").value).toBe("DESCRIPTION");
    expect(sheet.getCell("D11").value).toBe(12);
    expect(sheet.getCell("A11").isMerged).toBe(true);
    expect(sheet.pageSetup.orientation).toBe("portrait");
    expect(sheet.getImages()).toHaveLength(1);
  });
});

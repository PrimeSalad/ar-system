import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { ZodError, z } from "zod";
import { buildAccomplishmentWorkbook, exportFilename } from "./excel.js";
import {
  draftActivities,
  GeminiConfigurationError,
  GeminiServiceError,
  improveActivityDescription,
  improveActivityDescriptions,
  testGeminiConnection,
} from "./gemini.js";
import { CATEGORY_OPTIONS, reportInputSchema } from "./report-schema.js";
import { JsonReportStore } from "./store.js";

const draftRequestSchema = z.object({
  notes: z.string().trim().min(5).max(12_000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  defaultDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  defaultUnits: z.number().int().positive().max(1_000_000).default(1),
  office: z.string().trim().min(2).max(100),
}).superRefine((request, context) => {
  if (request.startDate > request.endDate) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Reporting period end must be on or after its start",
    });
  }
});

const descriptionRequestSchema = z.object({
  notes: z.string().trim().min(3).max(2_500),
  office: z.string().trim().min(2).max(100),
});

const descriptionsRequestSchema = z.object({
  notes: z.array(z.string().trim().min(3).max(2_500)).min(1).max(50),
  office: z.string().trim().min(2).max(100),
});

export function clampDraftDate(value: string | undefined, startDate: string, endDate: string): string {
  if (!value || value < startDate) return startDate;
  if (value > endDate) return endDate;
  return value;
}

function defaultDataFile(): string {
  return fileURLToPath(new URL("../data/reports.json", import.meta.url));
}

export function createApp(options: { dataFile?: string } = {}) {
  const app = express();
  const store = new JsonReportStore(options.dataFile ?? process.env.DATA_FILE ?? defaultDataFile());
  const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(["http://localhost:5173", ...configuredOrigins]);
  const vercelFrontendOrigin = /^https:\/\/accomplish-pro-boac(?:-[a-z0-9-]+)*\.vercel\.app$/i;

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        const allowed = !origin || allowedOrigins.has(origin) || vercelFrontendOrigin.test(origin);
        callback(null, allowed);
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "x-gemini-api-key"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", service: "AccomplishPro API" });
  });

  app.get("/api/template", (_request, response) => {
    response.json({
      name: "Municipality of Boac MSWDO Accomplishment Report",
      source: "2026 ACCOMPLISHMENT TRUE .xlsx",
      columns: ["DATE", "DESCRIPTION", "UNITS"],
      categories: CATEGORY_OPTIONS,
    });
  });

  app.get("/api/ai/status", (_request, response) => {
    response.json({
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
    });
  });

  app.post("/api/ai/test", async (request, response, next) => {
    try {
      const apiKey = request.header("x-gemini-api-key");
      const result = await testGeminiConnection(apiKey);
      response.json({ ok: true, model: result.model });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/description", async (request, response, next) => {
    try {
      const payload = descriptionRequestSchema.parse(request.body);
      const apiKey = request.header("x-gemini-api-key");
      const details = await improveActivityDescription(payload.notes, payload.office, apiKey);
      response.json({ details });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/descriptions", async (request, response, next) => {
    try {
      const payload = descriptionsRequestSchema.parse(request.body);
      const apiKey = request.header("x-gemini-api-key");
      const details = await improveActivityDescriptions(payload.notes, payload.office, apiKey);
      response.json({ details });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/draft", async (request, response, next) => {
    try {
      const payload = draftRequestSchema.parse(request.body);
      const apiKey = request.header("x-gemini-api-key");
      const activities = await draftActivities({
        ...payload,
        defaultDate: clampDraftDate(payload.defaultDate, payload.startDate, payload.endDate),
      }, apiKey);
      response.json({ activities });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports", async (_request, response, next) => {
    try {
      response.json({ reports: await store.list() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/:id", async (request, response, next) => {
    try {
      const report = await store.get(request.params.id);
      if (!report) {
        response.status(404).json({ error: "Report not found" });
        return;
      }
      response.json({ report });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/reports/:id", async (request, response, next) => {
    try {
      const payload = reportInputSchema.parse({ ...request.body, id: request.params.id });
      const report = await store.upsert(payload);
      response.json({ report });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/reports/:id", async (request, response, next) => {
    try {
      const deleted = await store.delete(request.params.id);
      if (!deleted) {
        response.status(404).json({ error: "Report not found" });
        return;
      }
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/exports/xlsx", async (request, response, next) => {
    try {
      const report = reportInputSchema.parse(request.body);
      const workbook = await buildAccomplishmentWorkbook(report);
      response.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      response.setHeader("Content-Disposition", `attachment; filename=\"${exportFilename(report)}\"`);
      response.setHeader("Content-Length", workbook.byteLength.toString());
      response.send(workbook);
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Endpoint not found" });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "Please review the submitted information.",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
      return;
    }
    if (error instanceof GeminiConfigurationError) {
      response.status(503).json({ error: error.message, code: "GEMINI_NOT_CONFIGURED" });
      return;
    }
    if (error instanceof GeminiServiceError) {
      response.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected server error";
    console.error(error);
    response.status(500).json({ error: message });
  });

  return app;
}

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  reportInputSchema,
  storedReportSchema,
  type ReportInput,
  type StoredReport,
} from "./report-schema.js";

const storedReportsSchema = z.array(storedReportSchema);

export class JsonReportStore {
  constructor(private readonly filePath: string) {}

  async list(): Promise<StoredReport[]> {
    const reports = await this.readAll();
    return reports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<StoredReport | undefined> {
    return (await this.readAll()).find((report) => report.id === id);
  }

  async upsert(rawReport: ReportInput): Promise<StoredReport> {
    const report = reportInputSchema.parse(rawReport);
    const reports = await this.readAll();
    const index = reports.findIndex((item) => item.id === report.id);
    const now = new Date().toISOString();
    const stored: StoredReport = {
      ...report,
      createdAt: index >= 0 ? reports[index]!.createdAt : now,
      updatedAt: now,
    };

    if (index >= 0) {
      reports[index] = stored;
    } else {
      reports.push(stored);
    }

    await this.writeAll(reports);
    return stored;
  }

  async delete(id: string): Promise<boolean> {
    const reports = await this.readAll();
    const remaining = reports.filter((report) => report.id !== id);
    if (remaining.length === reports.length) return false;
    await this.writeAll(remaining);
    return true;
  }

  private async readAll(): Promise<StoredReport[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      if (!contents.trim()) return [];
      return storedReportsSchema.parse(JSON.parse(contents));
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAll(reports: StoredReport[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }
}

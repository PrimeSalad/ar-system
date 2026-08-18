import type { Activity, AiStatus, Report } from "./types";

interface ApiErrorBody {
  error?: string;
  issues?: Array<{ path: string; message: string }>;
}

async function readError(response: Response): Promise<Error> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // The fallback below is clearer than a JSON parsing error.
  }
  const issue = body.issues?.[0];
  return new Error(issue ? `${body.error ?? "Request failed"} ${issue.message}` : body.error ?? `Request failed (${response.status})`);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getReports(): Promise<Report[]> {
  const result = await apiFetch<{ reports: Report[] }>("/api/reports");
  return result.reports;
}

export async function saveReport(report: Report): Promise<Report> {
  const result = await apiFetch<{ report: Report }>(`/api/reports/${report.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  return result.report;
}

export async function deleteReport(id: string): Promise<void> {
  await apiFetch<void>(`/api/reports/${id}`, { method: "DELETE" });
}

export async function getAiStatus(): Promise<AiStatus> {
  return apiFetch<AiStatus>("/api/ai/status");
}

export async function testAiConnection(sessionApiKey?: string): Promise<{ ok: true; model: string }> {
  const headers: Record<string, string> = {};
  if (sessionApiKey) headers["x-gemini-api-key"] = sessionApiKey;
  return apiFetch<{ ok: true; model: string }>("/api/ai/test", {
    method: "POST",
    headers,
  });
}

export async function generateAiDraft(
  report: Report,
  notes: string,
  sessionApiKey?: string,
  defaultDate?: string,
  defaultUnits?: number,
): Promise<Activity[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionApiKey) headers["x-gemini-api-key"] = sessionApiKey;
  const result = await apiFetch<{ activities: Activity[] }>("/api/ai/draft", {
    method: "POST",
    headers,
    body: JSON.stringify({
      notes,
      startDate: report.startDate,
      endDate: report.endDate,
      defaultDate: defaultDate ?? report.startDate,
      defaultUnits: defaultUnits ?? 1,
      office: report.office,
    }),
  });
  return result.activities;
}

export async function downloadExcel(report: Report): Promise<void> {
  const response = await fetch("/api/exports/xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw await readError(response);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `Accomplishment_Report_${report.startDate}_to_${report.endDate}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

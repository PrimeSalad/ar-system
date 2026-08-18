import { describe, expect, it, vi } from "vitest";
import { activityDescription, clampDateToPeriod, createBlankReport, formatPeriod } from "./utils";

describe("report utilities", () => {
  it("creates a second-half report through the actual month end", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "91d36ca4-78c6-4d94-938a-714f8615cfab" });
    const report = createBlankReport(new Date(2026, 7, 17));
    expect(report.startDate).toBe("2026-08-16");
    expect(report.endDate).toBe("2026-08-31");
    expect(report.office).toBe("MSWDO");
    expect(report.preparedBy).toBe("Gene Elpie L. Landoy");
    vi.unstubAllGlobals();
  });

  it("formats a same-month period cleanly", () => {
    expect(formatPeriod("2026-08-16", "2026-08-31")).toBe("August 16–31, 2026");
  });

  it("keeps default dates inside current, past, and future reporting periods", () => {
    expect(clampDateToPeriod("2026-08-20", "2026-08-16", "2026-08-31")).toBe("2026-08-20");
    expect(clampDateToPeriod("2026-09-10", "2026-07-01", "2026-07-31")).toBe("2026-07-31");
    expect(clampDateToPeriod("2026-01-01", "2026-09-01", "2026-09-15")).toBe("2026-09-01");
  });

  it("combines the approved category and details", () => {
    const description = activityDescription({
      id: "a",
      date: "2026-08-17",
      category: "Communications",
      details: "Delivered four letters",
      units: 4,
    });
    expect(description).toBe("Communications: Delivered four letters");
  });
});

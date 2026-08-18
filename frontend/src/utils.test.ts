import { describe, expect, it, vi } from "vitest";
import { activityDescription, createBlankReport, formatPeriod } from "./utils";

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

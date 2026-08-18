import { describe, expect, it } from "vitest";
import { parseActivityCsv } from "./csv";

describe("parseActivityCsv", () => {
  it("parses quoted commas, escaped quotes, and multiline details", () => {
    const rows = parseActivityCsv([
      "date,category,details,units",
      '2026-08-03,"Preparation, coordination","Prepared invitations, kits, and certificates.",5',
      '2026-08-04,Documentation,"Prepared a ""complete"" report\nfor review.",2',
    ].join("\r\n"));

    expect(rows).toEqual([
      {
        date: "2026-08-03",
        category: "Preparation, coordination",
        details: "Prepared invitations, kits, and certificates.",
        units: 5,
      },
      {
        date: "2026-08-04",
        category: "Documentation",
        details: 'Prepared a "complete" report\nfor review.',
        units: 2,
      },
    ]);
  });

  it("accepts a UTF-8 BOM and friendly column aliases", () => {
    const rows = parseActivityCsv(
      "\uFEFFaccomplishment_date,work_category,what_was_accomplished,quantity\n"
      + "2026-08-05,Database,Updated profiling records.,10",
    );

    expect(rows[0]).toEqual({
      date: "2026-08-05",
      category: "Database",
      details: "Updated profiling records.",
      units: 10,
    });
  });

  it("identifies the exact CSV row containing invalid units", () => {
    expect(() => parseActivityCsv(
      "date,category,details,units\n2026-08-03,Coordination,Requested updates.,1.5",
    )).toThrow("CSV row 2: units must be a positive whole number.");
  });

  it("rejects impossible calendar dates", () => {
    expect(() => parseActivityCsv(
      "date,category,details,units\n2026-02-30,Coordination,Requested updates.,1",
    )).toThrow("CSV row 2: date must be a real date in YYYY-MM-DD format.");
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_OPTIONS, type Report } from "../types";
import { ActivityEditor } from "./ActivityEditor";

const report: Report = {
  id: "91d36ca4-78c6-4d94-938a-714f8615cfab",
  title: "Accomplishment Report",
  country: "Republic of the Philippines",
  province: "Province of Marinduque",
  municipality: "Municipality of Boac",
  office: "MSWDO",
  startDate: "2025-01-01",
  endDate: "2025-01-15",
  preparedBy: "Gene Elpie L. Landoy",
  preparedPosition: "Administrative Aide II",
  notedBy: "Hazel Maureen L. Gonzales",
  notedPosition: "MGDH I - MSWDO",
  status: "draft",
  activities: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderEditor(overrides: Partial<ComponentProps<typeof ActivityEditor>> = {}) {
  const props: ComponentProps<typeof ActivityEditor> = {
    report,
    editing: null,
    aiReady: true,
    onSubmit: vi.fn(),
    onImport: vi.fn(),
    onCancelEdit: vi.fn(),
    onOpenAi: vi.fn(),
    onOpenSettings: vi.fn(),
    onImprove: vi.fn(),
    onImproveBulk: vi.fn(),
    ...overrides,
  };
  render(<ActivityEditor {...props} />);
  return props;
}

describe("ActivityEditor", () => {
  it("adds several same-day accomplishments with a separate category and units for every row", () => {
    const randomUUID = vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("c2a41e70-6fcb-4994-9f25-f5f043670d0a")
      .mockReturnValueOnce("caed31b6-6470-481c-bd8f-12e4983237f4")
      .mockReturnValueOnce("3e83f976-efb8-4f9b-9b79-d952729cd4ee");
    const { onSubmit } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Bulk same-day" }));
    fireEvent.change(screen.getByLabelText("What was accomplished? (one per line)"), {
      target: {
        value: "- Prepared meeting invitations\n2. Distributed documents to four offices\nUpdated the participant database",
      },
    });

    expect(screen.getByText("3 entries ready")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("Work category")[1]!, {
      target: { value: CATEGORY_OPTIONS[2] },
    });
    fireEvent.change(screen.getAllByLabelText("Units")[2]!, {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add 3 entries" }));

    expect(randomUUID).toHaveBeenCalledTimes(3);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(vi.mocked(onSubmit).mock.calls[0]?.[0]).toMatchObject([
      { date: "2025-01-15", category: CATEGORY_OPTIONS[0], details: "Prepared meeting invitations", units: 1 },
      { date: "2025-01-15", category: CATEGORY_OPTIONS[2], details: "Distributed documents to four offices", units: 1 },
      { date: "2025-01-15", category: CATEGORY_OPTIONS[0], details: "Updated the participant database", units: 7 },
    ]);
  });

  it("improves every bulk line with Gemini while preserving its category and units", async () => {
    const onImproveBulk = vi.fn().mockResolvedValue([
      "Prepared meeting invitations.",
      "Distributed documents to four offices.",
    ]);
    renderEditor({ onImproveBulk });

    fireEvent.click(screen.getByRole("button", { name: "Bulk same-day" }));
    fireEvent.change(screen.getByLabelText("What was accomplished? (one per line)"), {
      target: { value: "nag prepare ng invitations\nnag distribute ng documents sa 4 offices" },
    });
    fireEvent.change(screen.getAllByLabelText("Work category")[1]!, {
      target: { value: CATEGORY_OPTIONS[2] },
    });
    fireEvent.change(screen.getAllByLabelText("Units")[1]!, {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Improve all with AI" }));

    await waitFor(() => expect(onImproveBulk).toHaveBeenCalledWith([
      "nag prepare ng invitations",
      "nag distribute ng documents sa 4 offices",
    ]));
    expect(screen.getByLabelText("What was accomplished? (one per line)")).toHaveValue(
      "Prepared meeting invitations.\nDistributed documents to four offices.",
    );
    expect(screen.getAllByLabelText("Work category")[1]).toHaveValue(CATEGORY_OPTIONS[2]);
    expect(screen.getAllByLabelText("Units")[1]).toHaveValue(4);
    expect(screen.getByText("Gemini improved 2 descriptions. Review every category and unit before adding.")).toBeInTheDocument();
  });

  it("lets Gemini improve the rough description before it is saved", async () => {
    const onImprove = vi.fn().mockResolvedValue(
      "Prepared and distributed 12 meeting invitations to SK chairpersons.",
    );
    renderEditor({ onImprove });

    fireEvent.change(screen.getByLabelText("What was accomplished?"), {
      target: { value: "nag prepare at distribute ako ng 12 invitations" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Improve with AI" }));

    await waitFor(() => expect(onImprove).toHaveBeenCalledWith(
      "nag prepare at distribute ako ng 12 invitations",
    ));
    expect(screen.getByLabelText("What was accomplished?")).toHaveValue(
      "Prepared and distributed 12 meeting invitations to SK chairpersons.",
    );
    expect(screen.getByText("Gemini improved the description. Review it before adding.")).toBeInTheDocument();
  });

  it("opens Gemini settings when field-level AI is not connected", () => {
    const onOpenSettings = vi.fn();
    renderEditor({ aiReady: false, onOpenSettings });

    fireEvent.click(screen.getByRole("button", { name: "Connect Gemini" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("imports CSV rows and expands both sides of the reporting period", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("b471e769-6c6b-4b24-bff6-51c58ccb9773")
      .mockReturnValueOnce("71ab1d30-eb88-45e0-b6ea-55ae7f4cab21");
    const { onImport } = renderEditor();
    const csv = [
      "date,category,details,units",
      '2024-12-31,Coordination,"Prepared invitations, kits, and certificates.",5',
      "2025-01-20,Database,Updated profiling records.,10",
    ].join("\n");
    const file = new File([csv], "accomplishments.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(csv) });

    fireEvent.change(screen.getByLabelText("Choose CSV file"), { target: { files: [file] } });

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    expect(vi.mocked(onImport).mock.calls[0]?.[0]).toEqual([
      {
        id: "b471e769-6c6b-4b24-bff6-51c58ccb9773",
        date: "2024-12-31",
        category: "Coordination",
        details: "Prepared invitations, kits, and certificates.",
        units: 5,
      },
      {
        id: "71ab1d30-eb88-45e0-b6ea-55ae7f4cab21",
        date: "2025-01-20",
        category: "Database",
        details: "Updated profiling records.",
        units: 10,
      },
    ]);
    expect(vi.mocked(onImport).mock.calls[0]?.[1]).toEqual({
      startDate: "2024-12-31",
      endDate: "2025-01-20",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 accomplishments imported; the reporting period was expanded to include every date.",
    );
  });

  it("shows the failing row and imports nothing when CSV validation fails", async () => {
    const { onImport } = renderEditor();
    const csv = "date,category,details,units\n2025-01-05,Coordination,Requested updates.,zero";
    const file = new File([csv], "invalid.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(csv) });

    fireEvent.change(screen.getByLabelText("Choose CSV file"), { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CSV row 2: units must be a positive whole number.",
    );
    expect(onImport).not.toHaveBeenCalled();
  });
});

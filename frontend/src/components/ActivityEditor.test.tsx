// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Report } from "../types";
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
    onCancelEdit: vi.fn(),
    onOpenAi: vi.fn(),
    onOpenSettings: vi.fn(),
    onImprove: vi.fn(),
    ...overrides,
  };
  render(<ActivityEditor {...props} />);
  return props;
}

describe("ActivityEditor", () => {
  it("adds several accomplishments for one shared day in a single submit", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Add 3 entries" }));

    expect(randomUUID).toHaveBeenCalledTimes(3);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(vi.mocked(onSubmit).mock.calls[0]?.[0]).toMatchObject([
      { date: "2025-01-15", details: "Prepared meeting invitations", units: 1 },
      { date: "2025-01-15", details: "Distributed documents to four offices", units: 1 },
      { date: "2025-01-15", details: "Updated the participant database", units: 1 },
    ]);
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
});

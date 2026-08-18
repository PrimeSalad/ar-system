// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAiDraft } from "../api";
import type { Report } from "../types";
import { AiDraftModal } from "./AiDraftModal";
import { SESSION_KEY_NAME } from "./SettingsModal";

vi.mock("../api", () => ({ generateAiDraft: vi.fn() }));

const report: Report = {
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
  activities: [],
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("AI draft modal", () => {
  it("sends rough notes and adds the returned editable rows", async () => {
    sessionStorage.setItem(SESSION_KEY_NAME, "session-key");
    const generated = [{
      id: "c2a41e70-6fcb-4994-9f25-f5f043670d0a",
      date: "2026-08-17",
      category: "Sort incoming and outgoing LYDC and SK communication",
      details: "Delivered four letters to municipal offices",
      units: 4,
    }];
    vi.mocked(generateAiDraft).mockResolvedValue(generated);
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(
      <AiDraftModal
        open
        report={report}
        serverConfigured={false}
        onClose={onClose}
        onAdd={onAdd}
        onOpenSettings={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Date to use when your story has no date"), {
      target: { value: "2026-08-20" },
    });
    fireEvent.change(screen.getByLabelText("Units when not stated"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("What did you work on?"), {
      target: { value: "Aug 17 - delivered four letters to municipal offices" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create report entries" }));

    await waitFor(() => {
      expect(generateAiDraft).toHaveBeenCalledWith(
        report,
        "Aug 17 - delivered four letters to municipal offices",
        "session-key",
        "2026-08-20",
        6,
      );
    });
    expect(onAdd).toHaveBeenCalledWith(generated);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("requires a positive whole number for fallback units", async () => {
    sessionStorage.setItem(SESSION_KEY_NAME, "session-key");

    render(
      <AiDraftModal
        open
        report={report}
        serverConfigured={false}
        onClose={vi.fn()}
        onAdd={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Units when not stated"), {
      target: { value: "1.5" },
    });
    fireEvent.change(screen.getByLabelText("What did you work on?"), {
      target: { value: "Prepared the monthly accomplishment report" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create report entries" }));

    expect(await screen.findByText("Enter a positive whole number up to 1,000,000.")).toBeTruthy();
    expect(generateAiDraft).not.toHaveBeenCalled();
  });
});

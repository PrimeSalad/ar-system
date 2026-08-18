// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_OPTIONS, type Report } from "../types";
import { DocumentPreview } from "./DocumentPreview";

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
  activities: [{
    id: "c2a41e70-6fcb-4994-9f25-f5f043670d0a",
    date: "2025-01-08",
    category: CATEGORY_OPTIONS[0],
    details: "Updated the participant database",
    units: 1,
  }],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPreview(onUpdateActivity = vi.fn()) {
  render(
    <DocumentPreview
      report={report}
      exporting={false}
      onExport={vi.fn()}
      onPrint={vi.fn()}
      onUpdateActivity={onUpdateActivity}
    />,
  );
  return onUpdateActivity;
}

describe("DocumentPreview", () => {
  it("edits a complete accomplishment row directly from its preview description", () => {
    const onUpdateActivity = renderPreview();

    fireEvent.click(screen.getByRole("button", { name: /Edit accomplishment:/ }));
    expect(screen.getByRole("button", { name: "Print or save the report as PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export report to Excel" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2025-01-10" } });
    fireEvent.change(screen.getByLabelText("Work category"), { target: { value: "Custom" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("What was accomplished?"), {
      target: { value: "Prepared and distributed four meeting invitations." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onUpdateActivity).toHaveBeenCalledWith({
      ...report.activities[0],
      date: "2025-01-10",
      category: "Custom",
      details: "Prepared and distributed four meeting invitations.",
      units: 4,
    });
    expect(screen.queryByRole("heading", { name: "Update accomplishment" })).not.toBeInTheDocument();
  });

  it("keeps the preview editor open and shows nearby validation errors", () => {
    const onUpdateActivity = renderPreview();

    fireEvent.click(screen.getByRole("button", { name: /Edit accomplishment:/ }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2025-02-01" } });
    fireEvent.change(screen.getByLabelText("Units"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("What was accomplished?"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onUpdateActivity).not.toHaveBeenCalled();
    expect(screen.getByText("Date must be inside the reporting period.")).toBeInTheDocument();
    expect(screen.getByText("Units must be a positive whole number.")).toBeInTheDocument();
    expect(screen.getByText("Describe the accomplishment in at least 3 characters.")).toBeInTheDocument();
  });
});

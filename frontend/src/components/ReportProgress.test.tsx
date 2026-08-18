// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportProgress } from "./ReportProgress";

afterEach(cleanup);

describe("ReportProgress", () => {
  it("shows a useful first-entry state instead of zero-heavy progress copy", () => {
    const onAddFirst = vi.fn();

    render(
      <ReportProgress
        activityCount={0}
        activeDays={0}
        totalUnits={0}
        status="draft"
        onAddFirst={onAddFirst}
      />,
    );

    expect(screen.getByText("Ready for your first accomplishment")).toBeInTheDocument();
    expect(screen.queryByText(/0 accomplishments/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add first accomplishment" }));
    expect(onAddFirst).toHaveBeenCalledOnce();
  });

  it("shows totals and document status once accomplishments exist", () => {
    render(
      <ReportProgress
        activityCount={3}
        activeDays={2}
        totalUnits={12}
        status="ready"
        onAddFirst={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Report progress")).toHaveTextContent(
      "3 accomplishments recorded across 2 active days, totaling 12 units.",
    );
    expect(screen.getByLabelText("Document status: Ready for signature")).toBeInTheDocument();
  });
});

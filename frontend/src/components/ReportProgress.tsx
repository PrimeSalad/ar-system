import { Plus } from "lucide-react";
import type { Report } from "../types";

interface ReportProgressProps {
  activityCount: number;
  activeDays: number;
  totalUnits: number;
  status: Report["status"];
  onAddFirst: () => void;
}

export function ReportProgress({
  activityCount,
  activeDays,
  totalUnits,
  status,
  onAddFirst,
}: ReportProgressProps) {
  const isEmpty = activityCount === 0;

  return (
    <section
      className={`report-summary${isEmpty ? " report-summary--empty" : ""}`}
      aria-label="Report progress"
    >
      <div className="report-summary__content">
        <p className="report-summary__label">Report progress</p>
        {isEmpty ? (
          <>
            <p className="report-summary__empty-title">Ready for your first accomplishment</p>
            <p className="report-summary__empty-copy">
              Add an entry manually or use Gemini to start building this reporting period.
            </p>
          </>
        ) : (
          <p className="report-summary__sentence">
            <strong>{activityCount.toLocaleString()}</strong>{" "}
            {activityCount === 1 ? "accomplishment" : "accomplishments"} recorded across{" "}
            <strong>{activeDays.toLocaleString()}</strong> {activeDays === 1 ? "active day" : "active days"},
            totaling <strong>{totalUnits.toLocaleString()}</strong> {totalUnits === 1 ? "unit" : "units"}.
          </p>
        )}
      </div>

      {isEmpty ? (
        <button className="button button--outline report-summary__action" type="button" onClick={onAddFirst}>
          <Plus aria-hidden="true" size={17} />
          Add first accomplishment
        </button>
      ) : (
        <div
          className={`document-state document-state--${status}`}
          aria-label={`Document status: ${status === "ready" ? "Ready for signature" : "Draft in progress"}`}
        >
          <span className="document-state__dot" aria-hidden="true" />
          <span>{status === "ready" ? "Ready for signature" : "Draft in progress"}</span>
        </div>
      )}
    </section>
  );
}

import { Download, Printer } from "lucide-react";
import type { Activity, Report } from "../types";
import { activityDescription, formatLongDate, formatPeriod, sortedActivities } from "../utils";

interface DocumentPreviewProps {
  report: Report;
  exporting: boolean;
  onExport: () => void;
  onPrint: () => void;
}

interface ActivityGroup {
  date: string;
  activities: Activity[];
}

function groupActivities(activities: Activity[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const activity of sortedActivities(activities)) {
    const last = groups.at(-1);
    if (last?.date === activity.date) last.activities.push(activity);
    else groups.push({ date: activity.date, activities: [activity] });
  }
  return groups;
}

export function DocumentPreview({ report, exporting, onExport, onPrint }: DocumentPreviewProps) {
  const groups = groupActivities(report.activities);

  return (
    <section className="preview-panel" aria-labelledby="preview-title">
      <div className="preview-toolbar">
        <div>
          <p className="eyebrow">Document preview</p>
          <h2 id="preview-title">Report preview</h2>
        </div>
        <div className="preview-toolbar__actions">
          <button className="button button--icon-text button--outline" type="button" onClick={onPrint}>
            <Printer aria-hidden="true" size={17} />
            Print / PDF
          </button>
          <button className="button button--icon-text button--primary" type="button" onClick={onExport} disabled={exporting}>
            <Download aria-hidden="true" size={17} />
            {exporting ? "Building…" : "Excel"}
          </button>
        </div>
      </div>

      <div className="paper-stage">
        <article className="report-paper" aria-label="Accomplishment report document preview">
          <header className="report-header">
            <img src="/boac-seal.jpg" alt="Municipality of Boac seal" />
            <p>{report.country}</p>
            <p>{report.province}</p>
            <p>{report.municipality}</p>
            <div className="report-header__gap" />
            <p className="report-header__office">{report.office}</p>
            <div className="report-header__gap report-header__gap--small" />
            <h3>{report.title}</h3>
            <p>As of {formatPeriod(report.startDate, report.endDate)}</p>
          </header>

          <table className="report-table">
            <caption className="sr-only">Accomplishment activities grouped by date</caption>
            <colgroup>
              <col className="report-table__date" />
              <col className="report-table__description" />
              <col className="report-table__units" />
            </colgroup>
            <thead>
              <tr><th scope="col">DATE</th><th scope="col">DESCRIPTION</th><th scope="col">UNITS</th></tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr className="report-table__empty"><td>—</td><td>Add accomplishments to build this report.</td><td>—</td></tr>
              ) : groups.flatMap((group) =>
                group.activities.map((activity, index) => (
                  <tr key={activity.id}>
                    {index === 0 && <td rowSpan={group.activities.length}>{formatLongDate(group.date)}</td>}
                    <td>{activityDescription(activity)}</td>
                    <td>{activity.units}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>

          <section className="signatures" aria-label="Report signatories">
            <div className="signature signature--prepared">
              <p>Prepared by:</p>
              <strong>{report.preparedBy}</strong>
              <span>{report.preparedPosition}</span>
            </div>
            <div className="signature signature--noted">
              <p>Noted by:</p>
              <strong>{report.notedBy}</strong>
              <span>{report.notedPosition}</span>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}

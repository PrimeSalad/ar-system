import { AlertTriangle, Building2, ChevronDown, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import type { Report } from "../types";
import { reportIssues } from "../utils";

interface ReportDetailsProps {
  report: Report;
  onChange: (changes: Partial<Report>) => void;
}
export function ReportDetails({ report, onChange }: ReportDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const issues = reportIssues(report);

  return (
    <section className={`card details-card ${expanded ? "details-card--expanded" : ""}`}>
      <button className="details-card__toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <div className="details-card__summary">
          <div className="summary-icon"><Building2 aria-hidden="true" size={20} /></div>
          <div>
            <strong>Report details & signatories</strong>
            <span>{report.office} · {report.preparedBy} · {report.notedBy}</span>
          </div>
        </div>
        <div className="details-card__status">
          {issues.length > 0 && <span className="issue-count"><AlertTriangle aria-hidden="true" size={15} /> {issues.length}</span>}
          <ChevronDown aria-hidden="true" size={20} />
        </div>
      </button>

      {expanded && (
        <div className="details-card__body">
          {issues.length > 0 && (
            <div className="inline-alert inline-alert--warning" role="status">
              <AlertTriangle aria-hidden="true" size={19} />
              <div>
                <strong>Review before export</strong>
                {issues.map((issue) => <p key={issue}>{issue}</p>)}
              </div>
            </div>
          )}

          <fieldset>
            <legend><Building2 aria-hidden="true" size={18} /> Document header</legend>
            <div className="form-grid form-grid--three">
              <div className="field-group">
                <label htmlFor="report-office">Office</label>
                <input id="report-office" value={report.office} onChange={(event) => onChange({ office: event.target.value })} />
              </div>
              <div className="field-group field-group--span-two">
                <label htmlFor="report-title">Report title</label>
                <input id="report-title" value={report.title} onChange={(event) => onChange({ title: event.target.value })} />
              </div>
              <div className="field-group">
                <label htmlFor="report-country">Country heading</label>
                <input id="report-country" value={report.country} onChange={(event) => onChange({ country: event.target.value })} />
              </div>
              <div className="field-group">
                <label htmlFor="report-province">Province heading</label>
                <input id="report-province" value={report.province} onChange={(event) => onChange({ province: event.target.value })} />
              </div>
              <div className="field-group">
                <label htmlFor="report-municipality">Municipality heading</label>
                <input id="report-municipality" value={report.municipality} onChange={(event) => onChange({ municipality: event.target.value })} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend><UserRoundCheck aria-hidden="true" size={18} /> Signatories</legend>
            <div className="form-grid form-grid--two">
              <div className="field-group">
                <label htmlFor="prepared-by">Prepared by</label>
                <input id="prepared-by" value={report.preparedBy} onChange={(event) => onChange({ preparedBy: event.target.value })} />
              </div>
              <div className="field-group">
                <label htmlFor="prepared-position">Position</label>
                <input id="prepared-position" value={report.preparedPosition} onChange={(event) => onChange({ preparedPosition: event.target.value })} />
              </div>
              <div className="field-group">
                <label htmlFor="noted-by">Noted by</label>
                <input id="noted-by" value={report.notedBy} onChange={(event) => onChange({ notedBy: event.target.value })} />
              </div>
              <div className="field-group">
                <label htmlFor="noted-position">Position</label>
                <input id="noted-position" value={report.notedPosition} onChange={(event) => onChange({ notedPosition: event.target.value })} />
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </section>
  );
}

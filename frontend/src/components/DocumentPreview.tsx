import { Check, Download, PencilLine, Printer, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATEGORY_OPTIONS, type Activity, type Report } from "../types";
import { activityDescription, formatLongDate, formatPeriod, sortedActivities } from "../utils";

interface DocumentPreviewProps {
  report: Report;
  exporting: boolean;
  onExport: () => void;
  onPrint: () => void;
  onUpdateActivity: (activity: Activity) => void;
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

type PreviewEditErrors = Partial<Record<"date" | "details" | "units", string>>;
type PreviewActivityDraft = Omit<Activity, "units"> & { units: string };

export function DocumentPreview({
  report,
  exporting,
  onExport,
  onPrint,
  onUpdateActivity,
}: DocumentPreviewProps) {
  const groups = groupActivities(report.activities);
  const [editing, setEditing] = useState<PreviewActivityDraft | null>(null);
  const [errors, setErrors] = useState<PreviewEditErrors>({});
  const detailsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditing(null);
    setErrors({});
  }, [report.id]);

  useEffect(() => {
    if (editing) detailsRef.current?.focus();
  }, [editing?.id]);

  const beginEdit = (activity: Activity) => {
    setEditing({ ...activity, units: String(activity.units) });
    setErrors({});
  };

  const updateEditing = <Field extends keyof PreviewActivityDraft>(
    field: Field,
    value: PreviewActivityDraft[Field],
  ) => {
    setEditing((current) => current ? { ...current, [field]: value } : current);
    if (field === "date" || field === "details" || field === "units") {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const savePreviewEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const nextErrors: PreviewEditErrors = {};
    const details = editing.details.trim();
    const units = Number(editing.units);
    if (!editing.date) nextErrors.date = "Choose the accomplishment date.";
    else if (editing.date < report.startDate || editing.date > report.endDate) {
      nextErrors.date = "Date must be inside the reporting period.";
    }
    if (details.length < 3) nextErrors.details = "Describe the accomplishment in at least 3 characters.";
    else if (details.length > 2_500) nextErrors.details = "Keep the description within 2,500 characters.";
    if (!Number.isInteger(units) || units < 1) {
      nextErrors.units = "Units must be a positive whole number.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onUpdateActivity({ ...editing, details, units });
    setEditing(null);
    setErrors({});
  };

  return (
    <section className="preview-panel" aria-labelledby="preview-title">
      <div className="preview-toolbar">
        <div>
          <p className="eyebrow">Document preview</p>
          <h2 id="preview-title">Report preview</h2>
          <p className="preview-toolbar__hint">Select an accomplishment description to edit it here.</p>
        </div>
        <div className="preview-toolbar__actions">
          <button
            className="button button--icon-text button--outline"
            type="button"
            onClick={onPrint}
            disabled={Boolean(editing)}
            aria-label="Print or save the report as PDF"
          >
            <Printer aria-hidden="true" size={17} />
            Print / PDF
          </button>
          <button
            className="button button--icon-text button--primary"
            type="button"
            onClick={onExport}
            disabled={exporting || Boolean(editing)}
            aria-label={exporting ? "Building Excel file" : "Export report to Excel"}
          >
            <Download aria-hidden="true" size={17} />
            {exporting ? "Building…" : "Excel"}
          </button>
        </div>
      </div>

      {editing && (
        <form className="preview-inline-editor" onSubmit={savePreviewEdit} noValidate aria-labelledby="preview-editor-title">
          <div className="preview-inline-editor__header">
            <div>
              <p className="eyebrow">Editing from preview</p>
              <h3 id="preview-editor-title">Update accomplishment</h3>
              <p>Review the full row, then save it back to the report.</p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => { setEditing(null); setErrors({}); }}
              aria-label="Cancel preview editing"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <div className="preview-inline-editor__grid">
            <div className="field-group">
              <label htmlFor="preview-edit-date">Date</label>
              <input
                id="preview-edit-date"
                type="date"
                min={report.startDate}
                max={report.endDate}
                value={editing.date}
                onChange={(event) => updateEditing("date", event.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? "preview-edit-date-error" : undefined}
              />
              {errors.date && <p className="field-error" id="preview-edit-date-error">{errors.date}</p>}
            </div>

            <div className="field-group preview-inline-editor__category">
              <label htmlFor="preview-edit-category">Work category</label>
              <select
                id="preview-edit-category"
                value={editing.category}
                onChange={(event) => updateEditing("category", event.target.value)}
              >
                {!CATEGORY_OPTIONS.some((category) => category === editing.category) && editing.category !== "Custom" && (
                  <option value={editing.category}>{editing.category}</option>
                )}
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
                <option value="Custom">Custom / description only</option>
              </select>
            </div>

            <div className="field-group preview-inline-editor__units">
              <label htmlFor="preview-edit-units">Units</label>
              <input
                id="preview-edit-units"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={editing.units}
                onChange={(event) => updateEditing("units", event.target.value)}
                aria-invalid={Boolean(errors.units)}
                aria-describedby={errors.units ? "preview-edit-units-error" : undefined}
              />
              {errors.units && <p className="field-error" id="preview-edit-units-error">{errors.units}</p>}
            </div>

            <div className="field-group preview-inline-editor__details">
              <label htmlFor="preview-edit-details">What was accomplished?</label>
              <textarea
                ref={detailsRef}
                id="preview-edit-details"
                rows={4}
                maxLength={2_500}
                value={editing.details}
                onChange={(event) => updateEditing("details", event.target.value)}
                aria-invalid={Boolean(errors.details)}
                aria-describedby={errors.details ? "preview-edit-details-error" : "preview-edit-details-help"}
              />
              {errors.details ? (
                <p className="field-error" id="preview-edit-details-error">{errors.details}</p>
              ) : (
                <p className="field-help" id="preview-edit-details-help">This updates the selected row only. Category, date, and units stay editable above.</p>
              )}
            </div>
          </div>

          <div className="preview-inline-editor__actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={() => { setEditing(null); setErrors({}); }}
            >
              <X aria-hidden="true" size={17} />
              Cancel
            </button>
            <button className="button button--primary" type="submit">
              <Check aria-hidden="true" size={17} />
              Save changes
            </button>
          </div>
        </form>
      )}

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
            <p className="report-header__period">As of {formatPeriod(report.startDate, report.endDate)}</p>
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
                  <tr key={activity.id} className={editing?.id === activity.id ? "report-table__row--editing" : undefined}>
                    {index === 0 && <td rowSpan={group.activities.length}>{formatLongDate(group.date)}</td>}
                    <td>
                      <button
                        className="report-edit-trigger"
                        type="button"
                        onClick={() => beginEdit(activity)}
                        disabled={Boolean(editing)}
                        aria-label={`Edit accomplishment: ${activityDescription(activity)}`}
                      >
                        <span>
                          {activity.category.toLowerCase() === "custom" ? (
                            activity.details
                          ) : (
                            <><strong>{activity.category}: </strong>{activity.details}</>
                          )}
                        </span>
                        <PencilLine aria-hidden="true" size={13} />
                      </button>
                    </td>
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

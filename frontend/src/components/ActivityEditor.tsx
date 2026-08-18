import { CalendarDays, Check, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CATEGORY_OPTIONS, type Activity, type Report } from "../types";
import { clampDateToPeriod, toIsoDate } from "../utils";

interface ActivityEditorProps {
  report: Report;
  editing: Activity | null;
  onSubmit: (activity: Activity) => void;
  onCancelEdit: () => void;
  onOpenAi: () => void;
}

interface DraftActivity {
  date: string;
  category: string;
  details: string;
  units: string;
}

function freshDraft(report: Report): DraftActivity {
  return {
    date: clampDateToPeriod(toIsoDate(new Date()), report.startDate, report.endDate),
    category: CATEGORY_OPTIONS[0],
    details: "",
    units: "1",
  };
}

export function ActivityEditor({ report, editing, onSubmit, onCancelEdit, onOpenAi }: ActivityEditorProps) {
  const [draft, setDraft] = useState<DraftActivity>(() => freshDraft(report));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editing) {
      setDraft({
        date: editing.date,
        category: editing.category,
        details: editing.details,
        units: String(editing.units),
      });
    } else {
      setDraft((current) => ({
        ...freshDraft(report),
        date:
          current.date >= report.startDate && current.date <= report.endDate
            ? current.date
            : clampDateToPeriod(current.date, report.startDate, report.endDate),
      }));
    }
    setErrors({});
  }, [editing, report.id, report.startDate, report.endDate]);

  const update = (field: keyof DraftActivity, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const reset = () => {
    setDraft(freshDraft(report));
    setErrors({});
    onCancelEdit();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const units = Number(draft.units);
    if (!draft.date) nextErrors.date = "Choose the accomplishment date.";
    else if (draft.date < report.startDate || draft.date > report.endDate) {
      nextErrors.date = "Date must be inside the reporting period.";
    }
    if (!draft.details.trim() || draft.details.trim().length < 3) {
      nextErrors.details = "Describe the accomplishment in at least 3 characters.";
    }
    if (!Number.isInteger(units) || units < 1) nextErrors.units = "Units must be a positive whole number.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      id: editing?.id ?? crypto.randomUUID(),
      date: draft.date,
      category: draft.category,
      details: draft.details.trim(),
      units,
    });
    setDraft((current) => ({ ...freshDraft(report), date: current.date }));
    setErrors({});
  };

  return (
    <section className="card entry-card" aria-labelledby="entry-title">
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">New report entry</p>
          <h2 id="entry-title">{editing ? "Edit accomplishment" : "Add accomplishment"}</h2>
          <p>Record one measurable output, or let Gemini structure rough notes for you.</p>
        </div>
        <button className="button button--ai button--compact" type="button" onClick={onOpenAi}>
          <Sparkles aria-hidden="true" size={17} />
          Turn notes into entries
        </button>
      </div>

      <form className="entry-form" onSubmit={handleSubmit} noValidate>
        <div className="entry-form__topline">
          <div className="field-group">
            <label htmlFor="activity-date">Date</label>
            <div className="input-with-icon">
              <CalendarDays aria-hidden="true" size={17} />
              <input
                id="activity-date"
                type="date"
                min={report.startDate}
                max={report.endDate}
                value={draft.date}
                onChange={(event) => update("date", event.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? "activity-date-error" : undefined}
              />
            </div>
            {errors.date && <p className="field-error" id="activity-date-error">{errors.date}</p>}
          </div>

          <div className="field-group field-group--units">
            <label htmlFor="activity-units">Units</label>
            <input
              id="activity-units"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={draft.units}
              onChange={(event) => update("units", event.target.value)}
              aria-invalid={Boolean(errors.units)}
              aria-describedby={errors.units ? "activity-units-error" : undefined}
            />
            {errors.units && <p className="field-error" id="activity-units-error">{errors.units}</p>}
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="activity-category">Work category</label>
          <select
            id="activity-category"
            value={draft.category}
            onChange={(event) => update("category", event.target.value)}
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
            <option value="Custom">Custom / description only</option>
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="activity-details">What was accomplished?</label>
          <textarea
            id="activity-details"
            rows={4}
            value={draft.details}
            onChange={(event) => update("details", event.target.value)}
            placeholder="Example: Communicated with 12 SK chairpersons regarding the upcoming quarterly meeting"
            aria-invalid={Boolean(errors.details)}
            aria-describedby={errors.details ? "activity-details-error" : "activity-details-help"}
          />
          {errors.details ? (
            <p className="field-error" id="activity-details-error">{errors.details}</p>
          ) : (
            <p className="field-help" id="activity-details-help">Use past tense and include the measurable result. The category is added automatically.</p>
          )}
        </div>

        <div className="entry-form__actions">
          {(editing || draft.details) && (
            <button className="button button--ghost" type="button" onClick={reset}>
              <RotateCcw aria-hidden="true" size={17} />
              Reset
            </button>
          )}
          <button className="button button--primary" type="submit">
            {editing ? <Check aria-hidden="true" size={17} /> : <Plus aria-hidden="true" size={17} />}
            {editing ? "Save changes" : "Add to report"}
          </button>
        </div>
      </form>
    </section>
  );
}

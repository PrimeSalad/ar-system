import { CalendarDays, Check, ListPlus, LoaderCircle, Plus, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CATEGORY_OPTIONS, type Activity, type Report } from "../types";
import { clampDateToPeriod, toIsoDate } from "../utils";

const MAX_BULK_ENTRIES = 50;
const MAX_REPORT_ENTRIES = 250;

interface ActivityEditorProps {
  report: Report;
  editing: Activity | null;
  aiReady: boolean;
  onSubmit: (activities: Activity[]) => void;
  onCancelEdit: () => void;
  onOpenAi: () => void;
  onOpenSettings: () => void;
  onImprove: (notes: string) => Promise<string>;
  onImproveBulk: (notes: string[]) => Promise<string[]>;
}

interface DraftActivity {
  date: string;
  category: string;
  details: string;
  units: string;
}

interface BulkEntryDraft {
  details: string;
  category: string;
  units: string;
}

type EntryMode = "single" | "bulk";
type AiFeedback = { tone: "success" | "error"; message: string } | null;

function freshDraft(report: Report): DraftActivity {
  return {
    date: clampDateToPeriod(toIsoDate(new Date()), report.startDate, report.endDate),
    category: CATEGORY_OPTIONS[0],
    details: "",
    units: "1",
  };
}

export function parseBulkAccomplishments(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "").trim())
    .filter(Boolean);
}

function syncBulkRows(
  details: string[],
  current: BulkEntryDraft[],
  defaultCategory: string,
  defaultUnits: string,
): BulkEntryDraft[] {
  return details.map((detail, index) => ({
    details: detail,
    category: current[index]?.category ?? defaultCategory,
    units: current[index]?.units ?? defaultUnits,
  }));
}

export function ActivityEditor({
  report,
  editing,
  aiReady,
  onSubmit,
  onCancelEdit,
  onOpenAi,
  onOpenSettings,
  onImprove,
  onImproveBulk,
}: ActivityEditorProps) {
  const [draft, setDraft] = useState<DraftActivity>(() => freshDraft(report));
  const [bulkRows, setBulkRows] = useState<BulkEntryDraft[]>([]);
  const [mode, setMode] = useState<EntryMode>("single");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [improving, setImproving] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback>(null);
  const isBulk = mode === "bulk" && !editing;

  useEffect(() => {
    if (editing) {
      setMode("single");
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
    setBulkRows([]);
    setErrors({});
    setAiFeedback(null);
  }, [editing, report.id, report.startDate, report.endDate]);

  const update = (field: keyof DraftActivity, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "details" && isBulk) {
      const details = parseBulkAccomplishments(value);
      setBulkRows((current) => syncBulkRows(details, current, draft.category, draft.units));
    }
    setErrors((current) => ({ ...current, [field]: "" }));
    if (field === "details") setAiFeedback(null);
  };

  const switchMode = (nextMode: EntryMode) => {
    setMode(nextMode);
    if (nextMode === "bulk") {
      setBulkRows((current) => syncBulkRows(
        parseBulkAccomplishments(draft.details),
        current,
        draft.category,
        draft.units,
      ));
    }
    setErrors({});
    setAiFeedback(null);
  };

  const reset = () => {
    setDraft(freshDraft(report));
    setBulkRows([]);
    setMode("single");
    setErrors({});
    setAiFeedback(null);
    onCancelEdit();
  };

  const handleImprove = async () => {
    const roughNote = draft.details.trim();
    if (!aiReady) {
      onOpenSettings();
      return;
    }
    if (roughNote.length < 3) {
      setErrors((current) => ({ ...current, details: "Type a rough accomplishment first, then ask Gemini to improve it." }));
      return;
    }
    if (roughNote.length > 2_500) {
      setErrors((current) => ({ ...current, details: "Keep the rough accomplishment within 2,500 characters." }));
      return;
    }

    setImproving(true);
    setAiFeedback(null);
    try {
      const improved = await onImprove(roughNote);
      setDraft((current) => ({ ...current, details: improved }));
      setErrors((current) => ({ ...current, details: "" }));
      setAiFeedback({ tone: "success", message: "Gemini improved the description. Review it before adding." });
    } catch (error) {
      setAiFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Gemini could not improve the description.",
      });
    } finally {
      setImproving(false);
    }
  };

  const handleImproveBulk = async () => {
    if (!aiReady) {
      onOpenSettings();
      return;
    }
    if (bulkRows.length === 0) {
      setErrors((current) => ({ ...current, details: "Enter at least one accomplishment before asking Gemini to improve it." }));
      return;
    }
    if (bulkRows.length > MAX_BULK_ENTRIES) {
      setErrors((current) => ({ ...current, details: `Improve up to ${MAX_BULK_ENTRIES} accomplishments at a time.` }));
      return;
    }
    if (bulkRows.some((row) => row.details.length < 3)) {
      setErrors((current) => ({ ...current, details: "Each accomplishment must contain at least 3 characters." }));
      return;
    }
    if (bulkRows.some((row) => row.details.length > 2_500)) {
      setErrors((current) => ({ ...current, details: "Keep each accomplishment within 2,500 characters." }));
      return;
    }

    setImproving(true);
    setAiFeedback(null);
    try {
      const improved = await onImproveBulk(bulkRows.map((row) => row.details));
      if (improved.length !== bulkRows.length) {
        throw new Error("Gemini changed the number of entries. Please try again.");
      }
      setBulkRows((current) => improved.map((details, index) => ({
        ...current[index]!,
        details,
      })));
      setDraft((current) => ({ ...current, details: improved.join("\n") }));
      setErrors((current) => ({ ...current, details: "" }));
      setAiFeedback({
        tone: "success",
        message: `Gemini improved ${improved.length} ${improved.length === 1 ? "description" : "descriptions"}. Review every category and unit before adding.`,
      });
    } catch (error) {
      setAiFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Gemini could not improve the descriptions.",
      });
    } finally {
      setImproving(false);
    }
  };

  const updateBulkRow = (index: number, field: "category" | "units", value: string) => {
    setBulkRows((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
    setErrors((current) => ({ ...current, [`bulk-units-${index}`]: "" }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const units = Number(draft.units);
    const details = isBulk ? bulkRows.map((row) => row.details) : [draft.details.trim()].filter(Boolean);

    if (!draft.date) nextErrors.date = "Choose the accomplishment date.";
    else if (draft.date < report.startDate || draft.date > report.endDate) {
      nextErrors.date = "Date must be inside the reporting period.";
    }
    if (isBulk && details.length === 0) {
      nextErrors.details = "Enter at least one accomplishment, with one item per line.";
    } else if (isBulk && details.length > MAX_BULK_ENTRIES) {
      nextErrors.details = `Add up to ${MAX_BULK_ENTRIES} accomplishments at a time.`;
    } else if (details.some((detail) => detail.length < 3)) {
      nextErrors.details = isBulk
        ? "Each accomplishment must contain at least 3 characters."
        : "Describe the accomplishment in at least 3 characters.";
    } else if (details.some((detail) => detail.length > 2_500)) {
      nextErrors.details = "Keep each accomplishment within 2,500 characters.";
    }
    if (!isBulk && (!Number.isInteger(units) || units < 1)) {
      nextErrors.units = "Units must be a positive whole number.";
    }
    if (isBulk) {
      bulkRows.forEach((row, index) => {
        const rowUnits = Number(row.units);
        if (!Number.isInteger(rowUnits) || rowUnits < 1) {
          nextErrors[`bulk-units-${index}`] = "Enter a positive whole number.";
        }
      });
    }
    if (!editing && report.activities.length + details.length > MAX_REPORT_ENTRIES) {
      const remaining = Math.max(0, MAX_REPORT_ENTRIES - report.activities.length);
      nextErrors.details = remaining
        ? `This report can accept ${remaining} more ${remaining === 1 ? "entry" : "entries"}.`
        : "This report already contains the maximum of 250 entries.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const activities = isBulk
      ? bulkRows.map((row) => ({
          id: crypto.randomUUID(),
          date: draft.date,
          category: row.category,
          details: row.details,
          units: Number(row.units),
        }))
      : details.map((detail) => ({
          id: editing?.id ?? crypto.randomUUID(),
          date: draft.date,
          category: draft.category,
          details: detail,
          units,
        }));
    onSubmit(activities);
    setBulkRows([]);
    setDraft((current) => ({
      ...freshDraft(report),
      date: current.date,
      category: isBulk ? current.category : CATEGORY_OPTIONS[0],
      units: isBulk ? current.units : "1",
    }));
    setErrors({});
    setAiFeedback(null);
  };

  const detailsFeedbackId = errors.details
    ? "activity-details-error"
    : aiFeedback
      ? "activity-details-ai-feedback"
      : "activity-details-help";

  return (
    <section className="card entry-card" aria-labelledby="entry-title">
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">{isBulk ? "Bulk report entries" : "New report entry"}</p>
          <h2 id="entry-title">
            {editing ? "Edit accomplishment" : isBulk ? "Add several accomplishments" : "Add accomplishment"}
          </h2>
          <p>
            {isBulk
              ? "Use one date for the day, then enter each completed task on its own line."
              : "Record one measurable output, or let Gemini improve your rough wording."}
          </p>
        </div>
        <button className="button button--ai button--compact" type="button" onClick={onOpenAi}>
          <Sparkles aria-hidden="true" size={17} />
          Turn notes into entries
        </button>
      </div>

      {!editing && (
        <div className="entry-mode-switch" role="group" aria-label="Entry method">
          <button type="button" aria-pressed={mode === "single"} onClick={() => switchMode("single")}>
            <Plus aria-hidden="true" size={16} /> Single entry
          </button>
          <button type="button" aria-pressed={mode === "bulk"} onClick={() => switchMode("bulk")}>
            <ListPlus aria-hidden="true" size={16} /> Bulk same-day
          </button>
        </div>
      )}

      <form className="entry-form" onSubmit={handleSubmit} noValidate>
        <div className={`entry-form__topline${isBulk ? " entry-form__topline--bulk" : ""}`}>
          <div className="field-group">
            <label htmlFor="activity-date">{isBulk ? "Shared date" : "Date"}</label>
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

          {!isBulk && (
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
          )}
        </div>

        {!isBulk && (
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
        )}

        <div className="field-group">
          <label htmlFor="activity-details">
            {isBulk ? "What was accomplished? (one per line)" : "What was accomplished?"}
          </label>
          <textarea
            id="activity-details"
            rows={isBulk ? 8 : 4}
            value={draft.details}
            onChange={(event) => update("details", event.target.value)}
            placeholder={isBulk
              ? "Prepared meeting invitations\nDistributed documents to four offices\nUpdated the participant database"
              : "Example: Communicated with 12 SK chairpersons regarding the upcoming quarterly meeting"}
            maxLength={isBulk ? 30_000 : 2_500}
            disabled={improving}
            aria-invalid={Boolean(errors.details || aiFeedback?.tone === "error")}
            aria-describedby={detailsFeedbackId}
          />
          <div className="field-assist-row">
            {errors.details ? (
              <p className="field-error" id="activity-details-error">{errors.details}</p>
            ) : aiFeedback ? (
              <p className={`field-feedback field-feedback--${aiFeedback.tone}`} id="activity-details-ai-feedback" role="status">
                {aiFeedback.message}
              </p>
            ) : (
              <p className="field-help" id="activity-details-help">
                {isBulk
                  ? "Every non-empty line becomes a separate row. Set its own work category and units below."
                  : "Type rough English, Filipino, or Taglish. Gemini can improve it without inventing facts."}
              </p>
            )}

            {isBulk ? (
              <div className="bulk-assist-actions">
                <span className="bulk-ready-count" aria-live="polite">
                  {bulkRows.length} {bulkRows.length === 1 ? "entry" : "entries"} ready
                </span>
                <button
                  className="button button--ai button--field-ai"
                  type="button"
                  onClick={aiReady ? handleImproveBulk : onOpenSettings}
                  disabled={improving}
                  aria-busy={improving}
                >
                  {improving
                    ? <LoaderCircle className="spin" aria-hidden="true" size={16} />
                    : <WandSparkles aria-hidden="true" size={16} />}
                  {improving ? "Improving all…" : aiReady ? "Improve all with AI" : "Connect Gemini"}
                </button>
              </div>
            ) : (
              <button
                className="button button--ai button--field-ai"
                type="button"
                onClick={aiReady ? handleImprove : onOpenSettings}
                disabled={improving}
                aria-busy={improving}
              >
                {improving
                  ? <LoaderCircle className="spin" aria-hidden="true" size={16} />
                  : <WandSparkles aria-hidden="true" size={16} />}
                {improving ? "Improving…" : aiReady ? "Improve with AI" : "Connect Gemini"}
              </button>
            )}
          </div>
        </div>

        {isBulk && bulkRows.length > 0 && (
          <fieldset className="bulk-entry-review" disabled={improving}>
            <legend>Review each entry</legend>
            <p className="bulk-entry-review__help">
              Category and units apply only to their own accomplishment.
            </p>
            <div className="bulk-entry-review__list">
              {bulkRows.map((row, index) => {
                const unitsError = errors[`bulk-units-${index}`];
                return (
                  <div className="bulk-entry-row" key={`${index}-${row.details}`}>
                    <div className="bulk-entry-row__header">
                      <span className="bulk-entry-row__number" aria-hidden="true">{index + 1}</span>
                      <p>{row.details}</p>
                    </div>
                    <div className="bulk-entry-row__controls">
                      <div className="field-group">
                        <label htmlFor={`bulk-category-${index}`}>Work category</label>
                        <select
                          id={`bulk-category-${index}`}
                          value={row.category}
                          onChange={(event) => updateBulkRow(index, "category", event.target.value)}
                        >
                          {CATEGORY_OPTIONS.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                          <option value="Custom">Custom / description only</option>
                        </select>
                      </div>
                      <div className="field-group field-group--units">
                        <label htmlFor={`bulk-units-${index}`}>Units</label>
                        <input
                          id={`bulk-units-${index}`}
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={row.units}
                          onChange={(event) => updateBulkRow(index, "units", event.target.value)}
                          aria-invalid={Boolean(unitsError)}
                          aria-describedby={unitsError ? `bulk-units-${index}-error` : undefined}
                        />
                        {unitsError && (
                          <p className="field-error" id={`bulk-units-${index}-error`}>{unitsError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="entry-form__actions">
          {(editing || draft.details) && (
            <button className="button button--ghost" type="button" onClick={reset} disabled={improving}>
              <RotateCcw aria-hidden="true" size={17} />
              Reset
            </button>
          )}
          <button className="button button--primary" type="submit" disabled={improving}>
            {editing
              ? <Check aria-hidden="true" size={17} />
              : isBulk
                ? <ListPlus aria-hidden="true" size={17} />
                : <Plus aria-hidden="true" size={17} />}
            {editing
              ? "Save changes"
              : isBulk
                ? bulkRows.length
                  ? `Add ${bulkRows.length} ${bulkRows.length === 1 ? "entry" : "entries"}`
                  : "Add entries"
                : "Add to report"}
          </button>
        </div>
      </form>
    </section>
  );
}

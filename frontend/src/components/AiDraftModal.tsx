import { AlertCircle, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { generateAiDraft } from "../api";
import type { Activity, Report } from "../types";
import { clampDateToPeriod, toIsoDate } from "../utils";
import { SESSION_KEY_NAME } from "./SettingsModal";
import { Modal } from "./Modal";

interface AiDraftModalProps {
  open: boolean;
  report: Report;
  serverConfigured: boolean;
  onClose: () => void;
  onAdd: (activities: Activity[]) => void;
  onOpenSettings: () => void;
}

function suggestedDate(report: Report): string {
  return clampDateToPeriod(toIsoDate(new Date()), report.startDate, report.endDate);
}

export function AiDraftModal({
  open,
  report,
  serverConfigured,
  onClose,
  onAdd,
  onOpenSettings,
}: AiDraftModalProps) {
  const [notes, setNotes] = useState("");
  const [defaultDate, setDefaultDate] = useState(() => suggestedDate(report));
  const [defaultUnits, setDefaultUnits] = useState("1");
  const [unitsError, setUnitsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasSessionKey = Boolean(sessionStorage.getItem(SESSION_KEY_NAME));
  const canGenerate = serverConfigured || hasSessionKey;

  useEffect(() => {
    if (open) setDefaultDate(suggestedDate(report));
  }, [open, report.id, report.startDate, report.endDate]);

  const handleGenerate = async () => {
    if (!notes.trim()) {
      setError("Add at least one rough accomplishment note.");
      return;
    }
    const parsedDefaultUnits = Number(defaultUnits);
    if (!Number.isInteger(parsedDefaultUnits) || parsedDefaultUnits < 1 || parsedDefaultUnits > 1_000_000) {
      setUnitsError("Enter a positive whole number up to 1,000,000.");
      return;
    }
    if (report.startDate > report.endDate) {
      setError("Set a valid reporting period before creating entries.");
      return;
    }
    const safeDefaultDate = clampDateToPeriod(defaultDate, report.startDate, report.endDate);
    setDefaultDate(safeDefaultDate);
    setLoading(true);
    setError("");
    try {
      const activities = await generateAiDraft(
        report,
        notes,
        sessionStorage.getItem(SESSION_KEY_NAME) ?? undefined,
        safeDefaultDate,
        parsedDefaultUnits,
      );
      onAdd(activities);
      setNotes("");
      setDefaultUnits("1");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gemini could not generate a draft.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Turn your work story into entries"
      description="Write naturally in English, Filipino, or Taglish. Gemini will identify the completed work and turn it into editable report entries."
      size="large"
    >
      <div className="ai-note">
        <Sparkles aria-hidden="true" size={18} />
        <p>Tell it the way you would explain your day to a coworker. It can separate several accomplishments from one paragraph without changing the facts.</p>
      </div>

      {!canGenerate && (
        <div className="inline-alert inline-alert--warning" role="status">
          <AlertCircle aria-hidden="true" size={20} />
          <div>
            <strong>Connect Gemini first</strong>
            <p>Add your free API key in Settings to activate drafting.</p>
          </div>
          <button className="button button--small button--outline" type="button" onClick={onOpenSettings}>
            Open settings
          </button>
        </div>
      )}

      <div className="ai-draft-defaults">
        <div className="field-group">
          <label htmlFor="ai-default-date">Date to use when your story has no date</label>
          <input
            id="ai-default-date"
            type="date"
            min={report.startDate}
            max={report.endDate}
            value={defaultDate}
            onChange={(event) => setDefaultDate(
              clampDateToPeriod(event.target.value, report.startDate, report.endDate),
            )}
            disabled={loading}
            required
          />
          <p className="field-help">Past periods are supported. This date always stays inside the selected period.</p>
        </div>

        <div className="field-group">
          <label htmlFor="ai-default-units">Units when not stated</label>
          <input
            id="ai-default-units"
            type="number"
            min="1"
            max="1000000"
            step="1"
            inputMode="numeric"
            value={defaultUnits}
            onChange={(event) => {
              setDefaultUnits(event.target.value);
              setUnitsError("");
            }}
            disabled={loading}
            required
            aria-invalid={Boolean(unitsError)}
            aria-describedby={unitsError ? "ai-default-units-error" : "ai-default-units-help"}
          />
          {unitsError ? (
            <p className="field-error" id="ai-default-units-error">{unitsError}</p>
          ) : (
            <p className="field-help" id="ai-default-units-help">Quantities written in your story take priority.</p>
          )}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="rough-notes">What did you work on?</label>
        <textarea
          id="rough-notes"
          rows={10}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setError("");
          }}
          placeholder="Example: Kanina nag-coordinate ako sa 12 SK chairpersons tungkol sa quarterly meeting. Pagkatapos, nag-deliver din ako ng 4 na letters sa iba't ibang municipal offices at chineck ko ang Gmail at Messenger para sa mga bagong concern."
          autoFocus
          disabled={loading}
          maxLength={12_000}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "ai-draft-error" : "rough-notes-help"}
        />
        <div className="ai-field-meta">
          <p className="field-help" id="rough-notes-help">Dates and quantities help, but you can write a normal paragraph.</p>
          <span>{notes.length.toLocaleString()} / 12,000</span>
        </div>
      </div>

      {error && (
        <div className="inline-alert inline-alert--error" id="ai-draft-error" role="alert">
          <AlertCircle aria-hidden="true" size={20} />
          <p>{error}</p>
        </div>
      )}

      <div className="modal__actions">
        <button className="button button--ghost" type="button" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button
          className="button button--primary"
          type="button"
          onClick={handleGenerate}
          disabled={loading || !canGenerate || !defaultDate || !defaultUnits}
          aria-busy={loading}
        >
          {loading ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : <WandSparkles aria-hidden="true" size={18} />}
          {loading ? "Understanding your story…" : "Create report entries"}
        </button>
      </div>
    </Modal>
  );
}

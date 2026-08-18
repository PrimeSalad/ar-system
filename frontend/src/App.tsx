import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  CloudCheck,
  CloudCog,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteReport, downloadExcel, getAiStatus, getReports, saveReport } from "./api";
import { ActivityEditor } from "./components/ActivityEditor";
import { ActivityList } from "./components/ActivityList";
import { AiDraftModal } from "./components/AiDraftModal";
import { DocumentPreview } from "./components/DocumentPreview";
import { ReportDetails } from "./components/ReportDetails";
import { SESSION_KEY_NAME, SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { useAutosave } from "./hooks/useAutosave";
import type { Activity, AiStatus, Report, SaveState } from "./types";
import { countWorkDays, createBlankReport, formatPeriod, reportIssues } from "./utils";

interface ToastState {
  message: string;
  tone: "success" | "error" | "info";
}

const initialAiStatus: AiStatus = { configured: false, model: "gemini-3.5-flash" };

export default function App() {
  const [reports, setReports] = useState<Report[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [exporting, setExporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>(initialAiStatus);
  const [sessionKeyVersion, setSessionKeyVersion] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  const hasSessionKey = useMemo(
    () => Boolean(sessionStorage.getItem(SESSION_KEY_NAME)),
    // This number changes whenever Settings saves session storage.
    [sessionKeyVersion],
  );

  useEffect(() => {
    let active = true;
    Promise.allSettled([getReports(), getAiStatus()]).then(async ([reportsResult, aiResult]) => {
      if (!active) return;
      if (aiResult.status === "fulfilled") setAiStatus(aiResult.value);
      if (reportsResult.status === "rejected") {
        setLoadError(reportsResult.reason instanceof Error ? reportsResult.reason.message : "Could not reach the backend.");
        setLoading(false);
        return;
      }

      let loadedReports = reportsResult.value;
      if (loadedReports.length === 0) {
        const blank = createBlankReport();
        try {
          const saved = await saveReport(blank);
          loadedReports = [saved];
        } catch {
          loadedReports = [blank];
        }
      }
      if (!active) return;
      setReports(loadedReports);
      setReport(loadedReports[0] ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useAutosave(
    report,
    !loading && !loadError,
    setSaveState,
    (saved) => {
      setReports((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
      });
    },
    (message) => setToast({ message, tone: "error" }),
  );

  const updateReport = (changes: Partial<Report>) => {
    setReport((current) => (current ? { ...current, ...changes } : current));
  };

  const saveActivity = (activity: Activity) => {
    if (!report) return;
    const exists = report.activities.some((item) => item.id === activity.id);
    updateReport({
      activities: exists
        ? report.activities.map((item) => (item.id === activity.id ? activity : item))
        : [...report.activities, activity],
    });
    setEditing(null);
    setToast({ message: exists ? "Accomplishment updated." : "Accomplishment added to the report.", tone: "success" });
  };

  const addAiActivities = (activities: Activity[]) => {
    if (!report) return;
    updateReport({ activities: [...report.activities, ...activities] });
    setToast({
      message: `Gemini added ${activities.length} editable ${activities.length === 1 ? "row" : "rows"}. Review them before export.`,
      tone: "success",
    });
  };

  const handleDeleteActivity = (activity: Activity) => {
    if (!report) return;
    if (!window.confirm(`Delete this accomplishment?\n\n${activity.details}`)) return;
    updateReport({ activities: report.activities.filter((item) => item.id !== activity.id) });
    if (editing?.id === activity.id) setEditing(null);
    setToast({ message: "Accomplishment deleted.", tone: "info" });
  };

  const handleNewReport = () => {
    const next = createBlankReport();
    setReports((current) => [next, ...current]);
    setReport(next);
    setEditing(null);
    setToast({ message: "New half-month report created.", tone: "success" });
  };

  const handleSelectReport = (id: string) => {
    const selected = reports.find((item) => item.id === id);
    if (selected) {
      setReport(selected);
      setEditing(null);
    }
  };

  const handleDeleteReport = async (id: string) => {
    const target = reports.find((item) => item.id === id);
    if (!target || !window.confirm(`Delete the report for ${formatPeriod(target.startDate, target.endDate)}? This cannot be undone.`)) return;
    try {
      await deleteReport(id);
      const remaining = reports.filter((item) => item.id !== id);
      if (remaining.length > 0) {
        setReports(remaining);
        setReport(remaining[0]!);
      } else {
        const blank = createBlankReport();
        setReports([blank]);
        setReport(blank);
      }
      setEditing(null);
      setToast({ message: "Report deleted.", tone: "info" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Could not delete the report.", tone: "error" });
    }
  };

  const handleExport = async () => {
    if (!report) return;
    const issues = reportIssues(report);
    if (issues.length > 0) {
      setToast({ message: issues[0]!, tone: "error" });
      return;
    }
    setExporting(true);
    try {
      await downloadExcel(report);
      updateReport({ status: "ready" });
      setToast({ message: "Excel report generated in the Boac report format.", tone: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Could not build the Excel file.", tone: "error" });
    } finally {
      setExporting(false);
    }
  };

  const focusEntry = () => {
    document.getElementById("activity-details")?.focus();
    document.querySelector(".entry-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-mark"><FileSpreadsheet aria-hidden="true" size={30} /></div>
        <h1>Opening AccomplishPro</h1>
        <p>Preparing your report workspace and template…</p>
        <div className="loading-bar"><span /></div>
      </main>
    );
  }

  if (loadError || !report) {
    return (
      <main className="error-screen">
        <div className="error-screen__icon"><AlertCircle aria-hidden="true" size={30} /></div>
        <h1>The report workspace could not start</h1>
        <p>{loadError || "No report was available."}</p>
        <p className="error-screen__hint">Run <code>npm run dev</code> from the project root, then refresh this page.</p>
        <button className="button button--primary" type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }

  const activityCount = report.activities.length;
  const totalUnits = report.activities.reduce((sum, activity) => sum + activity.units, 0);
  const activeDays = countWorkDays(report.activities);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to report workspace</a>
      <Sidebar
        reports={reports}
        activeId={report.id}
        aiStatus={aiStatus}
        hasSessionKey={hasSessionKey}
        onSelect={handleSelectReport}
        onNew={handleNewReport}
        onDelete={handleDeleteReport}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="main-content" id="main-content">
        <header className="workspace-header">
          <div className="workspace-header__intro">
            <div className="workspace-header__meta">
              <span>Municipality of Boac</span><span aria-hidden="true">/</span><span>{report.office}</span>
            </div>
            <h1>{formatPeriod(report.startDate, report.endDate)}</h1>
            <p>Prepare, review, and export your accomplishment report from one focused workspace.</p>
          </div>
          <div className={`save-indicator save-indicator--${saveState}`} role="status" aria-live="polite">
            {saveState === "saving" ? <CloudCog aria-hidden="true" size={18} /> : saveState === "error" ? <AlertCircle aria-hidden="true" size={18} /> : <CloudCheck aria-hidden="true" size={18} />}
            <span>{saveState === "saving" ? "Saving draft…" : saveState === "error" ? "Save needs attention" : "Draft saved"}</span>
          </div>
        </header>

        <section className="period-strip" aria-label="Reporting period and status">
          <div className="period-strip__icon"><CalendarRange aria-hidden="true" size={20} /></div>
          <div className="field-group field-group--inline">
            <label htmlFor="period-start">Period start</label>
            <input id="period-start" type="date" value={report.startDate} onChange={(event) => updateReport({ startDate: event.target.value })} />
          </div>
          <div className="period-arrow" aria-hidden="true">to</div>
          <div className="field-group field-group--inline">
            <label htmlFor="period-end">Period end</label>
            <input id="period-end" type="date" value={report.endDate} onChange={(event) => updateReport({ endDate: event.target.value })} />
          </div>
          <div className="period-strip__status">
            <label htmlFor="report-status">Document status</label>
            <select id="report-status" value={report.status} onChange={(event) => updateReport({ status: event.target.value as Report["status"] })}>
              <option value="draft">Draft</option><option value="ready">Ready for signature</option>
            </select>
          </div>
          <button className="button button--primary period-strip__export" type="button" onClick={handleExport} disabled={exporting}>
            <Download aria-hidden="true" size={17} /> {exporting ? "Building Excel…" : "Export Excel"}
          </button>
        </section>

        <section className="report-summary" aria-label="Report progress">
          <div>
            <p className="report-summary__label">Report progress</p>
            <p className="report-summary__sentence">
              <strong>{activityCount.toLocaleString()}</strong> {activityCount === 1 ? "accomplishment" : "accomplishments"} recorded across <strong>{activeDays.toLocaleString()}</strong> {activeDays === 1 ? "active day" : "active days"}, totaling <strong>{totalUnits.toLocaleString()}</strong> {totalUnits === 1 ? "unit" : "units"}.
            </p>
          </div>
          <div
            className={`document-state document-state--${report.status}`}
            aria-label={`Document status: ${report.status === "ready" ? "Ready for signature" : "Draft in progress"}`}
          >
            <span className="document-state__dot" aria-hidden="true" />
            <span>{report.status === "ready" ? "Ready for signature" : "Draft in progress"}</span>
          </div>
        </section>

        <ReportDetails report={report} onChange={updateReport} />

        <div className="workspace-grid">
          <div className="editor-column">
            <ActivityEditor report={report} editing={editing} onSubmit={saveActivity} onCancelEdit={() => setEditing(null)} onOpenAi={() => setAiOpen(true)} />
            <ActivityList activities={report.activities} onEdit={(activity) => { setEditing(activity); focusEntry(); }} onDelete={handleDeleteActivity} onAddFocus={focusEntry} />
          </div>
          <DocumentPreview report={report} exporting={exporting} onExport={handleExport} onPrint={() => window.print()} />
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={aiStatus}
        onSaved={() => setSessionKeyVersion((version) => version + 1)}
      />
      <AiDraftModal
        open={aiOpen}
        report={report}
        serverConfigured={aiStatus.configured}
        onClose={() => setAiOpen(false)}
        onAdd={addAiActivities}
        onOpenSettings={() => { setAiOpen(false); setSettingsOpen(true); }}
      />

      {toast && <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">{toast.tone === "success" ? <CheckCircle2 aria-hidden="true" size={19} /> : <AlertCircle aria-hidden="true" size={19} />}<span>{toast.message}</span></div>}
    </div>
  );
}

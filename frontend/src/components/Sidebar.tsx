import { FileCheck2, FilePlus2, Settings, Sparkles, Trash2 } from "lucide-react";
import type { AiStatus, Report } from "../types";
import { formatPeriod } from "../utils";

interface SidebarProps {
  reports: Report[];
  activeId: string | null;
  aiStatus: AiStatus;
  hasSessionKey: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
}

export function Sidebar({
  reports,
  activeId,
  aiStatus,
  hasSessionKey,
  onSelect,
  onNew,
  onDelete,
  onSettings,
}: SidebarProps) {
  const aiReady = aiStatus.configured || hasSessionKey;
  const aiLabel = aiStatus.configured
    ? "Gemini configured"
    : hasSessionKey
      ? "Session key added"
      : "Gemini not connected";
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark"><FileCheck2 aria-hidden="true" size={24} /></div>
        <div><strong>AccomplishPro</strong><span>Boac · MSWDO</span></div>
      </div>

      <div className={`ai-status ${aiReady ? "ai-status--ready" : ""}`}>
        <Sparkles aria-hidden="true" size={17} />
        <div><strong>{aiLabel}</strong><span>{aiStatus.model}</span></div>
      </div>

      <nav className="report-nav" aria-label="Saved reports">
        <div className="sidebar-label"><span>My reports</span><span>{reports.length}</span></div>
        <div className="report-nav__list">
          {reports.map((report) => (
            <div className={`report-nav__item ${report.id === activeId ? "report-nav__item--active" : ""}`} key={report.id}>
              <button type="button" onClick={() => onSelect(report.id)} aria-current={report.id === activeId ? "page" : undefined}>
                <span className="report-nav__icon"><FileCheck2 aria-hidden="true" size={17} /></span>
                <span className="report-nav__copy"><strong>{formatPeriod(report.startDate, report.endDate)}</strong><small>{report.activities.length} entries · {report.status}</small></span>
              </button>
              {report.id === activeId && (
                <button className="report-nav__delete" type="button" onClick={() => onDelete(report.id)} aria-label={`Delete report for ${formatPeriod(report.startDate, report.endDate)}`}>
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </nav>

      <div className="sidebar__actions">
        <button className="button button--sidebar-primary" type="button" onClick={onNew}>
          <FilePlus2 aria-hidden="true" size={18} /> New report
        </button>
        <button className="button button--sidebar-ghost" type="button" onClick={onSettings}>
          <Settings aria-hidden="true" size={18} /> Gemini settings
        </button>
      </div>

      <p className="sidebar__footer">Independent report workspace · Municipality of Boac</p>
    </aside>
  );
}

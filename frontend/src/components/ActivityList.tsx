import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import type { Activity } from "../types";
import { activityDescription, categoryLabel, formatShortDate, sortedActivities } from "../utils";

interface ActivityListProps {
  activities: Activity[];
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onAddFocus: () => void;
}
export function ActivityList({ activities, onEdit, onDelete, onAddFocus }: ActivityListProps) {
  return (
    <section className="card activity-card" aria-labelledby="activity-list-title">
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">Report entries</p>
          <h2 id="activity-list-title">Accomplishments</h2>
        </div>
        <span className="count-pill">{activities.length} {activities.length === 1 ? "entry" : "entries"}</span>
      </div>

      {activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><ClipboardList aria-hidden="true" size={28} /></div>
          <h3>Your report is ready for its first entry</h3>
          <p>Add an accomplishment manually or paste several rough notes into Gemini.</p>
          <button className="button button--outline" type="button" onClick={onAddFocus}>
            <Plus aria-hidden="true" size={17} />
            Add first entry
          </button>
        </div>
      ) : (
        <div className="activity-list">
          {sortedActivities(activities).map((activity) => (
            <article className="activity-item" key={activity.id}>
              <div className="date-tile">
                <strong>{formatShortDate(activity.date).split(" ")[1]}</strong>
                <span>{formatShortDate(activity.date).split(" ")[0]}</span>
              </div>
              <div className="activity-item__content">
                <div className="activity-item__meta">
                  <span className="category-chip">{categoryLabel(activity.category)}</span>
                  <span className="unit-chip">{activity.units} {activity.units === 1 ? "unit" : "units"}</span>
                </div>
                <p title={activityDescription(activity)}>{activity.details}</p>
              </div>
              <div className="activity-item__actions">
                <button className="icon-button" type="button" onClick={() => onEdit(activity)} aria-label={`Edit ${activity.details}`}>
                  <Pencil aria-hidden="true" size={17} />
                </button>
                <button className="icon-button icon-button--danger" type="button" onClick={() => onDelete(activity)} aria-label={`Delete ${activity.details}`}>
                  <Trash2 aria-hidden="true" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

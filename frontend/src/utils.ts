import type { Activity, Report } from "./types";

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createBlankReport(now = new Date()): Report {
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const start = new Date(year, month, day <= 15 ? 1 : 16);
  const end = new Date(year, month + 1, day <= 15 ? 0 : 0);
  if (day <= 15) end.setDate(15);

  return {
    id: crypto.randomUUID(),
    title: "Accomplishment Report",
    country: "Republic of the Philippines",
    province: "Province of Marinduque",
    municipality: "Municipality of Boac",
    office: "MSWDO",
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    preparedBy: "Gene Elpie L. Landoy",
    preparedPosition: "Administrative Aide II",
    notedBy: "Hazel Maureen L. Gonzales",
    notedPosition: "MGDH I - MSWDO",
    status: "draft",
    activities: [],
  };
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

export function formatLongDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}

export function formatShortDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(value));
}

export function formatPeriod(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "Reporting period";
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(start);
    return `${month} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
}

export function activityDescription(activity: Activity): string {
  return activity.category.toLowerCase() === "custom"
    ? activity.details
    : `${activity.category}: ${activity.details}`;
}

export function sortedActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => a.date.localeCompare(b.date));
}

export function countWorkDays(activities: Activity[]): number {
  return new Set(activities.map((activity) => activity.date)).size;
}

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    "Regular Updating of database, and inventory of files; Profiling of SK Officials, KK, Child Youth and Child Laborers":
      "Database & profiling",
    "Receive Inquiries, concerns of LYDC and SK": "Inquiries & coordination",
    "Sort incoming and outgoing LYDC and SK communication": "Communications",
    "Assist in the conduct of LYDC and SK Officials Meeting": "Meeting support",
    "Preparation of LYDC Minutes of Meeting": "Meeting minutes",
    "Preparation of training paraphernalia's (Invitation, kits and supplies, certificates, attendance sheets and post-activity reports)":
      "Training materials",
    "Assist in the Implementation of Anti-Child Labor Initiative": "Anti-child labor",
    "Performs other related tasks as may be assigned by the LYDO Designate and MSWDO": "Other assigned tasks",
    Custom: "Custom entry",
  };
  return labels[category] ?? category;
}

export function reportIssues(report: Report): string[] {
  const issues: string[] = [];
  if (report.startDate > report.endDate) issues.push("The end date is before the start date.");
  const outside = report.activities.filter(
    (activity) => activity.date < report.startDate || activity.date > report.endDate,
  ).length;
  if (outside) issues.push(`${outside} activity ${outside === 1 ? "is" : "are"} outside the reporting period.`);
  if (!report.preparedBy.trim() || !report.notedBy.trim()) issues.push("Complete both signatory names.");
  return issues;
}

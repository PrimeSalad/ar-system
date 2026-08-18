export const CATEGORY_OPTIONS = [
  "Regular Updating of database, and inventory of files; Profiling of SK Officials, KK, Child Youth and Child Laborers",
  "Receive Inquiries, concerns of LYDC and SK",
  "Sort incoming and outgoing LYDC and SK communication",
  "Assist in the conduct of LYDC and SK Officials Meeting",
  "Preparation of LYDC Minutes of Meeting",
  "Preparation of training paraphernalia's (Invitation, kits and supplies, certificates, attendance sheets and post-activity reports)",
  "Assist in the Implementation of Anti-Child Labor Initiative",
  "Performs other related tasks as may be assigned by the LYDO Designate and MSWDO",
] as const;

export interface Activity {
  id: string;
  date: string;
  category: string;
  details: string;
  units: number;
}

export interface Report {
  id: string;
  title: string;
  country: string;
  province: string;
  municipality: string;
  office: string;
  startDate: string;
  endDate: string;
  preparedBy: string;
  preparedPosition: string;
  notedBy: string;
  notedPosition: string;
  status: "draft" | "ready";
  activities: Activity[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AiStatus {
  configured: boolean;
  model: string;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

import { z } from "zod";

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

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date in YYYY-MM-DD format");

export const activitySchema = z.object({
  id: z.uuid(),
  date: isoDate,
  category: z.string().trim().min(2).max(300),
  details: z.string().trim().min(3).max(2_500),
  units: z.number().int().positive().max(1_000_000),
});

export const reportInputSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(3).max(120).default("Accomplishment Report"),
    country: z.string().trim().min(2).max(120).default("Republic of the Philippines"),
    province: z.string().trim().min(2).max(120).default("Province of Marinduque"),
    municipality: z.string().trim().min(2).max(120).default("Municipality of Boac"),
    office: z.string().trim().min(2).max(100).default("MSWDO"),
    startDate: isoDate,
    endDate: isoDate,
    preparedBy: z.string().trim().min(2).max(120),
    preparedPosition: z.string().trim().min(2).max(120),
    notedBy: z.string().trim().min(2).max(120),
    notedPosition: z.string().trim().min(2).max(120),
    status: z.enum(["draft", "ready"]).default("draft"),
    activities: z.array(activitySchema).max(250),
  })
  .superRefine((report, ctx) => {
    if (report.startDate > report.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    }

    report.activities.forEach((activity, index) => {
      if (activity.date < report.startDate || activity.date > report.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["activities", index, "date"],
          message: "Activity date must be inside the reporting period",
        });
      }
    });
  });

export const storedReportSchema = reportInputSchema.and(
  z.object({
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
);

export type Activity = z.infer<typeof activitySchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;
export type StoredReport = z.infer<typeof storedReportSchema>;

export function activityDescription(activity: Activity): string {
  const category = activity.category.trim();
  const details = activity.details.trim();
  return category.toLowerCase() === "custom" ? details : `${category}: ${details}`;
}

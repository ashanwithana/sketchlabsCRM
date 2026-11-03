import { db } from "@/lib/db";

export type ActivityInput = {
  action: "CREATE" | "UPDATE" | "DELETE" | "ARCHIVE" | "STATUS" | "EMAIL" | "PDF" | "EXPORT" | "BACKUP" | "LOGIN" | "LOGOUT";
  entityType: string;
  entityId?: string | null;
  summary: string;
};

/** Writes one row to the activity log. Never include personal data beyond names and numbers. */
export async function logActivity(input: ActivityInput) {
  await db.activityLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
    },
  });
}

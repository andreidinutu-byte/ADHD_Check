// FR-50 "new mission" email. Logic and tests in ../handlers.ts.
import { createResendSender } from "@/lib/email/resend";
import { createAdminPb } from "@/lib/pocketbase/admin";
import { q } from "@/lib/pocketbase/config";
import { sharedRateLimiter } from "@/lib/rate-limit";
import { EMAILS_RATE_LIMIT, handleMissionEmail } from "../handlers";
import { getEmailParent } from "../parent";

export async function POST(request: Request) {
  let admin, parent;
  try {
    admin = await createAdminPb();
    parent = await getEmailParent(admin);
  } catch {
    console.error("[emails] failed", { error: "storage_unavailable" });
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  const limiter = sharedRateLimiter();
  return handleMissionEmail(request, {
    email: createResendSender(),
    rateLimiter: { take: (key) => limiter.take(key, EMAILS_RATE_LIMIT) },
    siteUrl: process.env.SITE_URL,
    getParent: async () => parent,
    // The superuser client sees every mission, so the read is filtered on the parent's id as well.
    missionIsOwn: async (id) => {
      if (!parent) return false;
      try {
        await admin.collection("missions").getFirstListItem(`id = ${q(id)} && parent = ${q(parent.id)}`, { fields: "id" });
        return true;
      } catch {
        return false;
      }
    },
  });
}

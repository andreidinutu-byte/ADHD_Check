// FR-50 weekly summary email, on request. Logic and tests in ../handlers.ts.
import { createResendSender } from "@/lib/email/resend";
import { createAdminPb } from "@/lib/pocketbase/admin";
import { sharedRateLimiter } from "@/lib/rate-limit";
import { EMAILS_RATE_LIMIT, handleWeeklySummaryEmail } from "../handlers";
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
  return handleWeeklySummaryEmail(request, {
    email: createResendSender(),
    rateLimiter: { take: (key, rule) => limiter.take(key, rule ?? EMAILS_RATE_LIMIT) },
    siteUrl: process.env.SITE_URL,
    getParent: async () => parent,
  });
}

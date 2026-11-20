// Early-access sign-ups from the landing page. Logic and tests live in handler.ts.
import { after } from "next/server";
import { createResendSender } from "@/lib/email/resend";
import { ClientResponseError } from "pocketbase";
import { createAdminPb } from "@/lib/pocketbase/admin";
import { sharedRateLimiter, SESSIONS_RATE_LIMIT } from "@/lib/rate-limit";
import { handleWaitlistPost, WAITLIST_EMAIL_CAP_KEY, WAITLIST_EMAIL_DAILY_CAP } from "./handler";

export async function POST(request: Request) {
  let admin;
  try {
    admin = await createAdminPb();
  } catch {
    // No PocketBase admin settings (a teammate running the app with no .env.local): store nothing.
    console.error("[waitlist] failed", { error: "storage_unavailable" });
    return Response.json({ ok: false }, { status: 503 });
  }
  const limiter = sharedRateLimiter();
  return handleWaitlistPost(request, {
    store: {
      async add(email, lang) {
        try {
          await admin.collection("waitlist").create({ email: email.toLowerCase(), lang });
          return true;
        } catch (e) {
          // waitlist.email is unique: an address already listed is not an error.
          const data = e instanceof ClientResponseError ? (e.response?.data as Record<string, { code?: string }> | undefined) : undefined;
          if (data?.email?.code === "validation_not_unique") return false;
          throw new Error(`join waitlist failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      },
    },
    // Same placeholder limit as session posts (TODO in docs/02 NFR-13).
    rateLimiter: { take: (key) => limiter.take(key, SESSIONS_RATE_LIMIT) },
    // One bucket for the whole site, not per client: this is the cap on mail sent to addresses nobody proved.
    emailCap: { take: () => limiter.take(WAITLIST_EMAIL_CAP_KEY, WAITLIST_EMAIL_DAILY_CAP) },
    email: createResendSender(),
    defer: (task) => after(task),
  });
}

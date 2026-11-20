import type PocketBase from "pocketbase";
import { ClientResponseError } from "pocketbase";
import type { Resend } from "resend";
import type { EmailLang } from "../../../lib/email/messages";
import { SESSION_FIELDS, toSessionResult } from "../../../lib/data/parent";
import { q } from "../../../lib/pocketbase/config";
import type { Mailer, PaidOutcome } from "./handlers";

// Database and email side of the one-off report purchase (D-05b), with the PocketBase superuser client
// (report_purchases, users) and the Resend client. Server code only: imported by route handlers.
// PocketBase has no row locks: a purchase row is created once through the unique index on
// stripe_checkout_session_id (a second create fails with validation_not_unique and the existing row is read),
// and every state change reads the row, checks its status and then updates it. Two concurrent webhooks for
// one checkout can therefore both see "pending"; the email stays single through its Resend idempotency key.

function isNotFound(e: unknown): boolean {
  return e instanceof ClientResponseError && e.status === 404;
}

function isNotUnique(e: unknown): boolean {
  if (!(e instanceof ClientResponseError) || e.status !== 400) return false;
  const data = (e.response?.data ?? {}) as Record<string, { code?: string }>;
  return data.stripe_checkout_session_id?.code === "validation_not_unique";
}

// The session, only when it belongs to that parent.
async function ownsSession(admin: PocketBase, parentId: string, sessionId: string): Promise<boolean> {
  try {
    await admin.collection("sessions").getFirstListItem(`id = ${q(sessionId)} && parent = ${q(parentId)}`, { fields: "id" });
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}

async function purchaseByCheckout(admin: PocketBase, checkoutId: string) {
  try {
    return await admin.collection("report_purchases").getFirstListItem(`stripe_checkout_session_id = ${q(checkoutId)}`);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

// Records a pending purchase for the checkout, unless one exists. Returns the row either way.
async function ensurePurchase(admin: PocketBase, p: { parentId: string; sessionId: string; checkoutId: string; lang: EmailLang }) {
  try {
    return await admin.collection("report_purchases").create({
      parent: p.parentId,
      session: p.sessionId,
      stripe_checkout_session_id: p.checkoutId,
      status: "pending",
      lang: p.lang,
    });
  } catch (e) {
    if (!isNotUnique(e)) throw e;
    const existing = await purchaseByCheckout(admin, p.checkoutId);
    if (!existing) throw e;
    return existing;
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Checkout start: records a pending purchase, only for a session of that parent. Returns 'started' or
// 'unknown_session'. Starting the same checkout session twice keeps one row.
export async function startPurchase(
  admin: PocketBase,
  p: { parentId: string; sessionId: string; checkoutId: string; lang: EmailLang },
): Promise<string> {
  try {
    if (!(await ownsSession(admin, p.parentId, p.sessionId))) return "unknown_session";
    await ensurePurchase(admin, p);
    return "started";
  } catch (e) {
    throw new Error(`start purchase failed: ${message(e)}`);
  }
}

// Webhook write (checkout.session.completed with payment_status paid, or async_payment_succeeded).
// outcome: 'paid' (first time), 'already_paid' (a replay), 'unknown_session' (not that parent's session, or
// deleted), 'mismatch' (the checkout id is known for another parent or session). emailed: the report email
// was already sent, so the caller must not send it again.
export async function markPaid(
  admin: PocketBase,
  p: { checkoutId: string; parentId: string; sessionId: string; lang: EmailLang },
): Promise<PaidOutcome> {
  try {
    if (!(await ownsSession(admin, p.parentId, p.sessionId))) return { outcome: "unknown_session", emailed: false };
    const row = await ensurePurchase(admin, p);
    if (row.parent !== p.parentId || row.session !== p.sessionId) return { outcome: "mismatch", emailed: false };
    if (row.status === "paid") return { outcome: "already_paid", emailed: Boolean(row.emailed_at) };
    await admin.collection("report_purchases").update(row.id, { status: "paid", paid_at: new Date().toISOString() });
    return { outcome: "paid", emailed: false };
  } catch (e) {
    throw new Error(`mark paid failed: ${message(e)}`);
  }
}

// A delayed payment failed or the checkout expired. Moves a PENDING row only; a paid row never changes.
export async function markNotPaid(admin: PocketBase, checkoutId: string, status: "failed" | "expired"): Promise<void> {
  try {
    const row = await purchaseByCheckout(admin, checkoutId);
    if (row && row.status === "pending") await admin.collection("report_purchases").update(row.id, { status });
  } catch (e) {
    throw new Error(`mark not paid failed: ${message(e)}`);
  }
}

// After the email is accepted by the provider. Only a paid row that has not been marked yet.
export async function markEmailed(admin: PocketBase, checkoutId: string): Promise<void> {
  try {
    const row = await purchaseByCheckout(admin, checkoutId);
    if (row && row.status === "paid" && !row.emailed_at) {
      await admin.collection("report_purchases").update(row.id, { emailed_at: new Date().toISOString() });
    }
  } catch (e) {
    throw new Error(`mark emailed failed: ${message(e)}`);
  }
}

// The address the parent signed up with (PocketBase users), never one from the request or from Stripe.
export async function getParentEmail(admin: PocketBase, parentId: string): Promise<string | null> {
  let user;
  try {
    user = await admin.collection("users").getOne(parentId, { fields: "email,verified" });
  } catch (e) {
    if (isNotFound(e)) return null;
    throw new Error(`read parent failed: ${message(e)}`);
  }
  // Only an address the parent has verified: an unverified sign-up could name someone else's mailbox.
  if (!user.verified) return null;
  return user.email ? String(user.email) : null;
}

// Where the paid report of one session of one parent is downloaded: the child page. The superuser client sees
// every record, so every read is filtered on the parent id as well as the session id. Only ids and the band are
// returned (R3-D1: no child data goes into an email, so no nickname is read here).
export async function reportTargetFor(admin: PocketBase, parentId: string, sessionId: string): Promise<{ childId: string; band: string } | null> {
  let row;
  try {
    row = await admin.collection("sessions").getFirstListItem(`id = ${q(sessionId)} && parent = ${q(parentId)}`, { fields: SESSION_FIELDS });
  } catch (e) {
    if (isNotFound(e)) return null;
    throw new Error(`read session failed: ${message(e)}`);
  }
  const result = toSessionResult(row as unknown as Parameters<typeof toSessionResult>[0]);
  if (!result.score) return null;
  return { childId: result.child_id, band: result.score.band };
}

// Resend: { data, error } on an API answer; a thrown error is a network failure. 4xx except 429 is
// permanent (a 403 means the sender domain is not verified: onboarding@resend.dev only delivers to the
// Resend account owner, https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
export function resendMailer(resend: Resend, from: string): Mailer {
  return {
    async send(mail) {
      try {
        const { error } = await resend.emails.send(
          {
            from,
            to: [mail.to],
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          },
          { idempotencyKey: mail.idempotencyKey },
        );
        if (!error) return { ok: true };
        // 409 invalid_idempotent_request: the key was already used, so an earlier attempt of this email went
        // out (a retry whose payload differs from the first). Treat it as sent.
        if (error.name === "invalid_idempotent_request") return { ok: true };
        const status = error.statusCode ?? 0;
        // 409 concurrent_idempotent_requests: the first attempt is still being processed; retry later.
        if (error.name === "concurrent_idempotent_requests") return { ok: false, permanent: false };
        return { ok: false, permanent: status >= 400 && status < 500 && status !== 429 };
      } catch {
        return { ok: false, permanent: false };
      }
    },
  };
}

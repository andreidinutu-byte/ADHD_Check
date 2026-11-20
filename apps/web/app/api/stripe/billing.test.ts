import { describe, expect, it, vi } from "vitest";
import { ClientResponseError } from "pocketbase";
import type PocketBase from "pocketbase";
import type { Resend } from "resend";
import { getParentEmail, markEmailed, markNotPaid, markPaid, resendMailer, startPurchase } from "./billing";
import type { ReportMail } from "./handlers";

const MAIL: ReportMail = {
  to: "parent@example.test",
  subject: "s",
  text: "t",
  html: "<p>t</p>",
  idempotencyKey: "report-email/cs_test",
};

type Rec = Record<string, unknown> & { id: string };

// A small in-memory PocketBase: just the collections and filters billing.ts uses (equality on one or two
// fields, a unique index on report_purchases.stripe_checkout_session_id).
function fakePb(seed: { sessions?: Rec[]; users?: Rec[]; report_purchases?: Rec[] } = {}) {
  const data: Record<string, Rec[]> = { sessions: [], users: [], report_purchases: [], ...seed };
  let n = 0;
  const notFound = () => new ClientResponseError({ status: 404, response: { message: "not found" } });
  const matches = (filter: string) => {
    const pairs = [...filter.matchAll(/(\w+) = "([^"]*)"/g)].map((m) => [m[1]!, m[2]!] as const);
    return (r: Rec) => pairs.every(([k, v]) => r[k] === v);
  };
  const admin = {
    collection: (name: string) => ({
      getFirstListItem: async (filter: string) => {
        const row = data[name]!.find(matches(filter));
        if (!row) throw notFound();
        return row;
      },
      getOne: async (id: string) => {
        const row = data[name]!.find((r) => r.id === id);
        if (!row) throw notFound();
        return row;
      },
      create: async (body: Record<string, unknown>) => {
        if (name === "report_purchases" && data[name]!.some((r) => r.stripe_checkout_session_id === body.stripe_checkout_session_id)) {
          throw new ClientResponseError({ status: 400, response: { data: { stripe_checkout_session_id: { code: "validation_not_unique" } } } });
        }
        const row = { id: `r${++n}`, emailed_at: "", paid_at: "", ...body } as Rec;
        data[name]!.push(row);
        return row;
      },
      update: async (id: string, body: Record<string, unknown>) => {
        const row = data[name]!.find((r) => r.id === id)!;
        Object.assign(row, body);
        return row;
      },
    }),
  } as unknown as PocketBase;
  return { admin, data };
}

const PARENT = "parent-1";
const SESSION = "session-1";
const P = { checkoutId: "cs_test", parentId: PARENT, sessionId: SESSION, lang: "en" as const };
const ownSession = { id: SESSION, parent: PARENT };

describe("getParentEmail (R3-P5)", () => {
  it("returns the address of a verified user", async () => {
    const { admin } = fakePb({ users: [{ id: "p", email: "a@example.test", verified: true }] });
    expect(await getParentEmail(admin, "p")).toBe("a@example.test");
  });
  it("returns null for an address that is not verified", async () => {
    const { admin } = fakePb({ users: [{ id: "p", email: "a@example.test", verified: false }] });
    expect(await getParentEmail(admin, "p")).toBeNull();
  });
  it("returns null for an unknown user", async () => {
    const { admin } = fakePb();
    expect(await getParentEmail(admin, "p")).toBeNull();
  });
});

describe("startPurchase and markPaid (D-05b)", () => {
  it("records a pending purchase once, even when the checkout is started twice", async () => {
    const { admin, data } = fakePb({ sessions: [ownSession] });
    expect(await startPurchase(admin, P)).toBe("started");
    expect(await startPurchase(admin, P)).toBe("started");
    expect(data.report_purchases).toHaveLength(1);
    expect(data.report_purchases![0]).toMatchObject({ parent: PARENT, session: SESSION, status: "pending", lang: "en" });
  });
  it("answers unknown_session for another parent's session", async () => {
    const { admin, data } = fakePb({ sessions: [{ id: SESSION, parent: "someone-else" }] });
    expect(await startPurchase(admin, P)).toBe("unknown_session");
    expect((await markPaid(admin, P)).outcome).toBe("unknown_session");
    expect(data.report_purchases).toHaveLength(0);
  });
  it("marks paid the first time, then already_paid, with the emailed flag", async () => {
    const { admin, data } = fakePb({ sessions: [ownSession] });
    await startPurchase(admin, P);
    expect(await markPaid(admin, P)).toEqual({ outcome: "paid", emailed: false });
    expect(data.report_purchases![0]).toMatchObject({ status: "paid" });
    expect(data.report_purchases![0]!.paid_at).toBeTruthy();
    expect(await markPaid(admin, P)).toEqual({ outcome: "already_paid", emailed: false });
    await markEmailed(admin, "cs_test");
    expect(await markPaid(admin, P)).toEqual({ outcome: "already_paid", emailed: true });
  });
  it("records a purchase the webhook sees before the checkout start did", async () => {
    const { admin, data } = fakePb({ sessions: [ownSession] });
    expect(await markPaid(admin, P)).toEqual({ outcome: "paid", emailed: false });
    expect(data.report_purchases).toHaveLength(1);
  });
  it("answers mismatch when the checkout id belongs to another session", async () => {
    const { admin } = fakePb({
      sessions: [ownSession, { id: "session-2", parent: PARENT }],
      report_purchases: [{ id: "x", parent: PARENT, session: "session-2", stripe_checkout_session_id: "cs_test", status: "pending" }],
    });
    expect(await markPaid(admin, P)).toEqual({ outcome: "mismatch", emailed: false });
  });
});

describe("markEmailed", () => {
  it("sets emailed_at once, only on a paid row", async () => {
    const { admin, data } = fakePb({
      report_purchases: [{ id: "x", parent: PARENT, session: SESSION, stripe_checkout_session_id: "cs_test", status: "pending", emailed_at: "" }],
    });
    await markEmailed(admin, "cs_test");
    expect(data.report_purchases![0]!.emailed_at).toBe("");
    data.report_purchases![0]!.status = "paid";
    await markEmailed(admin, "cs_test");
    const first = data.report_purchases![0]!.emailed_at;
    expect(first).toBeTruthy();
    await markEmailed(admin, "cs_test");
    expect(data.report_purchases![0]!.emailed_at).toBe(first);
  });
});

describe("resendMailer (R3-P3)", () => {
  function resendReturning(error: { statusCode: number | null; name: string } | null) {
    const send = vi.fn().mockResolvedValue({ data: error ? null : { id: "e" }, error });
    return { resend: { emails: { send } } as unknown as Resend, send };
  }
  it("accepts an accepted email", async () => {
    expect(await resendMailer(resendReturning(null).resend, "f@example.test").send(MAIL)).toEqual({ ok: true });
  });
  it("R3-D1 sends the message with its idempotency key and no attachment", async () => {
    const { resend, send } = resendReturning(null);
    await resendMailer(resend, "f@example.test").send(MAIL);
    const [payload, options] = send.mock.calls[0] as [Record<string, unknown>, { idempotencyKey: string }];
    expect(payload).not.toHaveProperty("attachments");
    expect(payload).toMatchObject({ from: "f@example.test", to: ["parent@example.test"], subject: "s", text: "t", html: "<p>t</p>" });
    expect(options).toEqual({ idempotencyKey: "report-email/cs_test" });
  });
  it("treats 409 invalid_idempotent_request as already sent (the first attempt went out)", async () => {
    const { resend } = resendReturning({ statusCode: 409, name: "invalid_idempotent_request" });
    expect(await resendMailer(resend, "f@example.test").send(MAIL)).toEqual({ ok: true });
  });
  it("treats 409 concurrent_idempotent_requests as transient, so Stripe retries", async () => {
    const { resend } = resendReturning({ statusCode: 409, name: "concurrent_idempotent_requests" });
    expect(await resendMailer(resend, "f@example.test").send(MAIL)).toEqual({ ok: false, permanent: false });
  });
  it("treats another 4xx as permanent and a 429 or 5xx as transient", async () => {
    const m = (e: { statusCode: number; name: string }) => resendMailer(resendReturning(e).resend, "f@example.test").send(MAIL);
    expect(await m({ statusCode: 403, name: "validation_error" })).toEqual({ ok: false, permanent: true });
    expect(await m({ statusCode: 429, name: "rate_limit_exceeded" })).toEqual({ ok: false, permanent: false });
    expect(await m({ statusCode: 500, name: "application_error" })).toEqual({ ok: false, permanent: false });
  });
});

describe("markNotPaid (R4-2)", () => {
  const row = (status: string) => ({ id: "x", parent: PARENT, session: SESSION, stripe_checkout_session_id: "cs_test", status });
  it("moves a pending row to the given status", async () => {
    const { admin, data } = fakePb({ report_purchases: [row("pending")] });
    await markNotPaid(admin, "cs_test", "failed");
    expect(data.report_purchases![0]!.status).toBe("failed");
  });
  it("never changes a paid row", async () => {
    const { admin, data } = fakePb({ report_purchases: [row("paid")] });
    await markNotPaid(admin, "cs_test", "expired");
    expect(data.report_purchases![0]!.status).toBe("paid");
  });
  it("throws when the database fails, so the webhook answers 500", async () => {
    const admin = { collection: () => ({ getFirstListItem: vi.fn().mockRejectedValue(new Error("down")) }) } as unknown as PocketBase;
    await expect(markNotPaid(admin, "cs_test", "expired")).rejects.toThrow();
  });
});

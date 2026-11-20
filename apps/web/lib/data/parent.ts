import { ScoreResultSchema, type ScoreResult } from "@adhdcheck/contracts";
import type PocketBase from "pocketbase";
import { isMissionKey } from "../missions";
import { q, toIso } from "../pocketbase/config";
import { PROCESSING_CONSENT_VERSION } from "../processing-consent";

// Data for the parent pages (Person 4). Pass the logged-in parent's PocketBase client (lib/pocketbase/server.ts
// in Server Components, lib/pocketbase/client.ts in Client Components): the API rules in pocketbase/schema.json
// return only their own records. Every score is checked against ScoreResult v1 before a page sees it. Errors
// throw; pages show their error state. Writes the parent may not do (sessions, scores) go through the API routes.

export type Child = { id: string; nickname: string; birth_year: number; created_at: string };

export type SessionResult = {
  session_id: string;
  child_id: string;
  started_at: string;
  duration_ms: number;
  // NFR-24: the chart shows the device per session; sessions on different devices are not comparable.
  device: { pointer_type: string; user_agent: string };
  // null until the session is scored.
  score: ScoreResult | null;
};

export type MissionRow = {
  id: string;
  child_id: string;
  mission_key: string;
  status: "todo" | "done";
  created_at: string;
  done_at: string | null;
};

// Fields read for a session: never the trials (large) or the play link (hidden anyway).
export const SESSION_FIELDS = "id,child,started_at,duration_ms,device,score";
const CHILD_FIELDS = "id,nickname,birth_year,created_at";
const MISSION_FIELDS = "id,child,mission_key,status,created_at,done_at";

async function check<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw new Error(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function parentIdOf(client: PocketBase): string {
  const id = client.authStore.record?.id;
  if (!id) throw new Error("not logged in");
  return id;
}

type SessionRow = {
  id: string;
  child?: string;
  child_id?: string;
  started_at: string;
  duration_ms: number;
  device: Record<string, unknown> | null;
  score?: unknown;
  scores?: unknown;
};

export function toSessionResult(row: SessionRow): SessionResult {
  const raw = row.score !== undefined ? row.score : row.scores;
  const embedded = Array.isArray(raw) ? raw[0] : raw;
  const score =
    embedded && typeof embedded === "object"
      ? ScoreResultSchema.parse({ ...(embedded as object), schema_version: "1.0", session_id: row.id })
      : null;
  const device = row.device ?? {};
  return {
    session_id: row.id,
    child_id: String(row.child_id ?? row.child ?? ""),
    started_at: toIso(row.started_at) ?? row.started_at,
    duration_ms: row.duration_ms,
    device: { pointer_type: String(device.pointer_type ?? ""), user_agent: String(device.user_agent ?? "") },
    score,
  };
}

function toChild(r: Record<string, unknown>): Child {
  return { id: String(r.id), nickname: String(r.nickname), birth_year: Number(r.birth_year), created_at: toIso(String(r.created_at)) ?? "" };
}

function toMission(r: Record<string, unknown>): MissionRow {
  return {
    id: String(r.id),
    child_id: String(r.child),
    mission_key: String(r.mission_key),
    status: r.status === "done" ? "done" : "todo",
    created_at: toIso(String(r.created_at)) ?? "",
    done_at: toIso(r.done_at ? String(r.done_at) : null),
  };
}

// Intended purpose: children aged 6 to 12 (docs/02 section 2). The add-child form uses the same bounds.
export const MIN_AGE = 6;
export const MAX_AGE = 12;

// The longest nickname; pocketbase/schema.json (children.nickname max) uses the same number.
// Placeholder: TODO texts owner confirms (docs/02 FR-31).
export const MAX_NICKNAME_LENGTH = 40;

// With the birth year only, the accepted years are (current year - 12) to (current year - 6).
export function birthYearRange(now: Date = new Date()) {
  const year = now.getUTCFullYear();
  return { min: year - MAX_AGE, max: year - MIN_AGE };
}

// FR-31: nickname and birth year only (NFR-01). Returns null when the input is not acceptable,
// including a birth year outside the 6 to 12 age range.
export function validateNewChild(input: unknown, now: Date = new Date()): { nickname: string; birth_year: number } | null {
  const { nickname, birth_year } = (input ?? {}) as { nickname?: unknown; birth_year?: unknown };
  if (typeof nickname !== "string") return null;
  const name = nickname.trim();
  if (name.length === 0 || name.length > MAX_NICKNAME_LENGTH) return null;
  if (typeof birth_year !== "number" || !Number.isInteger(birth_year)) return null;
  const { min, max } = birthYearRange(now);
  if (birth_year < min || birth_year > max) return null;
  return { nickname: name, birth_year };
}

export async function listChildren(client: PocketBase): Promise<Child[]> {
  const rows = await check("list children", () =>
    client.collection("children").getFullList({ sort: "created_at", fields: CHILD_FIELDS }),
  );
  return rows.map(toChild);
}

export async function createChild(client: PocketBase, input: unknown): Promise<Child> {
  const child = validateNewChild(input);
  if (!child) throw new Error("create child: nickname and a whole birth year are required");
  const row = await check("create child", () =>
    client.collection("children").create({ ...child, parent: parentIdOf(client) }, { fields: CHILD_FIELDS }),
  );
  return toChild(row);
}

// Oldest first, for the progress chart (FR-38) and the history list.
export async function listSessionResults(client: PocketBase, childId: string): Promise<SessionResult[]> {
  const rows = await check("list sessions", () =>
    client.collection("sessions").getFullList<SessionRow>({ filter: `child = ${q(childId)}`, sort: "started_at", fields: SESSION_FIELDS }),
  );
  return rows.map(toSessionResult);
}

// The result card (FR-33) for one session, or null when it does not exist or is not the parent's.
export async function getSessionResult(client: PocketBase, sessionId: string): Promise<SessionResult | null> {
  const rows = await check("get session", () =>
    client.collection("sessions").getList<SessionRow>(1, 1, { filter: `id = ${q(sessionId)}`, fields: SESSION_FIELDS }),
  );
  return rows.items[0] ? toSessionResult(rows.items[0]) : null;
}

// The ids of a child's sessions (StartSession compares them before and after play).
export async function listSessionIds(client: PocketBase, childId: string): Promise<string[]> {
  const rows = await check("list session ids", () =>
    client.collection("sessions").getFullList({ filter: `child = ${q(childId)}`, fields: "id" }),
  );
  return rows.map((r) => r.id);
}

// FR-39: calls onScore when a new scored session of this parent is saved (PocketBase realtime; the list rule
// applies, so each parent hears only their own). Subscribe as soon as the QR is shown, and also poll
// getSessionResult every 2 s while waiting in case realtime is blocked. Returns the function that unsubscribes.
export function onNewScore(client: PocketBase, onScore: (sessionId: string) => void): () => void {
  let stop: (() => Promise<void>) | null = null;
  let stopped = false;
  client
    .collection("sessions")
    .subscribe("*", (e) => {
      if (e.action === "create" && typeof e.record?.id === "string") onScore(e.record.id);
    }, { fields: "id" })
    .then((unsubscribe) => {
      if (stopped) void unsubscribe();
      else stop = unsubscribe;
    })
    .catch(() => {
      // Realtime unavailable: the caller's polling still finds the result.
    });
  return () => {
    stopped = true;
    if (stop) void stop();
  };
}

// NFR-04: whether the parent has agreed to the current consent text, and record that they do (API rules: the
// record is always the caller's own, and cannot be changed afterwards). POST /api/play-links checks the same.
export async function hasProcessingConsent(client: PocketBase): Promise<boolean> {
  const rows = await check("read consent", () =>
    client.collection("processing_consents").getList(1, 1, { filter: `version = ${q(PROCESSING_CONSENT_VERSION)}`, fields: "id" }),
  );
  return rows.totalItems > 0;
}

export async function giveProcessingConsent(client: PocketBase): Promise<void> {
  await check("record consent", () =>
    client.collection("processing_consents").create({ parent: parentIdOf(client), version: PROCESSING_CONSENT_VERSION }),
  );
}

// D-05b, FR-48: the purchase of one report by the logged-in parent (own records only), the paid one first, or
// null before any checkout. Never gate the result card, next step or deletion on it.
export type ReportPurchase = { status: "pending" | "paid"; emailed_at: string | null };
export async function getReportPurchase(client: PocketBase, sessionId: string): Promise<ReportPurchase | null> {
  // failed and expired attempts are history, not the state of the report
  const rows = await check("read report purchase", () =>
    client.collection("report_purchases").getList(1, 1, {
      filter: `session = ${q(sessionId)} && (status = "pending" || status = "paid")`,
      sort: "-paid_at",
      fields: "status,emailed_at",
    }),
  );
  const r = rows.items[0];
  return r ? { status: r.status === "paid" ? "paid" : "pending", emailed_at: toIso(r.emailed_at ? String(r.emailed_at) : null) } : null;
}

// R3-P1: the Stripe Checkout Session ids of this parent's pending purchases of one report, newest first, so a
// second checkout can be refused or resumed. A Checkout lives 24 hours, so this stays short.
export async function listPendingCheckoutIds(client: PocketBase, sessionId: string): Promise<string[]> {
  const rows = await check("list pending checkouts", () =>
    client.collection("report_purchases").getList(1, 5, {
      filter: `session = ${q(sessionId)} && status = "pending"`,
      sort: "-created_at",
      fields: "stripe_checkout_session_id",
    }),
  );
  return rows.items.map((r) => String(r.stripe_checkout_session_id));
}

// R5-3: the Stripe Checkout Session id of this parent's newest failed or expired purchase of one report, or null.
// It goes into the checkout idempotency key, so a new checkout after a failure is new to Stripe.
export async function getLatestClosedCheckoutId(client: PocketBase, sessionId: string): Promise<string | null> {
  const rows = await check("latest closed checkout", () =>
    client.collection("report_purchases").getList(1, 1, {
      filter: `session = ${q(sessionId)} && (status = "failed" || status = "expired")`,
      sort: "-created_at",
      fields: "stripe_checkout_session_id",
    }),
  );
  return rows.items[0] ? String(rows.items[0].stripe_checkout_session_id) : null;
}

// FR-37: missions are always chosen by the parent; nothing here reads a score (NFR-52).
export async function listMissions(client: PocketBase, childId: string): Promise<MissionRow[]> {
  const rows = await check("list missions", () =>
    client.collection("missions").getFullList({ filter: `child = ${q(childId)}`, sort: "created_at", fields: MISSION_FIELDS }),
  );
  return rows.map(toMission);
}

export async function addMission(client: PocketBase, childId: string, missionKey: string): Promise<MissionRow> {
  if (!isMissionKey(missionKey)) throw new Error("add mission: unknown mission key");
  const row = await check("add mission", () =>
    client.collection("missions").create(
      {
        child: childId,
        parent: parentIdOf(client),
        mission_key: missionKey,
        chosen_by: "parent",
        status: "todo",
        created_at: new Date().toISOString(),
      },
      { fields: MISSION_FIELDS },
    ),
  );
  return toMission(row);
}

export async function setMissionDone(client: PocketBase, missionId: string, done: boolean): Promise<MissionRow> {
  const row = await check("update mission", () =>
    client
      .collection("missions")
      .update(missionId, { status: done ? "done" : "todo", done_at: done ? new Date().toISOString() : null }, { fields: MISSION_FIELDS }),
  );
  return toMission(row);
}

export async function deleteMission(client: PocketBase, missionId: string): Promise<void> {
  await check("delete mission", () => client.collection("missions").delete(missionId));
}

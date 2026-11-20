// Demo rehearsal: walks the showcase flow over HTTP against a running app, the way a parent and the game would,
// and prints one line per step. Use it before every demo, on localhost and on the production URL.
//
//   node scripts/demo-rehearsal.mts --base https://<app url>
//   node scripts/demo-rehearsal.mts --base http://localhost:3000 --env path/to/other.env --signup
//
// It reads NEXT_PUBLIC_PB_URL (default: the public PocketBase URL), DEMO_PARENT_EMAIL and DEMO_PARENT_PASSWORD
// from the environment, else from apps/web/.env.local (or --env). The demo account must exist; --signup creates
// it first (there is no email confirmation). The live-result step needs a global EventSource (Node 24 with
// --experimental-eventsource); without one it is reported as a warning and the result is polled instead.
// It ends with Reset demo, so the account is left with the synthetic seed only. Needs Node 23.6+ (type stripping).
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import PocketBase from "pocketbase";
import { validSessionMetrics } from "../packages/contracts/src/fixtures/session-metrics.valid.ts";
import { PROCESSING_CONSENT_VERSION } from "../apps/web/lib/processing-consent.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const k = args.indexOf(name);
  return k >= 0 ? args[k + 1] : undefined;
};
const base = (flag("--base") ?? "http://localhost:3000").replace(/\/$/, "");
const envFile = flag("--env") ?? new URL("../apps/web/.env.local", import.meta.url);

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m?.[1] && m[2]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // No env file: rely on the process environment.
  }
  return out;
}
const fileEnv = readEnv();
const env = (name: string) => process.env[name] || fileEnv[name] || "";

const pbUrl = env("NEXT_PUBLIC_PB_URL") || "https://unihub-db.andreidobrin.com";
const email = env("DEMO_PARENT_EMAIL");
const password = env("DEMO_PARENT_PASSWORD"); // check-secrets: allow
const missing = Object.entries({ DEMO_PARENT_EMAIL: email, DEMO_PARENT_PASSWORD: password }) // check-secrets: allow
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")} (environment or ${String(envFile)})`);
  process.exit(2);
}

let failures = 0;
function step(ok: boolean, label: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  return ok;
}
function warn(label: string, detail = "") {
  console.log(`warn  ${label}${detail ? `  (${detail})` : ""}`);
}
const json = { "content-type": "application/json" };
const readJson = async (res: Response): Promise<Record<string, unknown>> => {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

console.log(`Demo rehearsal against ${base}\n`);

// 1. The app answers.
let res: Response;
try {
  res = await fetch(base);
} catch (error) {
  step(false, "app reachable", String(error));
  process.exit(1);
}
step(res.ok, "landing page loads", `${res.status}`);

// 2. The parent logs in through the app (cookie session) and directly (for reads under API rules, as the pages do).
if (args.includes("--signup")) {
  res = await fetch(`${base}/api/auth/signup`, { method: "POST", headers: json, body: JSON.stringify({ email, password }) }); // check-secrets: allow
  step(res.status < 500, "sign up demo account", `${res.status}`);
}
res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: json, body: JSON.stringify({ email, password }) }); // check-secrets: allow
const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
if (!step(res.ok && cookie.length > 0, "parent logs in", `${res.status}`)) {
  console.log("\nCheck DEMO_PARENT_EMAIL and DEMO_PARENT_PASSWORD, or run with --signup."); // check-secrets: allow
  process.exit(1);
}
const db = new PocketBase(pbUrl);
db.autoCancellation(false);
const signIn = await db.collection("users").authWithPassword(email, password).then(() => "", (e: Error) => e.message); // check-secrets: allow
step(!signIn, "data client logs in", signIn);
const parentId = db.authStore.record?.id ?? "";

// 3. Demo account and Reset demo (FR-55, FR-56).
res = await fetch(`${base}/api/demo`, { headers: { cookie } });
const demo = await readJson(res);
if (!step(demo.is_demo === true, "account is the demo account", `is_demo=${String(demo.is_demo)}`))
  console.log("      DEMO_PARENT_EMAIL on the server must match this email.");
const reset = () => fetch(`${base}/api/demo/reset`, { method: "POST", headers: { ...json, cookie }, body: "{}" });
res = await reset();
step(res.ok, "Reset demo", `${res.status} ${JSON.stringify(await readJson(res))}`);

// 4. The seeded data a parent sees: child, four weeks of results, missions.
const children = await db.collection("children").getFullList({ sort: "created_at", fields: "id,nickname" });
const child = children[0];
step(!!child, "demo child listed", child ? String(child.nickname) : "none");
if (!child) process.exit(1);
const seeded = await db.collection("sessions").getFullList({ filter: `child = "${child.id}"`, fields: "id,started_at,score" });
step(seeded.length >= 10, "results history", `${seeded.length} sessions`);
const missions = await db.collection("missions").getFullList({ filter: `child = "${child.id}"`, fields: "id,status" });
step(missions.length > 0, "missions", `${missions.length}`);

// 5. Live result (FR-39): subscribe before the game uploads, as the QR page does.
let delivered: (id: string) => void = () => {};
const seen = new Set<string>();
let unsubscribe: (() => Promise<void>) | null = null;
if (typeof (globalThis as { EventSource?: unknown }).EventSource === "function") {
  unsubscribe = await db
    .collection("sessions")
    .subscribe("*", (e) => {
      if (e.action !== "create") return;
      seen.add(e.record.id);
      delivered(e.record.id);
    })
    .catch((e: Error) => (step(false, "live results subscribed", e.message), null));
  if (unsubscribe) step(true, "live results subscribed");
} else {
  warn("live results", "no global EventSource in this Node; run with --experimental-eventsource");
}

// 6. QR: the parent agrees to processing once, as the parent page asks (NFR-04), then creates a play link
// and the tablet opens it (FR-01, FR-32).
const agreed = await db.collection("processing_consents").create({ parent: parentId, version: PROCESSING_CONSENT_VERSION }).then(() => "", (e: Error) => e.message);
step(!agreed, "parent consents to processing", agreed);
res = await fetch(`${base}/api/play-links`, { method: "POST", headers: { ...json, cookie }, body: JSON.stringify({ child_id: child.id }) });
const link = await readJson(res);
const code = typeof link.code === "string" ? link.code : "";
step(res.status === 201 && !!code, "play link created", `${res.status}`);
res = await fetch(`${base}/play/${code}`, { redirect: "manual" });
if (res.status === 404) warn("play page /play/<code>", "not built yet");
else step(res.status < 400, "play page /play/<code> opens", `${res.status}`);
res = await fetch(`${base}/api/play-links/${code}`);
step(res.ok, "game resolves the link", `${res.status}`);

// 7. The game uploads a session (FR-11) and the parent sees the result live.
const sessionId = randomUUID();
const session = { ...validSessionMetrics, child_id: child.id, session_id: sessionId, started_at: new Date().toISOString() };
const live = new Promise<boolean>((resolve) => {
  if (seen.has(sessionId)) resolve(true);
  delivered = (id) => id === sessionId && resolve(true);
  setTimeout(() => resolve(false), unsubscribe ? 15_000 : 0);
});
res = await fetch(`${base}/api/sessions`, { method: "POST", headers: { ...json, authorization: `Bearer ${code}` }, body: JSON.stringify(session) });
const saved = await readJson(res);
step(res.status === 201, "game uploads the session", `${res.status} band=${String(saved.band)}`);
if (unsubscribe) step(await live, "result arrives live on the parent screen");
const result = await db.collection("sessions").getOne(sessionId, { fields: "id,score" }).then((r) => r, () => null);
step(!!result?.score, "parent reads the new result");
res = await fetch(`${base}/api/sessions`, { method: "POST", headers: { ...json, authorization: `Bearer ${code}` }, body: JSON.stringify({ ...session, session_id: randomUUID() }) });
step(res.status === 401, "used link cannot upload again", `${res.status}`);
if (unsubscribe) await unsubscribe();

// 8. Billing (FR-45, FR-46): a missing Stripe setup is reported, not failed.
res = await fetch(`${base}/api/stripe/checkout`, { method: "POST", headers: { ...json, cookie }, body: "{}" });
const checkout = await readJson(res);
if (res.status === 503) warn("Stripe checkout", String(checkout.error));
else step(res.ok && typeof checkout.url === "string", "Stripe checkout opens", `${res.status}`);

// 9. Leave the account as the demo expects it.
res = await reset();
step(res.ok, "Reset demo (clean up)", `${res.status}`);
db.authStore.clear();

console.log(failures ? `\n${failures} step(s) failed.` : "\nAll steps passed.");
process.exit(failures ? 1 : 0);

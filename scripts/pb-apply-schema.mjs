#!/usr/bin/env node
// Applies pocketbase/schema.json to the PocketBase in PB_URL (superuser from env or .env.local).
// Creates missing collections and updates existing ones; never deletes a collection or the users collection.
//   npm run db:schema
import { readFileSync, existsSync } from "node:fs";

for (const file of [".env.local", "apps/web/.env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const PB_URL = (process.env.PB_URL ?? "https://unihub-db.andreidobrin.com").replace(/\/$/, "");
const { PB_ADMIN_EMAIL: identity, PB_ADMIN_PASSWORD: pw } = process.env; // check-secrets: allow
if (!identity || !pw) throw new Error("Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD (env or .env.local)."); // check-secrets: allow

async function call(method, path, body, auth) {
  const res = await fetch(PB_URL + path, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const { token: su } = await call("POST", "/api/collections/_superusers/auth-with-password", { identity, password: pw }); // check-secrets: allow
const collections = JSON.parse(readFileSync(new URL("../pocketbase/schema.json", import.meta.url), "utf8"));
await call("PUT", "/api/collections/import", { collections, deleteMissing: false }, su);

// Parents are PocketBase users. Anyone may sign up (no SMTP, so no email verification); a user sees and
// edits only their own record and cannot set the Stripe customer id.
const users = await call("GET", "/api/collections/users", undefined, su);
const fields = users.fields.some((f) => f.name === "stripe_customer_id")
  ? users.fields
  : [...users.fields, { name: "stripe_customer_id", type: "text", hidden: true }];
await call("PATCH", "/api/collections/users", {
  fields,
  listRule: "id = @request.auth.id",
  viewRule: "id = @request.auth.id",
  createRule: "",
  updateRule: "id = @request.auth.id && @request.body.stripe_customer_id:isset = false && @request.body.verified:isset = false",
  deleteRule: "id = @request.auth.id",
}, su);

const now = await call("GET", "/api/collections?perPage=200", undefined, su);
console.log(JSON.stringify(now.items.map((c) => c.name).sort()));

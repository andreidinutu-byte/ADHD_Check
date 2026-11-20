#!/usr/bin/env node
// Zero-dependency CLI for the team PocketBase (see docs/HOSTING.md). Made for people and LLM agents.
// Usage: node scripts/db.mjs <command> [...args]   (or: npm run db -- <command> ...)
// Reads PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD from the environment, .env.local or apps/web/.env.local.
// Every command prints JSON to stdout; errors go to stderr with exit code 1.
import { readFileSync, existsSync } from "node:fs";

const HELP = `db CLI (PocketBase)

  collections                          list collections with their fields
  schema <collection>                  full definition of one collection
  list <collection> [--filter F] [--sort S] [--limit N] [--expand E]
  get <collection> <id>
  create <collection> <json|@file>     a JSON object, or an array for many records
  update <collection> <id> <json|@file>
  delete <collection> <id>
  import <collection> <file.json|file.csv>
  create-collection <json|@file>       {"name","type":"base","fields":[...],"listRule":...}
  add-field <collection> <json|@file>  append field(s), e.g. {"name":"score","type":"number"}
  update-collection <name> <json|@file>  PATCH rules/name; a "fields" key REPLACES all fields
  delete-collection <name>

Filter syntax: title ~ "abc" && created > "2026-01-01"   (see docs/HOSTING.md)`;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile("apps/web/.env.local");

const PB_URL = (process.env.PB_URL ?? "https://unihub-db.andreidobrin.com").replace(/\/$/, "");

function fail(msg) {
  console.error(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2));
  process.exit(1);
}

let token; // check-secrets: allow
async function auth() { // check-secrets: allow
  if (token) return token; // check-secrets: allow
  const { PB_ADMIN_EMAIL: identity, PB_ADMIN_PASSWORD: password } = process.env; // check-secrets: allow
  if (!identity || !password) fail("Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD (env or .env.local)."); // check-secrets: allow
  const r = await call("POST", "/api/collections/_superusers/auth-with-password", { identity, password }, false); // check-secrets: allow
  return (token = r.token); // check-secrets: allow
}

async function call(method, path, body, withAuth = true) {
  const headers = { "Content-Type": "application/json" };
  if (withAuth) headers.Authorization = await auth();
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(PB_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status !== 429 || attempt === 5) break; // rate limited: back off and retry
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) fail({ status: res.status, path, response: data });
  return data;
}

function readJsonArg(arg) {
  if (!arg) fail("Missing JSON argument.");
  return JSON.parse(arg.startsWith("@") ? readFileSync(arg.slice(1), "utf8") : arg);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  const [head, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

function flags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) out[args[i].slice(2)] = args[++i];
  return out;
}

async function createMany(collection, records) {
  const created = [];
  for (const rec of records) created.push(await call("POST", `/api/collections/${collection}/records`, rec));
  return { created: created.length, ids: created.map((r) => r.id) };
}

const [cmd, ...args] = process.argv.slice(2);
const print = (x) => console.log(JSON.stringify(x, null, 2));

switch (cmd) {
  case "collections": {
    const r = await call("GET", "/api/collections?perPage=200");
    print(r.items.filter((c) => !c.system).map((c) => ({
      name: c.name, type: c.type,
      fields: c.fields.filter((f) => !f.system || f.name === "id").map((f) => `${f.name}:${f.type}${f.required ? "!" : ""}`),
      listRule: c.listRule, createRule: c.createRule,
    })));
    break;
  }
  case "schema": print(await call("GET", `/api/collections/${args[0]}`)); break;
  case "list": {
    const f = flags(args.slice(1));
    const qs = new URLSearchParams({ perPage: f.limit ?? "50" });
    if (f.filter) qs.set("filter", f.filter);
    if (f.sort) qs.set("sort", f.sort);
    if (f.expand) qs.set("expand", f.expand);
    print(await call("GET", `/api/collections/${args[0]}/records?${qs}`));
    break;
  }
  case "get": print(await call("GET", `/api/collections/${args[0]}/records/${args[1]}`)); break;
  case "create": {
    const data = readJsonArg(args[1]);
    print(Array.isArray(data) ? await createMany(args[0], data) : await call("POST", `/api/collections/${args[0]}/records`, data));
    break;
  }
  case "update": print(await call("PATCH", `/api/collections/${args[0]}/records/${args[1]}`, readJsonArg(args[2]))); break;
  case "delete": await call("DELETE", `/api/collections/${args[0]}/records/${args[1]}`); print({ deleted: args[1] }); break;
  case "import": {
    const text = readFileSync(args[1], "utf8");
    const records = args[1].toLowerCase().endsWith(".csv") ? parseCsv(text) : JSON.parse(text);
    print(await createMany(args[0], records));
    break;
  }
  case "create-collection": print(await call("POST", "/api/collections", readJsonArg(args[0]))); break;
  case "add-field": {
    // PATCHing "fields" replaces the whole list, so append to the current fields instead.
    const c = await call("GET", `/api/collections/${args[0]}`);
    const extra = readJsonArg(args[1]);
    print(await call("PATCH", `/api/collections/${args[0]}`, { fields: [...c.fields, ...(Array.isArray(extra) ? extra : [extra])] }));
    break;
  }
  case "update-collection": print(await call("PATCH", `/api/collections/${args[0]}`, readJsonArg(args[1]))); break;
  case "delete-collection": await call("DELETE", `/api/collections/${args[0]}`); print({ deleted: args[0] }); break;
  default: console.log(HELP); if (cmd && cmd !== "help") process.exit(1);
}

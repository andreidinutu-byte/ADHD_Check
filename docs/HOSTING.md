# Hosting: live site, deploys and the team database

| | |
|---|---|
| Live site | https://unihub.andreidobrin.com |
| Database (PocketBase 0.40.6) | API https://unihub-db.andreidobrin.com, admin UI https://unihub-db.andreidobrin.com/_/ |
| Who to ask | Andrei (server access, database superuser, server-side environment variables) |

## 1. Deploy: push to `main`, nothing else

The web server checks this repo's `main` branch every minute. When `main` has a new commit it runs, from the repo root:

```bash
npm ci
npm run build
```

and on success restarts the app with the new build (`next start` in `apps/web`, Node 24). A push is usually live **2 to 3 minutes** later.

- **A build that fails changes nothing**: the previous version keeps running, and that commit is not retried. Push a fix and the next commit is built. Run `npm ci && npm run build` locally before pushing to `main`.
- **Keep `package-lock.json` in sync** with every `package.json` change (`npm install` updates it). `npm ci` refuses a lockfile that does not match.
- **How to tell your commit is live**: open the site in a private window and check your change. If it does not appear after 5 minutes, the build most likely failed; build it locally to see the error, or ask Andrei for the server log.
- Only `main` is deployed. Branches and pull requests are not built or run on the server.
- Anyone who can push to `main` runs code on the server, so treat `main` as production: no experiments, no secrets in commits (`npm run check:secrets`).

### Server-side environment variables

The server has no Supabase, Stripe or Resend keys yet, so the pages load but login, checkout and emails answer with errors. Values are set on the server, never in the repo. Send the variable names and values to Andrei privately (not in an issue or commit). Set today:

| Name | Value |
|---|---|
| `SITE_URL` | `https://unihub.andreidobrin.com` |
| `PB_URL` | the PocketBase URL (server-side reads) |

`NEXT_PUBLIC_*` variables are read at build time, so a change to one is live after the next push to `main`.

## 2. Database: PocketBase

The app code in this repo still talks to Supabase. PocketBase is a separate database the team can use for anything new (or to replace Supabase later); nothing in the app uses it yet.

PocketBase stores records in **collections** (tables). Every record has an `id` (15 characters, automatic). API rules on each collection decide who may list, view, create, update and delete: `""` means anyone, `null` means superusers only, or a filter such as `@request.auth.id != ""` (any logged-in user).

| | |
|---|---|
| API base | `https://unihub-db.andreidobrin.com` (env `PB_URL`) |
| Admin UI (people) | https://unihub-db.andreidobrin.com/_/ (log in with the superuser) |
| Superuser | ask Andrei; put the values in `.env.local` only |
| Rate limits per IP | 10 logins / 10 s, 20 anonymous creates / 5 s, 300 requests / 10 s (answers 429 above that) |
| Collections today | `notes` (anyone can read, superuser writes; a demo) |

### The easy way: `npm run db` (no dependencies, prints JSON)

Put these in `.env.local` at the repo root or in `apps/web/.env.local` (both gitignored):

```
PB_URL=https://unihub-db.andreidobrin.com
PB_ADMIN_EMAIL=<from Andrei>
PB_ADMIN_PASSWORD=<from Andrei>
```

Then:

```bash
npm run db -- collections                                   # what exists, with fields
npm run db -- schema notes                                  # full definition of one collection
npm run db -- list notes --filter 'title ~ "hello"' --sort -created --limit 10
npm run db -- get notes <id>
npm run db -- create notes '{"title":"Hi","body":"text"}'
npm run db -- create notes '[{"title":"a"},{"title":"b"}]'  # many at once
npm run db -- import notes data/notes.csv                   # CSV header = field names (or a .json array)
npm run db -- update notes <id> '{"body":"changed"}'
npm run db -- delete notes <id>
npm run db -- create-collection @schema/teams.json
npm run db -- add-field notes '{"name":"score","type":"number"}'
```

`update-collection` with a `fields` key **replaces all fields** and drops the data in fields you leave out. Use `add-field` to add one.

A collection definition:

```json
{
  "name": "teams",
  "type": "base",
  "listRule": "", "viewRule": "", "createRule": null, "updateRule": null, "deleteRule": null,
  "fields": [
    { "name": "name", "type": "text", "required": true },
    { "name": "members", "type": "number" },
    { "name": "active", "type": "bool" },
    { "name": "created", "type": "autodate", "onCreate": true },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ]
}
```

Field types: `text`, `editor` (rich text), `number`, `bool`, `email`, `url`, `date`, `autodate`, `select` (`"values":[...]`, `"maxSelect":1`), `json`, `file`, `relation` (`"collectionId":"<id from schema <name>>"`, `"maxSelect":1`; read the linked record with `list <coll> --expand <field>`), `password` (write-only, never returned), `geoPoint` (`{"lon":26.1,"lat":44.4}`).

### Raw HTTP (any language)

```bash
PB_URL=https://unihub-db.andreidobrin.com

# public read (collections whose listRule is "")
curl -s "$PB_URL/api/collections/notes/records?sort=-created&perPage=20"
curl -s -G "$PB_URL/api/collections/notes/records" --data-urlencode 'filter=title ~ "Hello"'

# superuser token: send it as the Authorization header, without "Bearer"
TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' -d '{"identity":"<email>","password":"<password>"}' | jq -r .token)

curl -s -X POST "$PB_URL/api/collections/notes/records" -H "Authorization: $TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"x"}'
curl -s -X POST "$PB_URL/api/collections" -H "Authorization: $TOKEN" \
  -H 'Content-Type: application/json' -d @schema/teams.json      # new collection
```

List responses look like `{"page":1,"perPage":20,"totalItems":N,"totalPages":N,"items":[...]}`. Filter operators: `=`, `!=`, `>`, `>=`, `<`, `<=`, `~` (contains), `!~`, combined with `&&`, `||` and parentheses; strings in double quotes. Without permission the API answers 403, or an empty list for list rules. Full API reference: https://pocketbase.io/docs/api-records/

### From the app (Next.js)

- Only **server code** (route handlers, Server Components, files with `import "server-only"`) may use the superuser credentials. Browser code must never see them.
- Browser code may call PocketBase directly only for collections whose rules allow it (public reads, or a user logged in through a PocketBase `auth` collection). The official JS SDK is `pocketbase` on npm (`npm install pocketbase --workspace apps/web`).
- A minimal server-side read with no dependency:

```ts
import "server-only";

const PB_URL = process.env.PB_URL ?? "https://unihub-db.andreidobrin.com";

export async function listRecords<T>(collection: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PocketBase ${res.status}: ${await res.text()}`);
  return (await res.json()) as { page: number; perPage: number; totalItems: number; totalPages: number; items: T[] };
}
```

With `cacheComponents` on, a page that reads live data must call `await connection()` (from `next/server`) inside a `<Suspense>` boundary, otherwise it is rendered once at build time.

### Rules

- Schema changes go through `npm run db` or the admin UI. Note them in the commit or PR message.
- No real personal data in PocketBase, same as everywhere else in this project.

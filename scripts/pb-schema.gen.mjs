// One-off generator kept for reference: writes pocketbase/schema.json. Edit this, run it, then `npm run db:schema`.
import { writeFileSync } from "node:fs";
const UUID_GEN = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const uuidId = { name: "id", type: "text", primaryKey: true, required: true, system: true, pattern: "^[0-9a-f-]{36}$", min: 36, max: 36, autogeneratePattern: UUID_GEN };
const autoId = { name: "id", type: "text", primaryKey: true, required: true, system: true, pattern: "^[a-z0-9]+$", min: 15, max: 15, autogeneratePattern: "[a-z0-9]{15}" };
const USERS = "_pb_users_auth_";
const rel = (name, collectionId, extra = {}) => ({ name, type: "relation", collectionId, maxSelect: 1, cascadeDelete: true, required: true, ...extra });
const created = (name = "created_at") => ({ name, type: "autodate", onCreate: true, onUpdate: false });
const own = "parent = @request.auth.id";
const ownCreate = '@request.auth.id != "" && @request.body.parent = @request.auth.id';
const serverOnly = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };

const collections = [
  {
    id: "pbc_children000", name: "children", type: "base",
    listRule: own, viewRule: own, createRule: ownCreate, deleteRule: own,
    updateRule: `${own} && (@request.body.parent:isset = false || @request.body.parent = @request.auth.id)`,
    fields: [uuidId, rel("parent", USERS),
      { name: "nickname", type: "text", required: true, max: 40 },
      { name: "birth_year", type: "number", required: true, onlyInt: true, min: 2000, max: 2100 },
      created()],
    indexes: ["CREATE INDEX idx_children_parent ON children (parent)"],
  },
  {
    id: "pbc_sessions000", name: "sessions", type: "base",
    ...serverOnly, listRule: own, viewRule: own,
    fields: [uuidId, rel("child", "pbc_children000"), rel("parent", USERS),
      { name: "started_at", type: "date", required: true },
      { name: "duration_ms", type: "number" },
      { name: "task", type: "json", maxSize: 100000 },
      { name: "device", type: "json", maxSize: 100000 },
      { name: "calibration", type: "json", maxSize: 100000 },
      { name: "off_target_taps", type: "json", maxSize: 2000000 },
      { name: "minigames", type: "json", maxSize: 2000000 },
      { name: "trials", type: "json", maxSize: 5000000 },
      { name: "schema_version", type: "text" },
      { name: "score", type: "json", maxSize: 200000 },
      { name: "play_link", type: "text", hidden: true },
      created()],
    indexes: [
      "CREATE INDEX idx_sessions_child ON sessions (child, started_at)",
      "CREATE INDEX idx_sessions_parent ON sessions (parent)",
      "CREATE UNIQUE INDEX idx_sessions_play_link ON sessions (play_link) WHERE play_link != ''",
    ],
  },
  {
    id: "pbc_playlinks00", name: "play_links", type: "base", ...serverOnly,
    fields: [autoId,
      { name: "code_hash", type: "text", required: true, pattern: "^[0-9a-f]{64}$" },
      rel("child", "pbc_children000"), rel("parent", USERS),
      { name: "expires_at", type: "date", required: true },
      { name: "allow_camera", type: "bool" },
      { name: "allow_microphone", type: "bool" },
      created()],
    indexes: ["CREATE UNIQUE INDEX idx_play_links_code ON play_links (code_hash)"],
  },
  {
    id: "pbc_consents000", name: "processing_consents", type: "base",
    ...serverOnly, listRule: own, viewRule: own, createRule: ownCreate,
    fields: [autoId, rel("parent", USERS), { name: "version", type: "text", required: true, max: 40 }, created("given_at")],
    indexes: ["CREATE INDEX idx_consents_parent ON processing_consents (parent, version)"],
  },
  {
    id: "pbc_missions000", name: "missions", type: "base",
    listRule: own, viewRule: own, deleteRule: own,
    createRule: `${ownCreate} && @request.body.child.parent = @request.auth.id && (@request.body.chosen_by:isset = false || @request.body.chosen_by = "parent") && @request.body.status = "todo" && @request.body.done_at:isset = false`,
    updateRule: `${own} && @request.body.parent:isset = false && @request.body.child:isset = false && @request.body.chosen_by:isset = false && @request.body.mission_key:isset = false && @request.body.created_at:isset = false`,
    fields: [uuidId, rel("child", "pbc_children000"), rel("parent", USERS),
      { name: "mission_key", type: "text", required: true, pattern: "^[a-z0-9_]{1,64}$" },
      { name: "chosen_by", type: "select", values: ["parent", "professional"], maxSelect: 1 },
      { name: "status", type: "select", values: ["todo", "done"], maxSelect: 1, required: true },
      { name: "created_at", type: "date", required: true },
      { name: "done_at", type: "date" }],
    indexes: ["CREATE INDEX idx_missions_child ON missions (child, created_at)"],
  },
  {
    id: "pbc_purchases00", name: "report_purchases", type: "base",
    ...serverOnly, listRule: own, viewRule: own,
    fields: [autoId, rel("parent", USERS), rel("session", "pbc_sessions000"),
      { name: "stripe_checkout_session_id", type: "text", required: true },
      { name: "status", type: "select", values: ["pending", "paid", "failed", "expired"], maxSelect: 1, required: true },
      { name: "lang", type: "select", values: ["ro", "en"], maxSelect: 1 },
      created(), { name: "paid_at", type: "date" }, { name: "emailed_at", type: "date" }],
    indexes: [
      "CREATE UNIQUE INDEX idx_purchases_checkout ON report_purchases (stripe_checkout_session_id)",
      "CREATE INDEX idx_purchases_session ON report_purchases (session, parent)",
    ],
  },
  {
    id: "pbc_waitlist000", name: "waitlist", type: "base", ...serverOnly,
    fields: [autoId, { name: "email", type: "text", required: true, max: 254 },
      { name: "lang", type: "select", values: ["ro", "en"], maxSelect: 1, required: true }, created()],
    indexes: ["CREATE UNIQUE INDEX idx_waitlist_email ON waitlist (email)"],
  },
];
writeFileSync(new URL("../pocketbase/schema.json", import.meta.url), JSON.stringify(collections, null, 2) + "\n");
console.log(`wrote ${collections.length} collections`);

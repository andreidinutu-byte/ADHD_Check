import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// pocketbase/schema.json holds the API rules that replace row-level security (NFR-11, NFR-12). These checks
// fail when a rule is loosened by accident. Rules: null = superuser only (the server), "" = anyone.
type Collection = {
  name: string;
  listRule: string | null;
  viewRule: string | null;
  createRule: string | null;
  updateRule: string | null;
  deleteRule: string | null;
  fields: { name: string; type: string; cascadeDelete?: boolean; hidden?: boolean; collectionId?: string }[];
};
const schema: Collection[] = JSON.parse(readFileSync(new URL("../../../pocketbase/schema.json", import.meta.url), "utf8"));
const byName = new Map(schema.map((c) => [c.name, c]));
const OWN = "parent = @request.auth.id";
const RULES = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"] as const;

describe("pocketbase/schema.json API rules", () => {
  it("has the collections the app uses", () => {
    for (const name of ["children", "sessions", "play_links", "processing_consents", "missions", "report_purchases", "waitlist"]) {
      expect(byName.has(name), name).toBe(true);
    }
  });

  it("never opens a rule to anyone", () => {
    for (const c of schema) for (const r of RULES) expect(c[r], `${c.name}.${r}`).not.toBe("");
  });

  it("lets a parent read only their own records", () => {
    for (const c of schema) {
      for (const r of ["listRule", "viewRule"] as const) {
        if (c[r] !== null) expect(c[r], `${c.name}.${r}`).toBe(OWN);
      }
    }
  });

  it("keeps play links, the waitlist and every write of sessions and purchases on the server", () => {
    for (const name of ["play_links", "waitlist"]) for (const r of RULES) expect(byName.get(name)![r], `${name}.${r}`).toBeNull();
    for (const name of ["sessions", "report_purchases"]) {
      for (const r of ["createRule", "updateRule", "deleteRule"] as const) expect(byName.get(name)![r], `${name}.${r}`).toBeNull();
    }
    expect(byName.get("processing_consents")!.updateRule).toBeNull();
    expect(byName.get("processing_consents")!.deleteRule).toBeNull();
  });

  it("makes every parent write name the parent itself", () => {
    for (const c of schema) {
      if (c.createRule !== null) expect(c.createRule, `${c.name}.createRule`).toContain("@request.body.parent = @request.auth.id");
      for (const r of ["updateRule", "deleteRule"] as const) if (c[r] !== null) expect(c[r], `${c.name}.${r}`).toContain(OWN);
    }
  });

  it("refuses missions for another parent's child and missions not chosen by the parent (NFR-52)", () => {
    const m = byName.get("missions")!;
    expect(m.createRule).toContain("@request.body.child.parent = @request.auth.id");
    expect(m.createRule).toContain('@request.body.chosen_by = "parent"');
    expect(m.updateRule).toContain("@request.body.chosen_by:isset = false");
    expect(m.updateRule).toContain("@request.body.child:isset = false");
  });

  it("deletes a child's data with the child (FR-41) and hides the play link code hash", () => {
    for (const name of ["sessions", "play_links", "missions"]) {
      const child = byName.get(name)!.fields.find((f) => f.name === "child");
      expect(child?.cascadeDelete, `${name}.child`).toBe(true);
    }
    expect(byName.get("sessions")!.fields.find((f) => f.name === "play_link")?.hidden).toBe(true);
  });
});

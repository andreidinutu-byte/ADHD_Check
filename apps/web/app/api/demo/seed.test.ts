import { describe, expect, it } from "vitest";
import type PocketBase from "pocketbase";
import { ScoreResultSchema } from "@adhdcheck/contracts";
import { seedDemo } from "./seed";

const PARENT = "00000000-0000-4000-8000-00000000000a";
const NOW = new Date("2026-11-20T10:00:00Z");

// Records what seedDemo writes; getFullList answers the parent's existing children.
function fakePb(existing: string[] = []) {
  const created: Record<string, Record<string, unknown>[]> = {};
  const deleted: string[] = [];
  const pb = {
    collection: (name: string) => ({
      getFullList: async () => existing.map((id) => ({ id })),
      delete: async (id: string) => void deleted.push(`${name}:${id}`),
      create: async (body: Record<string, unknown>) => {
        (created[name] ??= []).push(body);
        return { id: name === "children" ? "child-1" : "x", ...body };
      },
    }),
  } as unknown as PocketBase;
  return { pb, created, deleted };
}

describe("seedDemo (FR-55)", () => {
  it("deletes the parent's children first and answers 12 sessions", async () => {
    const { pb, deleted } = fakePb(["old-1", "old-2"]);
    expect(await seedDemo(pb, PARENT, NOW)).toBe(12);
    expect(deleted).toEqual(["children:old-1", "children:old-2"]);
  });

  it("creates Demo Fox, twelve scored synthetic sessions and six missions", async () => {
    const { pb, created } = fakePb();
    await seedDemo(pb, PARENT, NOW);

    expect(created.children).toEqual([{ parent: PARENT, nickname: "Demo Fox", birth_year: 2018 }]);
    expect(created.sessions).toHaveLength(12);
    expect(created.missions).toHaveLength(6);

    const first = created.sessions![0]!;
    expect(first.started_at).toBe("2026-10-24T16:30:00.000Z");
    expect(first).toMatchObject({ child: "child-1", parent: PARENT, play_link: "", trials: [], duration_ms: 300000, schema_version: "1.0" });
    for (const s of created.sessions!) {
      expect((s.score as { session_id: string }).session_id).toBe(s.id);
      expect(() => ScoreResultSchema.parse(s.score)).not.toThrow();
    }
    expect(new Set(created.sessions!.map((s) => s.id)).size).toBe(12);
  });

  it("makes the fifth session short, with insufficient data", async () => {
    const { pb, created } = fakePb();
    await seedDemo(pb, PARENT, NOW);
    const short = created.sessions![4]!;
    expect(short.duration_ms).toBe(60000);
    expect(short.score).toMatchObject({ band: "insufficient_data", flags: [], reasons: [], data_quality: { n_trials: 30 } });
  });

  it("makes the first four missions done, with dates as in the SQL seed", async () => {
    const { pb, created } = fakePb();
    await seedDemo(pb, PARENT, NOW);
    const m = created.missions!;
    expect(m.map((x) => x.status)).toEqual(["done", "done", "done", "done", "todo", "todo"]);
    expect(m[0]).toMatchObject({ mission_key: "wellbeing_01", chosen_by: "parent", created_at: "2026-10-27T19:00:00.000Z", done_at: "2026-10-29T19:00:00.000Z" });
    expect(m[4]!.done_at).toBeNull();
  });
});

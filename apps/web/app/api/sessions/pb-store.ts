import type PocketBase from "pocketbase";
import { ClientResponseError } from "pocketbase";
import { q } from "../../../lib/pocketbase/config";
import { InvalidPlayLinkError, type SessionStore } from "./store";

// The link must be valid when the session STARTS (resolve refuses an expired link), but a session lasts about
// 13 to 15 minutes (research/04 section 5), so a link that expired during play may still save the session the
// child just finished. TODO (design choice, no source): the grace, twice the 15 minutes.
export const LINK_GRACE_MS = 30 * 60 * 1000;

// SessionStore on PocketBase. One sessions record holds the session, its trials and its score, so a save is a
// single create. The play link is used up by that same create: sessions.play_link has a unique index, so two
// posts with one link store one session. parent and child come from the link, never from the payload.
// Pass the superuser client (lib/pocketbase/admin.ts).
export function createPbSessionStore(pb: PocketBase, now: () => Date = () => new Date()): SessionStore {
  async function sessionForLink(codeHash: string): Promise<string | null> {
    const r = await pb.collection("sessions").getList(1, 1, { filter: `play_link = ${q(codeHash)}`, fields: "id" });
    return r.items[0]?.id ?? null;
  }

  return {
    async save(codeHash, session, score) {
      const links = await pb.collection("play_links").getList(1, 1, { filter: `code_hash = ${q(codeHash)}` });
      const link = links.items[0];
      if (!link || link.child !== session.child_id) throw new InvalidPlayLinkError();

      const usedBy = await sessionForLink(codeHash);
      if (usedBy) {
        if (usedBy === session.session_id) return { created: false };
        throw new InvalidPlayLinkError();
      }
      const expires = new Date(String(link.expires_at).replace(" ", "T")).getTime();
      if (expires + LINK_GRACE_MS <= now().getTime()) throw new InvalidPlayLinkError();

      const s = session as typeof session & { minigames?: unknown };
      try {
        await pb.collection("sessions").create({
          id: s.session_id,
          child: link.child,
          parent: link.parent,
          started_at: s.started_at,
          duration_ms: s.duration_ms,
          task: s.task,
          device: s.device,
          calibration: s.calibration,
          off_target_taps: s.off_target_taps,
          schema_version: s.schema_version,
          minigames: s.minigames ?? null,
          trials: s.trials,
          score,
          play_link: codeHash,
        });
        return { created: true };
      } catch (e) {
        if (!(e instanceof ClientResponseError) || e.status !== 400) throw e;
        const data = (e.response?.data ?? {}) as Record<string, { code?: string }>;
        // A concurrent post with the same link won the unique index: answer as for a repeat.
        if (data.play_link?.code === "validation_not_unique") {
          if ((await sessionForLink(codeHash)) === s.session_id) return { created: false };
          throw new InvalidPlayLinkError();
        }
        // The session_id is already stored, saved with another link: this link cannot claim it.
        if (data.id) throw new InvalidPlayLinkError();
        throw new Error(`save session failed: ${JSON.stringify(data)}`);
      }
    },
  };
}

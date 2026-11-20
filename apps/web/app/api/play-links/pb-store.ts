import type PocketBase from "pocketbase";
import { q } from "../../../lib/pocketbase/config";
import type { PlayLinkStore } from "./handlers";

// PlayLinkStore on PocketBase (pocketbase/schema.json: play_links, children, sessions, processing_consents).
// Pass the superuser client (lib/pocketbase/admin.ts): play_links is closed to parents and to anonymous users.
// A link is used up once a session carries its code hash (unique index on sessions.play_link).
export function createPbPlayLinkStore(pb: PocketBase): PlayLinkStore {
  return {
    async issue({ parentId, childId, codeHash, expiresAt, consent }) {
      const owned = await pb
        .collection("children")
        .getList(1, 1, { filter: `id = ${q(childId)} && parent = ${q(parentId)}`, fields: "id" });
      if (owned.totalItems === 0) return false;
      await pb.collection("play_links").create({
        code_hash: codeHash,
        child: childId,
        parent: parentId,
        expires_at: expiresAt.toISOString(),
        allow_camera: consent.camera,
        allow_microphone: consent.microphone,
      });
      return true;
    },
    async resolve(codeHash) {
      const links = await pb.collection("play_links").getList(1, 1, {
        filter: `code_hash = ${q(codeHash)} && expires_at > @now`,
      });
      const link = links.items[0];
      if (!link) return null;
      const used = await pb.collection("sessions").getList(1, 1, { filter: `play_link = ${q(codeHash)}`, fields: "id" });
      if (used.totalItems > 0) return null;
      return {
        childId: String(link.child),
        consent: { camera: link.allow_camera === true, microphone: link.allow_microphone === true },
      };
    },
    async hasProcessingConsent(parentId, version) {
      const rows = await pb.collection("processing_consents").getList(1, 1, {
        filter: `parent = ${q(parentId)} && version = ${q(version)}`,
        fields: "id",
      });
      return rows.totalItems > 0;
    },
  };
}

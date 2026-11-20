import type PocketBase from "pocketbase";
import { getParent as getSessionParent } from "@/lib/pocketbase/server";
import { parentFromUser } from "./parent-from-user";

// The logged-in parent for the FR-50 email routes. The login is verified with PocketBase and the confirmation
// state (users.verified) is read from the users record with the superuser client, so it is the server's, never
// a claim copied from the request or the cookie (R3-E2).
export async function getEmailParent(admin: PocketBase) {
  const session = await getSessionParent();
  if (!session) return null;
  const user = await admin.collection("users").getOne(session.id, { fields: "id,email,verified" });
  return parentFromUser({ id: user.id, email: String(user.email ?? ""), verified: Boolean(user.verified) });
}

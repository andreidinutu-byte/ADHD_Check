import { getParent } from "@/lib/pocketbase/server";

// The logged-in parent, verified with PocketBase, or null.
export async function currentUser() {
  return getParent();
}

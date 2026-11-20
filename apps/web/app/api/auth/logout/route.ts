// Parent log-out (FR-30). Logic and tests in ../handlers.ts.
import { createPbAuth } from "@/lib/pocketbase/auth";
import { handleLogout } from "../handlers";

export async function POST(request: Request) {
  return handleLogout(request, { auth: await createPbAuth() });
}
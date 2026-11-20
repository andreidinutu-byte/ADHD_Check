// Parent log-in (FR-30). Logic and tests in ../handlers.ts.
import { createPbAuth } from "@/lib/pocketbase/auth";
import { handleLogin } from "../handlers";

export async function POST(request: Request) {
  return handleLogin(request, { auth: await createPbAuth() });
}
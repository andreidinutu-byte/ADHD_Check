// The parent behind an email request, from the PocketBase users record. emailConfirmed is true only when
// PocketBase has verified the address (users.verified); it is never assumed (R3-E2).
export type EmailParent = { id: string; email: string; emailConfirmed: boolean };

export function parentFromUser(user: { id?: string | null; email?: string | null; verified?: boolean | null } | null | undefined): EmailParent | null {
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email, emailConfirmed: Boolean(user.verified) };
}

import { getSession } from "../lib/dynamo-client.mjs";

export async function requireAuth(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const session = await getSession(token);
  if (!session) return null;

  if (new Date(session.expiresAt) < new Date()) return null;

  return { token, userId: session.userId, expiresAt: session.expiresAt };
}

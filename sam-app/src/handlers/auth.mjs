import bcrypt from "bcryptjs";
import { requireAuth } from "./middleware/auth.mjs";
import * as db from "./lib/dynamo-client.mjs";

const SALT_ROUNDS = 10;

function ok(data) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export async function lambdaHandler(event) {
  try {
    const method = event.httpMethod;
    const path = event.path;

    if (method === "POST" && path === "/api/auth/signup") return handleSignup(event);
    if (method === "POST" && path === "/api/auth/login") return handleLogin(event);
    if (method === "POST" && path === "/api/auth/logout") return handleLogout(event);
    if (method === "GET" && path === "/api/auth/me") return handleMe(event);

    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return json(500, { error: "Internal server error" });
  }
}

async function handleSignup(event) {
  const { email, username, password } = JSON.parse(event.body || "{}");
  if (!email || !username || !password) return json(400, { error: "Missing fields" });
  if (password.length < 8) return json(400, { error: "Password must be at least 8 characters" });

  const existing = await db.getUserByEmail(email.toLowerCase());
  if (existing) return json(409, { error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { randomUUID } = await import("node:crypto");
  const userId = randomUUID();

  await db.createUser(userId, email.toLowerCase(), username, passwordHash);

  return ok({ userId, email: email.toLowerCase(), username });
}

async function handleLogin(event) {
  const { email, password } = JSON.parse(event.body || "{}");
  if (!email || !password) return json(400, { error: "Missing fields" });

  const user = await db.getUserByEmail(email.toLowerCase());
  if (!user) return json(401, { error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return json(401, { error: "Invalid credentials" });

  const session = await db.createSession(user.userId);

  return ok({
    token: session.token,
    userId: user.userId,
    email: user.email,
    username: user.username,
    expiresAt: session.expiresAt,
  });
}

async function handleLogout(event) {
  const session = await requireAuth(event);
  if (!session) return json(401, { error: "Unauthorized" });
  await db.deleteSession(session.token);
  return ok({ message: "Logged out" });
}

async function handleMe(event) {
  const session = await requireAuth(event);
  if (!session) return json(401, { error: "Unauthorized" });
  const user = await db.getUserById(session.userId);
  if (!user) return json(404, { error: "User not found" });

  return ok({
    userId: user.userId,
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
  });
}

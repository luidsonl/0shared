import bcrypt from "bcryptjs";
import { requireAuth } from "./middleware/auth.mjs";
import * as db from "./lib/dynamo-client.mjs";
import {
  json,
  notFound,
  badRequest,
  unauthorized,
  conflict,
  internalError,
  signupResponse,
  loginResponse,
  logoutResponse,
  meResponse,
} from "./lib/dto.mjs";

const SALT_ROUNDS = 10;

export async function lambdaHandler(event) {
  try {
    const method = event.httpMethod;
    const path = event.path;

    if (method === "POST" && path === "/api/auth/signup") return handleSignup(event);
    if (method === "POST" && path === "/api/auth/login") return handleLogin(event);
    if (method === "POST" && path === "/api/auth/logout") return handleLogout(event);
    if (method === "GET" && path === "/api/auth/me") return handleMe(event);

    return notFound();
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    return internalError();
  }
}

async function handleSignup(event) {
  const { email, username, password } = JSON.parse(event.body || "{}");
  if (!email || !username || !password) return badRequest("Missing fields");
  if (password.length < 8) return badRequest("Password must be at least 8 characters");

  const existing = await db.getUserByEmail(email.toLowerCase());
  if (existing) return conflict("Email already registered");

  const existingUsername = await db.getUserByUsername(username);
  if (existingUsername) return conflict("Username already taken");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { randomUUID } = await import("node:crypto");
  const userId = randomUUID();

  await db.createUser(userId, email.toLowerCase(), username, passwordHash);

  return signupResponse(userId, email.toLowerCase(), username);
}

async function handleLogin(event) {
  const { email, password } = JSON.parse(event.body || "{}");
  if (!email || !password) return badRequest("Missing fields");

  const user = await db.getUserByEmail(email.toLowerCase());
  if (!user) return unauthorized("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return unauthorized("Invalid credentials");

  const session = await db.createSession(user.userId);

  return loginResponse(session.token, user.userId, user.email, user.username, session.expiresAt);
}

async function handleLogout(event) {
  const session = await requireAuth(event);
  if (!session) return unauthorized();
  await db.deleteSession(session.token);
  return logoutResponse();
}

async function handleMe(event) {
  const session = await requireAuth(event);
  if (!session) return unauthorized();
  const user = await db.getUserById(session.userId);
  if (!user) return notFound("User not found");

  return meResponse(user.userId, user.email, user.username, user.createdAt);
}

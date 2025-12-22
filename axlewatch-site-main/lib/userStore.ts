// User store with Neon Postgres persistence
// Falls back to in-memory storage for local development

import { sql, initDatabase } from './db';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  receivers: string[]; // Array of receiver MAC addresses
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

// In-memory fallback for local development
const localUsers = new Map<string, User>(); // email -> User
const localSessions = new Map<string, Session>(); // token -> Session

// Initialize database on module load
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized && sql) {
    await initDatabase();
    dbInitialized = true;
  }
}

// Check if database is available
const isDatabaseAvailable = (): boolean => {
  return sql !== null;
};

// Simple password hashing (for demo - use bcrypt in production)
export function hashPassword(password: string): string {
  // This is a simple hash for demonstration
  // In production, use bcrypt or argon2
  return Buffer.from(password).toString('base64');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Generate a random session token
export function generateToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Buffer.from(randomBytes).toString('base64');
}

// User management
export async function createUser(name: string, email: string, password: string): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();
  await ensureDbInitialized();

  // Check if user already exists
  const existingUser = await getUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new Error("User already exists");
  }

  const user: User = {
    id: Date.now().toString(),
    name,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    receivers: [],
  };

  if (isDatabaseAvailable() && sql) {
    // Store in Neon Postgres
    await sql`
      INSERT INTO users (id, name, email, password_hash, created_at, receivers)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.createdAt}, ${user.receivers})
    `;
  } else {
    // Local fallback
    localUsers.set(normalizedEmail, user);
  }

  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();
  await ensureDbInitialized();

  if (isDatabaseAvailable() && sql) {
    const result = await sql`
      SELECT id, name, email, password_hash as "passwordHash", created_at as "createdAt", receivers
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;
    return result.length > 0 ? result[0] as User : null;
  } else {
    return localUsers.get(normalizedEmail) || null;
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  await ensureDbInitialized();

  if (isDatabaseAvailable() && sql) {
    const result = await sql`
      SELECT id, name, email, password_hash as "passwordHash", created_at as "createdAt", receivers
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    return result.length > 0 ? result[0] as User : null;
  } else {
    // Local fallback - search through map
    const usersList = Array.from(localUsers.values());
    for (const user of usersList) {
      if (user.id === userId) {
        return user;
      }
    }
    return null;
  }
}

// Session management
export async function createSession(userId: string): Promise<Session> {
  const token = generateToken();
  const session: Session = {
    token,
    userId,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
  };

  await ensureDbInitialized();

  if (isDatabaseAvailable() && sql) {
    // Store in Neon Postgres
    await sql`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (${token}, ${userId}, ${session.expiresAt})
    `;
  } else {
    localSessions.set(token, session);
  }

  return session;
}

export async function getSession(token: string): Promise<Session | null> {
  await ensureDbInitialized();

  let session: Session | null = null;

  if (isDatabaseAvailable() && sql) {
    const result = await sql`
      SELECT token, user_id as "userId", expires_at as "expiresAt"
      FROM sessions
      WHERE token = ${token}
      LIMIT 1
    `;
    session = result.length > 0 ? result[0] as Session : null;
  } else {
    session = localSessions.get(token) || null;
  }

  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < Date.now()) {
    await deleteSession(token);
    return null;
  }

  return session;
}

export async function deleteSession(token: string): Promise<void> {
  await ensureDbInitialized();

  if (isDatabaseAvailable() && sql) {
    await sql`
      DELETE FROM sessions
      WHERE token = ${token}
    `;
  } else {
    localSessions.delete(token);
  }
}

// Verify authentication
export async function verifyAuth(token: string): Promise<User | null> {
  const session = await getSession(token);
  if (!session) {
    return null;
  }

  return await getUserById(session.userId);
}

// Receiver management for users
export async function addReceiverToUser(userId: string, receiverMac: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.receivers.includes(receiverMac)) {
    user.receivers.push(receiverMac);

    await ensureDbInitialized();

    if (isDatabaseAvailable() && sql) {
      // Update in Postgres
      await sql`
        UPDATE users
        SET receivers = ${user.receivers}
        WHERE id = ${userId}
      `;
    } else {
      localUsers.set(user.email, user);
    }
  }
}

export async function removeReceiverFromUser(userId: string, receiverMac: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.receivers = user.receivers.filter(mac => mac !== receiverMac);

  await ensureDbInitialized();

  if (isDatabaseAvailable() && sql) {
    // Update in Postgres
    await sql`
      UPDATE users
      SET receivers = ${user.receivers}
      WHERE id = ${userId}
    `;
  } else {
    localUsers.set(user.email, user);
  }
}

export async function getUserReceivers(userId: string): Promise<string[]> {
  const user = await getUserById(userId);
  return user?.receivers || [];
}

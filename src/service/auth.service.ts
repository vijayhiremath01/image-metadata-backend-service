import { db } from '@/db/db-connection';
import { users, sessions } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateSessionId,
  TOKEN_EXPIRY,
  AccessTokenPayload,
  RefreshTokenPayload,
  verifyRefreshToken,
} from '@/config/auth.config';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error('EMAIL_EXISTS');
  }

  const existingUsername = await db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (existingUsername.length > 0) {
    throw new Error('USERNAME_EXISTS');
  }

  const passwordHash = await hashPassword(input.password);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      passwordHash,
    })
    .returning();

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH);

  const accessToken = generateAccessToken({
    sub: user.id,
    sessionId,
    username: user.username,
  });

  const refreshToken = generateRefreshToken({
    sub: user.id,
    sessionId,
    username: user.username,
  });

  const refreshTokenHash = hashRefreshToken(refreshToken);

  await db.insert(sessions).values({
    userId: user.id,
    sessionId,
    refreshTokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: TOKEN_EXPIRY.ACCESS / 1000,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: 'USER',
    },
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, input.email), eq(users.isActive, true)))
    .limit(1);

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH);

  const accessToken = generateAccessToken({
    sub: user.id,
    sessionId,
    username: user.username,
  });

  const refreshToken = generateRefreshToken({
    sub: user.id,
    sessionId,
    username: user.username,
  });

  const refreshTokenHash = hashRefreshToken(refreshToken);

  await db.insert(sessions).values({
    userId: user.id,
    sessionId,
    refreshTokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: TOKEN_EXPIRY.ACCESS / 1000,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: 'USER',
    },
  };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.sessionId, payload.sessionId), eq(sessions.userId, payload.sub)))
    .limit(1);

  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  if (session.revokedAt) {
    throw new Error('SESSION_REVOKED');
  }

  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw new Error('SESSION_EXPIRED');
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  
  const isValid = await verifyPassword(refreshToken, session.refreshTokenHash);
  
  if (!isValid) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const newSessionId = generateSessionId();
  const newExpiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH);

  const newAccessToken = generateAccessToken({
    sub: payload.sub,
    sessionId: newSessionId,
    username: payload.username,
  });

  const newRefreshToken = generateRefreshToken({
    sub: payload.sub,
    sessionId: newSessionId,
    username: payload.username,
  });

  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.id, session.id));
    await tx.insert(sessions).values({
      userId: payload.sub,
      sessionId: newSessionId,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: newExpiresAt,
    });
  });

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, payload.sub), eq(users.isActive, true)))
    .limit(1);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    tokenType: 'Bearer',
    expiresIn: TOKEN_EXPIRY.ACCESS / 1000,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: 'USER',
    },
  };
}

export async function logout(sessionId: string, userId: string): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.sessionId, sessionId), eq(sessions.userId, userId)));
}

export async function logoutAll(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  return user || null;
}

export async function validateSession(sessionId: string, userId: string): Promise<boolean> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.sessionId, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) return false;
  if (session.revokedAt) return false;
  if (session.expiresAt < new Date()) return false;

  return true;
}
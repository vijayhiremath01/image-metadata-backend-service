import "dotenv/config";
import { db } from './src/db/db-connection';
import { sessions } from './src/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyRefreshToken, hashRefreshToken } from './src/config/auth.config';
import bcrypt from 'bcryptjs';

async function main() {
  const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZTYzOGIyYy02ZTRkLTQ2Y2QtYTQzNi1jZmJiYmEyNTllMWIiLCJzZXNzaW9uSWQiOiIyYWIyMjlkODYyOTliZTc5OWFiODhiMzkwNGY1Yjk5ZSIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzg2MjU5MjA2LCJleHAiOjE3ODg4NTEyMDZ9.4XfqNH4e6Kq3j0gdl5gD7iQDeiB5dZb785tFxkYuWiM";

  const payload = verifyRefreshToken(refreshToken);
  console.log('Payload:', payload);

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.sessionId, payload.sessionId), eq(sessions.userId, payload.sub)))
    .limit(1);

  console.log('Session:', session);

  if (session) {
    const hash = hashRefreshToken(refreshToken);
    console.log('New hash:', hash);
    console.log('Stored hash:', session.refreshTokenHash);
    
    const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    console.log('Is valid:', isValid);
  }
}

main().catch(console.error);

import "dotenv/config";
import { db } from './src/db/db-connection';
import { sessions } from './src/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyRefreshToken, hashRefreshToken } from './src/config/auth.config';
import bcrypt from 'bcryptjs';

async function main() {
  const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZTYzOGIyYy02ZTRkLTQ2Y2QtYTQzNi1jZmJiYmEyNTllMWIiLCJzZXNzaW9uSWQiOiJhNTVmMWNlNDg3NDY5ZGU5YzFmNjkwNGM5ZWMyODg5MyIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzg2MjU5NzU2LCJleHAiOjE3ODg4NTE3NTZ9.lg82kaUJ6eF49XkNt8ipHH5mdYm_GaUS_H6MQNBLUk0";

  const payload = verifyRefreshToken(refreshToken);
  console.log('Payload:', payload);

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.sessionId, payload.sessionId), eq(sessions.userId, payload.sub)))
    .limit(1);

  console.log('Session from DB:', session);

  if (session) {
    const computedHash = hashRefreshToken(refreshToken);
    console.log('Computed hash:', computedHash);
    console.log('Stored hash:', session.refreshTokenHash);
    
    const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    console.log('bcrypt.compare result:', isValid);
  }
}

main().catch(console.error);

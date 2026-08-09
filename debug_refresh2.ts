import "dotenv/config";
import { db } from './src/db/db-connection';
import { sessions } from './src/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyRefreshToken, hashRefreshToken } from './src/config/auth.config';
import bcrypt from 'bcryptjs';

async function main() {
  const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjZTYzOGIyYy02ZTRkLTQ2Y2QtYTQzNi1jZmJiYmEyNTllMWIiLCJzZXNzaW9uSWQiOiJlYjZiYTBiMTY5NWM5YTkyZmYwMGM0YTc2ZDA3MTA4NyIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzg2MjU5MzE5LCJleHAiOjE3ODg4NTEzMTl9.oiFGKdyuZyxRgNRVpgYfaGPAXoN3tnmpSuPr90L13fI";

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

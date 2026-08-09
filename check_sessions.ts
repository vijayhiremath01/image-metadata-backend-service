import "dotenv/config";
import { db } from './src/db/db-connection';
import { sessions } from './src/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const allSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, 'ce638b2c-6e4d-46cd-a436-cfbbba259e1b'))
    .orderBy(desc(sessions.createdAt));
  
  console.log('All sessions for user:');
  for (const s of allSessions) {
    console.log('Session:', JSON.stringify(s, null, 2));
  }
}

main().catch(console.error);

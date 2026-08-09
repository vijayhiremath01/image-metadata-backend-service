import "dotenv/config";
import { db } from './src/db/db-connection';

async function checkSchema() {
  const tables = await db.execute(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('Tables:', JSON.stringify(tables));
  
  const usersCols = await db.execute(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    ORDER BY ordinal_position
  `);
  console.log('\nUsers columns:', JSON.stringify(usersCols));
  
  const sessionsCols = await db.execute(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'sessions' 
    ORDER BY ordinal_position
  `);
  console.log('\nSessions columns:', JSON.stringify(sessionsCols));
  
  const photosCols = await db.execute(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'photos' 
    ORDER BY ordinal_position
  `);
  console.log('\nPhotos columns:', JSON.stringify(photosCols));
  
  const likesCols = await db.execute(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'photo_likes' 
    ORDER BY ordinal_position
  `);
  console.log('\nPhoto_likes columns:', JSON.stringify(likesCols));
  
  const likesNewCols = await db.execute(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'photo_likes_new' 
    ORDER BY ordinal_position
  `);
  console.log('\nPhoto_likes_new columns:', JSON.stringify(likesNewCols));
}

checkSchema().catch(console.error);

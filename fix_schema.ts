import "dotenv/config";
import { db } from './src/db/db-connection';

async function fixSchema() {
  // Drop old photo_likes table and rename photo_likes_new to photo_likes
  await db.execute(`DROP TABLE IF EXISTS "photo_likes"`);
  await db.execute(`ALTER TABLE "photo_likes_new" RENAME TO "photo_likes"`);
  console.log('Renamed photo_likes_new to photo_likes');
  
  // Add foreign key for photos.user_id -> users.id
  // First check if there are any photos with user_id
  const photosWithUser = await db.execute(`SELECT COUNT(*) as count FROM "photos" WHERE "user_id" IS NOT NULL`);
  console.log('Photos with user_id:', photosWithUser.rows);
  
  const photosWithoutUser = await db.execute(`SELECT COUNT(*) as count FROM "photos" WHERE "user_id" IS NULL`);
  console.log('Photos without user_id:', photosWithoutUser.rows);
  
  // If there are photos without user_id, we need to handle them
  // For now, let's make user_id nullable in the schema but add the FK
  // We'll use a partial foreign key or handle it in the application layer
  
  // Add foreign key for photos.user_id -> users.id (only for rows where user_id is not null)
  // PostgreSQL doesn't support partial FK directly, so we'll add it and handle in app
  try {
    await db.execute(`ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action`);
    console.log('Added FK for photos.user_id');
  } catch (e) {
    console.log('FK may already exist or error:', e);
  }
  
  // Add unique index for photo_likes (photo_id, user_id)
  try {
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "photo_likes_photo_id_user_id_idx" ON "photo_likes" USING btree ("photo_id", "user_id")`);
    console.log('Added unique index for photo_likes');
  } catch (e) {
    console.log('Index may already exist:', e);
  }
  
  console.log('Schema fix complete');
}

fixSchema().catch(console.error);

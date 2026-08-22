import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/db/schema';

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client, { schema });

async function runMigrations() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_follows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(follower_id, following_id)
    );
    CREATE INDEX IF NOT EXISTS user_follows_follower_id_idx ON user_follows(follower_id);
    CREATE INDEX IF NOT EXISTS user_follows_following_id_idx ON user_follows(following_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS boards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_private BOOLEAN DEFAULT FALSE NOT NULL,
      cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS boards_user_id_idx ON boards(user_id);
    CREATE INDEX IF NOT EXISTS boards_cover_photo_id_idx ON boards(cover_photo_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS board_photos (
      board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      PRIMARY KEY (board_id, photo_id)
    );
    CREATE INDEX IF NOT EXISTS board_photos_board_id_idx ON board_photos(board_id);
    CREATE INDEX IF NOT EXISTS board_photos_photo_id_idx ON board_photos(photo_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS photo_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photo_comments_photo_id_idx ON photo_comments(photo_id);
    CREATE INDEX IF NOT EXISTS photo_comments_user_id_idx ON photo_comments(user_id);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
      read BOOLEAN DEFAULT FALSE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS notifications_actor_id_idx ON notifications(actor_id);
    CREATE INDEX IF NOT EXISTS notifications_photo_id_idx ON notifications(photo_id);
    CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_interests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic VARCHAR(100) NOT NULL,
      score INTEGER DEFAULT 0 NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(user_id, topic)
    );
    CREATE INDEX IF NOT EXISTS user_interests_user_id_idx ON user_interests(user_id);
    CREATE INDEX IF NOT EXISTS user_interests_topic_idx ON user_interests(topic);
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS photo_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      photo_id UUID NOT NULL UNIQUE REFERENCES photos(id) ON DELETE CASCADE,
      impressions INTEGER DEFAULT 0 NOT NULL,
      views INTEGER DEFAULT 0 NOT NULL,
      downloads INTEGER DEFAULT 0 NOT NULL,
      shares INTEGER DEFAULT 0 NOT NULL,
      saves INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photo_analytics_photo_id_idx ON photo_analytics(photo_id);
  `);

  await db.execute(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS website VARCHAR(500);
  `);

  console.log('All tables created successfully!');
  await client.end();
}

runMigrations().catch(console.error);
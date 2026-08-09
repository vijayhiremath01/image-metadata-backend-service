-- Migration: Add users, sessions, user_id to photos, shares_count, and modify photo_likes

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"avatar_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users" USING btree ("is_active");
--> statement-breakpoint

-- Create sessions table
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"refresh_token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_refresh_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
--> statement-breakpoint

-- Add user_id to photos table
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "shares_count" integer DEFAULT 0 NOT NULL;

-- Add foreign key for user_id on photos (will need to handle existing data)
-- First, let's check if there are existing photos without user_id
-- We'll set a default user for existing photos or make it nullable for now

-- Create new photo_likes table with user_id instead of ip_address
CREATE TABLE IF NOT EXISTS "photo_likes_new" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_likes_new_photo_id_user_id_unique" UNIQUE("photo_id", "user_id")
);
--> statement-breakpoint
ALTER TABLE "photo_likes_new" ADD CONSTRAINT "photo_likes_new_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "photo_likes_new" ADD CONSTRAINT "photo_likes_new_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_likes_new_photo_id_idx" ON "photo_likes_new" USING btree ("photo_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_likes_new_user_id_idx" ON "photo_likes_new" USING btree ("user_id");
--> statement-breakpoint

-- Add indexes for photos
CREATE INDEX IF NOT EXISTS "photos_user_id_idx" ON "photos" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "photos_shares_count_idx" ON "photos" USING btree ("shares_count");
--> statement-breakpoint

-- Add foreign key for user_id on photos (after ensuring data integrity)
-- ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;